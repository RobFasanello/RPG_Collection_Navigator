# RPG Collection Manager - React CRUD Application

A modern, full-stack web application for managing tabletop RPG collection data stored in MSSQL database. Provides a user-friendly interface to Create, Read, Update, and Delete records across all tables with pagination support.

## Features

- 🎯 **Table Browser** - Browse all tables in your MSSQL database
- 📝 **CRUD Operations** - Create, read, update, and delete records for any table
- 📄 **Pagination** - Efficient handling of thousands of records
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS
- ⚡ **Fast Data Loading** - React Query for optimized caching and fetching
- 📱 **Responsive Design** - Works on desktop and tablet

## Project Structure

```
RPG Collection Navigator/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── server.ts          # Main server entry point
│   │   ├── db/
│   │   │   └── connection.ts  # MSSQL connection pool
│   │   ├── controllers/
│   │   │   └── tableController.ts  # CRUD business logic
│   │   └── routes/
│   │       └── tables.ts       # API route definitions
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                   # React Vite application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # Base UI components
│   │   │   ├── TableBrowser.tsx
│   │   │   ├── TableManager.tsx
│   │   │   └── RecordForm.tsx
│   │   ├── services/
│   │   │   └── api.ts         # API client
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
└── README.md
```

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: MSSQL (mssql driver)
- **Language**: TypeScript
- **Port**: 3001

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Fetching**: React Query
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Port**: 5173

## Prerequisites

- Node.js 18+ and npm
- MSSQL Server with your database (tabletop_inventory)
- Database connection accessible (server: FASARIG2)

## Setup Instructions

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env with your database credentials
# DB_SERVER=FASARIG2
# DB_DATABASE=tabletop_inventory
# DB_USER=your_username
# DB_PASSWORD=your_password
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

## Running the Application

### Development Mode

**Terminal 1 - Start Backend**
```bash
cd backend
npm run dev
```
Backend will run on: http://localhost:3001

**Terminal 2 - Start Frontend**
```bash
cd frontend
npm run dev
```
Frontend will run on: http://localhost:5173

### Production Build

**Backend**
```bash
cd backend
npm run build
npm start
```

**Frontend**
```bash
cd frontend
npm run build
npm run preview
```

## API Endpoints

All endpoints are prefixed with `/api/tables`

### Get all tables
```
GET /
Response: [{ TABLE_NAME: "string" }, ...]
```

### Get table schema
```
GET /:tableName/schema
Response: [{ COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ... }, ...]
```

### Get table data with pagination
```
GET /:tableName/data?page=1&pageSize=50
Response: {
  data: [...],
  total: number,
  page: number,
  pageSize: number,
  totalPages: number
}
```

### Create record
```
POST /:tableName
Body: { column1: value1, column2: value2, ... }
Response: { success: true, message: "Record created" }
```

### Update record
```
PATCH /:tableName/:id
Body: { column1: value1, column2: value2, ... }
Response: { success: true, message: "Record updated" }
```

### Delete record
```
DELETE /:tableName/:id
Response: { success: true, message: "Record deleted" }
```

## Database Connection

The application connects to your MSSQL database using Windows Authentication (default) or SQL Authentication. Update the `.env` file in the backend directory with your connection details:

- **Server**: FASARIG2
- **Database**: tabletop_inventory
- **User**: (optional - Windows Auth if empty)
- **Password**: (optional - Windows Auth if empty)

## Features in Detail

### Table Browser
- Displays all tables in your database
- Grid layout with table names
- Click any table to open the manager

### Table Manager
- View paginated records from any table
- Auto-generated forms based on table schema
- Inline actions for editing and deleting records

### Record Form
- Dynamically generated based on table columns
- Validation for required fields
- Support for various data types (int, text, datetime, etc.)
- Modal dialog for clean UX

### Pagination
- Configurable page size (default 50, max 100)
- Previous/Next navigation
- Display of record count and current page

## Troubleshooting

### Backend Connection Issues
1. Verify MSSQL server is running
2. Check .env database credentials
3. Ensure database exists on FASARIG2
4. Check firewall rules for port access

### Frontend Not Loading Data
1. Verify backend is running on port 3001
2. Check browser console for API errors
3. Ensure CORS is enabled (should be in Express config)

### Form Validation Issues
1. Required fields are marked in the schema
2. Data types are enforced (number inputs for integers)
3. Identity/computed columns are skipped

## Future Enhancements

- [ ] Advanced filtering and search
- [ ] Bulk operations (bulk import/export)
- [ ] Field-level permissions
- [ ] Query builder UI
- [ ] Data export (CSV, Excel)
- [ ] Audit logging
- [ ] Real-time updates with WebSockets

## License

MIT
