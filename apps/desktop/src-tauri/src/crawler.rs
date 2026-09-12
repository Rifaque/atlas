use ignore::gitignore::GitignoreBuilder;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;

/// Maximum file size to crawl (10 MB)
const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;

/// File extensions that Atlas will index
static ALLOWED_EXTENSIONS: &[&str] = &[
    "txt", "md", "py", "js", "ts", "jsx", "tsx", "java", "c", "cpp", "h", "cs", "go", "rs", "rb",
    "php", "swift", "kt", "scala", "json", "yaml", "yml", "toml", "env", "pdf", "csv", "log",
    "sql", "html", "css", "xml",
];

/// Directories/patterns always ignored
static DEFAULT_IGNORES: &[&str] = &[
    "node_modules/",
    ".git/",
    ".atlas/",
    "dist/",
    "build/",
    "coverage/",
    ".next/",
    "out/",
    "target/",
    "vendor/",
    "tmp/",
    ".venv/",
    "venv/",
    "__pycache__/",
    ".mypy_cache/",
    ".pytest_cache/",
    ".turbo/",
    ".cache/",
    "storybook-static/",
    // Audit reports preserve historical findings. They remain in the
    // repository, but do not represent current product behavior for Ask.
    "docs/audits/",
    // This is Atlas's synthetic retrieval-evaluation corpus, not a source of
    // truth about the opened workspace. Keep ordinary tests and fixtures
    // indexable; exclude only this internal evaluation artifact.
    "apps/desktop/src-tauri/fixtures/retrieval/",
    "*.min.js",
    "*.min.css",
];

fn is_internal_retrieval_fixture(relative_path: &str) -> bool {
    relative_path.replace('\\', "/") == "apps/desktop/src-tauri/fixtures/retrieval/evaluation.json"
}

fn is_explicitly_archival_document(relative_path: &str, content: &str) -> bool {
    let path = relative_path.replace('\\', "/").to_lowercase();
    if path.starts_with("docs/audits/") {
        return true;
    }
    let opening = content
        .lines()
        .take(12)
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
    opening.contains("archived pre-refresh")
        || opening.contains("archived pre-1.0")
        || opening.contains("not the current atlas 1.0 product contract")
        || opening.contains("historical or exploratory and are not commitments")
        || opening.contains("archived pre-refresh measurements")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileData {
    pub file_path: String,
    pub content: String,
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
    builder
        .build()
        .unwrap_or_else(|_| GitignoreBuilder::new(workspace_dir).build().unwrap())
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
            } else if entry
                .file_type()
                .await
                .map(|t| t.is_file())
                .unwrap_or(false)
            {
                if is_internal_retrieval_fixture(&rel_str) {
                    continue;
                }
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

                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase());

                // Read file content
                if ext.as_deref() == Some("pdf") {
                    let path_clone = path.clone();
                    match tokio::task::spawn_blocking(move || {
                        pdf_extract::extract_text(&path_clone)
                    })
                    .await
                    {
                        Ok(Ok(content)) => {
                            if !content.trim().is_empty() {
                                files.push(FileData {
                                    file_path: path.to_string_lossy().to_string(),
                                    content,
                                });
                            }
                        }
                        _ => {
                            log::warn!(
                                "[crawler] Failed to extract text from PDF: {}",
                                path.display()
                            );
                        }
                    }
                } else {
                    match fs::read_to_string(&path).await {
                        Ok(content) => {
                            if !content.trim().is_empty()
                                && !is_explicitly_archival_document(&rel_str, &content)
                            {
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
        b.2.cmp(&a.2)
            .then(a.0.to_lowercase().cmp(&b.0.to_lowercase()))
    });

    for (name, path, is_dir) in children {
        let rel_path = path.strip_prefix(root).unwrap_or(&path);
        let rel_str = rel_path.to_string_lossy().replace('\\', "/");

        if is_dir {
            let dir_rel = format!("{}/", rel_str);
            if gitignore
                .matched_path_or_any_parents(&dir_rel, true)
                .is_ignore()
            {
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
            if is_internal_retrieval_fixture(&rel_str) {
                continue;
            }
            if gitignore
                .matched_path_or_any_parents(&rel_str, false)
                .is_ignore()
            {
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

#[cfg(test)]
mod tests {
    use super::{crawl_directory, is_explicitly_archival_document, is_internal_retrieval_fixture};

    #[test]
    fn historical_audits_and_explicitly_archived_docs_are_not_runtime_sources() {
        assert!(is_explicitly_archival_document(
            "docs/audits/atlas-v0.9.2-audit.md",
            "# Historical audit"
        ));
        assert!(is_explicitly_archival_document(
            "docs/design-doc.md",
            "> Archived pre-refresh design reference. It is not the current Atlas 1.0 product contract."
        ));
        assert!(!is_explicitly_archival_document(
            "docs/architecture.md",
            "# Atlas 1.0 architecture\nThis is the current architecture."
        ));
        assert!(!is_explicitly_archival_document(
            "docs/release/atlas-1.0-release-checklist.md",
            "# Atlas 1.0 release checklist"
        ));
    }

    #[tokio::test]
    async fn runtime_crawl_keeps_current_docs_and_excludes_historical_product_claims() {
        let root = std::env::temp_dir().join(format!("atlas-crawl-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("docs/audits")).unwrap();
        std::fs::create_dir_all(root.join("docs/release")).unwrap();
        std::fs::write(
            root.join("docs/audits/phase-2.md"),
            "# Historical audit\nThe retired Graph and Insights panels were once present.",
        )
        .unwrap();
        std::fs::write(
            root.join("docs/release/current.md"),
            "# Current release behavior\nIndexing uses the active workspace pipeline.",
        )
        .unwrap();

        let files = crawl_directory(&root.to_string_lossy()).await.unwrap();
        let paths = files
            .iter()
            .map(|file| file.file_path.replace('\\', "/"))
            .collect::<Vec<_>>();
        assert!(paths
            .iter()
            .any(|path| path.ends_with("docs/release/current.md")));
        assert!(!paths
            .iter()
            .any(|path| path.ends_with("docs/audits/phase-2.md")));
        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn internal_retrieval_evaluation_fixture_is_not_runtime_evidence() {
        let root =
            std::env::temp_dir().join(format!("atlas-crawl-fixture-{}", uuid::Uuid::new_v4()));
        let fixture = root.join("apps/desktop/src-tauri/fixtures/retrieval/evaluation.json");
        let source = root.join("apps/desktop/src-tauri/src/workspace.rs");
        std::fs::create_dir_all(fixture.parent().unwrap()).unwrap();
        std::fs::create_dir_all(source.parent().unwrap()).unwrap();
        std::fs::write(&fixture, "{\"synthetic\": true}").unwrap();
        std::fs::write(&source, "pub fn canonical_workspace() {} ").unwrap();

        assert!(is_internal_retrieval_fixture(
            "apps/desktop/src-tauri/fixtures/retrieval/evaluation.json"
        ));
        let files = crawl_directory(&root.to_string_lossy()).await.unwrap();
        let paths = files
            .iter()
            .map(|file| file.file_path.replace('\\', "/"))
            .collect::<Vec<_>>();
        assert!(!paths.iter().any(|path| path.ends_with("evaluation.json")));
        assert!(paths.iter().any(|path| path.ends_with("src/workspace.rs")));
        let _ = std::fs::remove_dir_all(root);
    }
}
