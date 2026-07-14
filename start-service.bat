@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "PID_FILE=%CD%\.claude-code-gui.pid"
set "LOG_FILE=%CD%\claude-code-gui.log"
if not defined PORT set "PORT=4317"
set "APP_URL=http://127.0.0.1:%PORT%"

echo [Claude Code GUI] Starting service...

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or is not available in PATH.
  echo Install Node.js 18 or newer, then try again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not installed or is not available in PATH.
  pause
  exit /b 1
)

if exist "%PID_FILE%" (
  set /p SERVICE_PID=<"%PID_FILE%"
  call :is_running
  if not errorlevel 1 (
    call :recover_from_health
    if not errorlevel 1 (
      set /p SERVICE_PID=<"%PID_FILE%"
      echo [INFO] Service is already running ^(PID !SERVICE_PID!^).
      echo [INFO] Opening %APP_URL%
      start "" "%APP_URL%"
      exit /b 0
    )
    echo [INFO] PID file process is running, but health check did not confirm this service.
  )
  echo [INFO] Removing stale PID file.
  del /q "%PID_FILE%" >nul 2>&1
)

call :recover_from_health
if not errorlevel 1 (
  set /p SERVICE_PID=<"%PID_FILE%"
  echo [INFO] Service is already running ^(PID !SERVICE_PID!^).
  echo [INFO] Opening %APP_URL%
  start "" "%APP_URL%"
  exit /b 0
)

if not exist "node_modules\" (
  echo [INFO] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)

if not exist "dist\index.html" (
  echo [INFO] Building the application...
  call npm run build
  if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
  )
)

if exist "%LOG_FILE%" del /q "%LOG_FILE%" >nul 2>&1
if exist "%LOG_FILE%.err" del /q "%LOG_FILE%.err" >nul 2>&1
powershell -NoProfile -Command "$p = Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/tsx/dist/cli.mjs','server/index.ts' -WorkingDirectory '%CD%' -RedirectStandardOutput '%LOG_FILE%' -RedirectStandardError '%LOG_FILE%.err' -WindowStyle Hidden -PassThru; Set-Content -LiteralPath '%PID_FILE%' -Value $p.Id"

if not exist "%PID_FILE%" (
  echo [ERROR] Failed to start the service.
  pause
  exit /b 1
)
set /p SERVICE_PID=<"%PID_FILE%"

if not defined SERVICE_PID (
  echo [ERROR] Failed to start the service.
  pause
  exit /b 1
)

>"%PID_FILE%" echo %SERVICE_PID%
echo [INFO] Service process started ^(temporary PID %SERVICE_PID%^).
echo [INFO] Waiting for %APP_URL% ...

powershell -NoProfile -Command "$url = '%APP_URL%/api/health'; for ($i = 0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 (
  echo [ERROR] Service did not become ready. Check:
  echo         %LOG_FILE%
  echo         %LOG_FILE%.err
  pause
  exit /b 1
)

call :recover_from_health
if errorlevel 1 (
  echo [WARN] Service is ready, but could not read its health PID. Keeping temporary PID %SERVICE_PID%.
) else (
  set /p SERVICE_PID=<"%PID_FILE%"
  echo [INFO] Service ready ^(PID !SERVICE_PID!^).
)

echo [OK] Claude Code GUI is running at %APP_URL%
start "" "%APP_URL%"
exit /b 0

:is_running
tasklist /fi "PID eq %SERVICE_PID%" /fo csv /nh 2>nul | findstr /c:",\"%SERVICE_PID%\"," >nul
exit /b %errorlevel%

:recover_from_health
powershell -NoProfile -Command "$url = '%APP_URL%/api/health'; $pidFile = '%PID_FILE%'; try { $h = Invoke-RestMethod -UseBasicParsing -Uri $url -TimeoutSec 1; $serverPid = 0; if ($h.ok -and $null -ne $h.pid -and [int]::TryParse([string]$h.pid, [ref]$serverPid) -and $serverPid -gt 0) { Set-Content -LiteralPath $pidFile -Value $serverPid; exit 0 } } catch {}; exit 1"
exit /b %errorlevel%
