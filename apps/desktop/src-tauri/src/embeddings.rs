use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct EmbedRequest {
    model: String,
    input: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct EmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

#[derive(Debug, Serialize)]
struct LegacyEmbedRequest {
    model: String,
    prompt: String,
}

#[derive(Debug, Deserialize)]
struct LegacyEmbedResponse {
    embedding: Vec<f32>,
}

/// Generate embeddings for a batch of texts using Ollama
/// Tries the new /api/embed endpoint first, then falls back to legacy /api/embeddings
pub async fn generate_embeddings(
    texts: &[String],
    model: &str,
    host: &str,
) -> Result<Vec<Vec<f32>>, String> {
    let client = Client::new();
    let host = if host.is_empty() {
        "http://127.0.0.1:11434"
    } else {
        host
    };

    // Try new batched /api/embed endpoint
    let res = client
        .post(format!("{}/api/embed", host))
        .json(&EmbedRequest {
            model: model.to_string(),
            input: texts.to_vec(),
        })
        .send()
        .await
        .map_err(|e| format!("Embedding request failed: {}", e))?;

    if res.status().as_u16() == 404 {
        // Fallback to legacy /api/embeddings (one by one)
        let mut results = Vec::with_capacity(texts.len());
        for text in texts {
            let res = client
                .post(format!("{}/api/embeddings", host))
                .json(&LegacyEmbedRequest {
                    model: model.to_string(),
                    prompt: text.clone(),
                })
                .send()
                .await
                .map_err(|e| format!("Legacy embedding request failed: {}", e))?;

            if res.status().as_u16() == 404 {
                return Err(format!(
                    "Model \"{}\" not found in Ollama or doesn't support embeddings.",
                    model
                ));
            }

            if !res.status().is_success() {
                return Err(format!("Ollama legacy embeddings error: {}", res.status()));
            }

            let data: LegacyEmbedResponse = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse embedding: {}", e))?;
            results.push(data.embedding);
        }
        return Ok(results);
    }

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Ollama embed error ({}): {}", status, body));
    }

    let data: EmbedResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse embeddings: {}", e))?;
    Ok(data.embeddings)
}
