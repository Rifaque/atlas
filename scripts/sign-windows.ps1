param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$FilePath
)

$ErrorActionPreference = 'Stop'

$certificatePath = $env:ATLAS_WINDOWS_CODESIGN_PFX_PATH
$certificatePassword = $env:ATLAS_WINDOWS_CODESIGN_PFX_PASSWORD
$timestampUrl = $env:ATLAS_WINDOWS_CODESIGN_TIMESTAMP_URL
$expectedSubject = $env:ATLAS_WINDOWS_CODESIGN_SUBJECT

if ([string]::IsNullOrWhiteSpace($certificatePath) -or
    [string]::IsNullOrWhiteSpace($certificatePassword) -or
    [string]::IsNullOrWhiteSpace($timestampUrl) -or
    [string]::IsNullOrWhiteSpace($expectedSubject)) {
    throw 'Windows production signing is not configured. Set ATLAS_WINDOWS_CODESIGN_PFX_PATH, ATLAS_WINDOWS_CODESIGN_PFX_PASSWORD, ATLAS_WINDOWS_CODESIGN_TIMESTAMP_URL, and ATLAS_WINDOWS_CODESIGN_SUBJECT.'
}

if (-not (Test-Path -LiteralPath $certificatePath -PathType Leaf)) {
    throw 'The configured Windows code-signing certificate file is unavailable.'
}

$resolvedTarget = (Resolve-Path -LiteralPath $FilePath).Path
$resolvedCertificate = (Resolve-Path -LiteralPath $certificatePath).Path
$signToolCommand = Get-Command 'signtool.exe' -ErrorAction SilentlyContinue
$signToolPath = if ($null -ne $signToolCommand) { $signToolCommand.Source } else { $null }

if ([string]::IsNullOrWhiteSpace($signToolPath)) {
    $sdkTools = Get-ChildItem -Path 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe' -File -ErrorAction SilentlyContinue |
        Sort-Object -Property FullName -Descending
    $signToolPath = ($sdkTools | Select-Object -First 1).FullName
}

if ([string]::IsNullOrWhiteSpace($signToolPath)) {
    throw 'signtool.exe was not found. Install the Windows SDK signing tools.'
}

& $signToolPath sign /f $resolvedCertificate /p $certificatePassword /fd SHA256 /tr $timestampUrl /td SHA256 $resolvedTarget
if ($LASTEXITCODE -ne 0) {
    throw "signtool.exe failed with exit code $LASTEXITCODE."
}

$signature = Get-AuthenticodeSignature -LiteralPath $resolvedTarget
if ($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate) {
    throw "The resulting Authenticode signature is not valid: $($signature.Status)."
}
if ($signature.SignerCertificate.Subject -notlike "*$expectedSubject*") {
    throw 'The resulting Authenticode publisher does not match ATLAS_WINDOWS_CODESIGN_SUBJECT.'
}
if ($null -eq $signature.TimeStamperCertificate) {
    throw 'The resulting Authenticode signature has no trusted timestamp.'
}

Write-Output "Signed and verified $([System.IO.Path]::GetFileName($resolvedTarget))."
