// test-connection.ts
import sql from 'mssql';

const config: sql.config = {
  server: 'FASARIG2',
  database: 'TabletopInventory',
  port: 1433,
  user: 'rpg_app',
  password: 'YourStrongPassword123!',  // hardcode the exact password here temporarily
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

sql.connect(config).then(() => {
  console.log('✅ Connected!');
}).catch(err => {
  console.error('❌ Failed:', err.message);
});