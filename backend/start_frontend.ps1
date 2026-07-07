param(
    [int]$Port = 8000,
    [string]$BindHost = "127.0.0.1",
    [switch]$Reload,
    [switch]$InstallDeps,
    [switch]$OpenBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$venvDir = Join-Path $repoRoot ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$systemPython = (Get-Command python).Source
$pythonExe = $systemPython
$stdoutLog = Join-Path $scriptDir "frontend_server.out.log"
$stderrLog = Join-Path $scriptDir "frontend_server.err.log"
$appUrl = "http://$BindHost`:$Port"
$defaultYolov5Repo = "D:\yolov5"
$defaultPendulumWeights = "D:\yolov5\runs\train\pendulum_bob_mvp_v2\weights\best.pt"
$defaultTorsionWeights = "D:\yolov5\runs\train\torsion_rod_real_mvp\weights\best.pt"
$defaultTorsionYoloSegWeights = Join-Path $repoRoot "torsion_yolo_period\runs\segment\runs\torsion_rod_seg\yolo_seg_rod-3\weights\best.pt"

if (-not $env:PHYSICS_AGENT_YOLOV5_REPO -and (Test-Path $defaultYolov5Repo)) {
    $env:PHYSICS_AGENT_YOLOV5_REPO = $defaultYolov5Repo
}
if (-not $env:PHYSICS_AGENT_PENDULUM_YOLO_WEIGHTS -and (Test-Path $defaultPendulumWeights)) {
    $env:PHYSICS_AGENT_PENDULUM_YOLO_WEIGHTS = $defaultPendulumWeights
}
if (-not $env:PHYSICS_AGENT_PENDULUM_YOLO_CLASSES) {
    $env:PHYSICS_AGENT_PENDULUM_YOLO_CLASSES = "pendulum_bob,bob,ball,sports ball"
}
if (-not $env:PHYSICS_AGENT_TORSION_YOLO_WEIGHTS -and (Test-Path $defaultTorsionWeights)) {
    $env:PHYSICS_AGENT_TORSION_YOLO_WEIGHTS = $defaultTorsionWeights
}
if (-not $env:PHYSICS_AGENT_TORSION_YOLO_CLASSES) {
    $env:PHYSICS_AGENT_TORSION_YOLO_CLASSES = "torsion_rod"
}
if (-not $env:PHYSICS_AGENT_TORSION_YOLO_SEG_WEIGHTS -and (Test-Path $defaultTorsionYoloSegWeights)) {
    $env:PHYSICS_AGENT_TORSION_YOLO_SEG_WEIGHTS = $defaultTorsionYoloSegWeights
}

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

if ($InstallDeps) {
    if (-not (Test-Path $venvPython)) {
        Write-Host "Creating local virtual environment: $venvDir"
        & $systemPython -m venv $venvDir
    }
    $pythonExe = $venvPython
    Write-Host "Installing Python dependencies from requirements.txt..."
    & $pythonExe -m pip install --upgrade pip
    & $pythonExe -m pip install -r (Join-Path $repoRoot "requirements.txt")
} elseif (Test-Path $venvPython) {
    $pythonExe = $venvPython
}

Write-Host "Checking frontend status: $appUrl"
if (Test-FrontendReady -Url $appUrl) {
    Write-Host "Frontend is already running. Open $appUrl"
    if ($OpenBrowser) {
        Start-Process $appUrl
    }
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
if ($OpenBrowser) {
    Start-Process $appUrl
}
