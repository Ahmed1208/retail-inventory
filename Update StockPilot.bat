@echo off
setlocal
cd /d "%~dp0"

echo.
echo === StockPilot — Update ===
echo Downloads the latest app into THIS folder and keeps your data.
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker is not installed or not on PATH. Install Docker Desktop, start it, then try again.
  pause
  exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or not on PATH. Install Node LTS, then try again.
  pause
  exit /b 1
)

call npm run second-pc:update
if errorlevel 1 (
  echo Update failed.
  pause
  exit /b 1
)

set UI_PORT=8080
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /C:"STOCKPILOT_UI_PORT=" .env 2^>nul`) do set UI_PORT=%%B

echo.
echo Serving app on http://localhost:%UI_PORT%
echo Sign in: admin / devpass123
echo.
call npx --yes serve -s dist -l %UI_PORT%
pause
