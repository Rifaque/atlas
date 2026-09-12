use futures::StreamExt;
use reqwest::Client;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

fn http_client(timeout: Duration) -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(timeout)
        .build()
        .map_err(|e| format!("Failed to configure HTTP client: {e}"))
}

fn take_json_lines(
    buffer: &mut Vec<u8>,
    include_trailing: bool,
) -> Result<Vec<serde_json::Value>, String> {
    let mut values = Vec::new();
    loop {
        let newline = buffer.iter().position(|byte| *byte == b'\n');
        let end = match newline {
            Some(position) => position + 1,
            None if include_trailing && !buffer.is_empty() => buffer.len(),
            None => break,
        };
        let bytes = buffer.drain(..end).collect::<Vec<_>>();
        let line = std::str::from_utf8(&bytes)
            .map_err(|e| format!("Provider stream contained invalid UTF-8: {e}"))?
            .trim();
        if !line.is_empty() {
            values.push(
                serde_json::from_str(line)
                    .map_err(|e| format!("Provider stream contained malformed JSON: {e}"))?,
            );
        }
    }
    Ok(values)
}

/// Stream a chat response from Ollama
pub async fn stream_ollama(
    app: &AppHandle,
    event_id: &str,
    model: &str,
    messages: &[serde_json::Value],
    host: &str,
    cancelled: &Arc<AtomicBool>,
    emit_chunks: bool,
) -> Result<String, String> {
    let client = http_client(Duration::from_secs(300))?;
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
    let mut buffer = Vec::new();

    loop {
        if cancelled.load(Ordering::SeqCst) {
            return Err("Generation cancelled".to_string());
        }
        let Some(chunk_result) =
            (match tokio::time::timeout(Duration::from_millis(100), stream.next()).await {
                Ok(result) => result,
                Err(_) => continue,
            })
        else {
            break;
        };
        let bytes = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        buffer.extend_from_slice(&bytes);

        for data in take_json_lines(&mut buffer, false)? {
            if let Some(error) = data.get("error").and_then(|value| value.as_str()) {
                return Err(format!("Ollama stream error: {error}"));
            }
            if let Some(content) = data
                .get("message")
                .and_then(|message| message.get("content"))
                .and_then(|content| content.as_str())
            {
                full_response.push_str(content);
                if emit_chunks {
                    let _ = app.emit(
                        event_id,
                        serde_json::json!({ "type": "chunk", "data": { "chunk": content } }),
                    );
                }
            }
        }
    }

    for data in take_json_lines(&mut buffer, true)? {
        if let Some(content) = data
            .get("message")
            .and_then(|message| message.get("content"))
            .and_then(|content| content.as_str())
        {
            full_response.push_str(content);
            if emit_chunks {
                let _ = app.emit(
                    event_id,
                    serde_json::json!({ "type": "chunk", "data": { "chunk": content } }),
                );
            }
        }
    }

    Ok(full_response)
}

/// Stream a chat response from OpenRouter
pub async fn stream_openrouter(
    app: &AppHandle,
    event_id: &str,
    payload: &crate::outbound::OpenRouterPayload,
    api_key: &str,
    cancelled: &Arc<AtomicBool>,
    emit_chunks: bool,
) -> Result<String, String> {
    let client = http_client(Duration::from_secs(300))?;

    let res = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://atlas-app.local")
        .json(payload)
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

    'stream: loop {
        if cancelled.load(Ordering::SeqCst) {
            return Err("Generation cancelled".to_string());
        }
        let Some(chunk_result) =
            (match tokio::time::timeout(Duration::from_millis(100), stream.next()).await {
                Ok(result) => result,
                Err(_) => continue,
            })
        else {
            break;
        };
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
                break 'stream;
            }

            let data = serde_json::from_str::<serde_json::Value>(data_str)
                .map_err(|e| format!("OpenRouter stream contained malformed JSON: {e}"))?;
            if let Some(error) = data.get("error") {
                return Err(format!("OpenRouter stream error: {error}"));
            }
            if let Some(content) = data
                .get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("delta"))
                .and_then(|d| d.get("content"))
                .and_then(|c| c.as_str())
            {
                full_response.push_str(content);
                if emit_chunks {
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
    let client = http_client(Duration::from_secs(30))?;
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
    let Ok(client) = http_client(Duration::from_secs(10)) else {
        return false;
    };
    let host = if host.is_empty() {
        "http://127.0.0.1:11434"
    } else {
        host
    };

    client
        .get(host)
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ndjson_parser_buffers_a_record_split_across_transport_chunks() {
        let mut buffer = br#"{"message":{"content":"hel"#.to_vec();
        assert!(take_json_lines(&mut buffer, false).unwrap().is_empty());
        buffer.extend_from_slice(b"lo\"}}\n{\"message\":{\"content\":\"world\"}}\n");
        let values = take_json_lines(&mut buffer, false).unwrap();
        assert_eq!(values.len(), 2);
        assert_eq!(values[0]["message"]["content"], "hello");
        assert_eq!(values[1]["message"]["content"], "world");
    }

    #[test]
    fn ndjson_parser_preserves_split_multibyte_utf8() {
        let record = "{\"message\":{\"content\":\"नमस्ते\"}}\n".as_bytes();
        let split = record.iter().position(|byte| *byte >= 0x80).unwrap() + 1;
        let mut buffer = record[..split].to_vec();
        assert!(take_json_lines(&mut buffer, false).unwrap().is_empty());
        buffer.extend_from_slice(&record[split..]);
        let values = take_json_lines(&mut buffer, false).unwrap();
        assert_eq!(values[0]["message"]["content"], "नमस्ते");
    }
}
