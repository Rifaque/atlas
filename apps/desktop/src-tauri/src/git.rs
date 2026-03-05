use git2::{Repository, StatusOptions};
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct GitContext {
    pub branch: String,
    pub uncommitted_files: Vec<String>,
    pub recent_commits: Vec<String>,
    pub diff_summary: String,
}

pub fn get_git_context<P: AsRef<Path>>(repo_path: P) -> Result<GitContext, String> {
    let repo = Repository::discover(repo_path).map_err(|e| format!("Not a git repository: {}", e))?;

    // Get active branch
    let head = repo.head().map_err(|e| e.to_string())?;
    let branch = head.shorthand().unwrap_or("unknown").to_string();

    // Get uncommitted files
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
    
    let mut uncommitted_files = Vec::new();
    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            uncommitted_files.push(path.to_string());
        }
    }

    // Get recent 5 commits
    let mut recent_commits = Vec::new();
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    
    for (i, id) in revwalk.enumerate() {
        if i >= 5 { break; }
        if let Ok(id) = id {
            if let Ok(commit) = repo.find_commit(id) {
                let msg = commit.summary().unwrap_or("").to_string();
                let author = commit.author().name().unwrap_or("unknown").to_string();
                recent_commits.push(format!("{} - {}", author, msg));
            }
        }
    }

    // Get diff summary of index vs workdir
    let diff_summary = if let Ok(diff) = repo.diff_index_to_workdir(None, None) {
        let stats = diff.stats().map_err(|e| e.to_string())?;
        format!(
            "{} files changed, {} insertions(+), {} deletions(-)",
            stats.files_changed(),
            stats.insertions(),
            stats.deletions()
        )
    } else {
        String::new()
    };

    Ok(GitContext {
        branch,
        uncommitted_files,
        recent_commits,
        diff_summary,
    })
}
