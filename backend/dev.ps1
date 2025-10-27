# Runs the FastAPI backend in dev mode. Creates venv and installs deps if needed.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $here
try {
  $venv = Join-Path $here 'venv'
  if (!(Test-Path $venv)) {
    Write-Host 'Creating Python virtual environment...' -ForegroundColor Cyan
    python -m venv venv
  }

  $pip = Join-Path $venv 'Scripts/pip.exe'
  $py = Join-Path $venv 'Scripts/python.exe'

  Write-Host 'Installing Python dependencies...' -ForegroundColor Cyan
  & $pip install -r requirements.txt

  Write-Host 'Starting FastAPI (Uvicorn) at http://localhost:8000' -ForegroundColor Green
  & $py -m uvicorn main:app --reload
}
finally {
  Pop-Location
}
