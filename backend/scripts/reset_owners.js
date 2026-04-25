/**
 * Batch update all users with the 'owner' role to a unified password.
 * Password: Owner@123
 */
const mysql = require('mysql2/promise');
require('dotenv').config();
const bcrypt = require('bcryptjs');

async function resetOwnerPasswords() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || '3306');
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'ev_assistant';

  console.log(`[reset] Connecting to ${database} on ${host}...`);

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database
  });

  try {
    const newPassword = 'Owner@123';
    const hash = bcrypt.hashSync(newPassword, 10);

    console.log(`[reset] Updating all owners to password: ${newPassword}`);
    
    const [result] = await connection.execute(
      "UPDATE users SET password = ? WHERE role = 'owner'",
      [hash]
    );

    console.log(`[reset] Success! ${result.affectedRows} owner accounts updated.`);
  } catch (err) {
    console.error('[reset] Error:', err.message);
  } finally {
    await connection.end();
  }
}

resetOwnerPasswords();
