use crate::crawler;
use crate::embeddings;
use crate::llm;
use crate::manifest;
use crate::vectorstore::{
    AtlasVectorStore, StoredChunkMetadata, TablePreparation, DAMAGED_LOCAL_INDEX_MESSAGE,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::Mutex;
use uuid::Uuid;

type ParsedChunk = (String, i32, i32, Option<String>, Option<String>);

/// Shared application state
pub struct AppState {
    pub store: AtlasVectorStore,
    pub jobs: Mutex<HashMap<String, IndexingJob>>,
    pub query_cache: Mutex<lru::LruCache<String, Vec<f32>>>,
    pub watchers: Mutex<HashMap<String, Arc<std::sync::atomic::AtomicBool>>>,
    pub chat_cancellations: Mutex<HashMap<String, Arc<std::sync::atomic::AtomicBool>>>,
    pub authorized_workspaces: Mutex<HashMap<String, PathBuf>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingJob {
    pub id: String,
    pub folder_path: String,
    pub workspace_id: String,
    pub status: String, // "queued", "running", "completed", "failed"
    pub processed_files: usize,
    pub total_files: usize,
    pub total_chunks: usize,
    pub error: Option<String>,
    pub model: String,
    #[serde(skip)]
    pub requeue_requested: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexHealth {
    pub status: String,
    pub file_count: usize,
    pub chunk_count: usize,
    pub embedding_model: Option<String>,
    pub last_completed_at: Option<f64>,
    pub error: Option<String>,
}

fn coalesce_active_index_job(
    jobs: &mut HashMap<String, IndexingJob>,
    folder_path: &str,
) -> Option<String> {
    let existing = jobs.values_mut().find(|job| {
        job.folder_path == folder_path && matches!(job.status.as_str(), "queued" | "running")
    })?;
    existing.requeue_requested = true;
    Some(existing.id.clone())
}

pub(crate) async fn require_workspace(
    state: &Arc<AppState>,
    folder_path: &str,
) -> Result<PathBuf, String> {
    let canonical = crate::workspace::canonical_workspace(folder_path)?;
    let key = canonical.to_string_lossy().to_string();
    state
        .authorized_workspaces
        .lock()
        .await
        .get(&key)
        .cloned()
        .ok_or_else(|| "Workspace has not been authorized for this application session".to_string())
}

#[tauri::command]
pub async fn select_workspace(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<Option<String>, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |selection| {
        let _ = sender.send(selection.and_then(|path| path.into_path().ok()));
    });
    let Some(selected) = receiver
        .await
        .map_err(|_| "Workspace picker closed unexpectedly".to_string())?
    else {
        return Ok(None);
    };
    let canonical = crate::workspace::canonical_workspace(&selected.to_string_lossy())?;
    let canonical_key = canonical.to_string_lossy().to_string();
    let mut authorized = state.authorized_workspaces.lock().await;
    authorized.insert(canonical_key.clone(), canonical);
    crate::workspace::save_authorized(&authorized)?;
    Ok(Some(canonical_key))
}

#[tauri::command]
pub async fn is_workspace_authorized(
    state: State<'_, Arc<AppState>>,
    folder_path: String,
) -> Result<bool, String> {
    Ok(require_workspace(state.inner(), &folder_path).await.is_ok())
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

// ─── Indexing ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_indexing(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    folder_path: String,
    model: String,
    ollama_host: Option<String>,
) -> Result<String, crate::errors::AppError> {
    let canonical = require_workspace(state.inner(), &folder_path).await?;
    let canonical_key = canonical.to_string_lossy().to_string();
    start_indexing_internal(
        app,
        state.inner().clone(),
        canonical_key,
        model,
        ollama_host.unwrap_or_else(|| "http://127.0.0.1:11434".to_string()),
    )
    .await
    .map_err(Into::into)
}

pub async fn start_indexing_internal(
    app: AppHandle,
    state: Arc<AppState>,
    folder_path: String,
    model: String,
    ollama_host: String,
) -> Result<String, String> {
    let job_id = Uuid::new_v4().to_string();

    let job = IndexingJob {
        id: job_id.clone(),
        folder_path: folder_path.clone(),
        workspace_id: folder_path.clone(), // Use folder path as workspace ID for now
        status: "queued".to_string(),
        processed_files: 0,
        total_files: 0,
        total_chunks: 0,
        error: None,
        model: model.clone(),
        requeue_requested: false,
    };

    {
        // Check and insert while holding one lock so simultaneous watcher/UI
        // requests cannot both create a destructive workspace job.
        let mut jobs = state.jobs.lock().await;
        if let Some(existing_id) = coalesce_active_index_job(&mut jobs, &folder_path) {
            return Ok(existing_id);
        }
        // Keep health tied to the latest attempt rather than an older terminal
        // failure that has since been retried successfully.
        jobs.retain(|_, existing| existing.folder_path != folder_path);
        jobs.insert(job_id.clone(), job);
    }

    let state = state.clone();
    let jid = job_id.clone();

    tauri::async_runtime::spawn(async move {
        loop {
            {
                let mut jobs = state.jobs.lock().await;
                if let Some(job) = jobs.get_mut(&jid) {
                    job.status = "running".to_string();
                    job.error = None;
                    job.requeue_requested = false;
                }
            }

            if let Err(e) =
                run_indexing_job(&app, &state, &jid, &folder_path, &model, &ollama_host).await
            {
                log::error!("[indexer] Job {} failed: {}", jid, e);
                let user_error = index_error_for_user(&e);
                let mut jobs = state.jobs.lock().await;
                if let Some(job) = jobs.get_mut(&jid) {
                    job.status = "failed".to_string();
                    job.error = Some(user_error.clone());
                }
                let _ = app.emit(
                    &format!("index-progress-{}", jid),
                    serde_json::json!({ "status": "failed", "error": user_error }),
                );
                break;
            }

            let (rerun, completed) = {
                let mut jobs = state.jobs.lock().await;
                match jobs.get_mut(&jid) {
                    Some(job) if job.requeue_requested => (true, None),
                    Some(job) => {
                        job.status = "completed".to_string();
                        (false, Some(job.clone()))
                    }
                    None => (false, None),
                }
            };
            if !rerun {
                if let Some(job) = completed {
                    let _ = app.emit(
                        &format!("index-progress-{}", jid),
                        serde_json::json!({
                            "status": "completed",
                            "processedFiles": job.processed_files,
                            "totalFiles": job.total_files,
                            "totalChunks": job.total_chunks,
                        }),
                    );
                }
                break;
            }
        }
    });

    Ok(job_id)
}

fn index_error_for_user(error: &str) -> String {
    let lower = error.to_ascii_lowercase();
    if AtlasVectorStore::is_recoverable_table_error(error)
        || error.starts_with(DAMAGED_LOCAL_INDEX_MESSAGE)
    {
        format!("{DAMAGED_LOCAL_INDEX_MESSAGE} Retry indexing to try recovery again.")
    } else if lower.contains("lance") {
        "Atlas could not read its local index. Retry indexing; if the problem persists, check folder permissions and the Atlas logs.".to_string()
    } else {
        error.to_string()
    }
}

async fn ensure_manifest_vector_tables_readable(
    store: &AtlasVectorStore,
    index_manifest: &manifest::Manifest,
) -> Result<(), String> {
    let dimensions = index_manifest
        .values()
        .map(|entry| entry.vector_dimension)
        .collect::<std::collections::BTreeSet<_>>();
    for vector_dimension in dimensions {
        if vector_dimension == 0 {
            return Err("Index rebuild required for the local index integrity schema".to_string());
        }
        if let Err(error) = store.check_table_readable(vector_dimension).await {
            log::warn!(
                "[indexer] refusing retrieval from unhealthy table {}: {}",
                vector_dimension,
                error
            );
            if AtlasVectorStore::is_recoverable_table_error(&error) || error.contains("is missing")
            {
                return Err(DAMAGED_LOCAL_INDEX_MESSAGE.to_string());
            }
            return Err(
                "Atlas could not read its local index. Retry indexing to repair or diagnose it."
                    .to_string(),
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_index_job(
    state: State<'_, Arc<AppState>>,
    job_id: String,
) -> Result<IndexingJob, String> {
    state
        .jobs
        .lock()
        .await
        .get(&job_id)
        .cloned()
        .ok_or_else(|| format!("Unknown indexing job: {job_id}"))
}

async fn run_indexing_job(
    app: &AppHandle,
    state: &Arc<AppState>,
    job_id: &str,
    folder_path: &str,
    model: &str,
    ollama_host: &str,
) -> Result<(), String> {
    let files = crawler::crawl_directory(folder_path).await?;
    let mut manifest_data = manifest::load_manifest(folder_path);
    let mut total_chunks: usize = 0;
    let mut processed: usize = 0;
    let batch_size = 8;

    struct ChunkData {
        file_path: String,
        text: String,
        start_line: i32,
        end_line: i32,
        chunk_index: i32,
        kind: Option<String>,
        name: Option<String>,
    }

    let mut parser = crate::parser::CodeParser::new();
    let mut index_changed = false;
    let mut prepared_dimension: Option<usize> = None;

    {
        let mut jobs = state.jobs.lock().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.processed_files = 0;
            job.total_files = files.len();
            job.total_chunks = 0;
        }
    }

    // A current manifest records the exact table it depends on.  Probe it
    // before the unchanged-file fast path, otherwise a missing fragment could
    // leave every file skipped and the index incorrectly appear reusable.
    let known_dimensions = manifest_data
        .values()
        .filter(|entry| {
            entry.pipeline_version == manifest::INDEX_PIPELINE_VERSION
                && entry.model == model
                && entry.vector_dimension > 0
        })
        .map(|entry| entry.vector_dimension)
        .collect::<std::collections::BTreeSet<_>>();
    for vector_dimension in known_dimensions {
        match state
            .store
            .prepare_table_for_index(vector_dimension)
            .await?
        {
            TablePreparation::Ready => {
                prepared_dimension = Some(vector_dimension);
            }
            TablePreparation::Missing | TablePreparation::Rebuilt => {
                let invalidated =
                    manifest::invalidate_manifests_for_table_dimension(vector_dimension)?;
                manifest_data = manifest::load_manifest(folder_path);
                let _ = app.emit(
                    &format!("index-progress-{job_id}"),
                    serde_json::json!({
                        "status": "recovering",
                        "processedFiles": 0,
                        "totalFiles": files.len(),
                        "totalChunks": 0,
                        "recoveryMessage": format!("{DAMAGED_LOCAL_INDEX_MESSAGE} Rebuilding {invalidated} affected workspace index manifest(s)."),
                    }),
                );
                prepared_dimension = Some(vector_dimension);
                break;
            }
        }
    }

    for file in &files {
        processed += 1;
        let file_hash = manifest::content_hash(&file.content);

        if !manifest::needs_indexing(&manifest_data, &file.file_path, model, &file_hash) {
            let existing_chunks = manifest_data
                .get(&file.file_path)
                .map(|entry| entry.chunk_count as usize)
                .unwrap_or(0);
            total_chunks += existing_chunks;
            update_index_progress(app, state, job_id, processed, files.len(), total_chunks).await;
            continue;
        }

        let semantic_chunks = parser
            .parse_semantic_chunks(&file.file_path, &file.content)
            .await;

        let chunks: Vec<ParsedChunk> = if !semantic_chunks.is_empty() {
            semantic_chunks
                .into_iter()
                .map(|chunk| {
                    (
                        chunk.text,
                        chunk.start_line as i32,
                        chunk.end_line as i32,
                        Some(chunk.kind),
                        chunk.name,
                    )
                })
                .collect()
        } else {
            let lines: Vec<&str> = file.content.lines().collect();
            let chunk_size = 50;
            let overlap = 10;
            let mut fallback_chunks = Vec::new();
            let mut start = 0;
            while start < lines.len() {
                let end = (start + chunk_size).min(lines.len());
                let chunk_text = lines[start..end].join("\n");
                if !chunk_text.trim().is_empty() {
                    fallback_chunks.push((chunk_text, (start + 1) as i32, end as i32, None, None));
                }
                start += chunk_size - overlap;
            }
            fallback_chunks
        };

        let chunks: Vec<ChunkData> = chunks
            .into_iter()
            .enumerate()
            .map(
                |(index, (text, start_line, end_line, kind, name))| ChunkData {
                    file_path: file.file_path.clone(),
                    text,
                    start_line,
                    end_line,
                    chunk_index: index as i32,
                    kind,
                    name,
                },
            )
            .collect();

        // Generate every embedding before touching the valid replacement currently
        // in LanceDB. A provider failure therefore leaves the old index intact.
        let mut generated_embeddings = Vec::with_capacity(chunks.len());
        for batch in chunks.chunks(batch_size) {
            let texts = batch
                .iter()
                .map(|chunk| chunk.text.clone())
                .collect::<Vec<_>>();
            let embeddings = embeddings::generate_embeddings(&texts, model, ollama_host).await?;
            if embeddings.len() != texts.len() {
                return Err(format!(
                    "Embedding provider returned {} vectors for {} chunks",
                    embeddings.len(),
                    texts.len()
                ));
            }
            generated_embeddings.extend(embeddings);
        }

        // Empty/whitespace-only files have no durable vector rows.  Leave
        // them unmanifested rather than claiming an unknown table dimension.
        let Some(vector_dimension) = generated_embeddings.first().map(Vec::len) else {
            update_index_progress(app, state, job_id, processed, files.len(), total_chunks).await;
            continue;
        };
        if generated_embeddings
            .iter()
            .any(|embedding| embedding.len() != vector_dimension)
        {
            return Err("Embedding provider returned inconsistent vector dimensions".to_string());
        }

        if prepared_dimension != Some(vector_dimension) {
            match state
                .store
                .prepare_table_for_index(vector_dimension)
                .await?
            {
                TablePreparation::Ready => {}
                TablePreparation::Missing | TablePreparation::Rebuilt => {
                    let had_entries_for_table = manifest_data.values().any(|entry| {
                        entry.vector_dimension == vector_dimension || entry.vector_dimension == 0
                    });
                    let invalidated =
                        manifest::invalidate_manifests_for_table_dimension(vector_dimension)?;
                    manifest_data = manifest::load_manifest(folder_path);
                    if had_entries_for_table || invalidated > 0 {
                        let _ = app.emit(
                            &format!("index-progress-{job_id}"),
                            serde_json::json!({
                                "status": "recovering",
                                "processedFiles": processed.saturating_sub(1),
                                "totalFiles": files.len(),
                                "totalChunks": total_chunks,
                                "recoveryMessage": DAMAGED_LOCAL_INDEX_MESSAGE,
                            }),
                        );
                    }
                }
            }
            prepared_dimension = Some(vector_dimension);
        }

        let ids = chunks
            .iter()
            .map(|_| Uuid::new_v4().to_string())
            .collect::<Vec<_>>();

        let metadatas = chunks
            .iter()
            .map(|chunk| StoredChunkMetadata {
                file_path: chunk.file_path.clone(),
                chunk_index: chunk.chunk_index,
                line_range_start: chunk.start_line,
                line_range_end: chunk.end_line,
                parent_text: None,
                parent_line_range_start: None,
                parent_line_range_end: None,
                kind: chunk.kind.clone(),
                name: chunk.name.clone(),
            })
            .collect::<Vec<_>>();
        let texts = chunks
            .iter()
            .map(|chunk| chunk.text.clone())
            .collect::<Vec<_>>();
        let file_path = file.file_path.clone();

        manifest::commit_replacement(
            &mut manifest_data,
            &file.file_path,
            chunks.len() as u32,
            model,
            file_hash,
            ids.clone(),
            vector_dimension,
            || async {
                if !texts.is_empty() {
                    state
                        .store
                        .store_chunks(
                            folder_path.to_string(),
                            ids,
                            generated_embeddings,
                            metadatas,
                            texts,
                        )
                        .await?;
                }
                Ok(())
            },
            |next| manifest::save_manifest(folder_path, next),
        )
        .await?;
        finalize_replacement_cleanup(
            state,
            &mut manifest_data,
            folder_path,
            &file_path,
            vector_dimension,
        )
        .await?;
        index_changed = true;
        total_chunks += chunks.len();

        update_index_progress(app, state, job_id, processed, files.len(), total_chunks).await;
    }

    let seen_files: std::collections::HashSet<String> =
        files.iter().map(|file| file.file_path.clone()).collect();
    let stale_files = manifest_data
        .keys()
        .filter(|path| !seen_files.contains(*path))
        .cloned()
        .collect::<Vec<_>>();

    for stale_path in stale_files {
        let stale_dimension = manifest_data
            .get(&stale_path)
            .map(|entry| entry.vector_dimension)
            .filter(|dimension| *dimension > 0)
            .or(prepared_dimension);
        manifest::commit_deletion(
            &mut manifest_data,
            &stale_path,
            || async {
                if let Some(vector_dimension) = stale_dimension {
                    state
                        .store
                        .delete_by_filepath(vector_dimension, &stale_path)
                        .await?;
                }
                state.query_cache.lock().await.clear();
                Ok(())
            },
            |next| manifest::save_manifest(folder_path, next),
        )
        .await?;
        index_changed = true;
    }

    if index_changed {
        state.query_cache.lock().await.clear();
    }

    update_index_progress(app, state, job_id, processed, files.len(), total_chunks).await;

    Ok(())
}

async fn finalize_replacement_cleanup(
    state: &Arc<AppState>,
    manifest_data: &mut manifest::Manifest,
    folder_path: &str,
    file_path: &str,
    vector_dimension: usize,
) -> Result<(), String> {
    let retained_ids = manifest_data
        .get(file_path)
        .ok_or_else(|| format!("Missing committed manifest entry for {file_path}"))?
        .chunk_ids
        .clone();
    state
        .store
        .delete_by_filepath_except(vector_dimension, file_path, &retained_ids)
        .await?;
    state.query_cache.lock().await.clear();

    let mut next = manifest_data.clone();
    if let Some(entry) = next.get_mut(file_path) {
        entry.cleanup_pending = false;
    }
    manifest::save_manifest(folder_path, &next)?;
    *manifest_data = next;
    Ok(())
}

async fn update_index_progress(
    app: &AppHandle,
    state: &Arc<AppState>,
    job_id: &str,
    processed_files: usize,
    total_files: usize,
    total_chunks: usize,
) {
    {
        let mut jobs = state.jobs.lock().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.processed_files = processed_files;
            job.total_files = total_files;
            job.total_chunks = total_chunks;
        }
    }

    let _ = app.emit(
        &format!("index-progress-{job_id}"),
        serde_json::json!({
            "status": "running",
            "processedFiles": processed_files,
            "totalFiles": total_files,
            "totalChunks": total_chunks,
        }),
    );
}

/*
The old delete-before-embed implementation intentionally remains absent. The
replacement protocol above stages all embeddings and rows before deleting any
valid rows, commits the manifest, and makes obsolete-row cleanup retryable.
*/

#[tauri::command]
pub async fn get_index_health(
    state: State<'_, Arc<AppState>>,
    workspace_id: String,
) -> Result<IndexHealth, crate::errors::AppError> {
    let workspace = require_workspace(state.inner(), &workspace_id).await?;
    let canonical = workspace.to_string_lossy().to_string();
    let manifest = manifest::load_manifest(&canonical);
    let active_job = state
        .jobs
        .lock()
        .await
        .values()
        .filter(|job| {
            job.workspace_id == canonical
                && matches!(job.status.as_str(), "queued" | "running" | "failed")
        })
        .max_by_key(|job| matches!(job.status.as_str(), "queued" | "running"))
        .cloned();
    let file_count = manifest.len();
    let chunk_count = manifest
        .values()
        .map(|entry| entry.chunk_count as usize)
        .sum();
    let embedding_model = manifest
        .values()
        .map(|entry| entry.model.clone())
        .find(|model| !model.is_empty());
    let incompatible = manifest.values().any(|entry| {
        entry.pipeline_version != manifest::INDEX_PIPELINE_VERSION || entry.vector_dimension == 0
    });
    let table_problem = if !incompatible && file_count > 0 {
        let dimensions = manifest
            .values()
            .map(|entry| entry.vector_dimension)
            .collect::<std::collections::BTreeSet<_>>();
        let mut problem = None;
        for vector_dimension in dimensions {
            if let Err(error) = state.store.check_table_readable(vector_dimension).await {
                problem = Some(
                    if AtlasVectorStore::is_recoverable_table_error(&error)
                        || error.contains("is missing")
                    {
                        DAMAGED_LOCAL_INDEX_MESSAGE.to_string()
                    } else {
                        "Atlas could not read its local index. Retry indexing to repair or diagnose it."
                        .to_string()
                    },
                );
                log::warn!(
                    "[indexer] index health check failed for table {}: {}",
                    vector_dimension,
                    error
                );
                break;
            }
        }
        problem
    } else {
        None
    };
    let (status, error) = if let Some(job) =
        active_job.filter(|job| matches!(job.status.as_str(), "queued" | "running" | "failed"))
    {
        (job.status, job.error)
    } else if incompatible {
        (
            "incompatible".to_string(),
            Some("Index rebuild required for the Phase 4 retrieval schema".to_string()),
        )
    } else if let Some(problem) = table_problem {
        ("incompatible".to_string(), Some(problem))
    } else if file_count > 0 {
        ("ready".to_string(), None)
    } else {
        ("not_indexed".to_string(), None)
    };
    Ok(IndexHealth {
        status,
        file_count,
        chunk_count,
        embedding_model,
        last_completed_at: manifest::last_completed_at(&canonical),
        error,
    })
}

// ─── Chat ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub query: String,
    pub model: String,
    pub provider: Option<String>,
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
    #[serde(rename = "allowCloud", default)]
    pub allow_cloud: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryTurn {
    pub role: String,
    pub content: String,
}

// A local shortcut avoids invoking a provider for a greeting with no history.
const GREETING_RE: &str = r"(?i)^\s*(hi|hello|hey|howdy|sup|yo|hola|greetings|good\s*(morning|afternoon|evening|day)|what'?s?\s*up|hii+)\s*[!?.]*\s*$";

const ATLAS_GREETINGS: &[&str] = &[
    "Hello. What would you like to understand about this workspace?",
    "Hello. Ask me about the indexed workspace, or use Find to inspect a source directly.",
    "Ready. What would you like to explore in this workspace?",
];

fn is_greeting(text: &str) -> bool {
    regex::Regex::new(GREETING_RE)
        .map(|re| re.is_match(text.trim()))
        .unwrap_or_else(|e| {
            log::error!("Invalid greeting regex: {}", e);
            false
        })
}

fn truncate_chars(text: &str, max_chars: usize) -> String {
    crate::retrieval_quality::truncate_chars(text, max_chars)
}

fn should_decline_without_evidence(
    relevance: crate::retrieval_quality::RelevanceLevel,
    has_pinned_context: bool,
) -> bool {
    relevance != crate::retrieval_quality::RelevanceLevel::Strong && !has_pinned_context
}

fn automatic_evidence_for_generation(
    search_results: &serde_json::Value,
    workspace_id: &str,
    relevance: crate::retrieval_quality::RelevanceLevel,
) -> Vec<crate::retrieval::EvidenceResult> {
    if relevance != crate::retrieval_quality::RelevanceLevel::Strong {
        return Vec::new();
    }
    crate::retrieval::evidence_from_store(search_results, workspace_id)
}

fn automatic_evidence_limits(has_pinned_context: bool) -> (usize, usize) {
    if has_pinned_context {
        (
            crate::retrieval_quality::PINNED_AUTOMATIC_EVIDENCE_BUDGET_CHARS,
            crate::retrieval_quality::PINNED_AUTOMATIC_EVIDENCE_LIMIT,
        )
    } else {
        (crate::retrieval_quality::EVIDENCE_BUDGET_CHARS, 8)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PinnedContextMode {
    Supporting,
    SourceAuthoritative,
}

fn is_implementation_question(query: &str) -> bool {
    let query = query.to_ascii_lowercase();
    query.contains("where is")
        || query.contains("where are")
        || query.contains("implemented")
        || query.contains("implementation")
        || query.contains("how does")
        || query.contains("how is")
        || query.contains("what happens after")
        || query.contains("which function")
        || query.contains("which method")
        || query.contains("enforced")
        || query.contains("enforce")
}

fn prioritize_automatic_evidence(
    mut evidence: Vec<crate::retrieval::EvidenceResult>,
    implementation_question: bool,
) -> Vec<crate::retrieval::EvidenceResult> {
    if implementation_question {
        // This affects only the bounded generation context. Hybrid retrieval
        // scores and Find ordering remain unchanged.
        evidence.sort_by_key(|source| source.source_kind.implementation_authority_rank());
    }
    evidence
}

fn automatic_evidence_header(index: usize, source: &crate::retrieval::EvidenceResult) -> String {
    format!(
        "--- [S{}] {}: {} (lines {}-{}) ---\n",
        index + 1,
        source.source_kind.prompt_label(),
        source.display_path,
        source.line_start,
        source.line_end
    )
}

#[derive(Debug, Clone)]
struct SuppliedEvidence {
    content: String,
}

fn allows_generated_example_code(query: &str) -> bool {
    let query = query.to_ascii_lowercase();
    [
        "write code",
        "write a code",
        "write a function",
        "write a snippet",
        "write an example",
        "propose code",
        "show an example",
        "give an example",
        "example code",
        "suggest a patch",
        "generate code",
    ]
    .iter()
    .any(|phrase| query.contains(phrase))
}

fn normalize_code_for_verification(text: &str) -> String {
    text.replace("\r\n", "\n")
        .replace('\r', "\n")
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .trim_end()
        .to_string()
}

fn fenced_block_is_supplied(block: &str, supplied_evidence: &[SuppliedEvidence]) -> bool {
    let normalized_block = normalize_code_for_verification(block);
    !normalized_block.is_empty()
        && supplied_evidence.iter().any(|source| {
            normalize_code_for_verification(&source.content).contains(&normalized_block)
        })
}

/// Source-like fenced blocks are allowed only when their exact code was part of
/// the evidence supplied to this model response. This intentionally never
/// searches the workspace: unsupplied source cannot be claimed as an excerpt.
fn sanitize_fenced_source_blocks(
    response: &str,
    supplied_evidence: &[SuppliedEvidence],
    generated_examples_allowed: bool,
) -> String {
    if generated_examples_allowed {
        return response.to_string();
    }

    let mut sanitized = String::with_capacity(response.len());
    let mut remaining = response;
    while let Some(open_offset) = remaining.find("```") {
        sanitized.push_str(&remaining[..open_offset]);
        let fence_start = &remaining[open_offset..];
        let Some(header_end) = fence_start.find('\n') else {
            sanitized.push_str(fence_start);
            return sanitized;
        };
        let code_start = header_end + 1;
        let Some(close_relative) = fence_start[code_start..].find("```") else {
            // An incomplete fence is not a verifiable workspace excerpt.
            return sanitized;
        };
        let code_end = code_start + close_relative;
        let fence_end = code_end + 3;
        let full_block = &fence_start[..fence_end];
        let code = &fence_start[code_start..code_end];
        if fenced_block_is_supplied(code, supplied_evidence) {
            sanitized.push_str(full_block);
        }
        remaining = &fence_start[fence_end..];
    }
    sanitized.push_str(remaining);
    sanitized
}

#[derive(Debug, Clone)]
struct PinnedFile {
    file_path: String,
    content: String,
}

#[derive(Debug, Clone)]
struct PinnedContext {
    prompt: String,
    evidence: Vec<crate::retrieval::EvidenceResult>,
}

async fn resolve_pinned_files(
    workspace_root: &Path,
    manual_files: Option<&[String]>,
) -> Result<Vec<PinnedFile>, String> {
    let mut pinned = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for requested_path in manual_files.unwrap_or_default() {
        let path = crate::workspace::authorized_file(workspace_root, requested_path)?;
        let canonical = path.to_string_lossy().to_string();
        if !seen.insert(canonical.clone()) {
            continue;
        }
        pinned.push(PinnedFile {
            file_path: canonical,
            content: read_file_content(&path).await?,
        });
    }
    Ok(pinned)
}

fn display_pinned_path(file_path: &str, workspace_root: &Path) -> String {
    Path::new(file_path)
        .strip_prefix(workspace_root)
        .unwrap_or_else(|_| Path::new(file_path))
        .to_string_lossy()
        .trim_start_matches(['/', '\\'])
        .to_string()
}

fn pinned_context_mode(query: &str, pinned_files: &[PinnedFile]) -> PinnedContextMode {
    if pinned_files.is_empty() {
        return PinnedContextMode::Supporting;
    }
    let query = query.to_ascii_lowercase();
    let names_a_pinned_file = pinned_files.iter().any(|file| {
        Path::new(&file.file_path)
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| query.contains(&name.to_ascii_lowercase()))
    });
    let explicitly_selects_pin = query.contains("using the pinned")
        || query.contains("summarize this pinned")
        || query.contains("summarize the pinned");
    let names_file_as_authority = names_a_pinned_file
        && (query.contains("according to")
            || query.contains("summarize")
            || query.contains("what does")
            || query.contains("what guarantees"));
    if explicitly_selects_pin || names_file_as_authority {
        PinnedContextMode::SourceAuthoritative
    } else {
        PinnedContextMode::Supporting
    }
}

fn assemble_pinned_context(pinned_files: &[PinnedFile], workspace_root: &Path) -> PinnedContext {
    use crate::retrieval_quality::{truncate_chars, PER_PINNED_CHARS, PINNED_BUDGET_CHARS};

    let mut prompt = String::new();
    let mut evidence = Vec::new();
    // A single explicitly pinned file may use the full bounded pinned budget.
    // Multiple pins retain the per-file cap so one broad selection cannot
    // crowd the rest out of the prompt.
    let per_file_budget = if pinned_files.len() == 1 {
        PINNED_BUDGET_CHARS
    } else {
        PER_PINNED_CHARS
    };
    for (index, file) in pinned_files.iter().enumerate() {
        if prompt.chars().count() >= PINNED_BUDGET_CHARS {
            break;
        }
        let display_path = display_pinned_path(&file.file_path, workspace_root);
        let header = format!(
            "--- [P{}] PINNED / USER-SELECTED {}: {} ---\n",
            index + 1,
            crate::retrieval::source_kind_from_path(&file.file_path).prompt_label(),
            display_path
        );
        let remaining =
            PINNED_BUDGET_CHARS.saturating_sub(prompt.chars().count() + header.chars().count());
        if remaining == 0 {
            break;
        }
        let supplied = truncate_chars(&file.content, remaining.min(per_file_budget));
        let line_end = supplied.lines().count().max(1) as i64;
        prompt.push_str(&header);
        prompt.push_str(&supplied);
        prompt.push_str("\n\n");
        evidence.push(crate::retrieval::EvidenceResult {
            id: format!("pinned:{}", file.file_path),
            workspace_id: workspace_root.to_string_lossy().to_string(),
            file_path: file.file_path.clone(),
            display_path,
            line_start: 1,
            line_end,
            content: supplied.clone(),
            snippet: supplied.chars().take(400).collect(),
            source_type: crate::retrieval::EvidenceSourceType::PinnedWorkspaceFile,
            source_kind: crate::retrieval::source_kind_from_path(&file.file_path),
        });
    }
    PinnedContext { prompt, evidence }
}

fn build_system_content(
    user_instruction: &str,
    pinned_context: &PinnedContext,
    automatic_context: &str,
    pinned_mode: PinnedContextMode,
    implementation_question: bool,
) -> String {
    let mut system_content = String::with_capacity(
        5000 + user_instruction.len() + pinned_context.prompt.len() + automatic_context.len(),
    );
    system_content.push_str("You are Atlas, a workspace intelligence assistant. Ground workspace-specific claims only in supplied evidence and cite valid source IDs such as [P1] or [S1]. Source headers state their kind: only IMPLEMENTATION CODE proves runtime symbols and behavior; DOCUMENTATION and DESIGN / SPECIFICATION describe written intent, while TEST and FIXTURE are non-production evidence. Do not invent function names, structs, methods, APIs, or responsibilities. If supplied evidence does not establish a specific detail, say so rather than infer it. Never reconstruct workspace source code from memory. Only present a fenced workspace excerpt when it is verbatim in supplied evidence; generated code is allowed only when explicitly requested as an example, proposal, or patch, and must be labeled as an example.\n\n");

    if !user_instruction.is_empty() {
        system_content.push_str(user_instruction);
        system_content.push_str("\n\n");
    }

    if pinned_mode == PinnedContextMode::SourceAuthoritative {
        system_content.push_str("SOURCE-DIRECTED PIN RULE: The user explicitly asked about the pinned source. Answer from PINNED CONTEXT only. Do not infer types, methods, APIs, guarantees, or behavior that are absent from it. Automatic context is intentionally omitted for this request.\n\n");
    }

    if implementation_question {
        system_content.push_str("IMPLEMENTATION-QUESTION RULE: Prefer current IMPLEMENTATION CODE. Documentation and design material may describe intended behavior, but must not be presented as executable implementation. If sources conflict, code wins. Do not name a runtime symbol unless the cited implementation source contains it; if no implementation source establishes the detail, say the supplied evidence does not establish it.\n\n");
    }

    system_content.push_str("PINNED CONTEXT (user-selected; primary evidence):\n");
    if pinned_context.prompt.is_empty() {
        system_content.push_str("None\n");
    } else {
        system_content.push_str(&pinned_context.prompt);
    }

    system_content.push_str("\nAUTOMATIC CONTEXT (secondary to pinned context):\n");
    if automatic_context.is_empty() {
        system_content.push_str("None. Do not add unsupported workspace claims.");
    } else {
        system_content.push_str(automatic_context);
    }
    system_content
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
        let idx = rand_index(ATLAS_GREETINGS.len());
        let greeting = ATLAS_GREETINGS[idx];
        let _ = app.emit(
            &event_id,
            serde_json::json!({ "type": "chunk", "data": { "chunk": greeting } }),
        );
        let _ = app.emit(&event_id, serde_json::json!({ "type": "done" }));
        return Ok(());
    }

    let eid = event_id.clone();
    let app2 = app.clone();
    let state = state.inner().clone();
    let cancelled = Arc::new(std::sync::atomic::AtomicBool::new(false));
    state
        .chat_cancellations
        .lock()
        .await
        .insert(eid.clone(), cancelled.clone());

    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_chat(&app2, &state, &eid, &request, &cancelled).await {
            if e != "Generation cancelled" {
                let error = crate::errors::AppError::from(e);
                let _ = app2.emit(
                    &eid,
                    serde_json::json!({
                        "type": "error",
                        "data": { "error": error.message, "code": error.code }
                    }),
                );
            }
        }
        state.chat_cancellations.lock().await.remove(&eid);
        let _ = app2.emit(&eid, serde_json::json!({ "type": "done" }));
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_chat(state: State<'_, Arc<AppState>>, event_id: String) -> Result<(), String> {
    let cancellations = state.chat_cancellations.lock().await;
    let cancelled = cancellations
        .get(&event_id)
        .ok_or_else(|| format!("Chat generation is not active: {event_id}"))?;
    cancelled.store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

async fn run_chat(
    app: &AppHandle,
    state: &Arc<AppState>,
    event_id: &str,
    request: &ChatRequest,
    cancelled: &Arc<std::sync::atomic::AtomicBool>,
) -> Result<(), String> {
    // Authorize the canonical workspace before any configured provider receives
    // even the query embedding input.
    let folder_path = request
        .folder_path
        .as_deref()
        .ok_or_else(|| "Chat request is missing its workspace identity".to_string())?;
    let canonical_workspace = require_workspace(state, folder_path).await?;
    let canonical_workspace_id = canonical_workspace.to_string_lossy().to_string();
    let index_manifest = manifest::load_manifest(&canonical_workspace_id);
    if index_manifest.is_empty() {
        return Err("Index required: this workspace has no completed index".to_string());
    }
    if index_manifest.values().any(|entry| {
        entry.pipeline_version != manifest::INDEX_PIPELINE_VERSION || entry.vector_dimension == 0
    }) {
        return Err("Index rebuild required for the Phase 4 retrieval schema".to_string());
    }
    ensure_manifest_vector_tables_readable(&state.store, &index_manifest).await?;

    let host = request
        .ollama_host
        .clone()
        .unwrap_or_else(|| "http://127.0.0.1:11434".to_string());

    // Use the embedding model (workspace indexing model) for query embedding.
    // Falls back to the chat model if not provided.
    let embed_model = request.embedding_model.as_deref().unwrap_or(&request.model);

    // A pin is persisted only as a frontend workspace/session path. Resolve it
    // through the Rust authorization boundary for every request, then keep the
    // exact canonical source and supplied range available to both the prompt
    // and Evidence considered.
    let pinned_files =
        resolve_pinned_files(&canonical_workspace, request.manual_files.as_deref()).await?;
    let pinned_context = assemble_pinned_context(&pinned_files, &canonical_workspace);
    let pinned_mode = pinned_context_mode(&request.query, &pinned_files);
    let implementation_question = is_implementation_question(&request.query);

    let previous_user_turn = request.history.as_ref().and_then(|turns| {
        turns
            .iter()
            .rev()
            .find(|turn| turn.role.eq_ignore_ascii_case("user"))
            .map(|turn| turn.content.as_str())
    });
    let retrieval_query =
        crate::retrieval_quality::contextualize_query(&request.query, previous_user_turn);
    // A direct request to summarize/describe a pinned source is a source
    // authority request, not a request for loosely related retrieval. Avoid a
    // second model call and omit automatic excerpts only in this narrow mode.
    // Interaction questions such as "how does this pinned file interact with
    // indexing?" keep normal, bounded supporting retrieval.
    let (relevance, evidence) = if pinned_mode == PinnedContextMode::SourceAuthoritative {
        (crate::retrieval_quality::RelevanceLevel::Strong, Vec::new())
    } else {
        let embedding_input = truncate_chars(
            &retrieval_query,
            crate::retrieval_quality::QUERY_BUDGET_CHARS,
        );
        let query_embeddings =
            embeddings::generate_embeddings(&[embedding_input], embed_model, &host).await?;
        let query_embedding = query_embeddings
            .into_iter()
            .next()
            .ok_or("No embedding generated")?;
        let search_results = state
            .store
            .quality_search(
                query_embedding,
                &retrieval_query,
                20,
                &canonical_workspace_id,
            )
            .await?;
        let relevance = match search_results
            .get("relevance")
            .and_then(serde_json::Value::as_str)
        {
            Some("strong") => crate::retrieval_quality::RelevanceLevel::Strong,
            Some("weak") => crate::retrieval_quality::RelevanceLevel::Weak,
            _ => crate::retrieval_quality::RelevanceLevel::None,
        };
        let evidence =
            automatic_evidence_for_generation(&search_results, &canonical_workspace_id, relevance);
        (relevance, evidence)
    };

    let evidence = prioritize_automatic_evidence(evidence, implementation_question);

    if should_decline_without_evidence(relevance, !pinned_context.evidence.is_empty()) {
        let _ = app.emit(
            event_id,
            serde_json::json!({ "type": "citations", "data": Vec::<crate::retrieval::EvidenceResult>::new() }),
        );
        let _ = app.emit(
            event_id,
            serde_json::json!({
                "type": "chunk",
                "data": { "chunk": "I couldn't find enough evidence in this workspace. Try a more specific workspace term or use Find to inspect direct matches." }
            }),
        );
        return Ok(());
    }

    use crate::retrieval_quality::{
        HISTORY_BUDGET_CHARS, INSTRUCTION_BUDGET_CHARS, PER_EVIDENCE_CHARS, QUERY_BUDGET_CHARS,
    };

    let mut context = String::new();
    let mut citations = pinned_context.evidence.clone();
    let mut supplied_evidence = pinned_context
        .evidence
        .iter()
        .map(|source| SuppliedEvidence {
            content: source.content.clone(),
        })
        .collect::<Vec<_>>();
    let mut evidence_used = 0;
    let (automatic_evidence_budget, automatic_evidence_limit) =
        automatic_evidence_limits(!pinned_context.evidence.is_empty());
    for (index, source) in evidence.iter().enumerate() {
        if evidence_used >= automatic_evidence_budget
            || citations
                .len()
                .saturating_sub(pinned_context.evidence.len())
                >= automatic_evidence_limit
        {
            break;
        }
        let header = automatic_evidence_header(index, source);
        let remaining =
            automatic_evidence_budget.saturating_sub(evidence_used + header.chars().count());
        if remaining == 0 {
            break;
        }
        let selected = truncate_chars(&source.content, remaining.min(PER_EVIDENCE_CHARS));
        evidence_used += header.chars().count() + selected.chars().count();
        context.push_str(&header);
        context.push_str(&selected);
        context.push_str("\n\n");
        supplied_evidence.push(SuppliedEvidence { content: selected });
        citations.push(source.clone());
    }

    let _ = app.emit(
        event_id,
        serde_json::json!({ "type": "citations", "data": citations }),
    );

    let sys_block = request
        .system_prompt
        .as_ref()
        .map(|s| {
            format!(
                "USER INSTRUCTION:\n{}\n",
                truncate_chars(s, INSTRUCTION_BUDGET_CHARS)
            )
        })
        .unwrap_or_default();

    let mut messages: Vec<serde_json::Value> = Vec::new();

    let system_content = build_system_content(
        &sys_block,
        &pinned_context,
        &context,
        pinned_mode,
        implementation_question,
    );

    messages.push(serde_json::json!({
        "role": "system",
        "content": system_content
    }));

    if let Some(ref turns) = request.history {
        let mut selected_turns = Vec::new();
        let mut remaining = HISTORY_BUDGET_CHARS;
        for turn in turns.iter().rev() {
            if remaining == 0 {
                break;
            }
            let content = truncate_chars(&turn.content, remaining.min(1_000));
            remaining = remaining.saturating_sub(content.chars().count());
            selected_turns.push((turn, content));
        }
        for (turn, content) in selected_turns.into_iter().rev() {
            let role = if turn.role.to_lowercase() == "assistant" {
                "assistant"
            } else {
                "user"
            };
            messages.push(serde_json::json!({
                "role": role,
                "content": content
            }));
        }
    }

    let mut user_content = String::with_capacity(request.query.len().min(QUERY_BUDGET_CHARS) + 200);
    user_content.push_str(&truncate_chars(&request.query, QUERY_BUDGET_CHARS));
    user_content.push_str("\n\nIMPORTANT: End your response EXACTLY with this block for follow-up questions:\nFOLLOW_UP_SUGGESTIONS:\n1. [question]\n2. [question]\n3. [question]\n");

    messages.push(serde_json::json!({
        "role": "user",
        "content": user_content
    }));

    // Stream the response
    let provider = request.provider.as_deref().unwrap_or("ollama");

    let full_response = match provider {
        "openrouter" => {
            let api_key = crate::credentials::get("openrouter")?;
            let payload = crate::outbound::build_openrouter_payload(
                &request.model,
                &messages,
                request.allow_cloud,
            )?;
            llm::stream_openrouter(app, event_id, &payload, &api_key, cancelled, false).await?
        }
        _ => {
            llm::stream_ollama(
                app,
                event_id,
                &request.model,
                &messages,
                &host,
                cancelled,
                false,
            )
            .await?
        }
    };

    let sanitized_response = sanitize_fenced_source_blocks(
        &full_response,
        &supplied_evidence,
        allows_generated_example_code(&request.query),
    );
    if !sanitized_response.is_empty() {
        let _ = app.emit(
            event_id,
            serde_json::json!({ "type": "chunk", "data": { "chunk": sanitized_response } }),
        );
    }

    // Extract follow-up suggestions
    if let Some(marker_pos) = sanitized_response.find("FOLLOW_UP_SUGGESTIONS:") {
        let suggestions_text = &sanitized_response[marker_pos + "FOLLOW_UP_SUGGESTIONS:".len()..];
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
    folder_path: Option<String>,
    ollama_host: Option<String>,
) -> Result<Vec<crate::retrieval::EvidenceResult>, crate::errors::AppError> {
    let folder_path = folder_path
        .ok_or_else(|| "Search request is missing its workspace identity".to_string())?;
    let workspace = require_workspace(state.inner(), &folder_path).await?;
    let workspace_id = workspace.to_string_lossy().to_string();
    let index_manifest = manifest::load_manifest(&workspace_id);
    if index_manifest.is_empty() {
        return Err("Index required: this workspace has no completed index".into());
    }
    if index_manifest.values().any(|entry| {
        entry.pipeline_version != manifest::INDEX_PIPELINE_VERSION || entry.vector_dimension == 0
    }) {
        return Err("Index rebuild required for the Phase 4 retrieval schema".into());
    }
    ensure_manifest_vector_tables_readable(&state.store, &index_manifest).await?;
    let host = ollama_host.unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
    let cache_key = format!("{}::{}::{}", host, model, query);

    let query_embedding = {
        let mut cache = state.query_cache.lock().await;
        if let Some(emb) = cache.get(&cache_key).cloned() {
            emb
        } else {
            drop(cache);
            let embeddings =
                embeddings::generate_embeddings(std::slice::from_ref(&query), &model, &host)
                    .await?;
            let emb = embeddings.into_iter().next().ok_or("No embedding")?;
            let mut cache = state.query_cache.lock().await;
            cache.put(cache_key, emb.clone());
            emb
        }
    };

    let results = state
        .store
        .quality_search(query_embedding, &query, 10, &workspace_id)
        .await?;

    Ok(crate::retrieval::evidence_from_store(
        &results,
        &workspace_id,
    ))
}

// ─── File Operations ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_file_tree(
    state: State<'_, Arc<AppState>>,
    folder_path: String,
) -> Result<Vec<crawler::FileNode>, String> {
    let workspace = require_workspace(state.inner(), &folder_path).await?;
    crawler::build_file_tree(&workspace.to_string_lossy()).await
}

#[tauri::command]
pub async fn read_file(
    state: State<'_, Arc<AppState>>,
    workspace_path: String,
    file_path: String,
    start: Option<usize>,
    end: Option<usize>,
) -> Result<serde_json::Value, crate::errors::AppError> {
    let workspace = require_workspace(state.inner(), &workspace_path).await?;
    let path = crate::workspace::authorized_file(&workspace, &file_path)?;
    let content = read_file_content(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let lines: Vec<&str> = content.lines().collect();
    let total = lines.len();
    let start = start.unwrap_or(0).min(total);
    let end = end.unwrap_or(total).clamp(start, total);
    let slice: String = lines[start..end].join("\n");

    Ok(serde_json::json!({
        "content": slice,
        "totalLines": total,
    }))
}

// ─── Utility ─────────────────────────────────────────────────────────────────

async fn read_file_content(path: &std::path::Path) -> Result<String, String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());
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
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(1337);
    (nanos as usize) % max
}

#[tauri::command]
pub async fn get_git_context(
    state: State<'_, Arc<AppState>>,
    folder_path: String,
) -> Result<crate::git::GitContext, String> {
    let workspace = require_workspace(state.inner(), &folder_path).await?;
    let folder_path = workspace.to_string_lossy().to_string();
    tokio::task::spawn_blocking(move || crate::git::get_git_context(folder_path))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn job(status: &str) -> IndexingJob {
        IndexingJob {
            id: "job-1".into(),
            folder_path: "workspace".into(),
            workspace_id: "workspace".into(),
            status: status.into(),
            processed_files: 0,
            total_files: 0,
            total_chunks: 0,
            error: None,
            model: "embed".into(),
            requeue_requested: false,
        }
    }

    #[test]
    fn repeated_index_request_is_coalesced_and_requeued() {
        let mut jobs = HashMap::from([("job-1".to_string(), job("running"))]);
        assert_eq!(
            coalesce_active_index_job(&mut jobs, "workspace"),
            Some("job-1".to_string())
        );
        assert!(jobs["job-1"].requeue_requested);
    }

    #[test]
    fn completed_index_request_does_not_block_a_new_job() {
        let mut jobs = HashMap::from([("job-1".to_string(), job("completed"))]);
        assert_eq!(coalesce_active_index_job(&mut jobs, "workspace"), None);
    }

    #[test]
    fn character_truncation_never_splits_unicode() {
        assert_eq!(truncate_chars("aनमस्ते", 2), "aन");
        assert_eq!(truncate_chars("🦀rust", 1), "🦀");
    }

    #[test]
    fn no_evidence_declines_generation_unless_manual_context_exists() {
        use crate::retrieval_quality::RelevanceLevel;

        assert!(should_decline_without_evidence(RelevanceLevel::None, false));
        assert!(should_decline_without_evidence(RelevanceLevel::Weak, false));
        assert!(!should_decline_without_evidence(
            RelevanceLevel::Strong,
            false
        ));
        assert!(!should_decline_without_evidence(RelevanceLevel::None, true));
    }

    #[test]
    fn weak_results_are_not_supplied_or_displayed_as_ask_evidence() {
        let raw = serde_json::json!({
            "ids": [["source"]],
            "documents": [["workspace authorization"]],
            "metadatas": [[{
                "filePath": "C:/workspace/src/workspace.rs",
                "lineRangeStart": 1,
                "lineRangeEnd": 4
            }]],
            "relevance": "weak"
        });
        assert!(automatic_evidence_for_generation(
            &raw,
            "C:/workspace",
            crate::retrieval_quality::RelevanceLevel::Weak,
        )
        .is_empty());

        let strong = automatic_evidence_for_generation(
            &raw,
            "C:/workspace",
            crate::retrieval_quality::RelevanceLevel::Strong,
        );
        assert_eq!(strong.len(), 1);
        assert_eq!(strong[0].file_path, "C:/workspace/src/workspace.rs");
    }

    #[test]
    fn pinned_context_preserves_the_selected_file_and_limits_secondary_context() {
        let root = Path::new("C:/workspace");
        let context = assemble_pinned_context(
            &[PinnedFile {
                file_path: "C:/workspace/src/workspace.rs".to_string(),
                content: "canonicalize selected workspace; reject files outside its root"
                    .to_string(),
            }],
            root,
        );
        assert!(context
            .prompt
            .contains("[P1] PINNED / USER-SELECTED IMPLEMENTATION CODE: src/workspace.rs"));
        assert!(context.prompt.contains("canonicalize selected workspace"));
        assert_eq!(context.evidence.len(), 1);
        assert_eq!(context.evidence[0].display_path, "src/workspace.rs");
        assert_eq!(context.evidence[0].line_start, 1);
        assert_eq!(
            context.evidence[0].source_type,
            crate::retrieval::EvidenceSourceType::PinnedWorkspaceFile
        );
        assert_eq!(automatic_evidence_limits(true), (3_000, 2));
        assert_eq!(automatic_evidence_limits(false), (9_000, 8));
    }

    #[test]
    fn source_directed_pin_is_primary_but_interaction_question_keeps_supporting_mode() {
        let pinned = vec![PinnedFile {
            file_path: "C:/workspace/src/workspace.rs".to_string(),
            content: "pub fn canonical_workspace() {}".to_string(),
        }];
        assert_eq!(
            pinned_context_mode(
                "Using the pinned workspace.rs source, summarize the authorization guarantees.",
                &pinned,
            ),
            PinnedContextMode::SourceAuthoritative
        );
        assert_eq!(
            pinned_context_mode("According to workspace.rs, what is authorized?", &pinned),
            PinnedContextMode::SourceAuthoritative
        );
        assert_eq!(
            pinned_context_mode("How does this pinned file interact with indexing?", &pinned),
            PinnedContextMode::Supporting
        );
        assert_eq!(
            pinned_context_mode(
                "How does this pinned source interact with indexing?",
                &pinned
            ),
            PinnedContextMode::Supporting
        );
    }

    #[test]
    fn source_directed_prompt_cannot_omit_or_displace_the_pinned_source() {
        let root = Path::new("C:/workspace");
        let pinned = assemble_pinned_context(
            &[PinnedFile {
                file_path: "C:/workspace/src/workspace.rs".to_string(),
                content: "pub fn canonical_workspace() {}\npub fn authorized_file() {}".to_string(),
            }],
            root,
        );
        let prompt = build_system_content(
            "",
            &pinned,
            "",
            PinnedContextMode::SourceAuthoritative,
            true,
        );
        assert!(prompt.contains("SOURCE-DIRECTED PIN RULE"));
        assert!(
            prompt.contains("[P1] PINNED / USER-SELECTED IMPLEMENTATION CODE: src/workspace.rs")
        );
        assert!(prompt.contains("pub fn canonical_workspace()"));
        assert!(!prompt.contains("commands.rs"));
        assert!(prompt.contains("AUTOMATIC CONTEXT (secondary to pinned context):\nNone"));
    }

    fn evidence(path: &str, content: &str) -> crate::retrieval::EvidenceResult {
        crate::retrieval::EvidenceResult {
            id: format!("id:{path}"),
            workspace_id: "C:/workspace".to_string(),
            file_path: format!("C:/workspace/{path}"),
            display_path: path.to_string(),
            line_start: 1,
            line_end: 4,
            content: content.to_string(),
            snippet: content.to_string(),
            source_type: crate::retrieval::EvidenceSourceType::WorkspaceFile,
            source_kind: crate::retrieval::source_kind_from_path(path),
        }
    }

    #[test]
    fn implementation_questions_prioritize_code_without_changing_retrieval_results() {
        let sources = vec![
            evidence("docs/design/atlas-1.0-ux-spec.md", "intended index state"),
            evidence(
                "apps/desktop/src-tauri/tests/indexing_test.rs",
                "test helper",
            ),
            evidence(
                "apps/desktop/src-tauri/src/commands.rs",
                "pub async fn start_indexing_internal() {}",
            ),
        ];
        let ordered = prioritize_automatic_evidence(sources.clone(), true);
        assert_eq!(
            ordered[0].display_path,
            "apps/desktop/src-tauri/src/commands.rs"
        );
        assert_eq!(
            prioritize_automatic_evidence(sources.clone(), false),
            sources
        );
    }

    #[test]
    fn implementation_prompt_exposes_source_kind_and_rejects_unsupported_runtime_claims() {
        let automatic = "--- [S1] IMPLEMENTATION CODE: apps/desktop/src-tauri/src/workspace.rs (lines 1-20) ---\npub fn canonical_workspace() {}\n\n--- [S2] DESIGN / SPECIFICATION: docs/design/atlas-1.0-ux-spec.md (lines 1-10) ---\nThe intended UI uses useWorkspaceIndex.\n\n--- [S3] TEST: apps/desktop/src-tauri/tests/indexing_test.rs (lines 1-10) ---\nfn test_only_helper() {}";
        let prompt = build_system_content(
            "",
            &PinnedContext {
                prompt: String::new(),
                evidence: Vec::new(),
            },
            automatic,
            PinnedContextMode::Supporting,
            true,
        );
        assert!(prompt.contains("IMPLEMENTATION-QUESTION RULE"));
        assert!(prompt.contains("only IMPLEMENTATION CODE proves runtime symbols"));
        assert!(prompt.contains(
            "Do not name a runtime symbol unless the cited implementation source contains it"
        ));
        assert!(prompt.contains("DESIGN / SPECIFICATION"));
        assert!(prompt.contains("TEST"));
    }

    #[test]
    fn automatic_evidence_header_carries_actual_source_metadata_into_prompt_context() {
        let source = evidence(
            "apps/desktop/src-tauri/src/workspace.rs",
            "pub fn authorized_file() {}",
        );
        let header = automatic_evidence_header(0, &source);
        assert_eq!(
            header,
            "--- [S1] IMPLEMENTATION CODE: apps/desktop/src-tauri/src/workspace.rs (lines 1-4) ---\n"
        );
        let prompt = build_system_content(
            "",
            &PinnedContext {
                prompt: String::new(),
                evidence: Vec::new(),
            },
            &format!("{header}{}", source.content),
            PinnedContextMode::Supporting,
            true,
        );
        assert!(prompt.contains(&header));
    }

    #[test]
    fn implementation_question_detection_keeps_design_questions_secondary() {
        assert!(is_implementation_question(
            "Where is workspace authorization implemented, and how is it enforced?"
        ));
        assert!(is_implementation_question(
            "What happens after a workspace is authorized and indexing starts?"
        ));
        assert!(!is_implementation_question(
            "What does the design specification say about the intended indexing UX?"
        ));
    }

    fn supplied(content: &str) -> SuppliedEvidence {
        SuppliedEvidence {
            content: content.to_string(),
        }
    }

    #[test]
    fn exact_supplied_source_block_is_retained() {
        let source = "pub fn canonical_workspace(path: &str) -> Result<PathBuf, String> {\n    std::fs::canonicalize(path)\n}";
        let response =
            format!("The function canonicalizes the selected root.\n```rust\n{source}\n```\n");
        assert_eq!(
            sanitize_fenced_source_blocks(&response, &[supplied(source)], false),
            response
        );
    }

    #[test]
    fn original_active_workspace_id_fabrication_is_removed_from_production_answer_assembly() {
        let evidence = "pub async fn start_indexing_internal(\n    app: AppHandle,\n    state: Arc<AppState>,\n    folder_path: String,\n    model: String,\n    ollama_host: String,\n) -> Result<String, String> {\n    let job_id = Uuid::new_v4().to_string();\n    tauri::async_runtime::spawn(async move {\n        run_indexing_job(&app, &state, &job_id, &folder_path, &model, &ollama_host).await\n    });\n    Ok(job_id)\n}";
        let response = "Atlas creates a queued job and runs indexing asynchronously.\n```rust\nstate.active_workspace_id = Some(folder_path.clone());\n```\nThe supplied function then returns the job ID.";
        let sanitized = sanitize_fenced_source_blocks(response, &[supplied(evidence)], false);
        assert!(sanitized.contains("Atlas creates a queued job"));
        assert!(sanitized.contains("returns the job ID"));
        assert!(!sanitized.contains("active_workspace_id"));
        assert!(!sanitized.contains("```"));
    }

    #[test]
    fn answer_sanitization_keeps_the_preselected_evidence_contract_intact() {
        let cited = evidence(
            "apps/desktop/src-tauri/src/commands.rs",
            "pub async fn start_indexing_internal() {}",
        );
        let citations = [cited.clone()];
        let response = "The indexing job is queued.\n```rust\nstate.active_workspace_id = Some(folder_path.clone());\n```";
        let sanitized = sanitize_fenced_source_blocks(response, &[supplied(&cited.content)], false);

        assert!(!sanitized.contains("active_workspace_id"));
        assert_eq!(citations.len(), 1);
        assert_eq!(
            citations[0].display_path,
            "apps/desktop/src-tauri/src/commands.rs"
        );
        assert_eq!(citations[0].line_start, 1);
    }

    #[test]
    fn mixed_real_and_invented_source_block_is_removed_as_a_whole() {
        let evidence = "pub fn canonical_workspace(path: &str) -> Result<PathBuf, String> {\n    std::fs::canonicalize(path)\n}";
        let response = "```rust\npub fn canonical_workspace(path: &str) -> Result<PathBuf, String> {\n    state.active_workspace_id = Some(path.to_string());\n}\n```";
        let sanitized = sanitize_fenced_source_blocks(response, &[supplied(evidence)], false);
        assert!(sanitized.trim().is_empty());
    }

    #[test]
    fn code_validation_accepts_line_endings_and_trailing_whitespace_only() {
        let source = "fn index() {\r\n    run();   \r\n}\r\n";
        let response = "```rust\nfn index() {\n    run();\n}\n```";
        assert_eq!(
            sanitize_fenced_source_blocks(response, &[supplied(source)], false),
            response
        );
    }

    #[test]
    fn block_cannot_validate_against_unsupplied_workspace_source() {
        let supplied_source = "pub fn canonical_workspace() {}";
        let unsupplied_source = "pub fn authorized_file() {}";
        let response = format!("```rust\n{unsupplied_source}\n```");
        let sanitized =
            sanitize_fenced_source_blocks(&response, &[supplied(supplied_source)], false);
        assert!(sanitized.trim().is_empty());
    }

    #[test]
    fn pinned_source_block_validates_against_pinned_evidence() {
        let pinned = "pub fn authorized_file(workspace: &Path, file_path: &str) -> Result<PathBuf, String> {\n    let canonical_file = std::fs::canonicalize(file_path)?;\n    Ok(canonical_file)\n}";
        let response = format!("Pinned source excerpt:\n```rust\n{pinned}\n```");
        assert_eq!(
            sanitize_fenced_source_blocks(&response, &[supplied(pinned)], false),
            response
        );
    }

    #[test]
    fn explicitly_requested_generated_example_code_remains_allowed() {
        let response = "Example:\n```rust\nlet proposed = true;\n```";
        assert!(allows_generated_example_code(
            "Show an example implementation."
        ));
        assert_eq!(sanitize_fenced_source_blocks(response, &[], true), response);
    }

    #[test]
    fn ordinary_write_a_summary_prompt_does_not_bypass_source_validation() {
        let response = "```rust\nstate.active_workspace_id = Some(folder_path.clone());\n```";
        assert!(!allows_generated_example_code(
            "Write a summary of workspace authorization."
        ));
        assert!(sanitize_fenced_source_blocks(response, &[], false)
            .trim()
            .is_empty());
    }

    #[test]
    fn one_pinned_source_can_use_the_full_bounded_pinned_budget() {
        let root = Path::new("C:/workspace");
        let content = "x".repeat(crate::retrieval_quality::PER_PINNED_CHARS + 250);
        let context = assemble_pinned_context(
            &[PinnedFile {
                file_path: "C:/workspace/src/workspace.rs".to_string(),
                content: content.clone(),
            }],
            root,
        );
        assert!(context.prompt.contains(&content));
        assert_eq!(context.evidence[0].content, content);
    }

    #[tokio::test]
    async fn pinned_file_is_canonicalized_and_cannot_escape_its_workspace() {
        let workspace =
            std::env::temp_dir().join(format!("atlas-pinned-workspace-{}", uuid::Uuid::new_v4()));
        let outside =
            std::env::temp_dir().join(format!("atlas-pinned-outside-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&workspace).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        let source = workspace.join("src/workspace.rs");
        let outside_file = outside.join("outside.rs");
        std::fs::create_dir_all(source.parent().unwrap()).unwrap();
        std::fs::write(&source, "pub fn canonical_workspace() {}").unwrap();
        std::fs::write(&outside_file, "not workspace context").unwrap();
        let canonical = crate::workspace::canonical_workspace(workspace.to_str().unwrap()).unwrap();

        let pins = resolve_pinned_files(&canonical, Some(&[source.to_string_lossy().to_string()]))
            .await
            .unwrap();
        assert_eq!(pins.len(), 1);
        assert_eq!(
            pins[0].file_path,
            std::fs::canonicalize(&source).unwrap().to_string_lossy()
        );
        assert!(resolve_pinned_files(
            &canonical,
            Some(&[outside_file.to_string_lossy().to_string()]),
        )
        .await
        .is_err());
        let _ = std::fs::remove_dir_all(workspace);
        let _ = std::fs::remove_dir_all(outside);
    }

    #[test]
    fn lance_fragment_errors_are_logged_but_not_exposed_as_primary_index_ui_text() {
        let raw = "Delete error: lance error: LanceError(IO): Execution error: Not found: C:/Users/owner/.atlas/lancedb/atlas_v2_1536.lance/data/missing.lance";
        let user_message = index_error_for_user(raw);
        assert!(user_message.contains(DAMAGED_LOCAL_INDEX_MESSAGE));
        assert!(!user_message.contains("C:/Users/owner"));
        assert!(user_message.contains("Retry indexing"));
    }
}
