const SERVICE: &str = "com.atlas.desktop";
const OPENROUTER: &str = "openrouter-api-key";

fn credential_name(name: &str) -> Result<&'static str, String> {
    match name {
        "openrouter" => Ok(OPENROUTER),
        _ => Err("Unsupported credential name".to_string()),
    }
}

pub fn set(name: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err("Credential cannot be empty".to_string());
    }
    keyring::Entry::new(SERVICE, credential_name(name)?)
        .map_err(|e| format!("Credential store is unavailable: {e}"))?
        .set_password(value)
        .map_err(|e| format!("Failed to store credential securely: {e}"))
}

pub fn get(name: &str) -> Result<String, String> {
    keyring::Entry::new(SERVICE, credential_name(name)?)
        .map_err(|e| format!("Credential store is unavailable: {e}"))?
        .get_password()
        .map_err(|e| format!("Credential is unavailable; re-enter it in Settings: {e}"))
}

pub fn exists(name: &str) -> bool {
    get(name).is_ok()
}

pub fn remove(name: &str) -> Result<(), String> {
    keyring::Entry::new(SERVICE, credential_name(name)?)
        .map_err(|e| format!("Credential store is unavailable: {e}"))?
        .delete_credential()
        .map_err(|e| format!("Failed to remove credential: {e}"))
}

#[tauri::command]
pub async fn store_credential(name: String, value: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set(&name, &value))
        .await
        .map_err(|e| format!("Credential task failed: {e}"))?
}

#[tauri::command]
pub async fn has_credential(name: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || exists(&name))
        .await
        .map_err(|e| format!("Credential task failed: {e}"))
}

#[tauri::command]
pub async fn remove_credential(name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || remove(&name))
        .await
        .map_err(|e| format!("Credential task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_names_remain_allowlisted() {
        assert_eq!(credential_name("openrouter"), Ok(OPENROUTER));
        assert!(credential_name("arbitrary-provider").is_err());
    }
}
