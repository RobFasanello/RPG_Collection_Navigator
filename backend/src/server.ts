import dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import { initializePool, closePool } from './db/connection.js';

import cors from 'cors';
import tablesRouter from './routes/tables.js';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tables', tablesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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

startServer();
