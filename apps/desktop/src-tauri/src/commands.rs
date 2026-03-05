use crate::crawler;
use crate::embeddings;
use crate::llm;
use crate::manifest;
use crate::vectorstore::{AtlasVectorStore, StoredChunkMetadata};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use uuid::Uuid;
use futures::stream::StreamExt;

/// Shared application state
pub struct AppState {
    pub store: AtlasVectorStore,
    pub jobs: Mutex<HashMap<String, IndexingJob>>,
    pub query_cache: Mutex<lru::LruCache<String, Vec<f32>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingJob {
    pub id: String,
    pub folder_path: String,
    pub status: String, // "running", "completed", "failed"
    pub processed_files: usize,
    pub total_chunks: usize,
    pub error: Option<String>,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub file_path: String,
    pub relative_path: String,
    pub mtime: f64,
    pub change_type: String, // "modified" (can be extended to "created" if we track it)
}

// ─── Status & Models ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn check_status(ollama_host: Option<String>) -> Result<String, String> {
    let host = ollama_host.unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
    if llm::check_ollama_status(&host).await {
        Ok("online".to_string())
    } else {
        Ok("offline".to_string())
    }
}

#[tauri::command]
pub async fn list_models(ollama_host: Option<String>) -> Result<Vec<String>, String> {
    let host = ollama_host.unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
    llm::list_ollama_models(&host).await
}

#[tauri::command]
pub async fn list_openrouter_models(api_key: Option<String>) -> Result<serde_json::Value, String> {
    llm::list_openrouter_models(&api_key.unwrap_or_default()).await
}

// ─── Indexing ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_indexing(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    folder_path: String,
    model: String,
) -> Result<String, String> {
    let job_id = Uuid::new_v4().to_string();

    let job = IndexingJob {
        id: job_id.clone(),
        folder_path: folder_path.clone(),
        status: "running".to_string(),
        processed_files: 0,
        total_chunks: 0,
        error: None,
        model: model.clone(),
    };

    {
        let mut jobs = state.jobs.lock().await;
        jobs.insert(job_id.clone(), job);
    }

    let state = state.inner().clone();
    let jid = job_id.clone();

    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_indexing_job(&app, &state, &jid, &folder_path, &model).await {
            log::error!("[indexer] Job {} failed: {}", jid, e);
            let mut jobs = state.jobs.lock().await;
            if let Some(job) = jobs.get_mut(&jid) {
                job.status = "failed".to_string();
                job.error = Some(e.clone());
            }
            let _ = app.emit(
                &format!("index-progress-{}", jid),
                serde_json::json!({ "status": "failed", "error": e }),
            );
        }
    });

    Ok(job_id)
}

