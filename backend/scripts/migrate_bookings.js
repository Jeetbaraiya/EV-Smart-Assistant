/**
 * Migration: add connector_id, connector_type_label, end_time to bookings table.
 * Run once: node backend/scripts/migrate_bookings.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2');

const host = (process.env.DB_HOST || '127.0.0.1').toLowerCase() === 'localhost'
  ? '127.0.0.1'
  : (process.env.DB_HOST || '127.0.0.1');

const pool = mysql.createPool({
  host,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'ev_assistant',
  port:     process.env.DB_PORT     ? Number(process.env.DB_PORT) : 3306,
  multipleStatements: true,
});

const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    pool.query(sql, params, (err, res) => (err ? reject(err) : resolve(res)))
  );

const columnExists = async (table, column) => {
  const rows = await run(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
};

(async () => {
  console.log('🔧 Running bookings table migration...\n');

  // 1. connector_id (FK to connectors, nullable for virtual bookings)
  if (!(await columnExists('bookings', 'connector_id'))) {
    await run(`ALTER TABLE bookings ADD COLUMN connector_id INT NULL DEFAULT NULL`);
    console.log('  ✅ Added column: bookings.connector_id');
  } else {
    console.log('  ✔  Column already exists: bookings.connector_id');
  }

  // 2. connector_type_label (stores type string for virtual connectors)
  if (!(await columnExists('bookings', 'connector_type_label'))) {
    await run(`ALTER TABLE bookings ADD COLUMN connector_type_label VARCHAR(100) NULL DEFAULT NULL`);
    console.log('  ✅ Added column: bookings.connector_type_label');
  } else {
    console.log('  ✔  Column already exists: bookings.connector_type_label');
  }

  // 3. end_time (was missing from original schema but used in overlap checks)
  if (!(await columnExists('bookings', 'end_time'))) {
    await run(`ALTER TABLE bookings ADD COLUMN end_time DATETIME NULL DEFAULT NULL`);
    console.log('  ✅ Added column: bookings.end_time');
  } else {
    console.log('  ✔  Column already exists: bookings.end_time');
  }

  // 4. status default fix: change default from 'completed' to 'confirmed'
  //    (only alters the default; existing rows are untouched)
  await run(
    `ALTER TABLE bookings MODIFY COLUMN status VARCHAR(50) DEFAULT 'confirmed'`
  );
  console.log('  ✅ Fixed default status: confirmed');

  console.log('\n✅ Migration complete.');
  pool.end();
})().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  pool.end();
  process.exit(1);
});
