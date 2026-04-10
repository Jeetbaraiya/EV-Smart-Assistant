/**
 * reset_admin.js — Utility: Create or reset the default admin account.
 *
 * Usage:  node reset_admin.js
 *
 * Creates the admin user if it doesn't exist, or resets its password
 * to Admin@123 if it does.
 */

require('dotenv').config();
const dbConfig = require('./config/database');
const bcrypt   = require('bcryptjs');

const ADMIN_EMAIL    = 'admin@evassistant.com';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Admin@123'; // Change after first login!

async function resetAdmin() {
  try {
    await dbConfig.init();
    const db = dbConfig.getDb();
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    db.get('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL], (err, row) => {
      if (err) {
        console.error('[reset_admin] DB error:', err.message);
        process.exit(1);
      }

      if (row) {
        db.run('UPDATE users SET password = ? WHERE email = ?', [hash, ADMIN_EMAIL], (err) => {
          if (err) { console.error('[reset_admin] Update failed:', err.message); process.exit(1); }
          console.log(`[reset_admin] Admin password reset → ${ADMIN_PASSWORD}`);
          process.exit(0);
        });
      } else {
        db.run(
          `INSERT INTO users (username, email, password, role, is_verified)
           VALUES (?, ?, ?, 'admin', 1)`,
          [ADMIN_USERNAME, ADMIN_EMAIL, hash],
          (err) => {
            if (err) { console.error('[reset_admin] Insert failed:', err.message); process.exit(1); }
            console.log(`[reset_admin] Admin created (${ADMIN_EMAIL} / ${ADMIN_PASSWORD})`);
            process.exit(0);
          }
        );
      }
    });
  } catch (err) {
    console.error('[reset_admin] Init failed:', err.message);
    process.exit(1);
  }
}

resetAdmin();