async fn run_indexing_job(
    app: &AppHandle,
    state: &Arc<AppState>,
    job_id: &str,
    folder_path: &str,
    model: &str,
) -> Result<(), String> {
    let files = crawler::crawl_directory(folder_path).await?;
    let mut manifest_data = manifest::load_manifest(folder_path);
    let mut total_chunks: usize = 0;
    let mut processed: usize = 0;
    let batch_size = 8;
    let concurrency_limit = 4;

    struct ChunkData {
        file_path: String,
        text: String,
        start_line: i32,
        end_line: i32,
        chunk_index: i32,
    }

    let mut chunks_to_process = Vec::new();

    for file in &files {
        processed += 1;

        if !manifest::needs_indexing(&manifest_data, &file.file_path, model) {
            // Emit progress even for skipped files
            let _ = app.emit(
                &format!("index-progress-{}", job_id),
                serde_json::json!({
                    "status": "running",
                    "processedFiles": processed,
                    "totalChunks": total_chunks,
                }),
            );
            continue;
        }

        // Delete old chunks for this file
        state.store.delete_by_filepath(&file.file_path).await?;

        // Simple line-based chunking: 50 lines per chunk, 10 line overlap
        let lines: Vec<&str> = file.content.lines().collect();
        let chunk_size = 50;
        let overlap = 10;
        let mut chunks: Vec<(String, i32, i32)> = Vec::new(); // (text, start_line, end_line)

        let mut start = 0;
        while start < lines.len() {
            let end = (start + chunk_size).min(lines.len());
            let chunk_text: String = lines[start..end].join("\n");
            if !chunk_text.trim().is_empty() {
                chunks.push((chunk_text, start as i32, end as i32));
            }
            start += chunk_size - overlap;
        }

        let file_chunk_count = chunks.len() as u32;
        for (i, (text, start_line, end_line)) in chunks.into_iter().enumerate() {
            chunks_to_process.push(ChunkData {
                file_path: file.file_path.clone(),
                text,
                start_line,
                end_line,
                chunk_index: i as i32,
            });
        }

        total_chunks += file_chunk_count as usize;
        manifest::mark_indexed(&mut manifest_data, &file.file_path, file_chunk_count, model);

        // Update job state and emit progress
        {
            let mut jobs = state.jobs.lock().await;
            if let Some(job) = jobs.get_mut(job_id) {
                job.processed_files = processed;
                job.total_chunks = total_chunks;
            }
        }

        let _ = app.emit(
            &format!("index-progress-{}", job_id),
            serde_json::json!({
                "status": "running",
                "processedFiles": processed,
                "totalChunks": total_chunks,
            }),
        );
    }

    // Clean up deleted files from manifest
    let seen_files: std::collections::HashSet<String> =
        files.iter().map(|f| f.file_path.clone()).collect();
    let stale: Vec<String> = manifest_data
        .keys()
        .filter(|k| !seen_files.contains(*k))
        .cloned()
        .collect();
    for fp in stale {
        state.store.delete_by_filepath(&fp).await?;
        manifest::remove_from_manifest(&mut manifest_data, &fp);
    }

    manifest::save_manifest(folder_path, &manifest_data);

    if !chunks_to_process.is_empty() {
        // Group into owned batches to avoid lifetime issues in async stream
        let mut batches = Vec::new();
        let mut current_batch = Vec::new();
        for chunk in chunks_to_process {
            current_batch.push(chunk);
            if current_batch.len() == batch_size {
                batches.push(current_batch);
                current_batch = Vec::new();
            }
        }
        if !current_batch.is_empty() {
            batches.push(current_batch);
        }

        let model_str = model.to_string();

        let mut stream = futures::stream::iter(batches)
            .map(|batch| {
                let texts: Vec<String> = batch.iter().map(|c| c.text.clone()).collect();
                let m = model_str.clone();
                async move {
                    let embeddings_res =
                        embeddings::generate_embeddings(&texts, &m, "http://127.0.0.1:11434").await;
                    (batch, texts, embeddings_res)
                }
            })
            .buffer_unordered(concurrency_limit);

        let mut chunks_embedded = 0;
        while let Some((batch, texts, embeddings_res)) = stream.next().await {
            let embeddings = embeddings_res?;
            let ids: Vec<String> = batch.iter().map(|_| Uuid::new_v4().to_string()).collect();
            let metadatas: Vec<StoredChunkMetadata> = batch
                .iter()
                .map(|c| StoredChunkMetadata {
                    file_path: c.file_path.clone(),
                    chunk_index: c.chunk_index,
                    line_range_start: c.start_line,
                    line_range_end: c.end_line,
                    parent_text: None,
                    parent_line_range_start: None,
                    parent_line_range_end: None,
                })
                .collect();

            state
                .store
                .store_chunks(ids, embeddings, metadatas, texts)
                .await?;

            chunks_embedded += batch.len();
            
            let mut jobs = state.jobs.lock().await;
            if let Some(job) = jobs.get_mut(job_id) {
                job.processed_files = if total_chunks > 0 {
                    (chunks_embedded * files.len()) / total_chunks
                } else {
                    files.len()
                };
            }

            let _ = app.emit(
                &format!("index-progress-{}", job_id),
                serde_json::json!({
                    "status": "running",
                    "processedFiles": if total_chunks > 0 { (chunks_embedded * files.len()) / total_chunks } else { files.len() },
                    "totalChunks": total_chunks,
                }),
            );
        }
    }

    // Mark job complete
    {
        let mut jobs = state.jobs.lock().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status = "completed".to_string();
            job.processed_files = processed;
            job.total_chunks = total_chunks;
        }
    }

    let _ = app.emit(
        &format!("index-progress-{}", job_id),
        serde_json::json!({
            "status": "completed",
            "processedFiles": processed,
            "totalChunks": total_chunks,
        }),
    );

    Ok(())
}

#[tauri::command]
pub async fn get_index_stats(state: State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    let count = state.store.count().await.unwrap_or(0);
    Ok(serde_json::json!({ "count": count }))
}

