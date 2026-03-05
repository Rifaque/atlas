use reqwest::Client;
use serde::{Deserialize, Serialize};

/// A single web search result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

/// Search the web using Tavily or Serper and return the top results.
pub async fn search_web(
    query: &str,
    api_key: &str,
    provider: &str,
) -> Result<Vec<WebResult>, String> {
    match provider {
        "tavily" => search_tavily(query, api_key).await,
        "serper" => search_serper(query, api_key).await,
        _ => Err(format!("Unknown web search provider: {}", provider)),
    }
}

// ─── Tavily ──────────────────────────────────────────────────────────────────

async fn search_tavily(query: &str, api_key: &str) -> Result<Vec<WebResult>, String> {
    let client = Client::new();
    let res = client
        .post("https://api.tavily.com/search")
        .json(&serde_json::json!({
            "api_key": api_key,
            "query": query,
            "search_depth": "basic",
            "max_results": 5,
            "include_answer": false,
        }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Tavily request failed: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Tavily error ({}): {}", status, body));
    }

    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Tavily JSON parse failed: {}", e))?;

    let results = data
        .get("results")
        .and_then(|r| r.as_array())
        .map(|arr| {
            arr.iter()
                .take(5)
                .filter_map(|item| {
                    Some(WebResult {
                        title: item.get("title")?.as_str()?.to_string(),
                        url: item.get("url")?.as_str()?.to_string(),
                        snippet: item
                            .get("content")
                            .and_then(|c| c.as_str())
                            .unwrap_or("")
                            .chars()
                            .take(500)
                            .collect(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(results)
}

// ─── Serper ──────────────────────────────────────────────────────────────────

async fn search_serper(query: &str, api_key: &str) -> Result<Vec<WebResult>, String> {
    let client = Client::new();
    let res = client
        .post("https://google.serper.dev/search")
        .header("X-API-KEY", api_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "q": query,
            "num": 5,
        }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Serper request failed: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Serper error ({}): {}", status, body));
    }

    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Serper JSON parse failed: {}", e))?;

    let results = data
        .get("organic")
        .and_then(|o| o.as_array())
        .map(|arr| {
            arr.iter()
                .take(5)
                .filter_map(|item| {
                    Some(WebResult {
                        title: item.get("title")?.as_str()?.to_string(),
                        url: item.get("link")?.as_str()?.to_string(),
                        snippet: item
                            .get("snippet")
                            .and_then(|s| s.as_str())
                            .unwrap_or("")
                            .to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(results)
}
