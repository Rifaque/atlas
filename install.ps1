# One-Command Installer for Atlas (Windows PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "[Atlas] Starting One-Command Install..." -ForegroundColor Cyan

# 1. Install prerequisites via Winget if missing
if (!(Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "[Atlas] Installing Node.js..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

if (!(Get-Command "pnpm" -ErrorAction SilentlyContinue)) {
    Write-Host "[Atlas] Installing pnpm..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://get.pnpm.io/install.ps1" -UseBasicParsing | Invoke-Expression
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

if (!(Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    Write-Host "[Atlas] Installing Rust..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "rustup-init.exe"
    .\rustup-init.exe -y --quiet
    Remove-Item "rustup-init.exe"
    $env:Path += ";$HOME\.cargo\bin"
}

if (!(Get-Command "ollama" -ErrorAction SilentlyContinue)) {
    Write-Host "[Atlas] Installing Ollama..." -ForegroundColor Yellow
    winget install --id Ollama.Ollama -e --source winget
}

# 2. Build and launch
Write-Host "[Atlas] Installing dependencies..." -ForegroundColor Cyan
pnpm install

Write-Host "[Atlas] Building monorepo..." -ForegroundColor Cyan
pnpm run build

Write-Host "[Atlas] Building Backend Sidecar..." -ForegroundColor Cyan
Set-Location -Path "apps\backend"
pnpm run build:sidecar
Set-Location -Path "..\.."

Write-Host "[Atlas] Launching Desktop App..." -ForegroundColor Cyan
Set-Location -Path "apps\desktop"
pnpm tauri dev
