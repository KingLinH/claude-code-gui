@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "PID_FILE=%CD%\.claude-code-gui.pid"
if not defined PORT set "PORT=4317"
set "APP_URL=http://127.0.0.1:%PORT%"

echo [Claude Code GUI] Stopping service...

set "SERVICE_PID="
if exist "%PID_FILE%" set /p SERVICE_PID=<"%PID_FILE%"

if defined SERVICE_PID (
  call :try_stop_pid "%SERVICE_PID%" "PID file"
  if not errorlevel 1 goto :stopped
  echo [INFO] PID file did not point to a running Claude Code GUI service.
)

call :get_health_pid
if not errorlevel 1 if defined HEALTH_PID (
  call :try_stop_pid "!HEALTH_PID!" "health endpoint"
  if not errorlevel 1 goto :stopped
)

call :get_port_pid
if not errorlevel 1 if defined PORT_PID (
  call :try_stop_pid "!PORT_PID!" "port %PORT%"
  if not errorlevel 1 goto :stopped
)

if exist "%PID_FILE%" del /q "%PID_FILE%" >nul 2>&1
echo [INFO] No running Claude Code GUI service was found.
exit /b 0

:stopped
if exist "%PID_FILE%" del /q "%PID_FILE%" >nul 2>&1
echo [OK] Service stopped.
exit /b 0

:try_stop_pid
set "CANDIDATE_PID=%~1"
set "PID_SOURCE=%~2"
if not defined CANDIDATE_PID exit /b 1

echo %CANDIDATE_PID%| findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 exit /b 1

call :is_service_process "%CANDIDATE_PID%"
if errorlevel 1 exit /b 1

echo [INFO] Stopping process %CANDIDATE_PID% from %PID_SOURCE%...
taskkill /pid %CANDIDATE_PID% /t /f >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Failed to stop process %CANDIDATE_PID%.
  pause
  exit /b 2
)
exit /b 0

:is_service_process
set "CHECK_PID=%~1"
powershell -NoProfile -Command "$pidValue = [int]'%CHECK_PID%'; $p = Get-CimInstance Win32_Process -Filter \"ProcessId=$pidValue\" -ErrorAction SilentlyContinue; if ($null -eq $p) { exit 1 }; $cmd = [string]$p.CommandLine; if ($p.Name -ieq 'node.exe' -and $cmd -match 'node_modules[\\/]+tsx[\\/]+dist[\\/]+(cli|loader|preflight)\.(mjs|cjs)' -and $cmd -match 'server[\\/]+index\.ts') { exit 0 }; exit 1"
exit /b %errorlevel%

:get_health_pid
set "HEALTH_PID="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$url = '%APP_URL%/api/health'; try { $h = Invoke-RestMethod -UseBasicParsing -Uri $url -TimeoutSec 1; $serverPid = 0; if ($h.ok -and $null -ne $h.pid -and [int]::TryParse([string]$h.pid, [ref]$serverPid) -and $serverPid -gt 0) { Write-Output $serverPid; exit 0 } } catch {}; exit 1"`) do set "HEALTH_PID=%%P"
if defined HEALTH_PID exit /b 0
exit /b 1

:get_port_pid
set "PORT_PID="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "try { Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -First 1 } catch { exit 1 }"`) do set "PORT_PID=%%P"
if defined PORT_PID exit /b 0
exit /b 1
