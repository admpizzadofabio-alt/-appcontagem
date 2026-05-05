@echo off
title APPCONTAGEM - Setup Inicial
color 0A

echo.
echo  ============================================
echo    APPCONTAGEM - Setup do Ambiente Dev
echo  ============================================
echo.

REM --- Verificar Docker ---
docker info >nul 2>&1
if %errorlevel% neq 0 (
  echo  [ERRO] Docker Desktop nao esta rodando.
  echo         Abra o Docker Desktop e execute este script novamente.
  echo.
  pause
  exit /b 1
)
echo  [OK] Docker esta rodando.

REM --- Subir PostgreSQL ---
echo.
echo  [1/5] Iniciando banco de dados PostgreSQL...
docker compose -f "%~dp0docker-compose.yml" up -d postgres
if %errorlevel% neq 0 (
  echo  [ERRO] Falha ao iniciar o container PostgreSQL.
  pause
  exit /b 1
)

echo  Aguardando PostgreSQL ficar pronto...
timeout /t 8 /nobreak >nul

REM --- Instalar dependencias backend ---
echo.
echo  [2/5] Instalando dependencias do backend...
cd /d "%~dp0backend"
call npm install
if %errorlevel% neq 0 (
  echo  [ERRO] Falha ao instalar dependencias do backend.
  pause
  exit /b 1
)

REM --- Executar migrations ---
echo.
echo  [3/5] Executando migrations do banco de dados...
call npx prisma migrate dev --name init
if %errorlevel% neq 0 (
  echo  [AVISO] Migration pode ja existir. Tentando prisma migrate deploy...
  call npx prisma migrate deploy
)

REM --- Gerar Prisma Client ---
echo.
echo  [4/5] Gerando Prisma Client...
call npx prisma generate

REM --- Seed ---
echo.
echo  [5/5] Populando banco com dados iniciais...
call npm run prisma:seed
if %errorlevel% neq 0 (
  echo  [AVISO] Seed falhou ou ja foi executado anteriormente.
)

REM --- Instalar dependencias mobile ---
echo.
echo  [+] Instalando dependencias do mobile...
cd /d "%~dp0mobile"
call npm install

echo.
echo  ============================================
echo   Setup concluido com sucesso!
echo.
echo   Banco:    localhost:5432 (postgres/postgres)
echo   pgAdmin:  http://localhost:5050
echo             login: admin@pizzadofabio.com
echo             senha:  admin
echo.
echo   Execute iniciar.bat para rodar o app.
echo  ============================================
echo.
pause