// ─── Chat ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub query: String,
    pub model: String,
    pub provider: Option<String>,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "ollamaHost")]
    pub ollama_host: Option<String>,
    #[serde(rename = "manualFiles")]
    pub manual_files: Option<Vec<String>>,
    #[serde(rename = "systemPrompt")]
    pub system_prompt: Option<String>,
    #[serde(rename = "folderPath")]
    #[allow(dead_code)]
    pub folder_path: Option<String>,
    pub history: Option<Vec<HistoryTurn>>,
    /// The model used for indexing embeddings — may differ from chat model
    #[serde(rename = "embeddingModel")]
    pub embedding_model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryTurn {
    pub role: String,
    pub content: String,
}

// Atlas Persona: Greeting Detection
const GREETING_RE: &str = r"(?i)^\s*(hi|hello|hey|howdy|sup|yo|hola|greetings|good\s*(morning|afternoon|evening|day)|what'?s?\s*up|hii+)\s*[!?.]*\s*$";

const ATLAS_GREETINGS: &[&str] = &[
    "Hey there! 👋 I'm Atlas, your personal knowledge assistant. How can I help you explore your workspace today?",
    "Hello! 😊 Great to see you. I'm ready to dive into your files and answer any questions. What's on your mind?",
    "Hi! 🌟 Welcome back. Ask me anything about your codebase, or try pinning a file for focused discussions!",
    "Hey! 👋 I'm here and ready to help. What would you like to explore in your workspace today?",
    "Hello there! ✨ Whether it's a code question, a file search, or a deep dive into your project — I've got you. What's up?",
];

fn is_greeting(text: &str) -> bool {
    regex::Regex::new(GREETING_RE)
        .map(|re| re.is_match(text.trim()))
        .unwrap_or(false)
}

#[tauri::command]
pub async fn start_chat(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    event_id: String,
    request: ChatRequest,
) -> Result<(), String> {
    let history = request.history.clone().unwrap_or_default();

    // Greeting shortcut
    if is_greeting(&request.query) && history.is_empty() {
        let greeting = ATLAS_GREETINGS[rand_index(ATLAS_GREETINGS.len())];
        let _ = app.emit(
            &event_id,
            serde_json::json!({ "type": "chunk", "data": { "chunk": greeting } }),
        );
        let _ = app.emit(
            &event_id,
            serde_json::json!({ "type": "done" }),
        );
        return Ok(());
    }

    let eid = event_id.clone();
    let app2 = app.clone();
    let state = state.inner().clone();

    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_chat(&app2, &state, &eid, &request).await {
            let _ = app2.emit(
                &eid,
                serde_json::json!({ "type": "error", "data": { "error": e } }),
            );
        }
        let _ = app2.emit(&eid, serde_json::json!({ "type": "done" }));
    });

    Ok(())
}

