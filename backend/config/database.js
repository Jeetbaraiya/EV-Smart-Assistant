/**
 * database.js — MySQL Connection Pool & Query Helper
 *
 * This module initialises a mysql2 connection pool and exposes a thin
 * helper object (`db`) whose API is used throughout the route files:
 *
 *   db.get(sql, params, callback)   → returns the first matching row
 *   db.all(sql, params, callback)   → returns all matching rows
 *   db.run(sql, params, callback)   → executes a mutating query;
 *                                     `this.lastID` and `this.changes`
 *                                     are available in the callback
 *
 * Set DB_BOOTSTRAP=true in .env to auto-create tables on first run.
 * Set DB_SEED_ADMIN=true in .env to insert a default admin account.
 */

require('dotenv').config();
const mysql  = require('mysql2');
const bcrypt = require('bcryptjs');

/* ── Internal helpers ──────────────────────────────────────────────── */

const toStr = (v, fallback = '') => {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s.length ? s : fallback;
};

const toBool = (v) => {
  if (v === undefined || v === null) return false;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(v).trim().toLowerCase());
};

/* ── Query Helper ──────────────────────────────────────────────────── */

/**
 * MySQLHelper wraps a mysql2 pool and exposes a simple callback-based
 * API so that route files remain easy to read and test.
 */
class MySQLHelper {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Fetch a single row.  Calls `callback(err, row)` where `row` is the
   * first result or `undefined` when nothing is found.
   */
  get(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    this.pool.query(sql, params, (err, results) => {
      if (err) return callback ? callback(err) : undefined;
      callback && callback(null, results && results.length > 0 ? results[0] : undefined);
    });
  }

  /**
   * Fetch all matching rows.  Calls `callback(err, rows[])`.
   */
  all(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    this.pool.query(sql, params, (err, results) => {
      if (err) return callback ? callback(err) : undefined;
      callback && callback(null, results || []);
    });
  }

  /**
   * Execute an INSERT / UPDATE / DELETE.
   * Inside the callback `this.lastID` holds `insertId` and
   * `this.changes` holds `affectedRows`.
   */
  run(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    this.pool.query(sql, params, (err, results) => {
      if (err) return callback ? callback(err) : undefined;
      const ctx = {
        lastID : results ? results.insertId    : null,
        changes: results ? results.affectedRows : 0,
      };
      callback && callback.call(ctx, null);
    });
  }

  /** No-op shim kept for compatibility — MySQL handles ordering. */
  serialize(fn) { fn(); }
}

/* ── Module state ──────────────────────────────────────────────────── */

let pool = null;
let db   = null;

/* ── Public API ────────────────────────────────────────────────────── */

/**
 * Initialise the MySQL pool, verify connectivity, and optionally run
 * schema creation and admin seeding based on .env flags.
 *
 * @returns {Promise<void>}
 */
const init = () => new Promise((resolve, reject) => {
  const hostRaw = toStr(process.env.DB_HOST, '127.0.0.1');
  const host    = hostRaw.toLowerCase() === 'localhost' ? '127.0.0.1' : hostRaw;

  const poolOptions = {
    host,
    port              : process.env.DB_PORT ? Number(String(process.env.DB_PORT).trim()) : 3306,
    user              : toStr(process.env.DB_USER,     'root'),
    password          : toStr(process.env.DB_PASSWORD, ''),
    database          : toStr(process.env.DB_NAME,     'ev_assistant'),
    waitForConnections : true,
    connectionLimit   : Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit        : 0,
    multipleStatements: true,
    connectTimeout    : Number(process.env.DB_CONNECT_TIMEOUT  || 10000),
    enableKeepAlive   : true,
    keepAliveInitialDelay: 0,
    timezone          : 'Z',
  };

  console.log('[db] Connecting to MySQL:', {
    host    : poolOptions.host,
    port    : poolOptions.port,
    user    : poolOptions.user,
    database: poolOptions.database,
  });

  pool = mysql.createPool(poolOptions);
  db   = new MySQLHelper(pool);

  // Verify basic connectivity
  pool.query('SELECT 1 AS ok', (err) => {
    if (err) {
      console.error('[db] Connection failed:', err.message);
      return reject(err);
    }
    console.log('[db] Connected successfully.');

    if (!toBool(process.env.DB_BOOTSTRAP)) return resolve();
    createTables().then(resolve).catch(reject);
  });
});

