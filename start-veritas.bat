@echo off
REM Starts the Veritas backend. Leave this window open while using the app.
cd /d "%~dp0"
title Veritas backend (port 3000) - leave open
echo Starting Veritas backend on http://localhost:3000
echo.
echo Leave this window OPEN while you use the app.
echo Closing it stops the backend and the pages will show zeros.
echo.
node server\index.js
echo.
echo *** Backend stopped. Press any key to close. ***
pause >nul
