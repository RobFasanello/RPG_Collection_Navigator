# Architecture & Design Documentation

## Overview
The RPG Collection Manager is a full-stack CRUD application built with modern web technologies. It provides a Manager interface to view, create, update, and delete records across all tables in your MSSQL database.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                         │
│  (React 18 + Vite + TypeScript)                             │
│  • TableBrowser - Table listing                             │
│  • TableManager - Record CRUD interface                     │
│  • RecordForm - Dynamic form generation                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                   HTTP/REST APIs
                    (Axios client)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    EXPRESS BACKEND                          │
│  (Node.js + TypeScript)                                     │
│  • Route: /api/tables - Table operations                    │
│  • Dynamic SQL query building                               │
│  • CORS enabled                                             │
│  • Connection pooling                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                   MSSQL Driver
                    (mssql package)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   MSSQL DATABASE                            │
│  (FASARIG2 - Your Local Server)                             │
│  • Multiple tables                                          │
│  • Relational data                                          │
└─────────────────────────────────────────────────────────────┘
```

## Technology Choices

### Frontend Stack
| Technology | Purpose | Why Chosen |
|-----------|---------|-----------|
| **React 18** | UI Framework | Modern, component-based, large ecosystem |
| **TypeScript** | Language | Type safety, better IDE support |
| **Vite** | Build Tool | Lightning-fast dev server, optimized builds |
| **Tailwind CSS** | Styling | Utility-first, responsive, modern look |
| **React Query** | Data Fetching | Caching, pagination, automatic refetch |
| **Axios** | HTTP Client | Promise-based, request/response interceptors |
| **Lucide React** | Icons | Minimal, consistent icon set |

### Backend Stack
| Technology | Purpose | Why Chosen |
|-----------|---------|-----------|
| **Node.js** | Runtime | JavaScript/TypeScript, non-blocking I/O |
| **Express** | Web Framework | Lightweight, fast, excellent middleware |
| **TypeScript** | Language | Type safety for API consistency |
| **mssql** | DB Driver | Native MSSQL support, connection pooling |
| **CORS** | Middleware | Enable frontend-backend communication |
| **dotenv** | Config | Environment variable management |

## Data Flow

### Reading Data
1. **Frontend**: User clicks on a table in TableBrowser
2. **React Component**: TableManager mounts
3. **API Call**: `GET /api/tables/{tableName}/schema` + `GET /api/tables/{tableName}/data`
4. **Backend**: Queries INFORMATION_SCHEMA for column info and table data
5. **Database**: Returns schema and paginated records
6. **React Query**: Caches results and manages loading/error states
7. **UI**: Renders table with data and pagination controls

### Creating Record
1. **User**: Clicks "New Record" button
2. **Modal Form**: Dynamic form based on table schema
3. **User Input**: Fills form fields
4. **Submit**: `POST /api/tables/{tableName}` with form data
5. **Backend**: Builds INSERT query, executes
6. **Database**: Inserts record
7. **React**: Refetches table data
8. **UI**: Updates table display

### Updating Record
1. **User**: Clicks edit icon on a row
2. **Modal Form**: Pre-populates with current values
3. **User Input**: Modifies fields
4. **Submit**: `PATCH /api/tables/{tableName}/{id}` with updated data
5. **Backend**: Builds UPDATE query with WHERE id = @id
6. **Database**: Updates record
7. **React**: Refetches data
8. **UI**: Reflects changes

### Deleting Record
1. **User**: Clicks delete icon
2. **Confirmation**: Prompt user for confirmation
3. **Request**: `DELETE /api/tables/{tableName}/{id}`
4. **Backend**: Builds DELETE query
5. **Database**: Deletes record
6. **React**: Refetches data
7. **UI**: Removes record from display

## Key Design Decisions

### 1. Dynamic CRUD Operations
- Backend accepts any table name and generates SQL dynamically
- Eliminates need for table-specific endpoints
- Schema is queried from INFORMATION_SCHEMA on each read
- **Benefit**: Scales to any number of tables without code changes

### 2. Connection Pooling
- Express maintains a connection pool to MSSQL
- Reuses connections across requests
- Better performance than creating new connections per request
- **Benefit**: Handles concurrent requests efficiently

### 3. React Query for State Management
- Handles caching of table data
- Automatic background refetch
- Built-in loading/error states
- **Benefit**: Simpler than Redux, perfect for data-fetching scenarios

### 4. TypeScript Throughout
- Compile-time error checking
- Better IDE autocomplete
- Self-documenting code through types
- **Benefit**: Fewer runtime errors, easier maintenance

### 5. Tailwind CSS + shadcn UI Components
- Utility-first CSS for rapid development
- Pre-built component patterns
- Responsive design built-in
- **Benefit**: Professional look with minimal custom CSS

### 6. Pagination
- Default 50 records per page (configurable)
- Max 100 records to prevent performance issues
- Server-side pagination using SQL OFFSET/FETCH
- **Benefit**: Handles thousands of records efficiently

## Security Considerations

### Current Implementation
- ✅ No authentication/authorization (per requirements)
- ✅ CORS limited to localhost in development
- ✅ SQL parameters are used (prevents SQL injection)
- ✅ Error messages don't leak sensitive DB info

### Future Enhancements
- 🔄 Add user authentication/authorization
- 🔄 Implement role-based access control
- 🔄 Add audit logging
- 🔄 Encrypt sensitive database credentials
- 🔄 Rate limiting on API endpoints

## Performance Optimizations

### Current
- Connection pooling on backend
- React Query caching
- Pagination on large datasets
- Tailwind CSS purging in production

### Potential
- Database indexes on frequently queried columns
- GraphQL instead of REST (better with large datasets)
- Redis caching layer
- Query result compression
- Frontend code splitting in Vite

## File Structure Explanation

### Backend
```
backend/src/
├── server.ts              # Main entry point, Express app setup
├── db/
│   └── connection.ts      # Database connection pool management
├── routes/
│   └── tables.ts          # Route definitions for /api/tables/*
└── controllers/
    └── tableController.ts # Business logic for CRUD operations
