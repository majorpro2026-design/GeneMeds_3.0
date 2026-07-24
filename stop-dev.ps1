Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runDir = Join-Path $projectRoot '.run'
$pidFile = Join-Path $runDir 'dev-pids.json'
$ports = @(5173, 8000)

function Stop-ListeningPort {
    param([int]$Port)

    $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        try {
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
        }
        catch {
            Write-Warning "Could not stop process $($connection.OwningProcess) for port $Port: $($_.Exception.Message)"
        }
    }
}

if (Test-Path $pidFile) {
    try {
        $pids = Get-Content $pidFile -Raw | ConvertFrom-Json
        foreach ($pid in @($pids.backend_pid, $pids.frontend_pid)) {
            if ($pid) {
                try {
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                }
                catch {
                    Write-Warning "Could not stop PID $pid: $($_.Exception.Message)"
                }
            }
        }
    }
    catch {
        Write-Warning "Could not read PID file at $pidFile: $($_.Exception.Message)"
    }
}

foreach ($port in $ports) {
    Stop-ListeningPort -Port $port
}

Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Stopped dev services and cleared ports 5173 and 8000 if they were running."
