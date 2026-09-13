use arrow_array::{
    Array, FixedSizeListArray, Float32Array, Int32Array, RecordBatch, RecordBatchIterator,
    StringArray,
};
use arrow_schema::{DataType, Field, Schema};
use lancedb::connect;
use lancedb::query::{ExecutableQuery, QueryBase};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;

// const TABLE_NAME: &str = "atlas_workspace";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredChunkMetadata {
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "chunkIndex")]
    pub chunk_index: i32,
    #[serde(rename = "lineRangeStart")]
    pub line_range_start: i32,
    #[serde(rename = "lineRangeEnd")]
    pub line_range_end: i32,
    #[serde(rename = "parentText")]
    pub parent_text: Option<String>,
    #[serde(rename = "parentLineRangeStart")]
    pub parent_line_range_start: Option<i32>,
    #[serde(rename = "parentLineRangeEnd")]
    pub parent_line_range_end: Option<i32>,
    pub kind: Option<String>,
    pub name: Option<String>,
}

pub struct AtlasVectorStore {
    db_path: String,
}

/// Result of checking the generated Lance table used for one embedding shape.
/// A table is shared by workspaces that use the same vector dimension, so a
/// repair must be deliberately scoped to that table and accompanied by
/// manifest invalidation in the caller.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TablePreparation {
    Ready,
    Missing,
    Rebuilt,
}

pub const DAMAGED_LOCAL_INDEX_MESSAGE: &str =
    "Atlas detected a damaged local index and needs to rebuild it.";

