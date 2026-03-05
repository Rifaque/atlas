use ignore::gitignore::GitignoreBuilder;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;

/// Maximum file size to crawl (10 MB)
const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;

/// File extensions that Atlas will index
static ALLOWED_EXTENSIONS: &[&str] = &[
    "txt", "md", "py", "js", "ts", "jsx", "tsx",
    "java", "c", "cpp", "h", "cs", "go", "rs",
    "rb", "php", "swift", "kt", "scala",
    "json", "yaml", "yml", "toml", "env",
    "pdf", "csv", "log", "sql", "html", "css", "xml",
];

/// Directories/patterns always ignored
static DEFAULT_IGNORES: &[&str] = &[
    "node_modules/", ".git/", ".atlas/", "dist/", "build/",
    "coverage/", ".next/", "out/", "target/", "vendor/", "tmp/",
    ".venv/", "venv/", "__pycache__/", ".mypy_cache/", ".pytest_cache/",
    ".turbo/", ".cache/", "storybook-static/", "*.min.js", "*.min.css",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileData {
    pub file_path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub file_path: String,
    pub mtime: f64,
}

/// A lightweight DirectoryEntry for file tree display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub node_type: String, // "file" or "directory"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

/// Check if a file extension is allowed
fn is_allowed(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| ALLOWED_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Build a gitignore matcher for the workspace
fn build_ignore(workspace_dir: &Path) -> ignore::gitignore::Gitignore {
    let mut builder = GitignoreBuilder::new(workspace_dir);
    // Add default ignores
    for pattern in DEFAULT_IGNORES {
        builder.add_line(None, pattern).ok();
    }
    // Try to load .gitignore
    let gitignore_path = workspace_dir.join(".gitignore");
    if gitignore_path.exists() {
        builder.add(&gitignore_path);
    }
    builder.build().unwrap_or_else(|_| {
        GitignoreBuilder::new(workspace_dir).build().unwrap()
    })
}

/// Crawl a directory and return all indexable files
pub async fn crawl_directory(dir: &str) -> Result<Vec<FileData>, String> {
    let root = PathBuf::from(dir);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", dir));
    }

    let gitignore = build_ignore(&root);
    let mut files = Vec::new();
    let mut stack: Vec<PathBuf> = vec![root.clone()];

    while let Some(current) = stack.pop() {
        let mut entries = fs::read_dir(&current)
            .await
            .map_err(|e| format!("Failed to read {}: {}", current.display(), e))?;

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden directories/files
            if name.starts_with('.') {
                continue;
            }

            let rel_path = path.strip_prefix(&root).unwrap_or(&path);
            let rel_str = rel_path.to_string_lossy().replace('\\', "/");

            if entry.file_type().await.map(|t| t.is_dir()).unwrap_or(false) {
                let dir_rel = format!("{}/", rel_str);
                if gitignore
                    .matched_path_or_any_parents(&dir_rel, true)
                    .is_ignore()
                {
                    continue;
                }
                stack.push(path);
            } else if entry.file_type().await.map(|t| t.is_file()).unwrap_or(false) {
                if gitignore
                    .matched_path_or_any_parents(&rel_str, false)
                    .is_ignore()
                {
                    continue;
                }

                if !is_allowed(&path) {
                    continue;
                }

                // Check file size
                if let Ok(meta) = fs::metadata(&path).await {
                    if meta.len() > MAX_FILE_BYTES {
                        log::warn!(
                            "[crawler] Skipping large file ({:.1} MB): {}",
                            meta.len() as f64 / 1e6,
                            path.display()
                        );
                        continue;
                    }
                }

                let ext = path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase());

                // Read file content
                if ext.as_deref() == Some("pdf") {
                    let path_clone = path.clone();
                    match tokio::task::spawn_blocking(move || pdf_extract::extract_text(&path_clone)).await {
                        Ok(Ok(content)) => {
                            if !content.trim().is_empty() {
                                files.push(FileData {
                                    file_path: path.to_string_lossy().to_string(),
                                    content,
                                });
                            }
                        }
                        _ => {
                            log::warn!("[crawler] Failed to extract text from PDF: {}", path.display());
                        }
                    }
                } else {
                    match fs::read_to_string(&path).await {
                        Ok(content) => {
                            if !content.trim().is_empty() {
                                files.push(FileData {
                                    file_path: path.to_string_lossy().to_string(),
                                    content,
                                });
                            }
                        }
                        Err(_) => {
                            // Binary file or encoding error — skip
                        }
                    }
                }
            }
        }
    }

    Ok(files)
}

