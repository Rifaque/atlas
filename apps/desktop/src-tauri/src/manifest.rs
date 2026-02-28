use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// A single entry in the manifest — tracks when a file was last indexed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub mtime: f64,       // ms since epoch (matching JS format)
    pub chunk_count: u32,
    #[serde(default)]
    pub model: String,
}

pub type Manifest = HashMap<String, ManifestEntry>;

/// Get the Atlas data directory (~/.atlas/)
fn atlas_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".atlas")
}

/// Get the manifest file path for a workspace
fn manifest_path(workspace_id: &str) -> PathBuf {
    let dir = atlas_dir().join("manifests");
    fs::create_dir_all(&dir).ok();
    dir.join(format!("{}.json", workspace_id))
}

/// Derive a stable workspace ID from the folder path (slugified, matching TS logic)
pub fn workspace_id(folder_path: &str) -> String {
    let slug: String = folder_path
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();
    // Collapse consecutive underscores and truncate
    let mut result = String::with_capacity(80);
    let mut last_underscore = false;
    for c in slug.chars() {
        if c == '_' {
            if !last_underscore {
                result.push('_');
            }
            last_underscore = true;
        } else {
            result.push(c);
            last_underscore = false;
        }
        if result.len() >= 80 {
            break;
        }
    }
    result
}

/// Load the manifest for a given workspace folder
pub fn load_manifest(folder_path: &str) -> Manifest {
    let id = workspace_id(folder_path);
    let path = manifest_path(&id);
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => HashMap::new(),
        }
    } else {
        HashMap::new()
    }
}

/// Save the manifest for a given workspace folder
pub fn save_manifest(folder_path: &str, manifest: &Manifest) {
    let id = workspace_id(folder_path);
    let path = manifest_path(&id);
    if let Ok(json) = serde_json::to_string_pretty(manifest) {
        fs::write(path, json).ok();
    }
}

/// Check if a file needs to be re-indexed (new or modified since last index, or model changed)
pub fn needs_indexing(manifest: &Manifest, file_path: &str, current_model: &str) -> bool {
    match manifest.get(file_path) {
        None => true, // never indexed
        Some(entry) => {
            if entry.model != current_model {
                return true; // model changed, must re-embed
            }
            match fs::metadata(file_path) {
                Ok(meta) => {
                    let mtime_ms = meta
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs_f64() * 1000.0)
                        .unwrap_or(0.0);
                    mtime_ms > entry.mtime
                }
                Err(_) => false, // file deleted — skip
            }
        }
    }
}

/// Mark a file as indexed in the manifest
pub fn mark_indexed(manifest: &mut Manifest, file_path: &str, chunk_count: u32, model: &str) {
    if let Ok(meta) = fs::metadata(file_path) {
        let mtime_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs_f64() * 1000.0)
            .unwrap_or(0.0);
        manifest.insert(
            file_path.to_string(),
            ManifestEntry {
                mtime: mtime_ms,
                chunk_count,
                model: model.to_string(),
            },
        );
    }
}

/// Remove a file from the manifest (for deleted files)
pub fn remove_from_manifest(manifest: &mut Manifest, file_path: &str) {
    manifest.remove(file_path);
}
