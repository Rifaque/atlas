use regex::Regex;
use serde::Serialize;

/// A match found by the secret scanner.
#[derive(Debug, Clone, Serialize)]
pub struct SecretMatch {
    /// Category of the detected secret (e.g. "AWS Key", "GitHub Token")
    pub kind: String,
    /// Redacted preview showing the detected pattern
    pub preview: String,
    /// Approximate character offset in the input text
    pub offset: usize,
}

/// Patterns to scan for in outgoing messages to cloud providers.
struct SecretPattern {
    kind: &'static str,
    regex: &'static str,
}

const SECRET_PATTERNS: &[SecretPattern] = &[
    // AWS Access Key ID
    SecretPattern {
        kind: "AWS Access Key",
        regex: r"(?:^|[^A-Z0-9])(?P<m>AKIA[0-9A-Z]{16})(?:[^A-Z0-9]|$)",
    },
    // AWS Secret Access Key (40 chars, base64-like)
    SecretPattern {
        kind: "AWS Secret Key",
        regex: r"(?i)(?:aws_secret_access_key|secret_key)\s*[=:]\s*(?P<m>[A-Za-z0-9/+=]{40})",
    },
    // GitHub Tokens (classic PAT, fine-grained, OAuth, etc.)
    SecretPattern {
        kind: "GitHub Token",
        regex: r"(?P<m>(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255})",
    },
    // OpenAI / OpenRouter API Keys
    SecretPattern {
        kind: "OpenAI/OpenRouter Key",
        regex: r"(?P<m>sk-(?:or-v1-)?[A-Za-z0-9]{20,})",
    },
    // Generic API key patterns (Bearer tokens, api_key values)
    SecretPattern {
        kind: "API Key / Bearer Token",
        regex: r#"(?i)(?:api[_-]?key|bearer|authorization|token|secret)\s*[=:]\s*['"]?(?P<m>[A-Za-z0-9_\-]{20,})['"]?"#,
    },
    // Slack Tokens
    SecretPattern {
        kind: "Slack Token",
        regex: r"(?P<m>xox[bporas]-[0-9]{10,}-[A-Za-z0-9\-]+)",
    },
    // Private Keys (multi-line header)
    SecretPattern {
        kind: "Private Key",
        regex: r"(?P<m>-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----)",
    },
    // JWT Tokens (3-part base64url)
    SecretPattern {
        kind: "JWT Token",
        regex: r"(?P<m>eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-]+)",
    },
    // Connection Strings (database URLs with credentials)
    SecretPattern {
        kind: "Connection String",
        regex: r"(?P<m>(?:postgres|mysql|mongodb|redis)://[^\s@]+:[^\s@]+@[^\s]+)",
    },
    // Passwords in config
    SecretPattern {
        kind: "Password",
        regex: r#"(?i)(?:password|passwd|pwd)\s*[=:]\s*['"]?(?P<m>[^\s'"]{8,})['"]?"#,
    },
];

/// Scan text for potential secrets, API keys, and sensitive data.
/// Returns a list of detected matches with redacted previews.
pub fn scan_for_secrets(text: &str) -> Vec<SecretMatch> {
    let mut matches = Vec::new();

    for pattern in SECRET_PATTERNS {
        if let Ok(re) = Regex::new(pattern.regex) {
            for cap in re.captures_iter(text) {
                let matched = cap.name("m").unwrap_or_else(|| cap.get(0).unwrap());
                let raw = matched.as_str();

                // Redact the middle of the match for preview
                let preview = redact(raw);

                matches.push(SecretMatch {
                    kind: pattern.kind.to_string(),
                    preview,
                    offset: matched.start(),
                });
            }
        }
    }

    // Deduplicate by offset
    matches.sort_by_key(|m| m.offset);
    matches.dedup_by_key(|m| m.offset);

    matches
}

/// Redact the middle portion of a secret, showing only a prefix and suffix.
fn redact(s: &str) -> String {
    let len = s.len();
    if len <= 8 {
        return format!("{}***", &s[..len.min(3)]);
    }
    let show = 4.min(len / 3);
    format!("{}…{}", &s[..show], &s[len - show..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_aws_key() {
        let text = "My key is AKIAIOSFODNN7EXAMPLE and stuff";
        let results = scan_for_secrets(text);
        assert!(!results.is_empty());
        assert_eq!(results[0].kind, "AWS Access Key");
    }

    #[test]
    fn detects_github_token() {
        let text = "token: ghp_abcdefghij1234567890XYZ0123456789012";
        let results = scan_for_secrets(text);
        assert!(results.iter().any(|m| m.kind == "GitHub Token"));
    }

    #[test]
    fn detects_openai_key() {
        let text = "OPENAI_API_KEY=sk-abcdefghijklmnopqrst1234567890";
        let results = scan_for_secrets(text);
        assert!(results.iter().any(|m| m.kind == "OpenAI/OpenRouter Key"));
    }

    #[test]
    fn no_false_positives_on_plain_text() {
        let text = "Hello world, this is just a normal conversation about code.";
        let results = scan_for_secrets(text);
        assert!(results.is_empty());
    }
}
