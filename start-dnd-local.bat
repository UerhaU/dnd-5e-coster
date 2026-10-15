@echo off
setlocal EnableExtensions

title DND Local Launcher
cd /d "%~dp0"

echo.
echo ==========================================
echo   DND 5e Coster - local launcher
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then open this file again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Check your Node.js installation.
  echo.
  pause
  exit /b 1
)

if not exist package.json (
  echo package.json was not found. Run this file from the project root.
  echo.
  pause
  exit /b 1
)

echo Checking ports 5173, 5174, 5175, 3000, and 3001...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(5173,5174,5175,3000,3001); $busy = @(); foreach ($port in $ports) { $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; foreach ($connection in $connections) { $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue; $busy += [pscustomobject]@{Port=$port; ProcessId=$connection.OwningProcess; ProcessName=$process.ProcessName} } }; if ($busy.Count -gt 0) { Write-Host ''; Write-Host 'Required port is already busy:'; $busy | ForEach-Object { Write-Host ('  port ' + $_.Port + ' - PID ' + $_.ProcessId + ' (' + $_.ProcessName + ')') }; Write-Host ''; Write-Host 'Close old DND Backend / DND Frontend windows, then run this file again.'; exit 10 }"
if errorlevel 10 (
  echo You can also run stop-dnd-local.bat to free these ports.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies. This is needed only on first run...
  call npm install
  if errorlevel 1 (
    echo.
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

echo Preparing SQLite database...
call npm run db:push
if errorlevel 1 (
  echo.
  echo Failed to prepare database.
  pause
  exit /b 1
)

echo Preparing local network bypass for proxy/DPI tools...
set "NO_PROXY=localhost,127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12"
set "no_proxy=%NO_PROXY%"
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "ALL_PROXY="
set "http_proxy="
set "https_proxy="
set "all_proxy="
set "VITE_API_TARGET=http://127.0.0.1:3000"

echo.
echo Starting backend on port 3000...
start "DND Backend API :3000" /D "%~dp0" cmd /k npm run dev:backend

echo Waiting for backend health check...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; for ($attempt = 1; $attempt -le 90; $attempt++) { Write-Host -NoNewline '.'; try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 1; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch { Start-Sleep -Seconds 1 } }; if (-not $ready) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 5; if ($response.StatusCode -eq 200) { $ready = $true } } catch {} }; Write-Host ''; if (-not $ready) { Write-Host ''; Write-Host 'Backend did not answer on http://127.0.0.1:3000/api/health after 90 seconds.'; Write-Host 'Check the DND Backend API window for errors.'; exit 20 }"
if errorlevel 20 (
  echo.
  echo Backend did not start correctly.
  echo Frontend was not started because API would be unavailable.
  echo.
  pause
  exit /b 1
)

echo Starting frontend on port 5173...
start "DND Frontend Web :5173" /D "%~dp0" cmd /k npm run dev:frontend

echo Waiting for frontend...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; for ($attempt = 1; $attempt -le 25; $attempt++) { Write-Host -NoNewline '.'; try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173' -TimeoutSec 1; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch { Start-Sleep -Seconds 1 } }; Write-Host ''; if (-not $ready) { Write-Host ''; Write-Host 'Frontend did not answer on http://127.0.0.1:5173 after 25 seconds.'; Write-Host 'Check the DND Frontend Web window for errors.'; exit 21 }"
if errorlevel 21 (
  echo.
  echo Frontend did not start correctly.
  echo.
  pause
  exit /b 1
)

echo.
echo Ready.
echo.
echo On this PC:
echo   http://127.0.0.1:5173/
echo.
echo On phone or tablet in the same Wi-Fi network, open one of these URLs:
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.IPAddress -notlike '0.*' } | Select-Object -ExpandProperty IPAddress -Unique; if ($ips) { $ips | ForEach-Object { Write-Host ('  http://' + $_ + ':5173/') } } else { Write-Host '  IP address was not found. Check network connection.' }"
echo.
echo If phone cannot open the site, allow Node.js in Windows Firewall
echo and check that PC and phone are connected to the same network.
echo.
echo To stop servers, close these windows:
echo   DND Backend API :3000
echo   DND Frontend Web :5173
echo Or run:
echo   stop-dnd-local.bat
echo.

start "" "http://127.0.0.1:5173/"

pause
