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
Change ports in configuration:
- Backend: Edit `backend/src/server.ts` - change PORT variable
- Frontend: Run `npm run dev -- --port 5174`

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
npm run preview
```

## Key Features
- ✅ Dynamic table listing
- ✅ CRUD operations for all tables
- ✅ Pagination (50 records per page)
- ✅ Auto-generated forms
- ✅ Responsive modern UI
