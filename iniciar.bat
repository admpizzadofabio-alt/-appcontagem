@echo off
chcp 65001 >nul
title APPCONTAGEM - Dev
color 0A

echo.
echo  ============================================
echo    APPCONTAGEM - Iniciando Ambiente Dev
echo  ============================================
echo.

REM --- Verificar Docker (opcional) ---
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
taskkill /FI "WINDOWTITLE eq Cloudflared APPCONTAGEM" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Expo APPCONTAGEM" /F >nul 2>&1
taskkill /IM ngrok.exe /F >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3333 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 1 /nobreak >nul

REM --- Backend ---
echo  Iniciando backend...
start "Backend APPCONTAGEM" cmd /k "cd /d "%~dp0backend" && npm run dev"

REM --- Espera ativa pelo backend (max 30s) ---
echo  Aguardando backend responder em /health...
set /a tries=0
:waitbackend
set /a tries+=1
if %tries% GTR 30 (
  echo  [!!] Backend nao respondeu apos 30s. Verifique a janela "Backend APPCONTAGEM".
  goto :cloudflaredstart
)
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://localhost:3333/api/v1/health -ErrorAction Stop; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel% NEQ 0 (
  timeout /t 1 /nobreak >nul
  goto :waitbackend
)
echo  [OK] Backend respondendo.

:cloudflaredstart
REM --- Cloudflared (tunnel gratuito para o backend) ---
echo  Iniciando tunnel cloudflared para backend...
set CF_LOG=%TEMP%\cf_appcontagem.txt
if exist "%CF_LOG%" del "%CF_LOG%"
start "Cloudflared APPCONTAGEM" cmd /k "cloudflared tunnel --url http://localhost:3333 > "%CF_LOG%" 2>&1"

REM --- Aguardar URL do cloudflared (max 30s) ---
echo  Aguardando URL do cloudflared...
set /a tries=0
:waitcf
set /a tries+=1
if %tries% GTR 30 (
  echo  [!!] Cloudflared nao respondeu. Verifique a janela "Cloudflared APPCONTAGEM".
  goto :expostart
)
powershell -NoProfile -Command "if (Select-String -Path '%CF_LOG%' -Pattern 'trycloudflare\.com' -Quiet -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% NEQ 0 (
  timeout /t 1 /nobreak >nul
  goto :waitcf
)

REM --- Extrair URL e salvar no .env.local ---
powershell -NoProfile -Command "$content = Get-Content '%CF_LOG%' -Raw -ErrorAction SilentlyContinue; $m = [regex]::Match($content, 'https://[^\s]+trycloudflare\.com'); if ($m.Success) { $url = $m.Value; \"EXPO_PUBLIC_API_URL=$url/api/v1\" | Set-Content '%~dp0mobile\.env.local' -Encoding utf8; Write-Host \"  [OK] Backend URL: $url/api/v1\" } else { Write-Host '  [!!] URL nao encontrada no log do cloudflared.' }"

:expostart
REM --- Expo com tunnel (ngrok proprio do Expo) ---
echo  Iniciando Expo (tunnel)...
start "Expo APPCONTAGEM" cmd /k "cd /d "%~dp0mobile" && npx expo start --tunnel --clear"

echo.
echo  [OK] Tudo iniciado! Escaneie o QR code no Expo Go.
echo  Para encerrar tudo, rode: parar.bat
echo.
exit