```

### Frontend
```
frontend/src/
├── components/
│   ├── TableBrowser.tsx      # Lists all tables
│   ├── TableManager.tsx      # Manages records for one table
│   ├── RecordForm.tsx        # Form for create/edit
│   └── ui/                   # Reusable UI components
├── services/
│   └── api.ts               # API client methods
├── App.tsx                  # Root component with React Query provider
└── main.tsx                 # Vite entry point
```

## Error Handling

### Frontend
- React Query handles API errors
- Error messages displayed in toast/alert
- Form validation before submission
- User-friendly error messages

### Backend
- Try-catch blocks on all routes
- Detailed console logging for debugging
- Generic error messages to client
- HTTP status codes (201, 400, 500)

## Testing Recommendations

1. **Unit Tests**: Jest for component and utility testing
2. **Integration Tests**: Supertest for API routes
3. **E2E Tests**: Cypress/Playwright for full workflows
4. **Database Tests**: Test with actual MSSQL instance

## Deployment Considerations

### Backend
- Use production-grade process manager (PM2)
- Set environment variables securely
- Enable HTTPS in production
- Monitor connection pool status

### Frontend
- Build optimization (tree-shaking, minification)
- Set appropriate cache headers
- Consider CDN for static assets
- Environment-specific API base URLs

### Database
- Regular backups
- Query performance monitoring
- Connection limits per application
- Separate read replicas if needed

## Monitoring & Maintenance

### Logging
- Backend logs all API requests/errors
- Frontend logs to browser console (dev only)
- Consider ELK stack for production

### Health Checks
- Implement `/health` endpoint
- Monitor database connectivity
- Track API response times

### Scaling
- Horizontal scaling for backend (load balancer)
- Vertical scaling for database
- Cache layer for frequently accessed data
