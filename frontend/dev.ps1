# Runs the Vite frontend in dev mode. Installs deps if needed.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $here
try {
  if (!(Test-Path 'node_modules')) {
    Write-Host 'Installing frontend dependencies (npm install)...' -ForegroundColor Cyan
    npm install
  }
  Write-Host 'Starting Vite dev server at http://localhost:5173' -ForegroundColor Green
  npm run dev
}
finally {
  Pop-Location
}
