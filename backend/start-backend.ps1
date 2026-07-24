Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $root
$venvActivate = Join-Path $projectRoot '.venv\Scripts\Activate.ps1'

if (-not (Test-Path $venvActivate)) {
    throw "Virtual environment not found at $venvActivate"
}

. $venvActivate

Set-Location $root

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
