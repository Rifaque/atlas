use lancedb::connect;
use lancedb::query::{ExecutableQuery, QueryBase};
use arrow_array::{
    Array, Float32Array, Int32Array, RecordBatch, RecordBatchIterator, StringArray,
    FixedSizeListArray,
};
use arrow_schema::{DataType, Field, Schema};
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

    fn edges_schema() -> Arc<Schema> {
        Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("fromName", DataType::Utf8, false),
            Field::new("toName", DataType::Utf8, false),
            Field::new("kind", DataType::Utf8, false),
            Field::new("workspaceId", DataType::Utf8, false),
        ]))
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
            metadatas.iter().map(|m| m.file_path.clone()).collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let chunk_idx_array = Arc::new(Int32Array::from(
            metadatas.iter().map(|m| m.chunk_index).collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let lr_start_array = Arc::new(Int32Array::from(
            metadatas.iter().map(|m| m.line_range_start).collect::<Vec<_>>(),
        )) as Arc<dyn Array>;
        let lr_end_array = Arc::new(Int32Array::from(
            metadatas.iter().map(|m| m.line_range_end).collect::<Vec<_>>(),
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
        let ws_id_array = Arc::new(StringArray::from(
            vec![workspace_id; metadatas.len()]
        )) as Arc<dyn Array>;

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

        let table_name = format!("atlas_v2_{}", vector_length);

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

    /// Store semantic relationships between entities
    pub async fn store_relationships(
        &self,
        workspace_id: String,
        relationships: Vec<crate::parser::SemanticRelationship>,
    ) -> Result<(), String> {
        if relationships.is_empty() {
            return Ok(());
        }

        let schema = Self::edges_schema();
        let db = connect(&self.db_path).execute().await.map_err(|e| e.to_string())?;

        let ids: Vec<String> = (0..relationships.len()).map(|_| uuid::Uuid::new_v4().to_string()).collect();
        let from_names: Vec<String> = relationships.iter().map(|r| r.from_name.clone()).collect();
        let to_names: Vec<String> = relationships.iter().map(|r| r.to_name.clone()).collect();
        let kinds: Vec<String> = relationships.iter().map(|r| r.kind.clone()).collect();
        let ws_ids: Vec<String> = vec![workspace_id; relationships.len()];

        let id_array = Arc::new(StringArray::from(ids)) as Arc<dyn Array>;
        let from_array = Arc::new(StringArray::from(from_names)) as Arc<dyn Array>;
        let to_array = Arc::new(StringArray::from(to_names)) as Arc<dyn Array>;
        let kind_array = Arc::new(StringArray::from(kinds)) as Arc<dyn Array>;
        let ws_array = Arc::new(StringArray::from(ws_ids)) as Arc<dyn Array>;

        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![id_array, from_array, to_array, kind_array, ws_array],
        ).map_err(|e| e.to_string())?;

        let batches = RecordBatchIterator::new(vec![Ok(batch)], schema.clone());
        let table_names = db.table_names().execute().await.map_err(|e| e.to_string())?;

        if table_names.contains(&"atlas_v2_edges".to_string()) {
            let table = db.open_table("atlas_v2_edges").execute().await.map_err(|e| e.to_string())?;
            table.add(batches).execute().await.map_err(|e| e.to_string())?;
        } else {
            db.create_table("atlas_v2_edges", batches)
                .execute()
                .await
                .map_err(|e| e.to_string())?;
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
        let table_name = format!("atlas_v2_{}", vector_length);

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

        let mut query = table.vector_search(query_embedding).map_err(|e| e.to_string())?;
        
        if let Some(ids) = workspace_ids {
            if !ids.is_empty() {
                let filter = ids.iter()
                    .map(|id| format!("`workspaceId` = '{}'", id.replace('\'', "''")))
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
            let id_col = batch.column_by_name("id")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let doc_col = batch.column_by_name("document")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let dist_col = batch.column_by_name("_distance")
                .and_then(|c| c.as_any().downcast_ref::<Float32Array>());
            let fp_col = batch.column_by_name("filePath")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let ci_col = batch.column_by_name("chunkIndex")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let ls_col = batch.column_by_name("lineRangeStart")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let le_col = batch.column_by_name("lineRangeEnd")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let pt_col = batch.column_by_name("parentText")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let pls_col = batch.column_by_name("parentLineRangeStart")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let ple_col = batch.column_by_name("parentLineRangeEnd")
                .and_then(|c| c.as_any().downcast_ref::<Int32Array>());

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

    /// Extract keywords from a query string for exact matching
    fn extract_keywords(query: &str) -> Vec<String> {
        let stop_words = vec![
            "what", "where", "when", "why", "how", "who", "which",
            "this", "that", "these", "those", "from", "with", "about",
            "the", "and", "but", "for", "nor", "yet", "has", "have",
            "function", "class", "method", "variable", "code", "file",
            "does", "doing", "find", "search", "show", "tell", "explain"
        ];
        
        query.split(|c: char| c.is_ascii_punctuation() || c.is_whitespace())
            .filter(|s| {
                let s_lower = s.to_lowercase();
                s.len() > 3 // only significant words
                && !stop_words.contains(&s_lower.as_str())
            })
            .map(|s| s.to_string())
            .collect()
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
            let id_col = batch.column_by_name("id")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let doc_col = batch.column_by_name("document")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>());
            // For exact matches, we artificially assign a perfect distance of 0.0
            let dist_col = if is_exact_match {
                None
            } else {
                batch.column_by_name("_distance")
                    .and_then(|c| c.as_any().downcast_ref::<Float32Array>())
            };
            
            let fp_col = batch.column_by_name("filePath").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let ci_col = batch.column_by_name("chunkIndex").and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let ls_col = batch.column_by_name("lineRangeStart").and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let le_col = batch.column_by_name("lineRangeEnd").and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let pt_col = batch.column_by_name("parentText").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let pls_col = batch.column_by_name("parentLineRangeStart").and_then(|c| c.as_any().downcast_ref::<Int32Array>());
            let ple_col = batch.column_by_name("parentLineRangeEnd").and_then(|c| c.as_any().downcast_ref::<Int32Array>());

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
                }));
            }
        }
        
        Ok((ids, distances, documents, metadatas))
    }

    pub async fn hybrid_search(
        &self,
        query_embedding: Vec<f32>,
        query_text: &str,
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
        let table_name = format!("atlas_v2_{}", vector_length);

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

        // 1. DENSE VECTOR SEARCH
        let mut sim_query = table.vector_search(query_embedding).map_err(|e| e.to_string())?;
        
        if let Some(ref ids) = workspace_ids {
            if !ids.is_empty() {
                let filter = ids.iter()
                    .map(|id| format!("`workspaceId` = '{}'", id.replace('\'', "''")))
                    .collect::<Vec<_>>()
                    .join(" OR ");
                sim_query = sim_query.only_if(filter);
            }
        }

        let sim_results = sim_query
            .limit(n_results)
            .execute()
            .await
            .map_err(|e| format!("Search execute error: {}", e))?;

        let (mut final_ids, mut final_dists, mut final_docs, mut final_metas) = 
            Self::process_batches(sim_results, false).await?;

        // 2. EXACT KEYWORD SEARCH (ILIKE Fallback)
        // Truncate query text to avoid massive filter strings (e.g. from timeline reports)
        let capped_query = if query_text.len() > 1000 { &query_text[..1000] } else { query_text };
        let mut keywords = Self::extract_keywords(capped_query);
        keywords.truncate(20); // Limit to top 20 keywords to prevent stack overflow in filter logic

        if !keywords.is_empty() {
            let filter_parts: Vec<_> = keywords.iter()
                .map(|k| format!("`text` ILIKE '%{}%'", k.replace('\'', "''")))
                .collect();

            let filter_query = if let Some(ref ids) = workspace_ids {
                if !ids.is_empty() {
                    let ws_filter = ids.iter()
                        .map(|id| format!("`workspaceId` = '{}'", id.replace('\'', "''")))
                        .collect::<Vec<_>>()
                        .join(" OR ");
                    format!("({}) AND ({})", ws_filter, filter_parts.join(" OR "))
                } else {
                    filter_parts.join(" OR ")
                }
            } else {
                filter_parts.join(" OR ")
            };

            let exact_results = table
                .query()
                .only_if(filter_query)
                .limit(n_results)
                .execute()
                .await;

            if let Ok(results) = exact_results {
                let (exact_ids, exact_dists, exact_docs, exact_metas) = 
                    Self::process_batches(results, true).await?;
                
                // Merge, prioritizing exact matches, and deduplicate
                let mut seen_ids = std::collections::HashSet::new();
                
                let mut merged_ids = Vec::new();
                let mut merged_dists = Vec::new();
                let mut merged_docs = Vec::new();
                let mut merged_metas = Vec::new();

                // Add exact matches first
                for i in 0..exact_ids.len() {
                    if !seen_ids.contains(&exact_ids[i]) {
                        seen_ids.insert(exact_ids[i].clone());
                        merged_ids.push(exact_ids[i].clone());
                        merged_dists.push(exact_dists[i]);
                        merged_docs.push(exact_docs[i].clone());
                        merged_metas.push(exact_metas[i].clone());
                    }
                }

                // Append semantic matches
                for i in 0..final_ids.len() {
                    if !seen_ids.contains(&final_ids[i]) {
                        seen_ids.insert(final_ids[i].clone());
                        merged_ids.push(final_ids[i].clone());
                        merged_dists.push(final_dists[i]);
                        merged_docs.push(final_docs[i].clone());
                        merged_metas.push(final_metas[i].clone());
                    }
                }

                // Truncate to requested limit
                merged_ids.truncate(n_results);
                merged_dists.truncate(n_results);
                merged_docs.truncate(n_results);
                merged_metas.truncate(n_results);

                final_ids = merged_ids;
                final_dists = merged_dists;
                final_docs = merged_docs;
                final_metas = merged_metas;
            }
        }

        Ok(serde_json::json!({
            "ids": [final_ids],
            "distances": [final_dists],
            "documents": [final_docs],
            "metadatas": [final_metas],
        }))
    }

    /// Delete all chunks for a given file path
    pub async fn delete_by_filepath(&self, file_path: &str) -> Result<(), String> {
        let db = connect(&self.db_path)
            .execute()
            .await
            .map_err(|e| format!("LanceDB connect error: {}", e))?;

        let table_names = db
            .table_names()
            .execute()
            .await
            .unwrap_or_default();
        let filter = format!("`filePath` = '{}'", file_path.replace('\'', "''"));

        for table_name in table_names {
            if table_name.starts_with("atlas_v2_") {
                let table = db
                    .open_table(&table_name)
                    .execute()
                    .await
                    .map_err(|e| format!("Open table error: {}", e))?;

                table
                    .delete(&filter)
                    .await
                    .map_err(|e| format!("Delete error: {}", e))?;
            }
        }

        Ok(())
    }

    /// Count total indexed chunks
    pub async fn count(&self) -> Result<usize, String> {
        let db = connect(&self.db_path)
            .execute()
            .await
            .map_err(|e| format!("LanceDB connect error: {}", e))?;

        let table_names = db
            .table_names()
            .execute()
            .await
            .unwrap_or_default();

        let mut total = 0;
        for table_name in table_names {
            if table_name.starts_with("atlas_v2_") {
                let table = db
                    .open_table(&table_name)
                    .execute()
                    .await
                    .map_err(|e| format!("Open table error: {}", e))?;

                let count = table
                    .count_rows(None)
                    .await
                    .map_err(|e| format!("Count error: {}", e))?;
                total += count;
            }
        }

        Ok(total)
    }

    /// Get graph data (nodes and edges) for a workspace
    pub async fn get_graph_data(&self, workspace_id: &str) -> Result<serde_json::Value, String> {
        let db = connect(&self.db_path).execute().await.map_err(|e| e.to_string())?;
        
        // 1. Get Edges
        let mut edges = Vec::new();
        if db.table_names().execute().await.unwrap_or_default().contains(&"atlas_v2_edges".to_string()) {
            let table = db.open_table("atlas_v2_edges").execute().await.map_err(|e| e.to_string())?;
            let filter = format!("`workspaceId` = '{}'", workspace_id.replace('\'', "''"));
            let results = table.query().only_if(filter).execute().await.map_err(|e| e.to_string())?;
            let batches: Vec<RecordBatch> = futures::TryStreamExt::try_collect(results).await.map_err(|e| e.to_string())?;
            
            for batch in batches {
                let from_col = batch.column_by_name("fromName").and_then(|c| c.as_any().downcast_ref::<StringArray>());
                let to_col = batch.column_by_name("toName").and_then(|c| c.as_any().downcast_ref::<StringArray>());
                let kind_col = batch.column_by_name("kind").and_then(|c| c.as_any().downcast_ref::<StringArray>());
                
                for i in 0..batch.num_rows() {
                    edges.push(serde_json::json!({
                        "from": from_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                        "to": to_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                        "kind": kind_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                    }));
                }
            }
        }

        // 2. Get Nodes (from chunks that have names)
        let mut nodes = std::collections::HashMap::new();
        let table_names = db.table_names().execute().await.unwrap_or_default();
        for tn in table_names {
            if tn.starts_with("atlas_v2_") && tn != "atlas_v2_edges" {
                let table = db.open_table(&tn).execute().await.map_err(|e| e.to_string())?;
                let filter = format!("`workspaceId` = '{}' AND `name` != ''", workspace_id.replace('\'', "''"));
                let results = table.query().only_if(filter).execute().await.map_err(|e| e.to_string())?;
                let batches: Vec<RecordBatch> = futures::TryStreamExt::try_collect(results).await.map_err(|e| e.to_string())?;
                
                for batch in batches {
                    let name_col = batch.column_by_name("name").and_then(|c| c.as_any().downcast_ref::<StringArray>());
                    let kind_col = batch.column_by_name("kind").and_then(|c| c.as_any().downcast_ref::<StringArray>());
                    let fp_col = batch.column_by_name("filePath").and_then(|c| c.as_any().downcast_ref::<StringArray>());
                    
                    for i in 0..batch.num_rows() {
                        let name = name_col.map(|c| c.value(i).to_string()).unwrap_or_default();
                        nodes.insert(name.clone(), serde_json::json!({
                            "id": name,
                            "kind": kind_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                            "filePath": fp_col.map(|c| c.value(i).to_string()).unwrap_or_default(),
                        }));
                    }
                }
            }
        }

        Ok(serde_json::json!({
            "nodes": nodes.values().collect::<Vec<_>>(),
            "edges": edges,
        }))
    }

    /// Drop the table (reset)
    #[allow(dead_code)]
    pub async fn reset(&self) -> Result<(), String> {
        let db = connect(&self.db_path)
            .execute()
            .await
            .map_err(|e| format!("LanceDB connect error: {}", e))?;

        let table_names = db
            .table_names()
            .execute()
            .await
            .unwrap_or_default();

        for table_name in table_names {
            if table_name.starts_with("atlas_v2_") {
                db.drop_table(&table_name)
                    .await
                    .map_err(|e| format!("Drop table error: {}", e))?;
            }
        }

        Ok(())
    }
}
