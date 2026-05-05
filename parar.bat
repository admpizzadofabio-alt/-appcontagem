@echo off
chcp 65001 >nul
title APPCONTAGEM - Encerrar
color 0C

echo.
echo  ============================================
echo    APPCONTAGEM - Encerrando ambiente
echo  ============================================
echo.

echo  Fechando janela Backend...
taskkill /FI "WINDOWTITLE eq Backend APPCONTAGEM" /F >nul 2>&1

echo  Fechando janela Cloudflared...
taskkill /FI "WINDOWTITLE eq Cloudflared APPCONTAGEM" /F >nul 2>&1

echo  Fechando janela Expo...
taskkill /FI "WINDOWTITLE eq Expo APPCONTAGEM" /F >nul 2>&1

echo  Matando processo ngrok...
taskkill /IM ngrok.exe /F >nul 2>&1

echo  Matando processo na porta 3333 (backend)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3333 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo  Matando processo na porta 8081 (Expo/Metro)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo  [OK] Ambiente encerrado.
echo.
timeout /t 2 /nobreak >nul
exit
