@echo off
chcp 65001 >nul
title APPCONTAGEM - Dev
color 0A

echo.
echo  ============================================
echo    APPCONTAGEM - Iniciando Ambiente Dev
echo  ============================================
echo.
echo  [1] Local   (mesmo WiFi - sem ngrok)
echo  [2] Externo (ngrok - qualquer rede)
echo.
set /p "MODO=  Escolha (1 ou 2): "

if "%MODO%"=="1" goto modolocal
if "%MODO%"=="2" goto modoexterno
echo  [!!] Opcao invalida. Digite 1 ou 2.
pause
exit

:modolocal
echo.
echo  [LOCAL] Usando IP 192.168.15.164:3333
echo EXPO_PUBLIC_API_URL=http://192.168.15.164:3333/api/v1> "%~dp0mobile\.env.local"
set "EXPO_LAN_IP=192.168.15.164"
goto iniciarcomum

:modoexterno
echo.
echo  [EXTERNO] Usando ngrok...
goto iniciarcomum

:iniciarcomum

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
taskkill /FI "WINDOWTITLE eq Ngrok APPCONTAGEM" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Expo APPCONTAGEM" /F >nul 2>&1
taskkill /IM ngrok.exe /F >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3333 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4040 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
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

if "%MODO%"=="1" goto expostart

REM --- Ngrok ---
REM  Pre-requisito: rodar uma vez no terminal: ngrok config add-authtoken SEU_TOKEN
REM  Token fica salvo em %USERPROFILE%\AppData\Local\ngrok\ngrok.yml
echo  Iniciando tunnel ngrok...
start "Ngrok APPCONTAGEM" cmd /k "title Ngrok APPCONTAGEM && ngrok http 3333"

echo  Aguardando ngrok...
set /a tries=0
:waitngrok
set /a tries+=1
if %tries% GTR 30 (
  echo  [!!] Ngrok nao respondeu.
  goto expostart
)
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://localhost:4040/api/tunnels -ErrorAction Stop; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel% NEQ 0 (
  timeout /t 1 /nobreak >nul
  goto waitngrok
)

powershell -NoProfile -Command "try { $r = (Invoke-WebRequest -UseBasicParsing http://localhost:4040/api/tunnels).Content | ConvertFrom-Json; $url = ($r.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1).public_url; if ($url) { \"EXPO_PUBLIC_API_URL=$url/api/v1\" | Set-Content '%~dp0mobile\.env.local' -Encoding utf8; Write-Host \"  [OK] URL: $url/api/v1\" } else { Write-Host '  [!!] URL nao encontrada.' } } catch { Write-Host '  [!!] Erro ao extrair URL do ngrok.' }"

:expostart
echo  Iniciando Expo...
if "%MODO%"=="2" (
  start "Expo APPCONTAGEM" cmd /k "title Expo APPCONTAGEM && cd /d "%~dp0mobile" && npx expo start --tunnel --clear"
) else (
  REM REACT_NATIVE_PACKAGER_HOSTNAME forca o Metro a publicar o QR no IP LAN (em vez de 127.0.0.1)
  start "Expo APPCONTAGEM" cmd /k "title Expo APPCONTAGEM && cd /d "%~dp0mobile" && set REACT_NATIVE_PACKAGER_HOSTNAME=%EXPO_LAN_IP% && npx expo start --lan --clear"
)

echo.
echo  [OK] Tudo iniciado! Escaneie o QR code no Expo Go.
echo  Para encerrar tudo, rode: parar.bat
echo.
exit
