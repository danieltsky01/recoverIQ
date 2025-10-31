# Runs the FastAPI backend in dev mode. Creates venv and installs deps if needed.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $here
try {
  # Locate a Python launcher (python or py.exe)
  $pythonCmd = $null
  try { $pythonCmd = (Get-Command python -ErrorAction SilentlyContinue).Source } catch {}
  $pyLauncher = $null
  if (-not $pythonCmd) {
    try { $pyLauncher = (Get-Command py -ErrorAction SilentlyContinue).Source } catch {}
  }
  if (-not $pythonCmd -and -not $pyLauncher) {
    Write-Host 'Python not found. Install Python 3 and ensure "python" or "py" is in PATH: https://www.python.org/downloads/' -ForegroundColor Red
    throw 'Missing Python interpreter'
  }

  $venv = Join-Path $here 'venv'
  if (!(Test-Path $venv)) {
    Write-Host 'Creating Python virtual environment...' -ForegroundColor Cyan
    if ($pythonCmd) {
      & $pythonCmd -m venv venv
    } else {
      & $pyLauncher -3 -m venv venv
    }
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
