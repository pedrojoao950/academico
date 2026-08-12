@echo off
setlocal
cd /d "%~dp0"

echo.
echo A iniciar o SIGA...
echo.

start "SIGA - Servidor Local (NAO FECHAR durante a demonstracao)" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

timeout /t 2 /nobreak >nul

start "" "http://localhost:5500"

echo O SIGA foi aberto no seu browser.
echo.
echo Para TERMINAR a demonstracao, feche a janela preta do PowerShell
echo chamada "SIGA - Servidor Local".
echo.
timeout /t 5 >nul
