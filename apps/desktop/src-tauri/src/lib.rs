#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;
use tauri::Manager;

mod commands;
mod crawler;
mod embeddings;
mod llm;
mod manifest;
mod shield;
mod vectorstore;
mod websearch;
mod watcher;
mod git;
mod parser;

pub fn run() {
    let app_state = Arc::new(commands::AppState {
        store: vectorstore::AtlasVectorStore::new(None),
        jobs: Mutex::new(HashMap::new()),
        query_cache: Mutex::new(lru::LruCache::new(std::num::NonZeroUsize::new(100).unwrap())),
        watchers: Mutex::new(HashMap::new()),
    });

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["alt+space"])
                .unwrap()
                .with_handler(|app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if shortcut.matches(tauri_plugin_global_shortcut::Modifiers::ALT, tauri_plugin_global_shortcut::Code::Space) {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(app_state)
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_status,
            commands::list_models,
            commands::list_openrouter_models,
            commands::start_indexing,
            commands::get_index_stats,
            commands::start_chat,
            commands::search_files,
            commands::get_file_tree,
            commands::read_file,
            commands::execute_shell_command,
            commands::apply_diff,
            commands::scan_secrets,
            commands::web_search,
            commands::get_timeline,
            watcher::start_watcher,
            watcher::stop_watcher,
            commands::get_git_context,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
