@echo off
REM RPG Collection Manager - Quick Start Script

echo.
echo ========================================
echo  RPG Collection Manager - Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Setup Backend
echo Setting up Backend...
cd backend
if not exist node_modules (
    echo Installing backend dependencies...
    call npm install
) else (
    echo Backend dependencies already installed
)

if not exist .env (
    echo Creating .env file from .env.example...
    copy .env.example .env
    echo.
    echo WARNING: Please edit backend\.env with your database credentials:
    echo   - DB_SERVER: FASARIG2
    echo   - DB_DATABASE: your_database_name
    echo   - DB_USER: your_username (leave blank for Windows Auth)
    echo   - DB_PASSWORD: your_password (leave blank for Windows Auth)
    echo.
)

cd ..

REM Setup Frontend
echo.
echo Setting up Frontend...
cd frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
) else (
    echo Frontend dependencies already installed
)

cd ..

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo To start the application, open two terminals:
echo.
echo Terminal 1 (Backend):
echo   cd backend
echo   npm run dev
echo.
echo Terminal 2 (Frontend):
echo   cd frontend
echo   npm run dev
echo.
echo Then open your browser to: http://localhost:5173
echo.
pause
