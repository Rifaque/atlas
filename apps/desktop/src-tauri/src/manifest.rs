use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// Version 7 excludes Atlas's synthetic retrieval-evaluation corpus from normal
// workspace indexes. Version 6 recorded embedding-vector dimensions so shared
// generated tables can be recovered without a false healthy manifest.
pub const INDEX_PIPELINE_VERSION: u32 = 7;

/// A single entry in the manifest — tracks when a file was last indexed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub mtime: f64, // ms since epoch (matching JS format)
    pub chunk_count: u32,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub content_hash: String,
    #[serde(default)]
    pub chunk_ids: Vec<String>,
    #[serde(default)]
    pub cleanup_pending: bool,
    #[serde(default)]
    pub pipeline_version: u32,
    /// The Lance table is dimension-named.  Older manifests deserialize as 0
    /// and are deliberately incompatible with the v6 integrity contract.
    #[serde(default)]
    pub vector_dimension: usize,
}

pub type Manifest = HashMap<String, ManifestEntry>;

pub fn last_completed_at(folder_path: &str) -> Option<f64> {
    let path = manifest_path(&workspace_id(folder_path));
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs_f64() * 1000.0)
}

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
    format!(
        "{}_{:016x}",
        legacy_workspace_id(folder_path),
        stable_hash(folder_path.as_bytes())
    )
}

fn legacy_workspace_id(folder_path: &str) -> String {
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
        if result.len() >= 60 {
            break;
        }
    }
    result
}

/// A deterministic, non-cryptographic content fingerprint used for change detection.
pub fn content_hash(content: &str) -> String {
    format!("{:016x}", stable_hash(content.as_bytes()))
}

fn stable_hash(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// Load the manifest for a given workspace folder
pub fn load_manifest(folder_path: &str) -> Manifest {
    let id = workspace_id(folder_path);
    let path = manifest_path(&id);
    let backup_path = path.with_extension("json.bak");
    let legacy_path = manifest_path(&legacy_workspace_id(folder_path));
    let readable_path = if path.exists() {
        &path
    } else if backup_path.exists() {
        &backup_path
    } else {
        &legacy_path
    };
    if readable_path.exists() {
        match fs::read_to_string(readable_path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => HashMap::new(),
        }
    } else {
        HashMap::new()
    }
}

/// Save the manifest for a given workspace folder
pub fn save_manifest(folder_path: &str, manifest: &Manifest) -> Result<(), String> {
    let id = workspace_id(folder_path);
    let path = manifest_path(&id);
    save_manifest_at_path(&path, manifest)
}

fn save_manifest_at_path(path: &std::path::Path, manifest: &Manifest) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(manifest)
        .map_err(|e| format!("Failed to serialize index manifest: {e}"))?;
    let temp_path = path.with_extension(format!("json.{}.tmp", std::process::id()));
    let backup_path = path.with_extension("json.bak");
    fs::write(&temp_path, json)
        .map_err(|e| format!("Failed to write index manifest staging file: {e}"))?;
    if path.exists() {
        let _ = fs::remove_file(&backup_path);
        fs::rename(path, &backup_path)
            .map_err(|e| format!("Failed to stage previous index manifest: {e}"))?;
    }
    if let Err(error) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        if backup_path.exists() {
            let _ = fs::rename(&backup_path, path);
        }
        return Err(format!("Failed to commit index manifest: {error}"));
    }
    let _ = fs::remove_file(backup_path);
    Ok(())
}

/// Invalidate only manifests whose rows may have been stored in a recovered
/// generated table.  A v5-or-earlier manifest lacks dimension ownership, so it
/// is conservatively invalidated too; those entries are already incompatible
/// with the v6 pipeline and must never claim vectors that were dropped.
pub fn invalidate_manifests_for_table_dimension(vector_dimension: usize) -> Result<usize, String> {
    invalidate_manifest_directory_for_table_dimension(
        &atlas_dir().join("manifests"),
        vector_dimension,
    )
}

fn invalidate_manifest_directory_for_table_dimension(
    directory: &std::path::Path,
    vector_dimension: usize,
) -> Result<usize, String> {
    if !directory.exists() {
        return Ok(0);
    }
    let mut invalidated = 0;
    for entry in fs::read_dir(directory)
        .map_err(|e| format!("Failed to inspect index manifests for recovery: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Failed to read an index manifest entry: {e}"))?;
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
            continue;
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read index manifest {}: {e}", path.display()))?;
        let mut manifest: Manifest = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse index manifest {}: {e}", path.display()))?;
        let mut changed = false;
        for record in manifest.values_mut() {
            if record.vector_dimension == vector_dimension || record.vector_dimension == 0 {
                record.pipeline_version = 0;
                record.vector_dimension = 0;
                record.chunk_count = 0;
                record.chunk_ids.clear();
                record.cleanup_pending = false;
                changed = true;
            }
        }
        if changed {
            save_manifest_at_path(&path, &manifest)?;
            invalidated += 1;
        }
    }
    Ok(invalidated)
}