async fn run_chat(
    app: &AppHandle,
    state: &Arc<AppState>,
    event_id: &str,
    request: &ChatRequest,
) -> Result<(), String> {
    let host = request
        .ollama_host
        .clone()
        .unwrap_or_else(|| "http://127.0.0.1:11434".to_string());

    // Use the embedding model (workspace indexing model) for query embedding.
    // Falls back to the chat model if not provided.
    let embed_model = request.embedding_model.as_deref().unwrap_or(&request.model);

    // Generate query embedding for retrieval
    let query_embeddings = embeddings::generate_embeddings(
        &[request.query.clone()],
        embed_model,
        &host,
    )
    .await?;

    let query_embedding = query_embeddings
        .into_iter()
        .next()
        .ok_or("No embedding generated")?;

    // Similarity search
    let search_results = state.store.similarity_search(query_embedding, 20).await?;

    // Extract context chunks and citations
    let documents = search_results
        .get("documents")
        .and_then(|d| d.get(0))
        .and_then(|d| d.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
        .unwrap_or_default();

    let metadatas = search_results
        .get("metadatas")
        .and_then(|m| m.get(0))
        .and_then(|m| m.as_array())
        .cloned()
        .unwrap_or_default();

    // Emit citations
    let citations: Vec<serde_json::Value> = metadatas
        .iter()
        .map(|m| {
            serde_json::json!({
                "filePath": m.get("filePath").and_then(|f| f.as_str()).unwrap_or(""),
                "lineRangeStart": m.get("lineRangeStart").and_then(|l| l.as_i64()).unwrap_or(0),
                "lineRangeEnd": m.get("lineRangeEnd").and_then(|l| l.as_i64()).unwrap_or(0),
            })
        })
        .collect();

    let _ = app.emit(
        event_id,
        serde_json::json!({ "type": "citations", "data": citations }),
    );

    // Build the RAG prompt
    let context = documents
        .iter()
        .enumerate()
        .map(|(i, c)| format!("--- Context {} ---\n{}", i + 1, c))
        .collect::<Vec<_>>()
        .join("\n\n");

    // Read manual/pinned files
    let mut pinned_context = String::new();
    if let Some(ref manual_files) = request.manual_files {
        for (i, fp) in manual_files.iter().enumerate() {
            let path = std::path::Path::new(fp);
            if let Ok(content) = read_file_content(path).await {
                pinned_context.push_str(&format!(
                    "--- Pinned Context {} ---\n{}\n\n",
                    i + 1,
                    &content[..content.len().min(8000)]
                ));
            }
        }
    }

    let sys_block = request
        .system_prompt
        .as_ref()
        .map(|s| format!("USER INSTRUCTION:\n{}\n", s))
        .unwrap_or_default();

    let mut messages: Vec<serde_json::Value> = Vec::new();

    let system_content = format!(
        "You are Atlas — a friendly, knowledgeable AI assistant who helps users understand their codebase and projects. You're conversational and warm, but always precise and accurate.

Guidelines:
- Be helpful and engaging. Use a natural, conversational tone — like a smart colleague who genuinely enjoys explaining things.
- Use the provided context to ground your answers. Prefer PINNED CONTEXT when available.
- If the context doesn't contain the answer, say so honestly. Never make things up.
- Format code blocks with proper syntax highlighting. Use headings and bullet points for clarity.
- Keep responses focused but don't be terse — provide enough detail to be genuinely helpful.

{sys_block}

PINNED CONTEXT:
{pinned}

CONTEXT:
{context}",
        sys_block = sys_block,
        pinned = if pinned_context.is_empty() {
            "None".to_string()
        } else {
            pinned_context
        },
        context = if context.is_empty() {
            "None".to_string()
        } else {
            context
        },
    );

    messages.push(serde_json::json!({
        "role": "system",
        "content": system_content
    }));

    if let Some(ref turns) = request.history {
        for turn in turns {
            let role = if turn.role.to_lowercase() == "assistant" { "assistant" } else { "user" };
            messages.push(serde_json::json!({
                "role": role,
                "content": &turn.content[..turn.content.len().min(500)]
            }));
        }
    }

    let user_content = format!(
        "{query}

IMPORTANT: End your response EXACTLY with this block for follow-up questions:
FOLLOW_UP_SUGGESTIONS:
1. [question]
2. [question]
3. [question]
",
        query = request.query
    );

    messages.push(serde_json::json!({
        "role": "user",
        "content": user_content
    }));

    // Stream the response
    let provider = request
        .provider
        .as_deref()
        .unwrap_or("ollama");

    let full_response = match provider {
        "openrouter" => {
            let api_key = request.api_key.as_deref().unwrap_or("");
            llm::stream_openrouter(app, event_id, &request.model, &messages, api_key).await?
        }
        _ => {
            llm::stream_ollama(app, event_id, &request.model, &messages, &host).await?
        }
    };

    // Extract follow-up suggestions
    if let Some(marker_pos) = full_response.find("FOLLOW_UP_SUGGESTIONS:") {
        let suggestions_text = &full_response[marker_pos + "FOLLOW_UP_SUGGESTIONS:".len()..];
        let suggestions: Vec<String> = suggestions_text
            .lines()
            .map(|l| {
                l.trim()
                    .trim_start_matches(|c: char| c.is_numeric() || c == '.' || c == ' ')
                    .trim_start_matches('[')
                    .trim_end_matches(']')
                    .trim()
                    .to_string()
            })
            .filter(|l| l.len() > 5)
            .take(3)
            .collect();

        if !suggestions.is_empty() {
            let _ = app.emit(
                event_id,
                serde_json::json!({ "type": "suggestions", "data": { "suggestions": suggestions } }),
            );
        }
    }

    Ok(())
}

// ─── Search ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn search_files(
    state: State<'_, Arc<AppState>>,
    query: String,
    model: String,
    _folder_path: Option<String>,
) -> Result<serde_json::Value, String> {
    // Create a cache key based on model and query
    let cache_key = format!("{}::{}", model, query);
    
    // Check cache first
    let cached_embedding = {
        let mut cache = state.query_cache.lock().await;
        cache.get(&cache_key).cloned()
    };

    let query_embedding = if let Some(emb) = cached_embedding {
        emb
    } else {
        let embeddings = embeddings::generate_embeddings(
            &[query.clone()],
            &model,
            "http://127.0.0.1:11434",
        )
        .await?;
        
        let emb = embeddings.into_iter().next().ok_or("No embedding")?;
        
        // Save to cache
        let mut cache = state.query_cache.lock().await;
        cache.put(cache_key, emb.clone());
        
        emb
    };
    let results = state.store.similarity_search(query_embedding, 10).await?;

    // Format for the frontend
    let metadatas = results
        .get("metadatas")
        .and_then(|m| m.get(0))
        .and_then(|m| m.as_array())
        .cloned()
        .unwrap_or_default();

    let documents = results
        .get("documents")
        .and_then(|d| d.get(0))
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default();

    let search_results: Vec<serde_json::Value> = metadatas
        .iter()
        .zip(documents.iter())
        .map(|(meta, doc)| {
            serde_json::json!({
                "filePath": meta.get("filePath").and_then(|f| f.as_str()).unwrap_or(""),
                "lineRangeStart": meta.get("lineRangeStart").and_then(|l| l.as_i64()).unwrap_or(0),
                "snippet": doc.as_str().unwrap_or("").chars().take(200).collect::<String>(),
            })
        })
        .collect();

    Ok(serde_json::json!(search_results))
}

