@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Install Node.js 22 or newer first. & pause & exit /b 1)
node "%~dp0portable.mjs" install
if errorlevel 1 echo FAILED - read the error above.
pause
