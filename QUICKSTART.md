# Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- MSSQL Server running with your database

## Initial Setup (One-time)

### Option 1: Automatic Setup (Windows)
```bash
# Run one of these:
.\setup.bat          # For Command Prompt
.\setup.ps1          # For PowerShell
```

### Option 2: Manual Setup
```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

## Running the Application

### Terminal 1 - Backend (Port 3001)
```bash
cd backend
npm run dev
```

Expected output:
```
Database connection pool initialized
Server is running on http://localhost:3001
```

### Terminal 2 - Frontend (Port 5173)
```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v4.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Press h to show help
```

## Access the Application
Open your browser and navigate to: **http://localhost:5173**

You should see the RPG Collection Manager dashboard with all your database tables listed.

## Troubleshooting

### Issue: Backend won't connect to database
**Solution:**
1. Check if MSSQL Server is running
2. Edit `backend/.env` with correct credentials:
   ```env
   DB_SERVER=FASARIG2
   DB_DATABASE=tabletop_inventory
   DB_USER=username
   DB_PASSWORD=password
   ```
3. Restart backend: `npm run dev`

### Issue: Frontend shows "Failed to fetch tables"
**Solution:**
1. Ensure backend is running on port 3001
2. Check browser console (F12) for detailed error
3. Verify CORS is enabled in backend

### Issue: Port already in use
**Solution:**
1. Find the process using port 3001 (PowerShell):
   ```powershell
   Get-NetTCPConnection -LocalPort 3001 | Select-Object LocalAddress, LocalPort, State, OwningProcess
   ```
2. Stop that process (if safe):
   ```powershell
   Stop-Process -Id <PID> -Force
   ```
3. Or move backend to another port by adding `PORT` to `backend/.env`, for example:
   ```env
   PORT=3002
   ```
4. Restart backend: `npm run dev`
5. If using IIS reverse proxy or service mode, keep backend on port 3001 unless you also update proxy targets.

## Project Folder Moved Checklist

When this repo is moved to a new local path, run these steps to refresh Windows service and IIS path bindings:

1. From repo root, stop/remove old backend service registration (if present):
   ```powershell
   ./scripts/remove-backend-service.ps1
   ```
2. Reinstall backend service so NSSM points to the new backend folder:
   ```powershell
   ./scripts/install-backend-service.ps1
   ```
3. Reconfigure IIS site physical path to the new frontend dist folder:
   ```powershell
   ./scripts/configure-iis-site.ps1 -SiteName "RPG Collection Navigator" -Port 80 -HostHeader "localhost" -ReconcileBindings
   ```
4. Verify endpoints:
   - http://localhost:3001/api/health
   - http://localhost/api/health
   - http://localhost
5. If backend dev startup fails with EADDRINUSE on 3001, stop the old process or change `PORT` in `backend/.env`.

## Development Workflow

1. Make changes to code (both frontend and backend auto-reload)
2. Frontend hot-reloads automatically
3. Backend needs manual reload if TypeScript changes

## Building for Production

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
```

## Local IIS + Windows Service Deployment

This deployment mode serves the frontend from IIS and proxies `/api/*` to a backend Node process running as a Windows service.

### Prerequisite bootstrap
Run PowerShell as Administrator from the repo root:

```powershell
./scripts/setup-local-iis-prereqs.ps1 -EnableIISFeatures
```

Use `-CheckOnly` to validate without changing Windows features.

### One-command bootstrap
Run PowerShell as Administrator from the repo root:

```powershell
./scripts/deploy-local-iis.ps1 -SiteName "RPG Collection Navigator" -HostHeader "localhost" -Port 80
```

Optional switches:
- `-SkipBuild` skips dependency install and build steps
- `-SkipVerification` skips post-deploy health checks
- `-EnableIISFeatures` enables required IIS Windows features before deployment
- `-ReconcileBindings` removes stale IIS HTTP bindings and keeps only the requested host/port binding
- `-UseNpmInstall` forces `npm install` instead of default `npm ci` behavior
- `-ForceCloseNodeProcesses` force-stops running Node processes tied to the repo/frontend/backend paths before install/build

### 1. Install prerequisites
- IIS with Static Content role service
- IIS URL Rewrite module
- Application Request Routing (ARR)
- NSSM (Non-Sucking Service Manager)

### 2. Build application artifacts
```bash
cd backend
npm ci
npm run build

cd ..\frontend
npm ci
npm run build
```

Notes:
- The deploy scripts default to `npm ci` when `package-lock.json` is present.
- If a lockfile is missing or you need legacy behavior, use `-UseNpmInstall`.

### 3. Install backend Windows service
Run PowerShell as Administrator:

```powershell
./scripts/install-backend-service.ps1
```

Optional parameters:

```powershell
./scripts/install-backend-service.ps1 -ServiceName "RPG-Backend" -NssmPath "C:\tools\nssm\nssm.exe"
```

Force `npm install` instead of default `npm ci`:

```powershell
./scripts/install-backend-service.ps1 -UseNpmInstall
```

### 4. Configure IIS site for frontend
Run PowerShell as Administrator:

```powershell
./scripts/configure-iis-site.ps1 -SiteName "RPG Collection Navigator" -Port 80 -HostHeader "rpg.local"
```

Remove stale HTTP bindings and keep only the requested host/port:

```powershell
./scripts/configure-iis-site.ps1 -SiteName "RPG Collection Navigator" -Port 80 -HostHeader "rpg.local" -ReconcileBindings
```

The frontend build includes `web.config` with two IIS rewrite rules:
- `/api/*` is proxied to `http://localhost:3001/api/*`
- all other unknown routes are rewritten to `index.html` for SPA routing

### 5. Verify deployment
1. Check backend service status:
   ```powershell
   Get-Service -Name "RPG-Backend"
   ```
2. Verify backend health endpoint directly:
   - http://localhost:3001/api/health
3. Verify IIS-proxied health endpoint:
   - http://rpg.local/api/health
4. Open frontend:
   - http://rpg.local

### Common deploy variants
Force clean binding reconciliation and keep default `npm ci` behavior:

```powershell
./scripts/deploy-local-iis.ps1 -SiteName "RPG Collection Navigator" -HostHeader "localhost" -Port 80 -ReconcileBindings
```

Force legacy dependency install behavior:

```powershell
./scripts/deploy-local-iis.ps1 -SiteName "RPG Collection Navigator" -HostHeader "localhost" -Port 80 -UseNpmInstall
```

Force-close blocking Node processes (helpful for EPERM node_modules file locks):

```powershell
./scripts/deploy-local-iis.ps1 -SiteName "RPG Collection Navigator" -HostHeader "localhost" -Port 80 -ReconcileBindings -UseNpmInstall -ForceCloseNodeProcesses
```

### 6. Remove backend service (if needed)
```powershell
./scripts/remove-backend-service.ps1
```

## Key Features
- ✅ Dynamic table listing
- ✅ CRUD operations for all tables
- ✅ Pagination (50 records per page)
- ✅ Auto-generated forms
- ✅ Responsive modern UI
