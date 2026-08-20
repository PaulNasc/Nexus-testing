@echo off
title Nexus Testing - Servidor de Producao e Compilacao
cls
echo ======================================================================
echo                      NEXUS TESTING - PLATAFORMA TCMS
echo ======================================================================
echo.
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
