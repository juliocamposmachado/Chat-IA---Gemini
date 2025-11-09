@echo off
setlocal enabledelayedexpansion
title Instalador Chat IA Gemini
color 0A

:: ======================================================
:: ELEVAÇÃO DE PRIVILÉGIOS (ADMIN)
:: ======================================================
:: Verifica se o script está rodando como administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando privilégios de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: ======================================================
:: INÍCIO DO INSTALADOR
:: ======================================================

set "PROJECT_DIR=%~dp0GeminiChat"
set "SERVER_FILE=%PROJECT_DIR%\server.js"
set "PACKAGE_FILE=%PROJECT_DIR%\package.json"

echo ============================================
echo   Instalador Chat IA Gemini - Julio Campos
echo ============================================
echo.

echo [Extra] Verificando container PowerShell...
docker ps -q -f name=powershell-container >nul 2>&1
IF ERRORLEVEL 1 (
    echo Criando container PowerShell...
    docker run -itd --name powershell-container mcr.microsoft.com/powershell:latest
) ELSE (
    echo ✅ Container PowerShell já em execução.
)

:: Verifica Node.js
echo [1/6] Verificando Node.js...
node -v >nul 2>&1
IF ERRORLEVEL 1 (
    echo ❌ ERRO: Node.js não está instalado.
    echo Baixe em: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js encontrado

:: Cria estrutura
echo [2/6] Criando estrutura de pastas...
if not exist "%PROJECT_DIR%" (
    mkdir "%PROJECT_DIR%"
    echo ✅ Pasta criada: %PROJECT_DIR%
) else (
    echo ✅ Pasta já existe: %PROJECT_DIR%
)

cd /d "%PROJECT_DIR%"

:: Cria package.json
echo [3/6] Criando package.json...
(
echo {
echo   "name": "gemini-chat-terminal",
echo   "version": "1.0.0",
echo   "description": "Servidor para terminal integrado do Chat IA Gemini",
echo   "main": "server.js",
echo   "scripts": { "start": "node server.js" },
echo   "dependencies": {
echo     "express": "^4.18.2",
echo     "helmet": "^7.1.0",
echo     "body-parser": "^1.20.2",
echo     "node-fetch": "^2.7.0"
echo   },
echo   "author": "Julio Campos",
echo   "license": "MIT"
echo }
) > "%PACKAGE_FILE%"
echo ✅ package.json criado

:: Cria server.js (como no seu código original)
echo [4/6] Criando servidor Node.js...
(
echo // server.js — Servidor Terminal para Chat IA Gemini
echo const express = require('express');
echo const helmet = require('helmet');
echo const bodyParser = require('body-parser');
echo const fetch = require('node-fetch');
echo const { exec } = require('child_process');
echo
echo const app = express();
echo app.use(helmet());
echo app.use(bodyParser.json({ limit: '200kb' }));
echo app.use(express.static('.'));
echo
echo const PORT = process.env.PORT || 3001;
echo const BIND_ADDR = '127.0.0.1';
echo
echo app.get('/health', (req, res) => {
echo   res.json({ status: 'online', port: PORT, timestamp: new Date().toISOString() });
echo });
echo
echo app.listen(PORT, BIND_ADDR, () => {
echo   console.log('Servidor Chat IA Gemini rodando em http://%s:%s', BIND_ADDR, PORT);
echo });
) > "%SERVER_FILE%"
echo ✅ server.js criado

:: Instala dependências
echo [5/6] Instalando dependências...
call npm install --silent
IF ERRORLEVEL 1 (
    echo ❌ Falha ao instalar dependências.
    pause
    exit /b 1
)
echo ✅ Dependências instaladas

:: Cria index.html
if not exist "index.html" (
    (
    echo ^<!DOCTYPE html^^>^<html^^>^<head^^>^<title^^>Chat IA Gemini^^</title^^>^</head^^>
    echo ^<body^^>^<h1^^>Servidor Chat IA Gemini rodando^^</h1^^>^</body^^>^</html^^>
    ) > "index.html"
)

:: ======================================================
:: NGROK CONFIG & TÚNEL AUTOMÁTICO
:: ======================================================
echo [Extra] Configurando ngrok...
where ngrok >nul 2>&1
IF ERRORLEVEL 1 (
    echo ❌ ngrok não encontrado. Baixe em https://ngrok.com/download
    pause
) ELSE (
    echo ✅ ngrok encontrado.
    echo Adicionando token de autenticação...
    ngrok config add-authtoken 2L67VHjRHzUJD9TSd60h2eHrqRL_TqovQEHnNcS7sj2GfCQz

    echo Iniciando túnel para porta 3001...
    start "" powershell -WindowStyle Hidden -Command "Start-Process ngrok -ArgumentList 'http 3001' -Verb RunAs"
    echo ✅ Túnel ngrok iniciado (porta 3001).
)

:: ======================================================
:: INICIAR SERVIDOR
:: ======================================================
echo [6/6] Iniciando servidor...
echo ============================================
echo 🌐 URL local: http://127.0.0.1:3001
echo 🔒 Token padrão: terminal-secret-token-2024
echo ============================================
echo.
echo ⚠️  Mantenha esta janela aberta enquanto usar o chat.
echo.

node "%SERVER_FILE%"
pause
