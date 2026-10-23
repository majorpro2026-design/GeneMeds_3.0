Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Join-Path $projectRoot 'Frontend-v2'
$nodeModules = Join-Path $frontendRoot 'node_modules'
$npmCmd = 'npm.cmd'

if (-not (Test-Path (Join-Path $frontendRoot 'package.json'))) {
    throw "Frontend-v2 package.json not found at $frontendRoot"
}

if (-not (Test-Path $nodeModules)) {
    Write-Host "Frontend-v2 dependencies are missing. Installing them now..."
    Push-Location $frontendRoot
    try {
        & $npmCmd install
    }
    finally {
        Pop-Location
    }
}

Push-Location $frontendRoot
try {
    Write-Host "Starting GeneMeds Frontend-v2 development server at http://127.0.0.1:5173..."
    & $npmCmd run dev
}
finally {
    Pop-Location
}
