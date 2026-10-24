# TermCanvas - one-shot Windows setup.
#
# From the repository folder:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
#
# Installs what is missing (Node 22+, pnpm, Claude CLI), installs the
# project's dependencies and starts the app. Safe to run again: anything
# already installed is skipped. Pass -NoStart to only install.

param([switch]$NoStart)

$ErrorActionPreference = "Stop"
$PnpmVersion = "10.33.0"
$MinNodeMajor = 22

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "    $text" -ForegroundColor Green }
function Fail($text) {
  Write-Host "`n$text" -ForegroundColor Red
  exit 1
}

# Installers add to PATH in the registry; pick that up in this window too.
function Update-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $extra = @("$env:USERPROFILE\.local\bin", "$env:APPDATA\npm") | Where-Object { Test-Path $_ }
  $env:Path = (@($machine, $user) + $extra | Where-Object { $_ }) -join ";"
}

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Get-NodeMajor {
  if (-not (Test-Command "node")) { return 0 }
  $version = (& node -v) -replace "^v", ""
  return [int]($version.Split(".")[0])
}

$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "pnpm-workspace.yaml"))) {
  Fail "Run this from the termcanvas-orchestrator folder (scripts\setup-windows.ps1)."
}
Set-Location $root
Write-Host "TermCanvas setup in $root"

Step "Node.js $MinNodeMajor+"
if ((Get-NodeMajor) -lt $MinNodeMajor) {
  if (-not (Test-Command "winget")) {
    Fail "Node.js $MinNodeMajor+ is missing and winget is not available. Install the LTS from https://nodejs.org, then run this script again."
  }
  winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-source-agreements --accept-package-agreements
  Update-SessionPath
  if ((Get-NodeMajor) -lt $MinNodeMajor) {
    Fail "Node.js was installed but this window cannot see it yet. Close PowerShell, open a new one and run this script again."
  }
}
Ok "node $(& node -v)"

Step "pnpm"
if (-not (Test-Command "pnpm")) {
  & npm install -g "pnpm@$PnpmVersion"
  if ($LASTEXITCODE -ne 0) { Fail "npm could not install pnpm." }
  Update-SessionPath
  if (-not (Test-Command "pnpm")) { Fail "pnpm was installed but is not on PATH. Open a new PowerShell and run this script again." }
}
Ok "pnpm $(& pnpm --version)"

Step "Claude CLI"
if (-not (Test-Command "claude")) {
  # In a child shell: the installer may call exit, which would end this script.
  $shell = (Get-Process -Id $PID).Path
  & $shell -NoProfile -ExecutionPolicy Bypass -Command "irm https://claude.ai/install.ps1 | iex"
  Update-SessionPath
  if (-not (Test-Command "claude")) { Fail "Claude CLI was installed but is not on PATH. Open a new PowerShell and run this script again." }
}
Ok "claude $(& claude --version)"

Step "Project dependencies (pnpm install - downloads Electron and Chromium, takes a few minutes)"
& pnpm install
if ($LASTEXITCODE -ne 0) {
  Fail "pnpm install failed. Copy the output above into your Claude session, then run this script again after the fix."
}
Ok "dependencies installed"

Write-Host "`nReady. If Claude has never been signed in on this computer, run 'claude' once and log in." -ForegroundColor Green
Write-Host "Next time, start the app with: pnpm dev" -ForegroundColor Green

if (-not $NoStart) {
  Step "Starting TermCanvas (pnpm dev) - close the app window or press Ctrl+C here to stop"
  & pnpm dev
}
