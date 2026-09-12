use std::path::{Path, PathBuf};
use std::{collections::HashMap, fs};

pub fn canonical_workspace(path: &str) -> Result<PathBuf, String> {
    let canonical =
        std::fs::canonicalize(path).map_err(|e| format!("Workspace path is unavailable: {e}"))?;
    if !canonical.is_dir() {
        return Err("Workspace path is not a directory".to_string());
    }
    Ok(canonical)
}

pub fn authorized_file(workspace: &Path, file_path: &str) -> Result<PathBuf, String> {
    let canonical_file =
        std::fs::canonicalize(file_path).map_err(|e| format!("File path is unavailable: {e}"))?;
    if !canonical_file.is_file() {
        return Err("Requested path is not a file".to_string());
    }
    if !canonical_file.starts_with(workspace) {
        return Err("Requested file is outside the active workspace".to_string());
    }
    Ok(canonical_file)
}

fn registry_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".atlas")
        .join("authorized-workspaces.json")
}

pub fn load_authorized() -> HashMap<String, PathBuf> {
    let Ok(content) = fs::read_to_string(registry_path()) else {
        return HashMap::new();
    };
    serde_json::from_str::<Vec<String>>(&content)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|path| canonical_workspace(&path).ok())
        .map(|path| (path.to_string_lossy().to_string(), path))
        .collect()
}

pub fn save_authorized(workspaces: &HashMap<String, PathBuf>) -> Result<(), String> {
    let path = registry_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create workspace registry directory: {e}"))?;
    }
    let mut paths = workspaces.keys().cloned().collect::<Vec<_>>();
    paths.sort();
    paths.dedup();
    let data = serde_json::to_vec_pretty(&paths)
        .map_err(|e| format!("Failed to serialize workspace registry: {e}"))?;
    fs::write(path, data).map_err(|e| format!("Failed to save workspace registry: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_dir(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("atlas-{name}-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn allows_files_inside_workspace_and_rejects_outside() {
        let workspace = test_dir("workspace");
        let outside = test_dir("outside");
        let inside_file = workspace.join("inside.txt");
        let outside_file = outside.join("outside.txt");
        std::fs::write(&inside_file, "inside").unwrap();
        std::fs::write(&outside_file, "outside").unwrap();

        let canonical = canonical_workspace(workspace.to_str().unwrap()).unwrap();
        assert!(authorized_file(&canonical, inside_file.to_str().unwrap()).is_ok());
        assert!(authorized_file(&canonical, outside_file.to_str().unwrap()).is_err());

        std::fs::remove_dir_all(workspace).unwrap();
        std::fs::remove_dir_all(outside).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escape() {
        use std::os::unix::fs::symlink;
        let workspace = test_dir("symlink-workspace");
        let outside = test_dir("symlink-outside");
        let outside_file = outside.join("secret.txt");
        std::fs::write(&outside_file, "secret").unwrap();
        let link = workspace.join("escape.txt");
        symlink(&outside_file, &link).unwrap();
        let canonical = canonical_workspace(workspace.to_str().unwrap()).unwrap();
        assert!(authorized_file(&canonical, link.to_str().unwrap()).is_err());
        std::fs::remove_dir_all(workspace).unwrap();
        std::fs::remove_dir_all(outside).unwrap();
    }
}
