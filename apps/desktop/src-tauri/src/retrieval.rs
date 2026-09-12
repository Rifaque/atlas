use serde::Serialize;
use std::path::Path;

/// The evidence category is deterministic provenance metadata used to format
/// generation context. It does not change retrieval scores or eligibility.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceSourceKind {
    ImplementationCode,
    Documentation,
    DesignSpecification,
    Test,
    Fixture,
    Configuration,
    HistoricalAudit,
    Other,
}

impl EvidenceSourceKind {
    pub fn prompt_label(self) -> &'static str {
        match self {
            Self::ImplementationCode => "IMPLEMENTATION CODE",
            Self::Documentation => "DOCUMENTATION",
            Self::DesignSpecification => "DESIGN / SPECIFICATION",
            Self::Test => "TEST",
            Self::Fixture => "FIXTURE",
            Self::Configuration => "CONFIGURATION",
            Self::HistoricalAudit => "HISTORICAL / AUDIT",
            Self::Other => "OTHER",
        }
    }

    pub fn implementation_authority_rank(self) -> u8 {
        match self {
            Self::ImplementationCode => 0,
            Self::Configuration => 1,
            Self::Documentation => 2,
            Self::DesignSpecification => 3,
            Self::Test => 4,
            Self::Fixture => 5,
            Self::HistoricalAudit => 6,
            Self::Other => 7,
        }
    }
}

