@echo off
title Nexus Testing - Modo Desenvolvimento (Hot Reload)
cls

:: ── Auto-resolução do Node.js v22 (NVM) ──────────────────────────────
if exist "%APPDATA%\nvm\v22.23.0\node.exe" (
    set "PATH=%APPDATA%\nvm\v22.23.0;%PATH%"
) else if exist "%ProgramFiles%\nodejs\node.exe" (
    :: Tentar nvm use se disponivel
    call nvm use 22.23.0 >nul 2>&1
)

echo ======================================================================
echo             NEXUS TESTING - MODO DESENVOLVIMENTO (HOT RELOAD)
echo ======================================================================
echo.
for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
echo Versao do Node.js em uso: %NODE_VER%
echo.

if "%NODE_VER:~0,3%"=="v14" (
    echo [AVISO CRITICO] O sistema esta usando o Node %NODE_VER% antigo.
    echo Para corrigir no seu CMD, execute: nvm use 22.23.0
    echo.
)

echo Iniciando API (Porta 4000) e Web Dev Server (Porta 5173)...
echo Acesse no navegador: http://localhost:5173
echo.
call npm run dev:all
pause
