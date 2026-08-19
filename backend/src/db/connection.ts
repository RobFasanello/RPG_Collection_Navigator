import sql from 'mssql';

const config: sql.config = {
  server: 'FASARIG2',
  database: 'TabletopInventory',
  port: 1433,
  user: 'rpg_app',
  password: 'Rpgapp123',  // hardcode temporarily
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
  },
};

let connectionPool: sql.ConnectionPool | null = null;

export async function initializePool(): Promise<sql.ConnectionPool> {
  try {
    if (!connectionPool) {
      console.log('Attempting to connect to:', {
        server: config.server,
        database: config.database,
        port: 1433,
        authentication: config.authentication?.type,
      });
      
      connectionPool = new sql.ConnectionPool(config);
      await connectionPool.connect();
      console.log('✅ Database connection pool initialized successfully');
    }
    return connectionPool;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    connectionPool = null; // Reset pool so next request will retry
    throw error;
  }
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!connectionPool) {
    return initializePool();
  }
  
  // If pool exists but is closed, try to reconnect
  if (connectionPool.connected === false) {
    connectionPool = null;
    return initializePool();
  }
  
  return connectionPool;
}

export async function closePool(): Promise<void> {
  if (connectionPool) {
    await connectionPool.close();
    connectionPool = null;
    console.log('Database connection pool closed');
  }
}

// Rolling back an already-aborted transaction (e.g. after a query error
// that SQL Server itself aborted the transaction for) throws its own error.
// Callers should always rollback through this helper instead of calling
// transaction.rollback() directly, so a rollback failure can't crash the process.
export async function safeRollback(transaction: sql.Transaction): Promise<void> {
  try {
    await transaction.rollback();
  } catch (rollbackError) {
    console.error('Error rolling back transaction (transaction may already be aborted):', rollbackError);
  }
}

export { sql };
