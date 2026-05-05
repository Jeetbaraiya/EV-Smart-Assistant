const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ev_assistant',
  port: process.env.DB_PORT || 3306
});

const fs = require('fs');

connection.query(
  'SELECT NOW() as cur_now, UTC_TIMESTAMP() as cur_utc, @@session.time_zone as tz, @@system_time_zone as stz',
  (err, rows) => {
    let output = '';
    if (err) {
      output = 'Error: ' + err.message;
    } else {
      output = 'Database Time Diagnostics:\n' + JSON.stringify(rows[0], null, 2);
    }
    
    // Check one booking
    connection.query('SELECT id, start_time, end_time, status FROM bookings ORDER BY id DESC LIMIT 1', (err2, rows2) => {
      if (!err2 && rows2[0]) {
        output += '\n\nLatest Booking:\n' + JSON.stringify(rows2[0], null, 2);
      }
      fs.writeFileSync('debug_output.txt', output);
      connection.end();
      process.exit(0);
    });
  }
);
