@echo off
title AI STOCK PREDICTION SYSTEM
echo ===================================================
echo   AI STOCK PREDICTION SYSTEM
echo   Indian Market Data & Intelligent Stock Analytics
echo ===================================================
echo.
echo Starting Flask server on http://127.0.0.1:5000 ...
echo Press Ctrl+C in this window to stop the server.
echo.
cd /d "%~dp0"
python app.py
pause
