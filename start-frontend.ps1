Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Join-Path $projectRoot 'Frontend'
$nodeModules = Join-Path $frontendRoot 'node_modules'
$npmCmd = 'npm.cmd'

if (-not (Test-Path (Join-Path $frontendRoot 'package.json'))) {
    throw "Frontend package.json not found at $frontendRoot"
}

if (-not (Test-Path $nodeModules)) {
    Write-Host "Frontend dependencies are missing. Installing them now..."
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
    & $npmCmd run dev -- --host 127.0.0.1 --port 5173
}
finally {
    Pop-Location
}
