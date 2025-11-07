@echo off
cd /d "%~dp0"

echo Verificando e instalando dependencias do Node.js...
call npm install express body-parser cors

echo Iniciando o servidor Node.js...
node server.cjs

pause