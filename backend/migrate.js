/**
 * migrate.js — Run pending database migrations.
 *
 * Usage:  node migrate.js
 *
 * This script is safe to run multiple times — all ALTER statements
 * are guarded with IF NOT EXISTS checks via INFORMATION_SCHEMA.
 */

require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host    : process.env.DB_HOST || '127.0.0.1',
  port    : Number(process.env.DB_PORT || 3306),
  user    : process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ev_assistant',
  multipleStatements: true,
});

const dbName = process.env.DB_NAME || 'ev_assistant';

const migrations = `
  -- Create connectors table if absent
  CREATE TABLE IF NOT EXISTS connectors (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    station_id    INT         NOT NULL,
    type          VARCHAR(50) NOT NULL,
    power         FLOAT       NOT NULL,
    price_per_kwh FLOAT       NOT NULL,
    status        VARCHAR(50) DEFAULT 'available',
    created_at    DATETIME    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES charging_stations(id) ON DELETE CASCADE
  );

  -- Modify station_id to VARCHAR(255) to support external/india-network stations
  SET @col_type = (
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '${dbName}'
      AND TABLE_NAME   = 'bookings'
      AND COLUMN_NAME  = 'station_id'
  );
  
  -- 1. Drop foreign key if it exists (to allow type change)
  SET @fk_name = (
    SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = '${dbName}'
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'station_id'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
  );
  SET @drop_fk = IF(@fk_name IS NOT NULL,
    CONCAT('ALTER TABLE bookings DROP FOREIGN KEY ', @fk_name),
    'SELECT 1 /* No FK on station_id */'
  );
  PREPARE drop_fk_stmt FROM @drop_fk;
  EXECUTE drop_fk_stmt;
  DEALLOCATE PREPARE drop_fk_stmt;

  -- 2. Change column type
  SET @alter_stmt = IF(@col_type LIKE 'int%',
    'ALTER TABLE bookings MODIFY COLUMN station_id VARCHAR(255) NOT NULL',
    'SELECT 1 /* station_id is already VARCHAR or non-int */'
  );
  PREPARE alter_stmt FROM @alter_stmt;
  EXECUTE alter_stmt;
  DEALLOCATE PREPARE alter_stmt;

  -- Add connector_id column to bookings if it doesn't exist yet
  SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '${dbName}'
      AND TABLE_NAME   = 'bookings'
      AND COLUMN_NAME  = 'connector_id'
  );
  SET @stmt = IF(@col_exists = 0,
    'ALTER TABLE bookings ADD COLUMN connector_id INT AFTER user_id',
    'SELECT 1 /* connector_id already exists */'
  );
  PREPARE migration_stmt FROM @stmt;
  EXECUTE migration_stmt;
  DEALLOCATE PREPARE migration_stmt;

`;

connection.connect((err) => {
  if (err) {
    console.error('[migrate] Cannot connect to MySQL:', err.message);
    process.exit(1);
  }
  console.log('[migrate] Connected. Running migrations…');

  connection.query(migrations, (err) => {
    if (err) {
      console.error('[migrate] Migration failed:', err.message);
      connection.end();
      process.exit(1);
    }
    console.log('[migrate] All migrations applied successfully.');
    connection.end();
  });
});