/// Crawl a directory and return metadata for all indexable files (no content reading)
pub async fn crawl_metadata(dir: &str) -> Result<Vec<FileMetadata>, String> {
    let root = PathBuf::from(dir);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", dir));
    }

    let gitignore = build_ignore(&root);
    let mut files = Vec::new();
    let mut stack: Vec<PathBuf> = vec![root.clone()];

    while let Some(current) = stack.pop() {
        let mut entries = match fs::read_dir(&current).await {
            Ok(e) => e,
            Err(_) => continue,
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with('.') {
                continue;
            }

            let rel_path = path.strip_prefix(&root).unwrap_or(&path);
            let rel_str = rel_path.to_string_lossy().replace('\\', "/");

            if entry.file_type().await.map(|t| t.is_dir()).unwrap_or(false) {
                let dir_rel = format!("{}/", rel_str);
                if gitignore.matched_path_or_any_parents(&dir_rel, true).is_ignore() {
                    continue;
                }
                stack.push(path);
            } else if entry.file_type().await.map(|t| t.is_file()).unwrap_or(false) {
                if gitignore.matched_path_or_any_parents(&rel_str, false).is_ignore() {
                    continue;
                }
                if !is_allowed(&path) {
                    continue;
                }

                if let Ok(meta) = fs::metadata(&path).await {
                    let mtime = meta.modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs_f64() * 1000.0)
                        .unwrap_or(0.0);

                    files.push(FileMetadata {
                        file_path: path.to_string_lossy().to_string(),
                        mtime,
                    });
                }
            }
        }
    }

    Ok(files)
}

/// Build a file tree for display in the UI
pub async fn build_file_tree(dir: &str) -> Result<Vec<FileNode>, String> {
    let root = PathBuf::from(dir);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", dir));
    }

    let gitignore = build_ignore(&root);
    build_tree_recursive(&root, &root, &gitignore).await
}

#[async_recursion::async_recursion]
async fn build_tree_recursive(
    current: &Path,
    root: &Path,
    gitignore: &ignore::gitignore::Gitignore,
) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();
    let mut entries = fs::read_dir(current)
        .await
        .map_err(|e| format!("Failed to read {}: {}", current.display(), e))?;

    let mut children: Vec<(String, PathBuf, bool)> = Vec::new();
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        let is_dir = entry.file_type().await.map(|t| t.is_dir()).unwrap_or(false);
        children.push((name, path, is_dir));
    }
    children.sort_by(|a, b| {
        // Directories first, then alphabetical
        b.2.cmp(&a.2).then(a.0.to_lowercase().cmp(&b.0.to_lowercase()))
    });

    for (name, path, is_dir) in children {
        let rel_path = path.strip_prefix(root).unwrap_or(&path);
        let rel_str = rel_path.to_string_lossy().replace('\\', "/");

        if is_dir {
            let dir_rel = format!("{}/", rel_str);
            if gitignore.matched_path_or_any_parents(&dir_rel, true).is_ignore() {
                continue;
            }
            let sub = build_tree_recursive(&path, root, gitignore).await?;
            if !sub.is_empty() {
                nodes.push(FileNode {
                    name,
                    path: path.to_string_lossy().to_string(),
                    node_type: "directory".to_string(),
                    children: Some(sub),
                });
            }
        } else {
            if gitignore.matched_path_or_any_parents(&rel_str, false).is_ignore() {
                continue;
            }
            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                node_type: "file".to_string(),
                children: None,
            });
        }
    }

    Ok(nodes)
}
