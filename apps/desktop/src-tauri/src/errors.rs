use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum ErrorCode {
    WorkspaceUnavailable,
    IndexRequired,
    IndexFailed,
    EmbeddingProviderUnavailable,
    GenerationProviderUnavailable,
    InvalidModel,
    NoRelevantEvidence,
    CloudAuthorizationRequired,
    CloudPayloadBlocked,
    FileUnavailable,
    PersistenceCorrupt,
    UpdateUnavailable,
    Unexpected,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
}

impl From<String> for AppError {
    fn from(message: String) -> Self {
        let lower = message.to_lowercase();
        let code = if lower.contains("cloud request blocked by secret shield") {
            ErrorCode::CloudPayloadBlocked
        } else if lower.contains("authorize openrouter") || lower.contains("cloud authorization") {
            ErrorCode::CloudAuthorizationRequired
        } else if lower.contains("index required") || lower.contains("not indexed") {
            ErrorCode::IndexRequired
        } else if lower.contains("no relevant evidence") {
            ErrorCode::NoRelevantEvidence
        } else if lower.contains("persistence") && lower.contains("corrupt") {
            ErrorCode::PersistenceCorrupt
        } else if lower.contains("updater disabled") || lower.contains("update unavailable") {
            ErrorCode::UpdateUnavailable
        } else if lower.contains("workspace")
            && (lower.contains("unavailable") || lower.contains("authorized"))
        {
            ErrorCode::WorkspaceUnavailable
        } else if lower.contains("embedding")
            && (lower.contains("failed") || lower.contains("offline"))
        {
            ErrorCode::EmbeddingProviderUnavailable
        } else if lower.contains("model")
            && (lower.contains("invalid") || lower.contains("not found"))
        {
            ErrorCode::InvalidModel
        } else if (lower.contains("generation")
            && (lower.contains("failed")
                || lower.contains("offline")
                || lower.contains("unavailable")))
            || ((lower.contains("ollama") || lower.contains("openrouter"))
                && (lower.contains("request")
                    || lower.contains("connect")
                    || lower.contains("timeout")
                    || lower.contains("timed out")))
        {
            ErrorCode::GenerationProviderUnavailable
        } else if lower.contains("index") {
            ErrorCode::IndexFailed
        } else if lower.contains("file") || lower.contains("path") {
            ErrorCode::FileUnavailable
        } else {
            ErrorCode::Unexpected
        };
        Self { code, message }
    }
}

impl From<&str> for AppError {
    fn from(message: &str) -> Self {
        message.to_string().into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_cloud_and_workspace_failures() {
        assert_eq!(
            AppError::from("Cloud request blocked by Secret Shield".to_string()).code,
            ErrorCode::CloudPayloadBlocked
        );
        assert_eq!(
            AppError::from("Workspace has not been authorized".to_string()).code,
            ErrorCode::WorkspaceUnavailable
        );
    }
}