// ─── File Operations ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_file_tree(folder_path: String) -> Result<Vec<crawler::FileNode>, String> {
    crawler::build_file_tree(&folder_path).await
}

#[tauri::command]
pub async fn read_file(
    file_path: String,
    start: Option<usize>,
    end: Option<usize>,
) -> Result<serde_json::Value, String> {
    let path = std::path::Path::new(&file_path);
    let content = read_file_content(path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let lines: Vec<&str> = content.lines().collect();
    let total = lines.len();
    let start = start.unwrap_or(0);
    let end = end.unwrap_or(total).min(total);
    let slice: String = lines[start..end].join("\n");

    Ok(serde_json::json!({
        "content": slice,
        "totalLines": total,
    }))
}

// ─── Utility ─────────────────────────────────────────────────────────────────

async fn read_file_content(path: &std::path::Path) -> Result<String, String> {
    let ext = path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase());
    if ext.as_deref() == Some("pdf") {
        let path_clone = path.to_path_buf();
        match tokio::task::spawn_blocking(move || pdf_extract::extract_text(&path_clone)).await {
            Ok(Ok(content)) => return Ok(content),
            Ok(Err(e)) => return Err(format!("PDF extraction failed: {}", e)),
            Err(e) => return Err(format!("Task failed: {}", e)),
        }
    }

    tokio::fs::read_to_string(path)
        .await
        .map_err(|e| e.to_string())
}

fn rand_index(max: usize) -> usize {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos() as usize
        % max
}

#[tauri::command]
pub async fn get_timeline(folder_path: String, hours: f64) -> Result<Vec<TimelineEvent>, String> {
    let files = crate::crawler::crawl_directory(&folder_path).await?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64() * 1000.0;
    
    let threshold = now - (hours * 3600.0 * 1000.0);
    let mut events = Vec::new();

    for file in files {
        if let Ok(meta) = std::fs::metadata(&file.file_path) {
            let mtime = meta.modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs_f64() * 1000.0)
                .unwrap_or(0.0);
            
            if mtime > threshold {
                let relative_path = file.file_path
                    .strip_prefix(&folder_path)
                    .unwrap_or(&file.file_path)
                    .trim_start_matches(|c| c == '/' || c == '\\')
                    .to_string();

                events.push(TimelineEvent {
                    file_path: file.file_path,
                    relative_path,
                    mtime,
                    change_type: "modified".to_string(),
                });
            }
        }
    }

    events.sort_by(|a, b| b.mtime.partial_cmp(&a.mtime).unwrap_or(std::cmp::Ordering::Equal));

    Ok(events)
}

#[tauri::command]
pub async fn scan_secrets(text: String) -> Vec<crate::shield::SecretMatch> {
    crate::shield::scan_for_secrets(&text)
}

#[tauri::command]
pub async fn web_search(
    query: String,
    api_key: String,
    provider: String,
) -> Result<Vec<crate::websearch::WebResult>, String> {
    crate::websearch::search_web(&query, &api_key, &provider).await
}