/** Return the initialised helper.  Throws if `init()` has not been called. */
const getDb = () => {
  if (!db) throw new Error('[db] Database not initialised — call init() first.');
  return db;
};

/* ── Schema creation ───────────────────────────────────────────────── */

const createTables = () => new Promise((resolve, reject) => {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      username    VARCHAR(255) UNIQUE NOT NULL,
      email       VARCHAR(255) UNIQUE NOT NULL,
      password    VARCHAR(255) NOT NULL,
      role        VARCHAR(50)  NOT NULL DEFAULT 'user',
      is_verified TINYINT(1)   DEFAULT 0,
      created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS charging_stations (
      id                    INT AUTO_INCREMENT PRIMARY KEY,
      name                  VARCHAR(255) NOT NULL,
      address               VARCHAR(255) NOT NULL,
      city                  VARCHAR(100) NOT NULL,
      state                 VARCHAR(100) NOT NULL,
      zip_code              VARCHAR(20),
      latitude              FLOAT,
      longitude             FLOAT,
      connector_type        VARCHAR(100) NOT NULL,
      power_kw              FLOAT,
      availability          VARCHAR(50) DEFAULT 'available',
      status                VARCHAR(50) DEFAULT 'available',
      slots_total           INT         DEFAULT 4,
      slots_available       INT         DEFAULT 4,
      expected_wait_minutes INT         DEFAULT 0,
      owner_id              INT         NOT NULL,
      is_verified           TINYINT(1)  DEFAULT 0,
      price_per_kw          FLOAT       DEFAULT NULL,
      created_at            DATETIME    DEFAULT CURRENT_TIMESTAMP,
      updated_at            DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS connectors (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      station_id    INT          NOT NULL,
      type          VARCHAR(50)  NOT NULL,
      power         FLOAT        NOT NULL,
      price_per_kwh FLOAT        NOT NULL,
      status        VARCHAR(50)  DEFAULT 'available',
      created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES charging_stations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      station_id          INT         NOT NULL,
      user_id             INT,
      connector_id        INT,
      connector_type_label VARCHAR(100),
      start_time          DATETIME    NOT NULL,
      end_time            DATETIME,
      energy_kwh          FLOAT,
      total_price         FLOAT,
      status              VARCHAR(50) DEFAULT 'confirmed',
      user_deleted        TINYINT(1)  DEFAULT 0,
      owner_deleted       TINYINT(1)  DEFAULT 0,
      created_at          DATETIME    DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES charging_stations(id),
      FOREIGN KEY (user_id)    REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS station_reviews (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      station_id VARCHAR(255) NOT NULL,
      user_id    INT          NOT NULL,
      rating     INT          NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment    TEXT,
      created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_station_user (station_id, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      user_id          INT          NOT NULL,
      name             VARCHAR(255) NOT NULL,
      battery_capacity FLOAT        NOT NULL,
      efficiency       FLOAT        NOT NULL,
      created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      email      VARCHAR(255) NOT NULL,
      token      VARCHAR(255) NOT NULL,
      expires_at DATETIME     NOT NULL,
      created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_change_otps (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT          NOT NULL,
      otp        VARCHAR(255) NOT NULL,
      expires_at DATETIME     NOT NULL,
      created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_change_otps (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT          NOT NULL,
      new_email  VARCHAR(255) NOT NULL,
      otp        VARCHAR(255) NOT NULL,
      expires_at DATETIME     NOT NULL,
      created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usage_events (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT,
      event_type VARCHAR(255) NOT NULL,
      metadata   TEXT,
      created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

  pool.query(schema, (err) => {
    if (err) {
      console.error('[db] Schema creation error:', err.message);
      return reject(err);
    }
    console.log('[db] Schema ready.');

    if (!toBool(process.env.DB_SEED_ADMIN)) return resolve();

    // Seed default admin only if none exists
    db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1", (err, row) => {
      if (err || row) return resolve(); // already exists or error — skip
      const hash = bcrypt.hashSync('Admin@123', 10);
      db.run(
        `INSERT INTO users (username, email, password, role, is_verified)
         VALUES ('admin', 'admin@evassistant.com', ?, 'admin', 1)`,
        [hash],
        (err) => {
          if (err) console.error('[db] Admin seed error:', err.message);
          else     console.log('[db] Default admin created (email: admin@evassistant.com, password: Admin@123)');
          resolve();
        }
      );
    });
  });
});

module.exports = { init, getDb };
