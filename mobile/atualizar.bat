@echo off
echo Enviando atualizacao OTA para os celulares...
set /p msg=Descricao da atualizacao:
eas update --branch preview --message "%msg%"
echo.
echo Pronto! Os celulares vao atualizar automaticamente.
pause
