-- ─────────────────────────────────────────────────────────────────────────────
-- EV Smart Route & Charging Assistant — MySQL Database Schema
-- Run this file once against a fresh database:
--   mysql -u root -p ev_assistant < schema.sql
--
-- Or use DB_BOOTSTRAP=true in .env to auto-apply on server start.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS `ev_assistant`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `ev_assistant`;

-- ── Users ─────────────────────────────────────────────────────────────────────
-- Roles: 'user' | 'owner' | 'admin'
-- is_verified: users are auto-verified; owners require admin approval
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(255) UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255)        NOT NULL,
  role        VARCHAR(50)         NOT NULL DEFAULT 'user',
  is_verified TINYINT(1)          DEFAULT 0,
  created_at  DATETIME            DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Charging Stations ─────────────────────────────────────────────────────────
-- availability: manual override by owner ('available'|'unavailable'|'maintenance')
-- status:       computed by server based on real-time bookings
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
  availability          VARCHAR(50)  DEFAULT 'available',
  status                VARCHAR(50)  DEFAULT 'available',
  slots_total           INT          DEFAULT 4,
  slots_available       INT          DEFAULT 4,
  expected_wait_minutes INT          DEFAULT 0,
  owner_id              INT          NOT NULL,
  is_verified           TINYINT(1)   DEFAULT 0,
  price_per_kw          FLOAT        DEFAULT NULL,
  created_at            DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Connectors ────────────────────────────────────────────────────────────────
-- Individual connector ports on a station (each can have its own type/pricing)
CREATE TABLE IF NOT EXISTS connectors (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  station_id    INT         NOT NULL,
  type          VARCHAR(50) NOT NULL,
  power         FLOAT       NOT NULL,
  price_per_kwh FLOAT       NOT NULL,
  status        VARCHAR(50) DEFAULT 'available',
  created_at    DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES charging_stations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Vehicles ──────────────────────────────────────────────────────────────────
-- User's EV garage; battery_capacity in kWh, efficiency in km/kWh
CREATE TABLE IF NOT EXISTS vehicles (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT          NOT NULL,
  name             VARCHAR(255) NOT NULL,
  battery_capacity FLOAT        NOT NULL,
  efficiency       FLOAT        NOT NULL,
  created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Bookings ──────────────────────────────────────────────────────────────────
-- status: 'confirmed' | 'cancelled' | 'completed'
-- user_deleted / owner_deleted: soft-delete flags for list views
CREATE TABLE IF NOT EXISTS bookings (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  station_id           INT         NOT NULL,
  user_id              INT,
  connector_id         INT,
  connector_type_label VARCHAR(100),
  start_time           DATETIME    NOT NULL,
  end_time             DATETIME,
  energy_kwh           FLOAT,
  total_price          FLOAT,
  status               VARCHAR(50) DEFAULT 'confirmed',
  user_deleted         TINYINT(1)  DEFAULT 0,
  owner_deleted        TINYINT(1)  DEFAULT 0,
  created_at           DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES charging_stations(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Station Reviews ───────────────────────────────────────────────────────────
-- One review per user per station (uq_station_user enforces this)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Password Resets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  token      VARCHAR(255) NOT NULL,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Password Change OTPs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_change_otps (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  otp        VARCHAR(255) NOT NULL,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Email Change OTPs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_change_otps (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  new_email  VARCHAR(255) NOT NULL,
  otp        VARCHAR(255) NOT NULL,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Usage Events ──────────────────────────────────────────────────────────────
-- Lightweight analytics: track route planner / calculator usage
CREATE TABLE IF NOT EXISTS usage_events (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT,
  event_type VARCHAR(255) NOT NULL,
  metadata   TEXT,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