pub fn source_kind_from_path(path: &str) -> EvidenceSourceKind {
    let normalized = path.replace('\\', "/").to_ascii_lowercase();
    let file_name = normalized.rsplit('/').next().unwrap_or(&normalized);

    if normalized.contains("/docs/audits/") || normalized.starts_with("docs/audits/") {
        return EvidenceSourceKind::HistoricalAudit;
    }
    if normalized.contains("/fixtures/") || normalized.starts_with("fixtures/") {
        return EvidenceSourceKind::Fixture;
    }
    if normalized.contains("/tests/")
        || normalized.starts_with("tests/")
        || file_name.ends_with("_test.rs")
        || file_name.ends_with(".test.ts")
        || file_name.ends_with(".test.tsx")
        || file_name.ends_with(".spec.ts")
        || file_name.ends_with(".spec.tsx")
    {
        return EvidenceSourceKind::Test;
    }
    if normalized.contains("/docs/design/")
        || normalized.starts_with("docs/design/")
        || file_name.contains("ux-spec")
        || file_name.contains("design-spec")
    {
        return EvidenceSourceKind::DesignSpecification;
    }
    if matches!(
        file_name.rsplit('.').next(),
        Some("toml" | "json" | "yaml" | "yml" | "ini")
    ) || file_name == ".env"
    {
        return EvidenceSourceKind::Configuration;
    }
    let is_source_extension = matches!(
        file_name.rsplit('.').next(),
        Some(
            "rs" | "ts"
                | "tsx"
                | "js"
                | "jsx"
                | "py"
                | "go"
                | "java"
                | "c"
                | "cc"
                | "cpp"
                | "h"
                | "hpp"
                | "cs"
                | "rb"
                | "php"
                | "swift"
                | "kt"
                | "kts"
                | "vue"
                | "svelte"
        )
    );
    if is_source_extension && (normalized.contains("/src/") || normalized.starts_with("src/")) {
        return EvidenceSourceKind::ImplementationCode;
    }
    if normalized.contains("/docs/")
        || normalized.starts_with("docs/")
        || file_name.starts_with("readme")
        || matches!(file_name, "architecture.md" | "prd.md")
    {
        return EvidenceSourceKind::Documentation;
    }
    EvidenceSourceKind::Other
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceSourceType {
    WorkspaceFile,
    PinnedWorkspaceFile,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceResult {
    pub id: String,
    pub workspace_id: String,
    pub file_path: String,
    pub display_path: String,
    pub line_start: i64,
    pub line_end: i64,
    pub content: String,
    pub snippet: String,
    pub source_type: EvidenceSourceType,
    pub source_kind: EvidenceSourceKind,
}

pub fn evidence_from_store(result: &serde_json::Value, workspace_id: &str) -> Vec<EvidenceResult> {
    let row = |name: &str| {
        result
            .get(name)
            .and_then(|value| value.get(0))
            .and_then(|value| value.as_array())
            .cloned()
            .unwrap_or_default()
    };
    let ids = row("ids");
    let documents = row("documents");
    let metadatas = row("metadatas");

    documents
        .iter()
        .zip(metadatas.iter())
        .enumerate()
        .filter_map(|(index, (document, metadata))| {
            let content = document.as_str()?.to_string();
            let file_path = metadata.get("filePath")?.as_str()?.to_string();
            let display_path = Path::new(&file_path)
                .strip_prefix(workspace_id)
                .ok()?
                .to_string_lossy()
                .trim_start_matches(['/', '\\'])
                .to_string();
            let line_start = metadata
                .get("lineRangeStart")
                .and_then(|line| line.as_i64())
                .unwrap_or(1)
                .max(1);
            let line_end = metadata
                .get("lineRangeEnd")
                .and_then(|line| line.as_i64())
                .unwrap_or(line_start)
                .max(line_start);
            let id = ids.get(index).and_then(|id| id.as_str())?;
            let source_kind = source_kind_from_path(&file_path);
            Some(EvidenceResult {
                id: id.to_string(),
                workspace_id: workspace_id.to_string(),
                file_path,
                display_path,
                line_start,
                line_end,
                snippet: content.chars().take(400).collect(),
                content,
                source_type: EvidenceSourceType::WorkspaceFile,
                source_kind,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evidence_contract_is_workspace_owned_one_based_and_stable() {
        let raw = serde_json::json!({
            "ids": [["source-1"]],
            "documents": [["fn main() {}"]],
            "metadatas": [[{
                "filePath": "C:/work/src/main.rs",
                "lineRangeStart": 0,
                "lineRangeEnd": 0
            }]]
        });
        let evidence = evidence_from_store(&raw, "C:/work");
        assert_eq!(evidence[0].workspace_id, "C:/work");
        assert_eq!(evidence[0].display_path, "src/main.rs");
        assert_eq!((evidence[0].line_start, evidence[0].line_end), (1, 1));
        assert_eq!(
            serde_json::to_value(&evidence[0]).unwrap()["sourceType"],
            "workspace_file"
        );
        assert_eq!(
            serde_json::to_value(&evidence[0]).unwrap()["sourceKind"],
            "implementation_code"
        );
        assert!(serde_json::to_value(&evidence[0])
            .unwrap()
            .get("score")
            .is_none());
    }

    #[test]
    fn evidence_outside_workspace_is_rejected() {
        let raw = serde_json::json!({
            "ids": [["source-1"]],
            "documents": [["secret"]],
            "metadatas": [[{
                "filePath": "C:/other/private.txt",
                "lineRangeStart": 1,
                "lineRangeEnd": 1
            }]]
        });
        assert!(evidence_from_store(&raw, "C:/work").is_empty());
    }

    #[test]
    fn source_kind_is_deterministic_and_keeps_code_distinct_from_docs_and_tests() {
        assert_eq!(
            source_kind_from_path("apps/desktop/src-tauri/src/workspace.rs"),
            EvidenceSourceKind::ImplementationCode
        );
        assert_eq!(
            source_kind_from_path("docs/design/atlas-1.0-ux-spec.md"),
            EvidenceSourceKind::DesignSpecification
        );
        assert_eq!(
            source_kind_from_path("apps/desktop/src-tauri/tests/retrieval_eval.rs"),
            EvidenceSourceKind::Test
        );
        assert_eq!(
            source_kind_from_path("apps/desktop/src-tauri/fixtures/retrieval/evaluation.json"),
            EvidenceSourceKind::Fixture
        );
        assert_eq!(
            source_kind_from_path("docs/architecture.md"),
            EvidenceSourceKind::Documentation
        );
        assert_eq!(
            source_kind_from_path("apps/desktop/src-tauri/tauri.conf.json"),
            EvidenceSourceKind::Configuration
        );
    }
}
