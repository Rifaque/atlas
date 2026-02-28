use std::sync::Arc;

use tokio::sync::Mutex;
use std::collections::HashMap;

mod commands;
mod crawler;
mod embeddings;
mod llm;
mod manifest;
mod vectorstore;

// Prevents additional console window on Windows in release
#[cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(commands::AppState {
        store: vectorstore::AtlasVectorStore::new(None),
        jobs: Mutex::new(HashMap::new()),
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
