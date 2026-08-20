@echo off
title Nexus Testing - Servidor de Producao e Compilacao
cls

:: ── Auto-resolução do Node.js v22 (NVM) ──────────────────────────────
if exist "%APPDATA%\nvm\v22.23.0\node.exe" (
    set "PATH=%APPDATA%\nvm\v22.23.0;%PATH%"
) else if exist "%ProgramFiles%\nodejs\node.exe" (
    :: Tentar nvm use se disponivel
    call nvm use 22.23.0 >nul 2>&1
)

echo ======================================================================
echo                      NEXUS TESTING - PLATAFORMA TCMS
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

echo [1/2] Compilando frontend para producao (Vite Build)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha na compilacao do frontend! Verifique os erros acima.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Iniciando servidor Node.js na raiz...
echo Frontend e API estarao disponiveis em: http://localhost:4000
echo Pressione Ctrl+C para encerrar.
echo.
node server/index.js
pause
