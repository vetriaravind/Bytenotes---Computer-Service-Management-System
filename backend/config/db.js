/**
 * MySQL Database Connection Pool Configuration
 * Utilizes mysql2/promise for async/await queries and connection pooling.
 */

const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// Explicitly load backend/.env using absolute path
dotenv.config({ path: path.join(__dirname, '../.env') });

// Create connection pool with resilient configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bytenotes_db',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true,
  ssl: { rejectUnauthorized: false }
});

/**
 * Test initial connectivity to MySQL server
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ [MySQL Pool] Connected successfully to database: "${process.env.DB_NAME || 'bytenotes_db'}" on host: "${process.env.DB_HOST || 'localhost'}"`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ [MySQL Pool] Database Connection Failed:');
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(`   -> Access denied for user: "${process.env.DB_USER || 'root'}" on host: "${process.env.DB_HOST || 'localhost'}"`);
      console.error(`   -> Password provided: ${process.env.DB_PASSWORD ? 'YES (Length: ' + process.env.DB_PASSWORD.length + ' chars)' : 'NO (Empty)'}`);
      console.error(`   -> MySQL Message: ${error.message}`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   -> Connection refused. Is your MySQL server running on port 3306?');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   -> Database not found. Run "npm run db:init" to create "bytenotes_db" automatically.');
    } else {
      console.error(`   -> Error Code: ${error.code} | Message: ${error.message}`);
    }
    return false;
  }
};

/**
 * Helper to execute parameterized SQL query with automatic connection management
 * @param {string} sql - SQL string with '?' placeholders
 * @param {Array} params - Values to safely inject into query
 */
const query = async (sql, params = []) => {
  try {
    const [rows, fields] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  pool,
  query,
  testConnection
};
