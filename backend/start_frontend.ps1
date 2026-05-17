param(
    [int]$Port = 8000,
    [string]$BindHost = "127.0.0.1",
    [switch]$Reload
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$pythonExe = (Get-Command python).Source
$stdoutLog = Join-Path $scriptDir "frontend_server.out.log"
$stderrLog = Join-Path $scriptDir "frontend_server.err.log"
$appUrl = "http://$BindHost`:$Port"

function Test-FrontendReady {
    param(
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

Write-Host "Checking frontend status: $appUrl"
if (Test-FrontendReady -Url $appUrl) {
    Write-Host "Frontend is already running. Open $appUrl"
    exit 0
}

$arguments = @(
    "-m",
    "uvicorn",
    "backend.main:app",
    "--host",
    $BindHost,
    "--port",
    [string]$Port
)

if ($Reload) {
    $arguments += "--reload"
}

$startInfo = @{
    FilePath = $pythonExe
    ArgumentList = $arguments
    WorkingDirectory = $repoRoot
    RedirectStandardOutput = $stdoutLog
    RedirectStandardError = $stderrLog
    WindowStyle = "Hidden"
    PassThru = $true
}

Write-Host "Starting frontend service in background..."
$process = Start-Process @startInfo

$started = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-FrontendReady -Url $appUrl) {
        $started = $true
        break
    }
}

if (-not $started) {
    Write-Host "Frontend did not start in time. Check logs:"
    Write-Host "stdout: $stdoutLog"
    Write-Host "stderr: $stderrLog"
    exit 1
}

Write-Host "Frontend started successfully."
Write-Host "URL: $appUrl"
Write-Host "PID: $($process.Id)"
Write-Host "stdout: $stdoutLog"
Write-Host "stderr: $stderrLog"
