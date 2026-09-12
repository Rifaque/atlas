use serde::Serialize;

/// The sole request-body type permitted to cross the OpenRouter boundary.
#[derive(Debug, Clone, Serialize)]
pub struct OpenRouterPayload {
    pub model: String,
    pub messages: Vec<serde_json::Value>,
    pub stream: bool,
}

pub fn build_openrouter_payload(
    model: &str,
    messages: &[serde_json::Value],
    cloud_allowed: bool,
) -> Result<OpenRouterPayload, String> {
    if !cloud_allowed {
        return Err(
            "Cloud request blocked: this request did not explicitly authorize OpenRouter"
                .to_string(),
        );
    }

    let payload = OpenRouterPayload {
        model: model.to_string(),
        messages: messages.to_vec(),
        stream: true,
    };
    let serialized = serde_json::to_string(&payload)
        .map_err(|e| format!("Failed to inspect cloud payload: {e}"))?;
    let matches = crate::shield::scan_for_secrets(&serialized);
    if !matches.is_empty() {
        let kinds = matches
            .iter()
            .map(|secret| secret.kind.as_str())
            .collect::<std::collections::BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>()
            .join(", ");
        return Err(format!(
            "Cloud request blocked by Secret Shield; sensitive data was found in the complete outbound payload ({kinds})"
        ));
    }

    Ok(payload)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "sk-abcdefghijklmnopqrst1234567890";

    fn messages(section: &str, secret: &str) -> Vec<serde_json::Value> {
        vec![serde_json::json!({
            "role": if section == "history" { "assistant" } else { "system" },
            "content": format!("{section}: {secret}")
        })]
    }

    #[test]
    fn explicit_cloud_authorization_is_required() {
        let error =
            build_openrouter_payload("model", &messages("query", "safe"), false).unwrap_err();
        assert!(error.contains("explicitly authorize"));
    }

    #[test]
    fn secrets_anywhere_in_complete_payload_are_blocked() {
        for section in [
            "user query",
            "retrieved source",
            "manual source",
            "history",
            "git metadata",
        ] {
            let error =
                build_openrouter_payload("model", &messages(section, SECRET), true).unwrap_err();
            assert!(
                error.contains("Secret Shield"),
                "section {section} bypassed policy"
            );
        }
    }

    #[test]
    fn safe_complete_payload_is_allowed() {
        assert!(build_openrouter_payload("model", &messages("query", "safe text"), true).is_ok());
    }
}
