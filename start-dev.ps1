Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runDir = Join-Path $projectRoot '.run'
$backendRoot = Join-Path $projectRoot 'backend'
$frontendRoot = Join-Path $projectRoot 'Frontend'
$backendScript = Join-Path $backendRoot 'start-backend.ps1'
$frontendScript = Join-Path $projectRoot 'start-frontend.ps1'

New-Item -ItemType Directory -Force $runDir | Out-Null

if (-not (Test-Path $backendScript)) {
    throw "Backend launcher not found at $backendScript"
}

if (-not (Test-Path $frontendScript)) {
    throw "Frontend launcher not found at $frontendScript"
}

$backendProcess = Start-Process -FilePath powershell.exe -WindowStyle Hidden -WorkingDirectory $backendRoot -ArgumentList @(
    '-NoLogo',
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $backendScript
) -PassThru

$frontendProcess = Start-Process -FilePath powershell.exe -WindowStyle Hidden -WorkingDirectory $frontendRoot -ArgumentList @(
    '-NoLogo',
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $frontendScript
) -PassThru

@{
    backend_pid = $backendProcess.Id
    frontend_pid = $frontendProcess.Id
} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $runDir 'dev-pids.json')

Write-Host "Started backend PID $($backendProcess.Id) and frontend PID $($frontendProcess.Id)."
Write-Host "Run .\stop.ps1 to stop them."
