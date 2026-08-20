@echo off
title Nexus Testing - Modo Desenvolvimento (Hot Reload)
cls
echo ======================================================================
echo             NEXUS TESTING - MODO DESENVOLVIMENTO (HOT RELOAD)
echo ======================================================================
echo.
echo Iniciando API (Porta 4000) e Web Dev Server (Porta 5173)...
echo Acesse no navegador: http://localhost:5173
echo.
call npm run dev:all
pause
