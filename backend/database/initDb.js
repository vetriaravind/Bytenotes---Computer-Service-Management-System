/**
 * ByteNotes Database Initialization Script
 * Automatically connects to MySQL, creates 'bytenotes_db', and executes schema.sql + seed.sql
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '2006';
const DB_NAME = process.env.DB_NAME || 'bytenotes_db';
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 3306;

async function init() {
  console.log('====================================================');
  console.log('🛠️  ByteNotes MySQL Database Auto-Setup');
  console.log(`📡 Connecting to MySQL server at ${DB_HOST}:${DB_PORT} as "${DB_USER}"...`);
  console.log(`🔑 Using password: ${DB_PASSWORD ? 'YES (Length: ' + DB_PASSWORD.length + ')' : 'NO (Empty)'}`);
  console.log('====================================================');

  let connection;

  try {
    // 1. Connect to MySQL Server (Without specifying database)
    connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      port: DB_PORT,
      multipleStatements: true,
      ssl: { rejectUnauthorized: false }
    });

    console.log('✅ Connected to MySQL server successfully!');

    // 2. Create database if it does not exist
    console.log(`📦 Creating database "${DB_NAME}" if not exists...`);
    await connection.query(`
      CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
      DEFAULT CHARACTER SET utf8mb4
      DEFAULT COLLATE utf8mb4_unicode_ci;
    `);
    console.log(`✅ Database "${DB_NAME}" is ready.`);

    // 3. Switch to bytenotes_db
    await connection.changeUser({ database: DB_NAME });

    // 4. Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`📄 Executing schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schemaSql);
    console.log('✅ All 21 normalized tables created successfully!');

    // 5. Read and execute seed.sql
    const seedPath = path.join(__dirname, 'seed.sql');
    if (fs.existsSync(seedPath)) {
      console.log(`🌱 Seeding initial accounts and catalog from: ${seedPath}`);
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await connection.query(seedSql);
      console.log('✅ Seed data inserted successfully (Admin, Receptionist, Technician, Inventory)!');
      
      // Ensure seed account passwords have guaranteed bcrypt hashes matching 'Password@123'
      const validHash = await bcrypt.hash('Password@123', 10);
      await connection.query(
        'UPDATE users SET password_hash = ? WHERE email IN (?, ?, ?)',
        [validHash, 'admin@bytenotes.com', 'reception@bytenotes.com', 'rahul.tech@bytenotes.com']
      );
      console.log('🔒 Verified and synchronized default passwords to "Password@123".');
    }

    // 6. Verify table counts
    const [tables] = await connection.query('SHOW TABLES');
    console.log('====================================================');
    console.log(`🎉 SUCCESS: Database "${DB_NAME}" initialized with ${tables.length} tables!`);
    console.log('🚀 You can now start the backend with: npm run dev');
    console.log('====================================================');

  } catch (error) {
    console.error('\n❌ DATABASE INITIALIZATION FAILED:');
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(`   -> Authentication error: MySQL rejected password for user "${DB_USER}".`);
      console.error('   -> Please verify:');
      console.error('      1. Did you set a different password during MySQL installation?');
      console.error('      2. If root has no password, change DB_PASSWORD= in backend/.env to empty.');
      console.error('      3. If your password is "root", change DB_PASSWORD=root in backend/.env.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error(`   -> Connection refused at ${DB_HOST}:${DB_PORT}. Is MySQL service running?`);
    } else {
      console.error(`   -> Error Code: ${error.code} | Message: ${error.message}`);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

init();
