@echo off
setlocal
cd /d "%~dp0"

set "PID_FILE=%CD%\.claude-code-gui.pid"

if not exist "%PID_FILE%" (
  echo [INFO] Claude Code GUI is not running ^(PID file not found^).
  exit /b 0
)

set /p SERVICE_PID=<"%PID_FILE%"
if not defined SERVICE_PID (
  echo [INFO] PID file is empty. Removing it.
  del /q "%PID_FILE%" >nul 2>&1
  exit /b 0
)

tasklist /fi "PID eq %SERVICE_PID%" /fo csv /nh 2>nul | findstr /c:",\"%SERVICE_PID%\"," >nul
if errorlevel 1 (
  echo [INFO] Service process %SERVICE_PID% is no longer running.
  del /q "%PID_FILE%" >nul 2>&1
  exit /b 0
)

echo [Claude Code GUI] Stopping service ^(PID %SERVICE_PID%^)...
taskkill /pid %SERVICE_PID% /t /f >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Failed to stop process %SERVICE_PID%.
  pause
  exit /b 1
)

del /q "%PID_FILE%" >nul 2>&1
echo [OK] Service stopped.
exit /b 0