impl AtlasVectorStore {
    pub fn new(db_path: Option<String>) -> Self {
        let path = db_path.unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".atlas")
                .join("lancedb")
                .to_string_lossy()
                .to_string()
        });
        std::fs::create_dir_all(&path).ok();
        Self { db_path: path }
    }

    fn schema(vector_length: i32) -> Arc<Schema> {
        Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new(
                "vector",
                DataType::FixedSizeList(
                    Arc::new(Field::new("item", DataType::Float32, true)),
                    vector_length,
                ),
                false,
            ),
            Field::new("document", DataType::Utf8, false),
            Field::new("filePath", DataType::Utf8, false),
            Field::new("chunkIndex", DataType::Int32, false),
            Field::new("lineRangeStart", DataType::Int32, false),
            Field::new("lineRangeEnd", DataType::Int32, false),
            Field::new("parentText", DataType::Utf8, false),
            Field::new("parentLineRangeStart", DataType::Int32, false),
            Field::new("parentLineRangeEnd", DataType::Int32, false),
            Field::new("kind", DataType::Utf8, true),
            Field::new("name", DataType::Utf8, true),
            Field::new("workspaceId", DataType::Utf8, false),
        ]))
    }

    pub fn table_name(vector_length: usize) -> String {
        format!("atlas_v2_{vector_length}")
    }

    /// A narrowly-scoped classifier for generated Lance table damage.  It is
    /// intentionally not used for permission, storage-space, or arbitrary I/O
    /// failures: those must remain actionable errors rather than trigger a
    /// destructive recovery attempt.
    pub fn is_recoverable_table_error(error: &str) -> bool {
        let error = error.to_ascii_lowercase();
        let looks_like_lance = error.contains("lance") || error.contains("dataset scanner");
        let damaged_data = [
            "not found",
            "no such file",
            "missing fragment",
            "missing data",
            "corrupt",
            "invalid manifest",
            "invalid data",
        ]
        .iter()
        .any(|needle| error.contains(needle));
        looks_like_lance && damaged_data
    }

    async fn read_table_probe(&self, vector_length: usize) -> Result<bool, String> {
        let db = connect(&self.db_path)
            .execute()
            .await
            .map_err(|e| format!("LanceDB connect error: {e}"))?;
        let table_name = Self::table_name(vector_length);
        let table_names = db
            .table_names()
            .execute()
            .await
            .map_err(|e| format!("Failed to list local index tables: {e}"))?;
        if !table_names.contains(&table_name) {
            return Ok(false);
        }
        let table = db
            .open_table(&table_name)
            .execute()
            .await
            .map_err(|e| format!("Failed to open local index table {table_name}: {e}"))?;
        let results = table
            .query()
            .limit(1)
            .execute()
            .await
            .map_err(|e| format!("Failed to scan local index table {table_name}: {e}"))?;
        // Opening a table only reads metadata.  Consume a bounded result so a
        // missing Lance fragment is detected before indexing modifies state.
        let _: Vec<RecordBatch> = futures::TryStreamExt::try_collect(results)
            .await
            .map_err(|e| format!("Failed to read local index table {table_name}: {e}"))?;
        Ok(true)
    }

    /// Check an existing generated table without changing it.  Health checks
    /// use this so a manifest alone can never advertise a damaged table as
    /// ready.
    pub async fn check_table_readable(&self, vector_length: usize) -> Result<(), String> {
        match self.read_table_probe(vector_length).await? {
            true => Ok(()),
            false => Err(format!(
                "Local index table {} is missing",
                Self::table_name(vector_length)
            )),
        }
    }

    /// Verify the one table needed for an index operation.  If its on-disk
    /// generated data is structurally missing/corrupt, drop only that table so
    /// the caller can invalidate manifests and rebuild it.  We do not recover
    /// arbitrary I/O failures such as permissions or disk-full errors.
    pub async fn prepare_table_for_index(
        &self,
        vector_length: usize,
    ) -> Result<TablePreparation, String> {
        match self.read_table_probe(vector_length).await {
            Ok(true) => Ok(TablePreparation::Ready),
            Ok(false) => Ok(TablePreparation::Missing),
            Err(error) if Self::is_recoverable_table_error(&error) => {
                let table_name = Self::table_name(vector_length);
                log::warn!(
                    "[indexer] damaged generated Lance table {table_name} detected; rebuilding only that table: {error}"
                );
                let db = connect(&self.db_path)
                    .execute()
                    .await
                    .map_err(|e| format!("LanceDB connect error during index recovery: {e}"))?;
                db.drop_table(&table_name).await.map_err(|e| {
                    format!(
                        "{DAMAGED_LOCAL_INDEX_MESSAGE} Atlas could not remove the damaged generated table {table_name}: {e}"
                    )
                })?;
                Ok(TablePreparation::Rebuilt)
            }
            Err(error) => Err(error),
        }
    }

    /// Store chunks with their embeddings
    pub async fn store_chunks(
        &self,
        workspace_id: String,
        ids: Vec<String>,
        embeddings: Vec<Vec<f32>>,
        metadatas: Vec<StoredChunkMetadata>,
        documents: Vec<String>,
    ) -> Result<(), String> {
        if ids.is_empty() {
            return Ok(());
        }

        let vector_length = embeddings.first().map(|e| e.len() as i32).unwrap_or(768);
        let schema = Self::schema(vector_length);

        let db = connect(&self.db_path)
            .execute()
            .await
            .map_err(|e| format!("LanceDB connect error: {}", e))?;

        // Build arrow arrays
        let id_array = Arc::new(StringArray::from(ids)) as Arc<dyn Array>;
        let doc_array = Arc::new(StringArray::from(documents)) as Arc<dyn Array>;
        let file_path_array = Arc::new(StringArray::from(
            metadatas
                .iter()
                .map(|m| m.file_path.clone())
                .collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let chunk_idx_array = Arc::new(Int32Array::from(
            metadatas.iter().map(|m| m.chunk_index).collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let lr_start_array = Arc::new(Int32Array::from(
            metadatas
                .iter()
                .map(|m| m.line_range_start)
                .collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let lr_end_array = Arc::new(Int32Array::from(
            metadatas
                .iter()
                .map(|m| m.line_range_end)
                .collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let parent_text_array = Arc::new(StringArray::from(
            metadatas
                .iter()
                .map(|m| m.parent_text.clone().unwrap_or_default())
                .collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let plr_start_array = Arc::new(Int32Array::from(
            metadatas
                .iter()
                .map(|m| m.parent_line_range_start.unwrap_or(m.line_range_start))
                .collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let plr_end_array = Arc::new(Int32Array::from(
            metadatas
                .iter()
                .map(|m| m.parent_line_range_end.unwrap_or(m.line_range_end))
                .collect::<Vec<_>>(),
        )) as Arc<dyn Array>;

        let kind_array = Arc::new(StringArray::from(
            metadatas
                .iter()
                .map(|m| m.kind.clone().unwrap_or_default())
                .collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let name_array = Arc::new(StringArray::from(
            metadatas
                .iter()
                .map(|m| m.name.clone().unwrap_or_default())
                .collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let ws_id_array =
            Arc::new(StringArray::from(vec![workspace_id; metadatas.len()])) as Arc<dyn Array>;

        // Build vector array (FixedSizeList of Float32)
        let flat_values: Vec<f32> = embeddings.iter().flatten().copied().collect();
        let values_array = Float32Array::from(flat_values);
        let vector_array = Arc::new(
            FixedSizeListArray::try_new(
                Arc::new(Field::new("item", DataType::Float32, true)),
                vector_length,
                Arc::new(values_array),
                None,
            )
            .map_err(|e| format!("Failed to build vector array: {}", e))?,
        ) as Arc<dyn Array>;

        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![
                id_array,
                vector_array,
                doc_array,
                file_path_array,
                chunk_idx_array,
                lr_start_array,
                lr_end_array,
                parent_text_array,
                plr_start_array,
                plr_end_array,
                kind_array,
                name_array,
                ws_id_array,
            ],
        )
        .map_err(|e| format!("Failed to create record batch: {}", e))?;

        let batches = RecordBatchIterator::new(vec![Ok(batch)], schema.clone());

        // Open or create table
        let table_names = db
            .table_names()
            .execute()
            .await
            .map_err(|e| format!("Failed to list tables: {}", e))?;

        let table_name = Self::table_name(vector_length as usize);

        if table_names.contains(&table_name) {
            let table = db
                .open_table(&table_name)
                .execute()
                .await
                .map_err(|e| format!("Failed to open table: {}", e))?;
            table
                .add(batches)
                .execute()
                .await
                .map_err(|e| format!("Failed to add data: {}", e))?;
        } else {
            db.create_table(&table_name, batches)
                .execute()
                .await
                .map_err(|e| format!("Failed to create table: {}", e))?;
        }

        Ok(())
    }

    /// Search for similar vectors
    pub async fn similarity_search(
        &self,
        query_embedding: Vec<f32>,
        n_results: usize,
        workspace_ids: Option<Vec<String>>,
    ) -> Result<serde_json::Value, String> {
        let db = connect(&self.db_path)
            .execute()
            .await
            .map_err(|e| format!("LanceDB connect error: {}", e))?;

        let table_names = db
            .table_names()
            .execute()
            .await
            .map_err(|e| format!("Table names error: {}", e))?;

        let vector_length = query_embedding.len();
        let table_name = Self::table_name(vector_length);

        if !table_names.contains(&table_name) {
            return Ok(serde_json::json!({
                "ids": [[]], "distances": [[]], "documents": [[]], "metadatas": [[]]
            }));
        }

        let table = db
            .open_table(&table_name)
            .execute()
            .await
            .map_err(|e| format!("Open table error: {}", e))?;

        let mut query = table
            .vector_search(query_embedding)
            .map_err(|e| e.to_string())?;

        if let Some(ids) = workspace_ids {
            if !ids.is_empty() {
                let filter = ids
                    .iter()
                    .map(|id| format!("`workspaceId` = '{}'", Self::escape_filter_string(id)))
                    .collect::<Vec<_>>()
                    .join(" OR ");
                query = query.only_if(filter);
            }
        }

        let results = query
            .limit(n_results)
            .execute()
            .await
            .map_err(|e| format!("Search execute error: {}", e))?;

        let batches: Vec<RecordBatch> = futures::TryStreamExt::try_collect(results)
            .await
            .map_err(|e| format!("Collect error: {}", e))?;

        let mut ids = Vec::new();
        let mut distances = Vec::new();
        let mut documents = Vec::new();
        let mut metadatas = Vec::new();

        for batch in &batches {
            let id_col = batch
                .column_by_name("id")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let doc_col = batch
                .column_by_name("document")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let dist_col = batch
                .column_by_name("_distance")
                .and_then(|c| c.as_any().downcast_ref::<Float32Array>());
            let fp_col = batch
                .column_by_name("filePath")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let ci_col = batch
                .column_by_name("chunkIndex")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let ls_col = batch
                .column_by_name("lineRangeStart")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let le_col = batch
                .column_by_name("lineRangeEnd")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let pt_col = batch
                .column_by_name("parentText")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let pls_col = batch
                .column_by_name("parentLineRangeStart")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let ple_col = batch
                .column_by_name("parentLineRangeEnd")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let kind_col = batch
                .column_by_name("kind")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let name_col = batch
                .column_by_name("name")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());

            let num_rows = batch.num_rows();
            for i in 0..num_rows {
                ids.push(id_col.map(|c| c.value(i).to_string()).unwrap_or_default());
                distances.push(dist_col.map(|c| c.value(i)).unwrap_or(0.0));
                documents.push(doc_col.map(|c| c.value(i).to_string()).unwrap_or_default());
                metadatas.push(serde_json::json!({
                    "filePath": fp_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                    "chunkIndex": ci_col.map(|c| c.value(i)).unwrap_or(0),
                    "lineRangeStart": ls_col.map(|c| c.value(i)).unwrap_or(0),
                    "lineRangeEnd": le_col.map(|c| c.value(i)).unwrap_or(0),
                    "parentText": pt_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                    "parentLineRangeStart": pls_col.map(|c| c.value(i)).unwrap_or(0),
                    "parentLineRangeEnd": ple_col.map(|c| c.value(i)).unwrap_or(0),
                    "kind": kind_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                    "name": name_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                }));
            }
        }

        Ok(serde_json::json!({
            "ids": [ids],
            "distances": [distances],
            "documents": [documents],
            "metadatas": [metadatas],
        }))
    }

    /// Escape string delimiters for LanceDB's SQL-like expression parser.
    /// Backslashes are literal in DataFusion string values; doubling Windows
    /// separators makes canonical workspace filters fail to match stored rows.
    fn escape_filter_string(s: &str) -> String {
        s.replace('\'', "''")
    }

    /// Helper to process a RecordBatch stream into vectors
    async fn process_batches(
        results: impl futures::Stream<Item = Result<RecordBatch, lancedb::error::Error>> + Unpin,
        is_exact_match: bool,
    ) -> Result<(Vec<String>, Vec<f32>, Vec<String>, Vec<serde_json::Value>), String> {
        let batches: Vec<RecordBatch> = futures::TryStreamExt::try_collect(results)
            .await
            .map_err(|e| format!("Collect error: {}", e))?;

        let mut ids = Vec::new();
        let mut distances = Vec::new();
        let mut documents = Vec::new();
        let mut metadatas = Vec::new();

        for batch in &batches {
            let id_col = batch
                .column_by_name("id")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let doc_col = batch
                .column_by_name("document")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            // For exact matches, we artificially assign a perfect distance of 0.0
            let dist_col = if is_exact_match {
                None
            } else {
                batch
                    .column_by_name("_distance")
                    .and_then(|c| c.as_any().downcast_ref::<Float32Array>())
            };

            let fp_col = batch
                .column_by_name("filePath")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let ci_col = batch
                .column_by_name("chunkIndex")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let ls_col = batch
                .column_by_name("lineRangeStart")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let le_col = batch
                .column_by_name("lineRangeEnd")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let pt_col = batch
                .column_by_name("parentText")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let pls_col = batch
                .column_by_name("parentLineRangeStart")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let ple_col = batch
                .column_by_name("parentLineRangeEnd")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let kind_col = batch
                .column_by_name("kind")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let name_col = batch
                .column_by_name("name")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());

            let num_rows = batch.num_rows();
            for i in 0..num_rows {
                ids.push(id_col.map(|c| c.value(i).to_string()).unwrap_or_default());
                distances.push(dist_col.map(|c| c.value(i)).unwrap_or(0.0));
                documents.push(doc_col.map(|c| c.value(i).to_string()).unwrap_or_default());
                metadatas.push(serde_json::json!({
                    "filePath": fp_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                    "chunkIndex": ci_col.map(|c| c.value(i)).unwrap_or(0),
                    "lineRangeStart": ls_col.map(|c| c.value(i)).unwrap_or(0),
                    "lineRangeEnd": le_col.map(|c| c.value(i)).unwrap_or(0),
                    "parentText": pt_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                    "parentLineRangeStart": pls_col.map(|c| c.value(i)).unwrap_or(0),
                    "parentLineRangeEnd": ple_col.map(|c| c.value(i)).unwrap_or(0),
                    "kind": kind_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                    "name": name_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                }));
            }
        }

        Ok((ids, distances, documents, metadatas))
    }

    /// BM25-ranked lexical candidates and vector candidates fused by rank.
    /// Both paths read the same committed Lance rows, so incremental updates
    /// cannot leave a second lexical index out of sync.
    pub async fn quality_search(
        &self,
        query_embedding: Vec<f32>,
        query_text: &str,
        n_results: usize,
        workspace_id: &str,
    ) -> Result<serde_json::Value, String> {
        use crate::retrieval_quality::{
            bm25_rank, classify_relevance, reciprocal_rank_fusion, short_query_direct_matches,
            suppress_overlap, EvalDocument, RankedCandidate, RelevanceLevel, CANDIDATE_LIMIT,
        };

        let semantic_json = self
            .similarity_search(
                query_embedding.clone(),
                CANDIDATE_LIMIT,
                Some(vec![workspace_id.to_string()]),
            )
            .await?;
        let row = |value: &serde_json::Value, name: &str| {
            value
                .get(name)
                .and_then(|field| field.get(0))
                .and_then(serde_json::Value::as_array)
                .cloned()
                .unwrap_or_default()
        };
        let ids = row(&semantic_json, "ids");
        let distances = row(&semantic_json, "distances");
        let documents = row(&semantic_json, "documents");
        let metadatas = row(&semantic_json, "metadatas");
        let semantic: Vec<_> = ids
            .iter()
            .enumerate()
            .filter_map(|(index, id)| {
                let metadata = metadatas.get(index)?;
                Some(RankedCandidate {
                    id: id.as_str()?.to_string(),
                    file_path: metadata.get("filePath")?.as_str()?.to_string(),
                    line_start: metadata.get("lineRangeStart")?.as_i64()?,
                    line_end: metadata.get("lineRangeEnd")?.as_i64()?,
                    text: documents.get(index)?.as_str()?.to_string(),
                    kind: metadata
                        .get("kind")
                        .and_then(|value| value.as_str())
                        .map(str::to_string),
                    name: metadata
                        .get("name")
                        .and_then(|value| value.as_str())
                        .map(str::to_string),
                    semantic_distance: distances.get(index)?.as_f64().map(|value| value as f32),
                    lexical_score: 0.0,
                    lexical_match_count: 0,
                    exact_structural_match: false,
                    fused_score: 0.0,
                })
            })
            .collect();

        let db = connect(&self.db_path)
            .execute()
            .await
            .map_err(|error| error.to_string())?;
        let table_name = format!("atlas_v2_{}", query_embedding.len());
        if !db
            .table_names()
            .execute()
            .await
            .map_err(|error| error.to_string())?
            .contains(&table_name)
        {
            return Ok(Self::empty_search_result());
        }
        let table = db
            .open_table(&table_name)
            .execute()
            .await
            .map_err(|error| error.to_string())?;
        let filter = format!(
            "`workspaceId` = '{}'",
            Self::escape_filter_string(workspace_id)
        );
        let rows = table
            .query()
            .only_if(filter)
            .limit(20_000)
            .execute()
            .await
            .map_err(|error| format!("Lexical candidate scan failed: {error}"))?;
        let (lexical_ids, _, lexical_texts, lexical_metadata) =
            Self::process_batches(rows, true).await?;
        let lexical_documents: Vec<_> = lexical_ids
            .iter()
            .enumerate()
            .filter_map(|(index, id)| {
                let metadata = lexical_metadata.get(index)?;
                Some(EvalDocument {
                    id: id.clone(),
                    file_path: metadata.get("filePath")?.as_str()?.to_string(),
                    line_start: metadata.get("lineRangeStart")?.as_i64()?,
                    line_end: metadata.get("lineRangeEnd")?.as_i64()?,
                    kind: metadata
                        .get("kind")
                        .and_then(|value| value.as_str())
                        .map(str::to_string),
                    name: metadata
                        .get("name")
                        .and_then(|value| value.as_str())
                        .map(str::to_string),
                    text: lexical_texts.get(index)?.clone(),
                })
            })
            .collect();
        let lexical = bm25_rank(query_text, &lexical_documents, CANDIDATE_LIMIT);
        let fused = suppress_overlap(
            reciprocal_rank_fusion(&semantic, &lexical, CANDIDATE_LIMIT),
            n_results,
        );
        let relevance = classify_relevance(&fused);
        let fallback = if relevance == RelevanceLevel::None {
            short_query_direct_matches(query_text, &fused)
        } else {
            Vec::new()
        };
        let (relevance, selected, direct_fallback) = if fallback.is_empty() {
            (relevance, fused, false)
        } else {
            // Find and Ask share this path.  The explicit flag lets Ask admit
            // only this bounded, path-backed evidence without relaxing its
            // normal treatment of every Weak retrieval result.
            (RelevanceLevel::Weak, fallback, true)
        };
        if relevance == RelevanceLevel::None {
            return Ok(Self::empty_search_result());
        }

        Ok(serde_json::json!({
            "ids": [selected.iter().map(|item| item.id.clone()).collect::<Vec<_>>()],
            "distances": [selected.iter().map(|item| item.semantic_distance.unwrap_or(f32::MAX)).collect::<Vec<_>>()],
            "documents": [selected.iter().map(|item| item.text.clone()).collect::<Vec<_>>()],
            "metadatas": [selected.iter().map(|item| serde_json::json!({
                "filePath": item.file_path,
                "lineRangeStart": item.line_start,
                "lineRangeEnd": item.line_end,
                "kind": item.kind,
                "name": item.name,
            })).collect::<Vec<_>>()],
            "relevance": relevance,
            "directFallback": direct_fallback,
        }))
    }

    fn empty_search_result() -> serde_json::Value {
        serde_json::json!({
            "ids": [[]], "distances": [[]], "documents": [[]], "metadatas": [[]],
            "relevance": "none"
        })
    }

    /// Delete all chunks for a given file path from the table used by the
    /// current embedding model.  Index tables are dimension-specific; scanning
    /// every table made a damaged, unrelated table block safe cleanup.
    pub async fn delete_by_filepath(
        &self,
        vector_length: usize,
        file_path: &str,
    ) -> Result<(), String> {
        self.delete_by_filepath_except(vector_length, file_path, &[])
            .await
    }

    /// Delete obsolete chunks while retaining a newly staged replacement set.
    pub async fn delete_by_filepath_except(
        &self,
        vector_length: usize,
        file_path: &str,
        retained_ids: &[String],
    ) -> Result<(), String> {
        let db = connect(&self.db_path)
            .execute()
            .await
            .map_err(|e| format!("LanceDB connect error: {}", e))?;

        let table_name = Self::table_name(vector_length);
        let table_names = db
            .table_names()
            .execute()
            .await
            .map_err(|e| format!("Failed to list local index tables: {e}"))?;
        if !table_names.contains(&table_name) {
            return Ok(());
        }
        let escaped_path = Self::escape_filter_string(file_path);
        let retained_filter = if retained_ids.is_empty() {
            String::new()
        } else {
            let ids = retained_ids
                .iter()
                .map(|id| format!("'{}'", Self::escape_filter_string(id)))
                .collect::<Vec<_>>()
                .join(", ");
            format!(" AND `id` NOT IN ({ids})")
        };
        let filter = format!("`filePath` = '{escaped_path}'{retained_filter}");

        let table = db
            .open_table(&table_name)
            .execute()
            .await
            .map_err(|e| format!("Open local index table {table_name} error: {e}"))?;
        table
            .delete(&filter)
            .await
            .map_err(|e| format!("Delete error in local index table {table_name}: {e}"))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{AtlasVectorStore, StoredChunkMetadata, TablePreparation};

    fn metadata(path: &str, name: &str) -> StoredChunkMetadata {
        StoredChunkMetadata {
            file_path: path.to_string(),
            chunk_index: 0,
            line_range_start: 1,
            line_range_end: 4,
            parent_text: None,
            parent_line_range_start: None,
            parent_line_range_end: None,
            kind: Some("function_item".into()),
            name: Some(name.into()),
        }
    }

    fn first_file_in(directory: &std::path::Path) -> Option<std::path::PathBuf> {
        for entry in std::fs::read_dir(directory).ok()? {
            let path = entry.ok()?.path();
            if path.is_file() {
                return Some(path);
            }
            if path.is_dir() {
                if let Some(file) = first_file_in(&path) {
                    return Some(file);
                }
            }
        }
        None
    }

    #[test]
    fn workspace_filter_preserves_windows_separators() {
        assert_eq!(
            AtlasVectorStore::escape_filter_string(r"\\?\C:\work\atlas"),
            r"\\?\C:\work\atlas"
        );
        assert_eq!(
            AtlasVectorStore::escape_filter_string("C:\\owner's\\atlas"),
            "C:\\owner''s\\atlas"
        );
    }

    #[tokio::test]
    async fn lexical_results_follow_committed_update_delete_and_rename() {
        let root = std::env::temp_dir().join(format!("atlas-retrieval-{}", uuid::Uuid::new_v4()));
        let store = AtlasVectorStore::new(Some(root.to_string_lossy().to_string()));
        let workspace = r"\\?\C:\fixture".to_string();
        let old_path = r"\\?\C:\fixture\src\workspace.rs";
        store
            .store_chunks(
                workspace.clone(),
                vec!["old".into(), "generic-tree".into()],
                vec![vec![1.0, 0.0], vec![0.0, 1.0]],
                vec![
                    metadata(old_path, "authorize_workspace"),
                    metadata(r"\\?\C:\fixture\src\FileTree.tsx", "FileTree"),
                ],
                vec![
                    "fn authorize_workspace() {}".into(),
                    "render tree nodes nodes nodes for the workspace file browser".into(),
                ],
            )
            .await
            .unwrap();
        let first = store
            .quality_search(vec![1.0, 0.0], "authorize_workspace", 5, &workspace)
            .await
            .unwrap();
        assert_eq!(first["ids"][0][0], "old");
        let unrelated = store
            .quality_search(vec![0.0, 1.0], "kubernetes scheduling", 5, &workspace)
            .await
            .unwrap();
        assert!(unrelated["ids"][0].as_array().unwrap().is_empty());
        let generic_term_collision = store
            .quality_search(
                vec![0.0, 1.0],
                "How does Kubernetes schedule pods across nodes?",
                5,
                &workspace,
            )
            .await
            .unwrap();
        assert!(generic_term_collision["ids"][0]
            .as_array()
            .unwrap()
            .is_empty());

        store.delete_by_filepath(2, old_path).await.unwrap();
        let new_path = r"\\?\C:\fixture\src\authorization.rs";
        store
            .store_chunks(
                workspace.clone(),
                vec!["new".into()],
                vec![vec![1.0, 0.0]],
                vec![metadata(new_path, "authorize_workspace")],
                vec!["fn authorize_workspace() { canonicalize(); }".into()],
            )
            .await
            .unwrap();
        let renamed = store
            .quality_search(vec![1.0, 0.0], "authorize_workspace", 5, &workspace)
            .await
            .unwrap();
        assert_eq!(renamed["ids"][0][0], "new");
        assert!(!renamed["ids"][0]
            .as_array()
            .unwrap()
            .iter()
            .any(|id| id == "old"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn canonical_windows_workspace_id_scopes_semantic_and_find_retrieval() {
        let root = std::env::temp_dir().join(format!(
            "atlas-windows-workspace-id-{}",
            uuid::Uuid::new_v4()
        ));
        let store = AtlasVectorStore::new(Some(root.to_string_lossy().to_string()));
        let canonical_workspace = r"\\?\C:\Users\rifaq\Documents\Projects\rifaque-portfolio";
        let plain_workspace = r"C:\Users\rifaq\Documents\Projects\rifaque-portfolio";

        store
            .store_chunks(
                canonical_workspace.into(),
                vec!["package".into()],
                vec![vec![1.0, 0.0]],
                vec![metadata(
                    r"\\?\C:\Users\rifaq\Documents\Projects\rifaque-portfolio\package.json",
                    "package",
                )],
                vec!["{ \"name\": \"rifaque-portfolio\" }".into()],
            )
            .await
            .unwrap();

        // This is the same workspace filter used by the semantic candidate
        // path.  Windows canonicalization preserves the verbatim-path prefix.
        let semantic = store
            .similarity_search(vec![1.0, 0.0], 10, Some(vec![canonical_workspace.into()]))
            .await
            .unwrap();
        assert_eq!(semantic["ids"][0][0], "package");

        // A non-canonical spelling must not become a second workspace scope.
        let plain = store
            .similarity_search(vec![1.0, 0.0], 10, Some(vec![plain_workspace.into()]))
            .await
            .unwrap();
        assert!(plain["ids"][0].as_array().unwrap().is_empty());

        // Ask and Find share quality_search.  An exact filename query has
        // structural lexical evidence and therefore remains available after
        // relevance classification as well as in the semantic candidate set.
        let results = store
            .quality_search(vec![1.0, 0.0], "package.json", 10, canonical_workspace)
            .await
            .unwrap();
        assert_eq!(results["relevance"], "strong");
        assert_eq!(results["ids"][0][0], "package");

        // One direct workspace token is intentionally not enough for the
        // general answerability classifier, but it is enough to expose this
        // bounded, path-backed source to Find and Ask.
        let short_query = store
            .quality_search(vec![1.0, 0.0], "portfolio", 10, canonical_workspace)
            .await
            .unwrap();
        assert_eq!(short_query["relevance"], "weak");
        assert_eq!(short_query["directFallback"], true);
        assert_eq!(short_query["ids"][0][0], "package");

        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn missing_fragment_rebuilds_only_the_damaged_generated_table() {
        let root =
            std::env::temp_dir().join(format!("atlas-lance-recovery-{}", uuid::Uuid::new_v4()));
        let source = root.join("workspace").join("source.rs");
        std::fs::create_dir_all(source.parent().unwrap()).unwrap();
        std::fs::write(&source, "fn authorization() { canonicalize(); }").unwrap();
        let store = AtlasVectorStore::new(Some(root.to_string_lossy().to_string()));
        store
            .store_chunks(
                "workspace-a".into(),
                vec!["a".into()],
                vec![vec![1.0, 0.0]],
                vec![metadata("workspace/source.rs", "authorization")],
                vec!["canonicalize authorized workspace root".into()],
            )
            .await
            .unwrap();
        let data_directory = root.join("atlas_v2_2.lance").join("data");
        let fragment = first_file_in(&data_directory).expect("test table has a data fragment");
        std::fs::remove_file(&fragment).unwrap();

        assert!(store.check_table_readable(2).await.is_err());
        assert_eq!(
            store.prepare_table_for_index(2).await.unwrap(),
            TablePreparation::Rebuilt
        );
        assert!(store.check_table_readable(2).await.is_err());
        assert_eq!(
            std::fs::read_to_string(&source).unwrap(),
            "fn authorization() { canonicalize(); }"
        );

        store
            .store_chunks(
                "workspace-a".into(),
                vec!["rebuilt".into()],
                vec![vec![1.0, 0.0]],
                vec![metadata("workspace/source.rs", "authorization")],
                vec!["canonicalize authorized workspace root".into()],
            )
            .await
            .unwrap();
        assert!(store.check_table_readable(2).await.is_ok());
        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn recovery_preserves_unrelated_dimension_table_and_workspace_rows() {
        let root =
            std::env::temp_dir().join(format!("atlas-lance-blast-radius-{}", uuid::Uuid::new_v4()));
        let store = AtlasVectorStore::new(Some(root.to_string_lossy().to_string()));
        store
            .store_chunks(
                "workspace-a".into(),
                vec!["a".into()],
                vec![vec![1.0, 0.0]],
                vec![metadata("a.rs", "a")],
                vec!["damaged table row".into()],
            )
            .await
            .unwrap();
        store
            .store_chunks(
                "workspace-b".into(),
                vec!["b".into()],
                vec![vec![1.0, 0.0, 0.0]],
                vec![metadata("b.rs", "authorization")],
                vec!["workspace b canonicalization remains available".into()],
            )
            .await
            .unwrap();
        let fragment = first_file_in(&root.join("atlas_v2_2.lance").join("data"))
            .expect("test table has a data fragment");
        std::fs::remove_file(fragment).unwrap();

        assert_eq!(
            store.prepare_table_for_index(2).await.unwrap(),
            TablePreparation::Rebuilt
        );
        let other = store
            .similarity_search(vec![1.0, 0.0, 0.0], 5, Some(vec!["workspace-b".into()]))
            .await
            .unwrap();
        assert_eq!(other["ids"][0][0], "b");
        let _ = std::fs::remove_dir_all(root);
    }
}
