@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "BACKEND_PORT=5000"
set "FRONTEND_PORT=5173"
set "DB_LOCAL_PORT=3306"
set "DB_REMOTE_HOST=127.0.0.1"
set "DB_REMOTE_PORT=3306"
set "SSH_USER=root"
set "SSH_HOST=104.248.227.132"

echo Restarting local KnightWise servers...
echo.

call :kill_port_if_listening %BACKEND_PORT% Backend
call :kill_port_if_listening %FRONTEND_PORT% Frontend
call :restart_ssh_tunnel

echo Starting backend in a new terminal...
start "KnightWise Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && npm run dev"

echo Starting frontend in a new terminal...
start "KnightWise Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

echo.
echo Tunnel:   %DB_LOCAL_PORT% ^> %DB_REMOTE_HOST%:%DB_REMOTE_PORT% via %SSH_USER%@%SSH_HOST%
echo Backend:  http://localhost:%BACKEND_PORT%
echo Frontend: http://localhost:%FRONTEND_PORT%
echo.
goto :eof

:restart_ssh_tunnel
set "FOUND_TUNNEL_PID="

for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$procs = Get-CimInstance Win32_Process -Filter \"Name='ssh.exe'\" ^| Where-Object { $_.CommandLine -and $_.CommandLine -match '-L\s*%DB_LOCAL_PORT%:%DB_REMOTE_HOST%:%DB_REMOTE_PORT%' -and $_.CommandLine -match '%SSH_USER%@%SSH_HOST%' }; $procs ^| Select-Object -ExpandProperty ProcessId"`) do (
    set "FOUND_TUNNEL_PID=1"
    echo [SSH Tunnel] Stopping existing tunnel PID %%P...
    taskkill /F /PID %%P >nul 2>&1
)

if not defined FOUND_TUNNEL_PID (
    echo [SSH Tunnel] No existing matching tunnel found.
)

echo [SSH Tunnel] Starting new tunnel...
start "KnightWise SSH Tunnel" cmd /k "ssh -N -o ExitOnForwardFailure=yes -L %DB_LOCAL_PORT%:%DB_REMOTE_HOST%:%DB_REMOTE_PORT% %SSH_USER%@%SSH_HOST%"

goto :eof

:kill_port_if_listening
set "TARGET_PORT=%~1"
set "TARGET_NAME=%~2"
set "FOUND_PID="

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
    set "FOUND_PID=1"
    echo [%TARGET_NAME%] Stopping PID %%P on port %TARGET_PORT%...
    taskkill /F /PID %%P >nul 2>&1
)

if not defined FOUND_PID (
    echo [%TARGET_NAME%] Nothing running on port %TARGET_PORT%.
)

goto :eof
