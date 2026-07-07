@echo off
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "backend\start_frontend.ps1" -InstallDeps -OpenBrowser
if errorlevel 1 (
  echo.
  echo 启动失败。请查看 backend\frontend_server.err.log
  pause
  exit /b 1
)
echo.
echo 网页端已启动。如果浏览器没有自动打开，请访问 http://127.0.0.1:8000
pause
