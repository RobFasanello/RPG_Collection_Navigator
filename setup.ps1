#!/usr/bin/env pwsh

Write-Host @"
========================================
 RPG Collection Manager - Setup
========================================
"@ -ForegroundColor Cyan

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Setup Backend
Write-Host "`nSetting up Backend..." -ForegroundColor Yellow
Push-Location backend

if (-not (Test-Path node_modules)) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    npm install
} else {
    Write-Host "Backend dependencies already installed" -ForegroundColor Green
}

if (-not (Test-Path .env)) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Cyan
    Copy-Item .env.example .env
    Write-Host @"
    
WARNING: Please edit backend\.env with your database credentials:
  - DB_SERVER: FASARIG2
  - DB_DATABASE: your_database_name
  - DB_USER: your_username (leave blank for Windows Auth)
  - DB_PASSWORD: your_password (leave blank for Windows Auth)
"@ -ForegroundColor Yellow
}

Pop-Location

# Setup Frontend
Write-Host "`nSetting up Frontend..." -ForegroundColor Yellow
Push-Location frontend

if (-not (Test-Path node_modules)) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    npm install
} else {
    Write-Host "Frontend dependencies already installed" -ForegroundColor Green
}

Pop-Location

Write-Host @"

========================================
 Setup Complete!
========================================

To start the application, open two terminals:

Terminal 1 (Backend):
  cd backend
  npm run dev

Terminal 2 (Frontend):
  cd frontend
  npm run dev

Then open your browser to: http://localhost:5173

"@ -ForegroundColor Green
