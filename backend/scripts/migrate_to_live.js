/**
 * migrate_to_live.js
 * ─────────────────────────────────────────────────────────────────
 * Migrates owner users, charging stations, and connectors
 * from your local MySQL → Railway (live) MySQL.
 *
 * HOW TO USE:
 *   1. Fill in the LIVE_* variables below with your Railway credentials
 *      (or set them as environment variables before running).
 *   2. Run:  node backend/scripts/migrate_to_live.js
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// ── LOCAL DB (from .env) ──────────────────────────────────────────
const localConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'ev_assistant',
};

// ── LIVE DB (Railway) — fill these in ────────────────────────────
// You can also set them as env vars: LIVE_DB_HOST, LIVE_DB_PORT, etc.
const liveConfig = {
  host:     process.env.LIVE_DB_HOST     || 'YOUR_RAILWAY_HOST',
  port:     parseInt(process.env.LIVE_DB_PORT || '3306'),
  user:     process.env.LIVE_DB_USER     || 'YOUR_RAILWAY_USER',
  password: process.env.LIVE_DB_PASSWORD || 'YOUR_RAILWAY_PASSWORD',
  database: process.env.LIVE_DB_NAME     || 'railway',
  ssl:      { rejectUnauthorized: false }, // Railway requires SSL
};

// ─────────────────────────────────────────────────────────────────

async function migrate() {
  console.log('\n🚀  EV Smart Assistant — Local → Railway Migration');
  console.log('════════════════════════════════════════════════════\n');

  let local, live;

  try {
    console.log('🔌  Connecting to LOCAL database...');
    local = await mysql.createConnection(localConfig);
    console.log('✅  Local DB connected.\n');

    console.log('🔌  Connecting to LIVE (Railway) database...');
    live = await mysql.createConnection(liveConfig);
    console.log('✅  Railway DB connected.\n');
  } catch (err) {
    console.error('❌  Connection failed:', err.message);
    process.exit(1);
  }

  // ── 1. Migrate Owner Users ──────────────────────────────────────
  console.log('👤  Step 1/3 — Migrating OWNER users...');
  const [localOwners] = await local.execute(
    `SELECT id, username, email, password, role, is_verified, created_at
     FROM users WHERE role = 'owner'`
  );
  console.log(`    Found ${localOwners.length} owner(s) locally.`);

  // Map: localOwnerId → liveOwnerId
  const ownerIdMap = {};
  let ownersInserted = 0, ownersSkipped = 0;

  for (const owner of localOwners) {
    // Check if email already exists on live
    const [existing] = await live.execute(
      'SELECT id FROM users WHERE email = ?', [owner.email]
    );

    if (existing.length > 0) {
      console.log(`    ⏩  Skipped owner "${owner.username}" — email already exists (live id=${existing[0].id})`);
      ownerIdMap[owner.id] = existing[0].id;
      ownersSkipped++;
      continue;
    }

    // Check username collision
    const [existingUsername] = await live.execute(
      'SELECT id FROM users WHERE username = ?', [owner.username]
    );
    const finalUsername = existingUsername.length > 0
      ? `${owner.username}_migrated`
      : owner.username;

    const [result] = await live.execute(
      `INSERT INTO users (username, email, password, role, is_verified, created_at)
       VALUES (?, ?, ?, 'owner', ?, ?)`,
      [finalUsername, owner.email, owner.password, owner.is_verified, owner.created_at]
    );

    ownerIdMap[owner.id] = result.insertId;
    console.log(`    ✅  Inserted owner "${finalUsername}" → live id=${result.insertId}`);
    ownersInserted++;
  }

  console.log(`\n    Summary: ${ownersInserted} inserted, ${ownersSkipped} skipped.\n`);

  // ── 2. Migrate Charging Stations ───────────────────────────────
  console.log('🔌  Step 2/3 — Migrating CHARGING STATIONS...');
  const [localStations] = await local.execute(
    `SELECT * FROM charging_stations ORDER BY id`
  );
  console.log(`    Found ${localStations.length} station(s) locally.`);

  // Map: localStationId → liveStationId
  const stationIdMap = {};
  let stationsInserted = 0, stationsSkipped = 0;

  for (const station of localStations) {
    // Skip if owner wasn't migrated (no live owner_id)
    const liveOwnerId = ownerIdMap[station.owner_id];
    if (!liveOwnerId) {
      console.log(`    ⚠️   Skipped station "${station.name}" — owner id=${station.owner_id} not found in live DB.`);
      stationsSkipped++;
      continue;
    }

    // Check by name + city to avoid duplicates
    const [existing] = await live.execute(
      'SELECT id FROM charging_stations WHERE name = ? AND city = ?',
      [station.name, station.city]
    );

    if (existing.length > 0) {
      console.log(`    ⏩  Skipped station "${station.name}" (${station.city}) — already exists (live id=${existing[0].id})`);
      stationIdMap[station.id] = existing[0].id;
      stationsSkipped++;
      continue;
    }

    const [result] = await live.execute(
      `INSERT INTO charging_stations
         (name, address, city, state, zip_code, latitude, longitude,
          connector_type, power_kw, availability, status, slots_total,
          slots_available, expected_wait_minutes, owner_id, is_verified,
          price_per_kw, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        station.name, station.address, station.city, station.state,
        station.zip_code, station.latitude, station.longitude,
        station.connector_type, station.power_kw,
        station.availability || 'available', station.status || 'available',
        station.slots_total || 4, station.slots_available || 4,
        station.expected_wait_minutes || 0,
        liveOwnerId,
        station.is_verified || 0,
        station.price_per_kw || null,
        station.created_at, station.updated_at,
      ]
    );

    stationIdMap[station.id] = result.insertId;
    console.log(`    ✅  Inserted station "${station.name}" (${station.city}) → live id=${result.insertId}`);
    stationsInserted++;
  }

  console.log(`\n    Summary: ${stationsInserted} inserted, ${stationsSkipped} skipped.\n`);

  // ── 3. Migrate Connectors ──────────────────────────────────────
  console.log('🔧  Step 3/3 — Migrating CONNECTORS...');
  const [localConnectors] = await local.execute(
    `SELECT * FROM connectors ORDER BY station_id, id`
  );
  console.log(`    Found ${localConnectors.length} connector(s) locally.`);

  let connectorsInserted = 0, connectorsSkipped = 0;

  for (const connector of localConnectors) {
    const liveStationId = stationIdMap[connector.station_id];
    if (!liveStationId) {
      connectorsSkipped++;
      continue;
    }

    // Check duplicate by station + type + power
    const [existing] = await live.execute(
      'SELECT id FROM connectors WHERE station_id = ? AND type = ? AND power = ?',
      [liveStationId, connector.type, connector.power]
    );

    if (existing.length > 0) {
      connectorsSkipped++;
      continue;
    }

    await live.execute(
      `INSERT INTO connectors (station_id, type, power, price_per_kwh, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        liveStationId, connector.type, connector.power,
        connector.price_per_kwh, connector.status || 'available',
        connector.created_at,
      ]
    );
    connectorsInserted++;
  }

  console.log(`    Summary: ${connectorsInserted} inserted, ${connectorsSkipped} skipped.\n`);

  // ── Done ────────────────────────────────────────────────────────
  await local.end();
  await live.end();

  console.log('════════════════════════════════════════════════════');
  console.log('🎉  Migration complete!');
  console.log(`    Owners:     ${ownersInserted} inserted`);
  console.log(`    Stations:   ${stationsInserted} inserted`);
  console.log(`    Connectors: ${connectorsInserted} inserted`);
  console.log('════════════════════════════════════════════════════\n');
}

migrate().catch(err => {
  console.error('\n❌  Migration failed:', err.message);
  process.exit(1);
});
