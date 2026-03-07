# MindStudio CLI — Windows installer
# Usage: irm https://msagent.ai/install.ps1 | iex

$ErrorActionPreference = "Stop"

$BaseUrl = "https://f.mscdn.ai/agent"
$BinaryName = "mindstudio.exe"
$InstallDir = "$env:USERPROFILE\.mindstudio\bin"

# Colors
function Write-Cyan { param($Text) Write-Host $Text -ForegroundColor Cyan }
function Write-Step { param($Text) Write-Host "  > $Text" }
function Write-Ok { param($Text) Write-Host "  $Text" -ForegroundColor Green }
function Write-Fail { param($Text) Write-Host "  $Text" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Cyan "  MindStudio CLI"
Write-Host ""

# Detect architecture
$Arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
if ($Arch -ne "x64") {
    Write-Fail "Only 64-bit Windows is supported."
}

$Artifact = "mindstudio-windows-x64.exe"
$DownloadUrl = "$BaseUrl/latest/$Artifact"

Write-Step "Detected windows/$Arch"
Write-Step "Downloading binary..."

# Create install directory
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$DestPath = Join-Path $InstallDir $BinaryName
$TmpPath = "$DestPath.tmp"

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TmpPath -UseBasicParsing
} catch {
    Write-Fail "Download failed. Check your internet connection and try again."
}

# Replace existing binary if present
if (Test-Path $DestPath) {
    Remove-Item $DestPath -Force
}
Move-Item $TmpPath $DestPath

# Add to user PATH if not already there
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    Write-Step "Adding to PATH..."
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    # Also update current session
    $env:Path = "$env:Path;$InstallDir"
}

Write-Ok "Installed to $DestPath"
Write-Host ""
Write-Host "  Run 'mindstudio login' to get started."
Write-Host "  (You may need to restart your terminal for PATH changes to take effect.)"
Write-Host ""
