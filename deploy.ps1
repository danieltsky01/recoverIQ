<#
One-click deploy script for Windows PowerShell.
- Checks/install Firebase CLI (via npm)
- Checks/install Google Cloud SDK (via winget if available)
- Authenticates gcloud and Firebase (prompts once if needed)
- Enables required Google Cloud APIs
- Deploys FastAPI backend to Cloud Run (source build, no local Docker needed)
- Builds frontend and deploys to Firebase Hosting

Prereqs: Node/npm installed (already in your project), Windows 10/11 (winget available recommended).
#>

param(
    [string]$ProjectId = "recoveriq-b2b09",
    [string]$Region = "us-central1",
    [string]$ServiceName = "hospital-scorer-api"
)

$ErrorActionPreference = "Stop"

function Write-Section($msg) {
    Write-Host "`n=== $msg ===" -ForegroundColor Cyan
}

function Command-Exists($cmd) {
    $old = $ErrorActionPreference; $ErrorActionPreference = 'SilentlyContinue'
    $exists = Get-Command $cmd
    $ErrorActionPreference = $old
    return $null -ne $exists
}

function Ensure-FirebaseCLI {
    Write-Section "Checking Firebase CLI"
    if (Command-Exists "firebase") {
        $ver = firebase --version
        Write-Host "Firebase CLI found: $ver" -ForegroundColor Green
        return
    }
    Write-Host "Installing Firebase CLI globally via npm..." -ForegroundColor Yellow
    npm install -g firebase-tools | Out-Host
    if (-not (Command-Exists "firebase")) {
        throw "Firebase CLI installation failed. Please install manually: npm i -g firebase-tools"
    }
}

function Ensure-GCloud {
    Write-Section "Checking Google Cloud SDK"
    if (Command-Exists "gcloud") {
        $ver = gcloud --version | Select-String -Pattern "Google Cloud SDK" | ForEach-Object { $_.Line }
        Write-Host "gcloud found: $ver" -ForegroundColor Green
        return
    }
    if (Command-Exists "winget") {
        Write-Host "Installing Google Cloud SDK via winget..." -ForegroundColor Yellow
        winget install -e --id Google.CloudSDK --accept-source-agreements --accept-package-agreements | Out-Host
        if (-not (Command-Exists "gcloud")) {
            throw "gcloud installation via winget did not succeed. Please install manually: https://cloud.google.com/sdk/docs/install"
        }
    } else {
        throw "winget is not available and gcloud is missing. Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    }
}

function Ensure-GCloudAuth($projectId) {
    Write-Section "Authenticating gcloud"
    $accounts = gcloud auth list --format="value(account)" 2>$null
    if (-not $accounts) {
        Write-Host "Opening browser to log in to Google Cloud..." -ForegroundColor Yellow
        gcloud auth login | Out-Host
    }
    gcloud config set project $projectId | Out-Host
}

function Ensure-FirebaseAuth {
    Write-Section "Authenticating Firebase CLI"
    $who = firebase login:list 2>$null | Select-String -Pattern "^\s*\*"
    if (-not $who) {
        Write-Host "Opening browser to log in to Firebase..." -ForegroundColor Yellow
        firebase login | Out-Host
    } else {
        Write-Host "Already logged in to Firebase" -ForegroundColor Green
    }
}

function Enable-APIs($projectId) {
    Write-Section "Enabling required Google Cloud APIs"
    $apis = @(
        'run.googleapis.com',
        'artifactregistry.googleapis.com',
        'cloudbuild.googleapis.com',
        'firestore.googleapis.com',
        'firebase.googleapis.com'
    )
    foreach ($api in $apis) {
        Write-Host "Enabling $api..." -ForegroundColor DarkCyan
        gcloud services enable $api --project $projectId --quiet | Out-Host
    }
}

function Deploy-CloudRun($projectId, $region, $serviceName) {
    Write-Section "Deploying backend to Cloud Run ($serviceName)"
    Push-Location "backend"
    try {
        # Source-based deploy (Cloud Build builds container for us)
        gcloud run deploy $serviceName `
            --source . `
            --region $region `
            --allow-unauthenticated `
            --project $projectId `
            --quiet | Out-Host
    } finally {
        Pop-Location
    }
    $url = gcloud run services describe $serviceName --region $region --project $projectId --format="value(status.url)"
    if (-not $url) { throw "Failed to obtain Cloud Run URL" }
    Write-Host "Cloud Run URL: $url" -ForegroundColor Green
    return $url
}

function Build-Frontend {
    Write-Section "Building frontend"
    Push-Location "frontend"
    try {
        if (Test-Path package-lock.json) {
            npm ci | Out-Host
        } else {
            npm install | Out-Host
        }
        npm run build | Out-Host
    } finally {
        Pop-Location
    }
}

function Deploy-Hosting($projectId) {
    Write-Section "Deploying to Firebase Hosting"
    firebase use $projectId | Out-Host
    firebase deploy --only hosting --project $projectId --non-interactive | Out-Host
}

# Main
Write-Section "Starting one-click deploy"

# 1) CLIs
Ensure-FirebaseCLI
Ensure-GCloud

# 2) Auth
Ensure-GCloudAuth -projectId $ProjectId
Ensure-FirebaseAuth

# 3) APIs
Enable-APIs -projectId $ProjectId

# 4) Cloud Run deploy
$cloudRunUrl = Deploy-CloudRun -projectId $ProjectId -region $Region -serviceName $ServiceName

# 5) Build frontend
Build-Frontend

# 6) Deploy Hosting
Deploy-Hosting -projectId $ProjectId

Write-Section "Done!"
Write-Host "API: $cloudRunUrl" -ForegroundColor Green
Write-Host "Hosting deployed. The Firebase CLI prints the live URL above. If using a custom domain, map it in the Firebase console." -ForegroundColor Green
