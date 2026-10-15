@echo off
setlocal EnableExtensions

title DND Local Stopper

echo.
echo ==========================================
echo   DND 5e Coster - stop local servers
echo ==========================================
echo.

echo Stopping processes that listen on ports 5173, 5174, 5175, 3000, and 3001...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$project = (Resolve-Path '.').Path; $ports = @(5173,5174,5175,3000,3001); $processIds = @(); foreach ($port in $ports) { $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; foreach ($connection in $connections) { $processIds += $connection.OwningProcess } }; $projectProcesses = Get-CimInstance Win32_Process | Where-Object { ($_.Name -in @('node.exe','cmd.exe')) -and ($_.CommandLine -like ('*' + $project + '*') -or $_.CommandLine -like '*backend/src/server.ts*' -or $_.CommandLine -like '*backend\src\server.ts*' -or $_.CommandLine -like '*vite --host*' -or $_.CommandLine -like '*concurrently*') }; foreach ($process in $projectProcesses) { $processIds += $process.ProcessId }; $processIds = @($processIds | Sort-Object -Unique); if ($processIds.Count -eq 0) { Write-Host 'No local DND server processes were found.'; exit 0 }; foreach ($processId in $processIds) { try { $process = Get-Process -Id $processId -ErrorAction Stop; Write-Host ('Stopping PID ' + $processId + ' (' + $process.ProcessName + ')'); Stop-Process -Id $processId -Force -ErrorAction Stop } catch { Write-Host ('Could not stop PID ' + $processId + ': ' + $_.Exception.Message) } }"

echo.
echo Done.
echo.
pause
