# Atlas source checkout bootstrap for Windows.
# This is NOT an end-user installer. Release users should install the signed
# artifact published on GitHub Releases after the 1.0.0 release is approved.
$ErrorActionPreference = "Stop"

Write-Host "[Atlas] Developer source bootstrap (not an application installer)" -ForegroundColor Cyan

$requiredCommands = @("node", "pnpm", "cargo", "protoc")
$missing = @($requiredCommands | Where-Object { -not (Get-Command $_ -ErrorAction SilentlyContinue) })

if ($missing.Count -gt 0) {
    throw "Missing developer prerequisites: $($missing -join ', '). See README.md and BUILD.md."
}

if (-not (Get-Command "ollama" -ErrorAction SilentlyContinue)) {
    Write-Warning "Ollama is not installed. Builds can continue, but indexing and local runtime QA require Ollama."
}

pnpm install --frozen-lockfile
pnpm version:check
pnpm build

Write-Host "[Atlas] Source dependencies and production frontend build are ready." -ForegroundColor Green
Write-Host "Run 'pnpm --filter desktop tauri dev' for development or follow BUILD.md for release bundles."
