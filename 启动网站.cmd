@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto no_node
where npm >nul 2>nul
if errorlevel 1 goto no_npm

if not exist "node_modules\.bin\vinext.cmd" (
  echo Installing project dependencies...
  call npm run install:ci
  if errorlevel 1 goto install_failed
)

echo Preparing local database...
call npm run setup:local
if errorlevel 1 goto setup_failed

echo.
echo Homepage: http://127.0.0.1:5173
echo Admin:    http://127.0.0.1:5173/admin
echo Press Ctrl+C to stop the server.
echo.
call npm run dev
if errorlevel 1 goto server_failed
exit /b 0

:no_node
echo Node.js 22.13 or newer is required. Install Node.js and try again.
goto failed

:no_npm
echo npm was not found. Reinstall Node.js and try again.
goto failed

:install_failed
echo Dependency installation failed. Check Node.js and your network connection.
goto failed

:setup_failed
echo Local database setup failed. See the error above and try again.
goto failed

:server_failed
echo The website server failed. See the error above and try again.
goto failed

:failed
echo.
pause
exit /b 1
