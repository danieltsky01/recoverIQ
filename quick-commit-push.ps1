<#
One-click: stage all, commit with a default message, and push current branch to origin.
#>
$ErrorActionPreference = "Stop"
function Write-Section($m){ Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# Ensure we're in a git repo
if (-not (Test-Path .git)) { throw ".git folder not found. Initialize git and add a remote first." }

# Determine current branch
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch -or $branch -eq "HEAD") { $branch = "main" }

Write-Section "Staging changes"
& git add -A

# Commit if there are staged changes
$diff = (& git diff --cached --name-only)
if ($diff) {
  $msg = "chore: update"
  & git commit -m $msg
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
} else {
  Write-Host "No changes to commit; pushing existing commits" -ForegroundColor Yellow
}

Write-Section "Pushing $branch to origin"
& git push origin $branch
if ($LASTEXITCODE -ne 0) { throw "git push failed (check that 'origin' exists and you have permissions)" }

Write-Section "Done"
