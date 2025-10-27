<#
Validates local project state without launching long-running servers.
- Ensures backend venv and installs requirements
- Runs Python self-test against FastAPI app using TestClient
- Builds the frontend (typechecks + vite build)
#>

$ErrorActionPreference = "Stop"

function Write-Section($msg) {
  Write-Host "`n=== $msg ===" -ForegroundColor Cyan
}

# Resolve backend Python
$backendVenvs = @("backend/venv", "backend/.venv")
$venv = $backendVenvs | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $venv) {
  Write-Section "Creating backend virtual environment (.venv)"
  python -m venv "backend/.venv"
  $venv = "backend/.venv"
}
$py = Join-Path $venv "Scripts/python.exe"
if (-not (Test-Path $py)) { throw "Python interpreter not found at $py" }

# Backend deps
Write-Section "Installing backend dependencies"
& $py -m pip install --upgrade pip | Out-Host
& $py -m pip install -r "backend/requirements.txt" | Out-Host

# Backend validation
Write-Section "Running backend validation"
& $py "scripts/validate_backend.py"
if ($LASTEXITCODE -ne 0) { throw "Backend validation failed" }

# Frontend: install and build
Write-Section "Installing frontend deps and building"
Push-Location "frontend"
try {
  $hasNodeModules = Test-Path "node_modules"
  $tscBin = Join-Path (Resolve-Path ".").Path "node_modules/.bin/tsc.cmd"
  $needsInstall = (-not $hasNodeModules) -or (-not (Test-Path $tscBin))
  if ($needsInstall) {
    if (Test-Path "package-lock.json") {
      npm ci
    } else {
      npm install
    }
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  } else {
    Write-Host "node_modules present; skipping install (close any running dev server to avoid file locks)" -ForegroundColor Yellow
  }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }
} finally {
  Pop-Location
}

Write-Section "Local validation passed"
