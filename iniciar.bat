@echo off
REM Teste de IA
chcp 65001 >nul
title APPCONTAGEM - Dev
color 0A

echo.
echo  ============================================
echo    APPCONTAGEM - Iniciando Ambiente Dev
echo  ============================================
echo.
echo  [LOCAL] Usando IP 192.168.15.164:3333
echo  (telefone deve estar no mesmo WiFi)
echo.

echo EXPO_PUBLIC_API_URL=http://192.168.15.164:3333/api/v1> "%~dp0mobile\.env.local"
set "EXPO_LAN_IP=192.168.15.164"

REM --- Verificar Docker ---
docker info >nul 2>&1
if %errorlevel% equ 0 (
  echo  [OK] Docker esta rodando. Garantindo PostgreSQL via Docker...
  docker compose -f "%~dp0docker-compose.yml" up -d postgres >nul 2>&1
  timeout /t 3 /nobreak >nul
) else (
  echo  [INFO] Docker nao esta rodando. Usando PostgreSQL local instalado.
)

REM --- Encerrar processos antigos ---
echo  Encerrando processos antigos...
taskkill /FI "WINDOWTITLE eq Backend APPCONTAGEM" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Expo APPCONTAGEM" /F >nul 2>&1
taskkill /IM ngrok.exe /F >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3333 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 1 /nobreak >nul

REM --- Backend ---
echo  Iniciando backend...
start "Backend APPCONTAGEM" cmd /k "title Backend APPCONTAGEM && cd /d "%~dp0backend" && npm run dev"

REM --- Espera backend ---
echo  Aguardando backend...
set /a tries=0
:waitbackend
set /a tries+=1
if %tries% GTR 30 (
  echo  [!!] Backend nao respondeu apos 30s.
  goto expostart
)
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://localhost:3333/api/v1/health -ErrorAction Stop; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel% NEQ 0 (
  timeout /t 1 /nobreak >nul
  goto waitbackend
)
echo  [OK] Backend respondendo.

:expostart
echo  Iniciando Expo...
start "Expo APPCONTAGEM" cmd /k "title Expo APPCONTAGEM && cd /d "%~dp0mobile" && set REACT_NATIVE_PACKAGER_HOSTNAME=%EXPO_LAN_IP% && npx expo start --lan --clear"

echo.
echo  [OK] Tudo iniciado! Escaneie o QR code no Expo Go.
echo  Para encerrar tudo, rode: parar.bat
echo.
exit
