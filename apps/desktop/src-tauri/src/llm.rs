use reqwest::Client;

use tauri::{AppHandle, Emitter};
use futures::StreamExt;


/// Stream a chat response from Ollama
pub async fn stream_ollama(
    app: &AppHandle,
    event_id: &str,
    model: &str,
    messages: &[serde_json::Value],
    host: &str,
) -> Result<String, String> {
    let client = Client::new();
    let host = if host.is_empty() {
        "http://127.0.0.1:11434"
    } else {
        host
    };

    let res = client
        .post(format!("{}/api/chat", host))
        .json(&serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Ollama error: {}", body));
    }

    let mut stream = res.bytes_stream();
    let mut full_response = String::new();

    while let Some(chunk_result) = stream.next().await {
        let bytes = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&bytes);

        // Ollama streams JSON lines
        for line in text.lines() {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(content) = data
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                {
                    full_response.push_str(content);
                    let _ = app.emit(
                        event_id,
                        serde_json::json!({ "type": "chunk", "data": { "chunk": content } }),
                    );
                }
            }
        }
    }

    Ok(full_response)
}

/// Stream a chat response from OpenRouter
pub async fn stream_openrouter(
    app: &AppHandle,
    event_id: &str,
    model: &str,
    messages: &[serde_json::Value],
    api_key: &str,
) -> Result<String, String> {
    let client = Client::new();

    let res = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://atlas-app.local")
        .json(&serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("OpenRouter request failed: {}", e))?;

    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("OpenRouter error: {}", body));
    }

    let mut stream = res.bytes_stream();
    let mut full_response = String::new();
    let mut buf = String::new();

    while let Some(chunk_result) = stream.next().await {
        let bytes = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        buf.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(pos) = buf.find('\n') {
            let line = buf[..pos].trim().to_string();
            buf = buf[pos + 1..].to_string();

            if !line.starts_with("data: ") {
                continue;
            }
            let data_str = &line[6..];
            if data_str == "[DONE]" {
                break;
            }

            if let Ok(data) = serde_json::from_str::<serde_json::Value>(data_str) {
                if let Some(content) = data
                    .get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("delta"))
                    .and_then(|d| d.get("content"))
                    .and_then(|c| c.as_str())
                {
                    full_response.push_str(content);
                    let _ = app.emit(
                        event_id,
                        serde_json::json!({ "type": "chunk", "data": { "chunk": content } }),
                    );
                }
            }
        }
    }

    Ok(full_response)
}

/// List available Ollama models
pub async fn list_ollama_models(host: &str) -> Result<Vec<String>, String> {
    let client = Client::new();
    let host = if host.is_empty() {
        "http://127.0.0.1:11434"
    } else {
        host
    };

    let res = client
        .get(format!("{}/api/tags", host))
        .send()
        .await
        .map_err(|e| format!("Failed to list models: {}", e))?;

    if !res.status().is_success() {
        return Err("Failed to fetch Ollama models".to_string());
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let models = data
        .get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

/// Check if Ollama is running
pub async fn check_ollama_status(host: &str) -> bool {
    let client = Client::new();
    let host = if host.is_empty() {
        "http://127.0.0.1:11434"
    } else {
        host
    };

    client.get(host).send().await.map(|r| r.status().is_success()).unwrap_or(false)
}

/// List OpenRouter models
pub async fn list_openrouter_models(api_key: &str) -> Result<serde_json::Value, String> {
    let client = Client::new();
    let mut req = client.get("https://openrouter.ai/api/v1/models");
    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let res = req.send().await.map_err(|e| format!("OpenRouter request failed: {}", e))?;
    if !res.status().is_success() {
        return Err("Failed to fetch OpenRouter models".to_string());
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let models = data.get("data").cloned().unwrap_or(serde_json::json!([]));

    let mut free = Vec::new();
    let mut paid = Vec::new();

    if let Some(arr) = models.as_array() {
        for model in arr {
            let id = model.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string();
            let is_free = model
                .get("pricing")
                .and_then(|p| p.get("prompt"))
                .and_then(|p| p.as_str())
                .map(|p| p == "0")
                .unwrap_or(false);
            if is_free {
                free.push(serde_json::json!({ "id": id }));
            } else {
                paid.push(serde_json::json!({ "id": id }));
            }
        }
    }

    Ok(serde_json::json!({ "free": free, "paid": paid }))
}
