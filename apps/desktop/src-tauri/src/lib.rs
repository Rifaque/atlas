use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::sync::{Arc, Mutex};

type Child = tauri_plugin_shell::process::CommandChild;

pub struct ManagedProcesses {
    pub backend: Mutex<Option<Child>>,
}

fn kill_services(processes: &Arc<ManagedProcesses>) {
    if let Ok(mut g) = processes.backend.lock() {
        if let Some(c) = g.take() { let _ = c.kill(); }
    }
}

#[tauri::command]
async fn start_services(app: tauri::AppHandle) -> Result<String, String> {
    let processes = app.state::<Arc<ManagedProcesses>>();

    // boot up the node backend sidecar process
    {
        let mut backend = processes.backend.lock().unwrap();
        if backend.is_none() {
            match app.shell().sidecar("atlas-backend") {
                Ok(cmd) => match cmd.spawn() {
                    Ok((_rx, child)) => { *backend = Some(child); }
                    Err(e) => { 
                        eprintln!("[atlas] Sidecar spawn failed: {e} (might be already running)");
                    }
                },
                Err(e) => { 
                    eprintln!("[atlas] Sidecar setup failed: {e}");
                }
            }
        }
    }

    Ok("Services started".to_string())
}

#[tauri::command]
async fn stop_services(app: tauri::AppHandle) {
    let processes = app.state::<Arc<ManagedProcesses>>();
    kill_services(&processes);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let processes: Arc<ManagedProcesses> = Arc::new(ManagedProcesses {
        backend: Mutex::new(None),
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .manage(Arc::clone(&processes))
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = start_services(handle).await {
                    eprintln!("[atlas] Service start error: {e}");
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_services, stop_services])
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                kill_services(&processes);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
