// MySQL connection pool (promise-based) shared by all routes.
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'food_delivery',
  waitForConnections: true,
  connectionLimit: 10,
  // Optional local socket support (used for validation/dev on Linux).
  socketPath: process.env.DB_SOCKET || undefined,
});

module.exports = pool;