/// Check if a file needs to be re-indexed (new or modified since last index, or model changed)
pub fn needs_indexing(
    manifest: &Manifest,
    file_path: &str,
    current_model: &str,
    current_content_hash: &str,
) -> bool {
    match manifest.get(file_path) {
        None => true, // never indexed
        Some(entry) => {
            if entry.cleanup_pending
                || entry.vector_dimension == 0
                || entry.pipeline_version != INDEX_PIPELINE_VERSION
                || entry.model != current_model
                || entry.content_hash != current_content_hash
            {
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

#[allow(clippy::too_many_arguments)]
pub fn mark_indexed_with_dimension(
    manifest: &mut Manifest,
    file_path: &str,
    chunk_count: u32,
    model: &str,
    content_hash: String,
    chunk_ids: Vec<String>,
    cleanup_pending: bool,
    vector_dimension: usize,
) {
    let mtime_ms = fs::metadata(file_path)
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs_f64() * 1000.0)
        .unwrap_or(0.0);
    manifest.insert(
        file_path.to_string(),
        ManifestEntry {
            mtime: mtime_ms,
            chunk_count,
            model: model.to_string(),
            content_hash,
            chunk_ids,
            cleanup_pending,
            pipeline_version: INDEX_PIPELINE_VERSION,
            vector_dimension,
        },
    );
}

/// Remove a file from the manifest (for deleted files)
pub fn remove_from_manifest(manifest: &mut Manifest, file_path: &str) {
    manifest.remove(file_path);
}

/// Commit a file's manifest state only after its replacement data is durable.
// Keeping the complete intended state alongside the two transaction callbacks
// makes the commit ordering explicit at every call site.
#[allow(clippy::too_many_arguments)]
pub async fn commit_replacement<Durable, DurableFuture, Save>(
    manifest: &mut Manifest,
    file_path: &str,
    chunk_count: u32,
    model: &str,
    content_hash: String,
    chunk_ids: Vec<String>,
    vector_dimension: usize,
    durable_replace: Durable,
    save: Save,
) -> Result<(), String>
where
    Durable: FnOnce() -> DurableFuture,
    DurableFuture: std::future::Future<Output = Result<(), String>>,
    Save: FnOnce(&Manifest) -> Result<(), String>,
{
    durable_replace().await?;
    let mut next = manifest.clone();
    mark_indexed_with_dimension(
        &mut next,
        file_path,
        chunk_count,
        model,
        content_hash,
        chunk_ids,
        true,
        vector_dimension,
    );
    save(&next)?;
    *manifest = next;
    Ok(())
}

/// Remove a manifest entry only after its durable index rows are gone.
pub async fn commit_deletion<Durable, DurableFuture, Save>(
    manifest: &mut Manifest,
    file_path: &str,
    durable_delete: Durable,
    save: Save,
) -> Result<(), String>
where
    Durable: FnOnce() -> DurableFuture,
    DurableFuture: std::future::Future<Output = Result<(), String>>,
    Save: FnOnce(&Manifest) -> Result<(), String>,
{
    durable_delete().await?;
    let mut next = manifest.clone();
    remove_from_manifest(&mut next, file_path);
    save(&next)?;
    *manifest = next;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_fingerprint_is_stable_and_changes_with_content() {
        assert_eq!(content_hash("hello"), content_hash("hello"));
        assert_ne!(content_hash("hello"), content_hash("hello!"));
    }

    #[test]
    fn manifest_identity_keeps_a_full_path_fingerprint() {
        let prefix = "a".repeat(100);
        assert_ne!(
            workspace_id(&format!("{prefix}/one")),
            workspace_id(&format!("{prefix}/two"))
        );
    }

    #[test]
    fn unchanged_requires_matching_model_and_content() {
        let mut manifest = Manifest::new();
        manifest.insert(
            "file.rs".into(),
            ManifestEntry {
                mtime: 0.0,
                chunk_count: 1,
                model: "embed".into(),
                content_hash: content_hash("current"),
                chunk_ids: vec!["current-id".into()],
                cleanup_pending: false,
                pipeline_version: INDEX_PIPELINE_VERSION,
                vector_dimension: 1536,
            },
        );
        assert!(!needs_indexing(
            &manifest,
            "file.rs",
            "embed",
            &content_hash("current")
        ));
        assert!(needs_indexing(
            &manifest,
            "file.rs",
            "embed",
            &content_hash("changed")
        ));
        assert!(needs_indexing(
            &manifest,
            "file.rs",
            "other",
            &content_hash("current")
        ));
        manifest.get_mut("file.rs").unwrap().pipeline_version = 0;
        assert!(needs_indexing(
            &manifest,
            "file.rs",
            "embed",
            &content_hash("current")
        ));
    }

    #[tokio::test]
    async fn initial_indexing_publishes_manifest_after_durable_data() {
        let mut manifest = Manifest::new();
        let durable = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let durable_for_write = durable.clone();
        let durable_for_save = durable.clone();
        commit_replacement(
            &mut manifest,
            "initial.rs",
            1,
            "embed",
            content_hash("initial"),
            vec!["initial-id".into()],
            1536,
            move || async move {
                durable_for_write.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
            move |_| {
                assert!(durable_for_save.load(std::sync::atomic::Ordering::SeqCst));
                Ok(())
            },
        )
        .await
        .unwrap();
        assert!(manifest.contains_key("initial.rs"));
        assert!(manifest["initial.rs"].cleanup_pending);
        assert_eq!(manifest["initial.rs"].chunk_ids, ["initial-id"]);
    }

    #[tokio::test]
    async fn failed_replacement_preserves_previous_manifest_and_retry_commits() {
        let mut manifest = Manifest::new();
        mark_indexed_with_dimension(
            &mut manifest,
            "file.rs",
            1,
            "embed",
            content_hash("old"),
            vec!["old-id".into()],
            false,
            1536,
        );

        let failed = commit_replacement(
            &mut manifest,
            "file.rs",
            2,
            "embed",
            content_hash("new"),
            vec!["new-1".into(), "new-2".into()],
            1536,
            || async { Err("embedding failure".to_string()) },
            |_| Ok(()),
        )
        .await;
        assert!(failed.is_err());
        assert_eq!(manifest["file.rs"].content_hash, content_hash("old"));

        commit_replacement(
            &mut manifest,
            "file.rs",
            2,
            "embed",
            content_hash("new"),
            vec!["new-1".into(), "new-2".into()],
            1536,
            || async { Ok(()) },
            |_| Ok(()),
        )
        .await
        .unwrap();
        assert_eq!(manifest["file.rs"].content_hash, content_hash("new"));
        assert_eq!(manifest["file.rs"].chunk_count, 2);
    }

    #[tokio::test]
    async fn durable_save_failure_does_not_publish_new_manifest_in_memory() {
        let mut manifest = Manifest::new();
        let result = commit_replacement(
            &mut manifest,
            "file.rs",
            1,
            "embed",
            content_hash("new"),
            vec!["new-id".into()],
            1536,
            || async { Ok(()) },
            |_| Err("disk full".to_string()),
        )
        .await;
        assert!(result.is_err());
        assert!(!manifest.contains_key("file.rs"));
    }

    #[tokio::test]
    async fn deletion_and_rename_update_manifest_after_durable_operations() {
        let mut manifest = Manifest::new();
        mark_indexed_with_dimension(
            &mut manifest,
            "old.rs",
            1,
            "embed",
            content_hash("body"),
            vec!["old-id".into()],
            false,
            1536,
        );
        commit_deletion(&mut manifest, "old.rs", || async { Ok(()) }, |_| Ok(()))
            .await
            .unwrap();
        commit_replacement(
            &mut manifest,
            "new.rs",
            1,
            "embed",
            content_hash("body"),
            vec!["new-id".into()],
            1536,
            || async { Ok(()) },
            |_| Ok(()),
        )
        .await
        .unwrap();
        assert!(!manifest.contains_key("old.rs"));
        assert!(manifest.contains_key("new.rs"));
    }

    #[test]
    fn recovery_invalidates_only_affected_and_legacy_manifest_entries() {
        let directory =
            std::env::temp_dir().join(format!("atlas-manifest-recovery-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&directory).unwrap();
        let current_path = directory.join("current.json");
        let unaffected_path = directory.join("unaffected.json");

        let entry = |dimension, pipeline| ManifestEntry {
            mtime: 0.0,
            chunk_count: 4,
            model: "nomic-embed-text:latest".into(),
            content_hash: "hash".into(),
            chunk_ids: vec!["chunk".into()],
            cleanup_pending: true,
            pipeline_version: pipeline,
            vector_dimension: dimension,
        };
        let mut current = Manifest::new();
        current.insert("current.rs".into(), entry(1536, INDEX_PIPELINE_VERSION));
        current.insert("legacy.rs".into(), entry(0, 5));
        save_manifest_at_path(&current_path, &current).unwrap();

        let mut unaffected = Manifest::new();
        unaffected.insert("other.rs".into(), entry(768, INDEX_PIPELINE_VERSION));
        save_manifest_at_path(&unaffected_path, &unaffected).unwrap();

        assert_eq!(
            invalidate_manifest_directory_for_table_dimension(&directory, 1536).unwrap(),
            1
        );
        let repaired: Manifest =
            serde_json::from_str(&fs::read_to_string(&current_path).unwrap()).unwrap();
        for key in ["current.rs", "legacy.rs"] {
            assert_eq!(repaired[key].pipeline_version, 0);
            assert_eq!(repaired[key].vector_dimension, 0);
            assert_eq!(repaired[key].chunk_count, 0);
            assert!(repaired[key].chunk_ids.is_empty());
            assert!(!repaired[key].cleanup_pending);
        }
        let untouched: Manifest =
            serde_json::from_str(&fs::read_to_string(&unaffected_path).unwrap()).unwrap();
        assert_eq!(untouched["other.rs"].vector_dimension, 768);
        assert_eq!(
            untouched["other.rs"].pipeline_version,
            INDEX_PIPELINE_VERSION
        );
        let _ = fs::remove_dir_all(directory);
    }
}
