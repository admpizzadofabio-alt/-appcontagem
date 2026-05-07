@echo off
chcp 65001 >nul
title APPCONTAGEM - Encerrar
color 0C

echo.
echo  ============================================
echo    APPCONTAGEM - Encerrando ambiente
echo  ============================================
echo.

echo  Fechando processos APPCONTAGEM e janelas pai...
powershell -NoProfile -Command "$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'APPCONTAGEM' -and $_.Name -ne 'powershell.exe' -and $_.Name -ne 'cmd.exe' }; $parents = $procs | ForEach-Object { $_.ParentProcessId } | Select-Object -Unique; $parents | ForEach-Object { try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {} }; $procs | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }"

echo  Matando ngrok...
taskkill /IM ngrok.exe /F >nul 2>&1

echo  Liberando portas...
powershell -NoProfile -Command "3333,8081,4040 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"

echo.
echo  [OK] Ambiente encerrado.
echo.
timeout /t 2 /nobreak >nul
exit
