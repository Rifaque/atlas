use crate::commands::{start_indexing_internal, AppState};
use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn start_watcher(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    folder_path: String,
    model: String,
    ollama_host: Option<String>,
) -> Result<(), String> {
    let workspace = crate::commands::require_workspace(state.inner(), &folder_path).await?;
    let folder_path = workspace.to_string_lossy().to_string();
    let mut watchers = state.watchers.lock().await;

    // Check if already watching this folder
    if watchers.contains_key(&folder_path) {
        return Ok(());
    }

    let (tx, rx) = std::sync::mpsc::channel();
    let mut debouncer = new_debouncer(Duration::from_secs(2), tx)
        .map_err(|e| format!("Failed to create watcher: {e}"))?;
    debouncer
        .watcher()
        .watch(std::path::Path::new(&folder_path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch folder: {e}"))?;

    let is_running = Arc::new(AtomicBool::new(true));
    watchers.insert(folder_path.clone(), is_running.clone());

    let folder_clone = folder_path.clone();
    let app_clone = app.clone();
    let state_inner = state.inner().clone();
    let ollama_host = ollama_host.unwrap_or_else(|| "http://127.0.0.1:11434".to_string());

    std::thread::spawn(move || {
        while is_running.load(Ordering::SeqCst) {
            match rx.recv_timeout(Duration::from_millis(500)) {
                Ok(Ok(events)) => {
                    let mut needs_reindex = false;
                    for event in events {
                        let path_str = event.path.to_string_lossy();
                        if path_str.contains(".atlas")
                            || path_str.contains(".git")
                            || path_str.contains("node_modules")
                            || path_str.contains("target")
                        {
                            continue;
                        }
                        needs_reindex = true;
                    }

                    if needs_reindex {
                        let a = app_clone.clone();
                        let s = state_inner.clone();
                        let f = folder_clone.clone();
                        let m = model.clone();
                        let h = ollama_host.clone();
                        tauri::async_runtime::spawn(async move {
                            log::info!("[watcher] Triggering indexer for changes in {}", f);
                            let _ = start_indexing_internal(a, s, f, m, h).await;
                        });
                    }
                }
                Ok(Err(e)) => {
                    log::error!("Watcher error: {:?}", e);
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // Timeout hit, loop around and check is_running
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }

        // debouncer is dropped here, stopping the watch.
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_watcher(
    state: State<'_, Arc<AppState>>,
    folder_path: String,
) -> Result<(), String> {
    let workspace = crate::commands::require_workspace(state.inner(), &folder_path).await?;
    let folder_path = workspace.to_string_lossy().to_string();
    let mut watchers = state.watchers.lock().await;
    if let Some(is_running) = watchers.remove(&folder_path) {
        is_running.store(false, Ordering::SeqCst);
    }
    Ok(())
}
