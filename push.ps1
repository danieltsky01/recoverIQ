<#
Runs local validation and only pushes to Git if validation succeeds.
Usage: .\push.ps1 [-Remote origin] [-Branch current]
#>
param(
  [string]$Remote = "origin",
  [string]$Branch = ""
)

$ErrorActionPreference = "Stop"

function Write-Section($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

Write-Section "Validating local project"
& "$PSScriptRoot/validate-local.ps1"
if ($LASTEXITCODE -ne 0) { throw "Validation failed; aborting push." }

if (-not $Branch) {
  $Branch = (& git rev-parse --abbrev-ref HEAD).Trim()
}

Write-Section "Pushing to $Remote/$Branch"
& git push $Remote $Branch
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Section "Push complete"
