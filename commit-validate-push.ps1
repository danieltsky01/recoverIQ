<#
Stages changes, prompts for a commit message, validates locally, then pushes.
#>
param(
  [string]$Remote = "origin",
  [string]$Branch = ""
)

$ErrorActionPreference = "Stop"
function Write-Section($m){ Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# Stage
Write-Section "Staging changes"
& git add -A

# Commit
if (-not $Branch) {
  $Branch = (& git rev-parse --abbrev-ref HEAD).Trim()
}
$defaultMsg = "chore: update"
$msg = Read-Host "Commit message (default: '$defaultMsg')"
if (-not $msg) { $msg = $defaultMsg }

# Only commit if there are staged changes
$diff = (& git diff --cached --name-only)
if ($diff) {
  & git commit -m $msg
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
} else {
  Write-Host "No staged changes to commit; continuing" -ForegroundColor Yellow
}

# Validate
Write-Section "Validating locally"
& "$PSScriptRoot/validate-local.ps1"
if ($LASTEXITCODE -ne 0) { throw "Validation failed; not pushing." }

# Push
Write-Section "Pushing $Branch to $Remote"
& git push $Remote $Branch
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Section "Done"
