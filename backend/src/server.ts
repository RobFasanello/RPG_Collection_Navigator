import dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import { initializePool, closePool } from './db/connection.js';
import { BACKEND_BUILD_TIME_ISO } from './generated/buildInfo.js';

import cors from 'cors';
import tablesRouter from './routes/tables.js';

const app: Express = express();
const PORT = process.env.PORT || 3001;

const rawCorsOrigins = process.env.CORS_ORIGINS?.trim() ?? '';
const corsOrigins = rawCorsOrigins
  ? rawCorsOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  : [];

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

const corsOptions: cors.CorsOptions = {
  origin(origin: string | undefined, callback: CorsOriginCallback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (corsOrigins.length === 0) {
      callback(null, true);
      return;
    }

    if (corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS policy'));
  },
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/tables', tablesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/build-info', (req, res) => {
  res.json({
    backendBuildTimeIso: BACKEND_BUILD_TIME_ISO,
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Don't fail on startup if DB is unavailable
    // Database will be initialized on first request
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log('Database will connect on first request...');
    });
    
    // Try to initialize pool in background
    initializePool().catch(err => {
      console.warn('Database not available yet, will retry on requests:', err.message);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connection...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connection...');
  await closePool();
  process.exit(0);
});

startServer();
