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
        ]))
    }

    /// Store chunks with their embeddings
    pub async fn store_chunks(
        &self,
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

        let table_name = format!("atlas_{}", vector_length);

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
        let table_name = format!("atlas_{}", vector_length);

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

        let results = table
            .vector_search(query_embedding)
            .map_err(|e| format!("Vector search error: {}", e))?
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
            if table_name.starts_with("atlas_") {
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
            if table_name.starts_with("atlas_") {
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
            if table_name.starts_with("atlas_") {
                db.drop_table(&table_name)
                    .await
                    .map_err(|e| format!("Drop table error: {}", e))?;
            }
        }

        Ok(())
    }
}
