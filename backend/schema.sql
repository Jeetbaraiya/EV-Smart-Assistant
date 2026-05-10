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
  station_id           VARCHAR(255) NOT NULL,
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

-- ── Seed Data ────────────────────────────────────────────────────────────────
-- Note: Run this against a fresh database.

-- ── Seed Users (Admin & Owners) ───────────────────────────────────────────────
INSERT INTO `users` (`id`, `username`, `email`, `password`, `role`, `is_verified`) VALUES
(1, 'admin', 'admin@evassistant.com', '$2a$10$fS0Y6oX1X1X1X1X1X1X1XOu8iW7qX5O1X2v3z4w5x6y7z8', 'admin', 1),
(3, 'yash', 'yash@owner.com', '$2a$10$fS0Y6oX1X1X1X1X1X1X1XOu8iW7qX5O1X2v3z4w5x6y7z8', 'owner', 1),
(4, 'abc', 'abc@owner.com', '$2a$10$fS0Y6oX1X1X1X1X1X1X1XOu8iW7qX5O1X2v3z4w5x6y7z8', 'owner', 1),
(5, 'krutarth', 'krutarth@owner.com', '$2a$10$fS0Y6oX1X1X1X1X1X1X1XOu8iW7qX5O1X2v3z4w5x6y7z8', 'owner', 1);

-- ── Seed Charging Stations ────────────────────────────────────────────────────
INSERT INTO `charging_stations` (`id`, `name`, `address`, `city`, `state`, `zip_code`, `latitude`, `longitude`, `connector_type`, `power_kw`, `availability`, `status`, `slots_total`, `slots_available`, `expected_wait_minutes`, `owner_id`, `is_verified`, `price_per_kw`, `created_at`, `updated_at`) VALUES
(1, 'Statiq Charging Station - Connaught Place', 'Connaught Place', 'New Delhi', 'Delhi', '110001', 28.6304, 77.2177, 'CCS2', 50, 'available', 'available', 4, 4, 0, 3, 1, 14.6, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(2, 'Tata Power EV Charging - Bandra', 'Bandra Kurla Complex', 'Mumbai', 'Maharashtra', '400051', 19.0596, 72.8295, 'Type 2', 30, 'available', 'available', 4, 4, 0, 3, 1, 17.5, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(3, 'Ather Grid - Koramangala', 'Koramangala 5th Block', 'Bangalore', 'Karnataka', '560095', 12.9352, 77.6245, 'CCS2', 25, 'available', 'available', 4, 4, 0, 3, 1, 21.8, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(4, 'Magenta Charging - Hitech City', 'Hitech City', 'Hyderabad', 'Telangana', '500081', 17.4486, 78.3908, 'Bharat DC-001', 50, 'available', 'available', 4, 4, 0, 3, 1, 14.6, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(5, 'ChargeZone - Salt Lake', 'Sector V, Salt Lake', 'Kolkata', 'West Bengal', '700091', 22.5726, 88.3639, 'CCS2', 60, 'available', 'available', 4, 4, 0, 3, 1, 15.6, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(6, 'EESL Charging Station - MG Road', 'MG Road', 'Pune', 'Maharashtra', '411001', 18.5204, 73.8567, 'Type 2', 15, 'available', 'available', 4, 4, 0, 3, 1, 12.1, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(7, 'Fortum Charge & Drive - Noida', 'Sector 18, Noida', 'Noida', 'Uttar Pradesh', '201301', 28.5355, 77.391, 'CCS2', 50, 'available', 'available', 4, 4, 0, 3, 1, 21.7, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(8, 'EV Plugs - Whitefield', 'Whitefield', 'Bangalore', 'Karnataka', '560066', 12.9698, 77.7499, 'Type 2', 22, 'available', 'available', 4, 4, 0, 3, 1, 20.1, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(9, 'ABB Charging - Gurgaon', 'DLF Cyber City', 'Gurgaon', 'Haryana', '122002', 28.4962, 77.0884, 'CCS2', 50, 'available', 'available', 4, 4, 0, 3, 1, 13.7, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(10, 'Zeon Charging - Chennai', 'T Nagar', 'Chennai', 'Tamil Nadu', '600017', 13.0475, 80.2409, 'Bharat DC-001', 30, 'available', 'available', 4, 4, 0, 3, 1, 16, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(11, 'Statiq Charging - Vasant Kunj', 'Vasant Kunj', 'New Delhi', 'Delhi', '110070', 28.5245, 77.1555, 'CCS2', 50, 'available', 'available', 4, 4, 0, 3, 1, 17, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(12, 'Tata Power - Andheri', 'Andheri West', 'Mumbai', 'Maharashtra', '400053', 19.1136, 72.8697, 'Type 2', 30, 'available', 'available', 4, 4, 0, 3, 1, 14.9, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(13, 'Ather Grid - Indiranagar', 'Indiranagar', 'Bangalore', 'Karnataka', '560038', 12.9784, 77.6408, 'CCS2', 25, 'available', 'available', 4, 4, 0, 3, 1, 21.7, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(14, 'ChargeZone - Powai', 'Powai', 'Mumbai', 'Maharashtra', '400076', 19.1176, 72.906, 'CCS2', 60, 'available', 'available', 4, 4, 0, 3, 1, 21.6, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(15, 'Magenta Charging - Banjara Hills', 'Banjara Hills', 'Hyderabad', 'Telangana', '500034', 17.4239, 78.4738, 'Bharat DC-001', 50, 'available', 'available', 4, 4, 0, 3, 1, 21.1, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(16, 'EESL Charging - Vashi', 'Vashi', 'Navi Mumbai', 'Maharashtra', '400703', 19.0791, 72.998, 'Type 2', 15, 'available', 'available', 4, 4, 0, 4, 1, 18.6, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(17, 'Fortum Charge - Greater Noida', 'Greater Noida', 'Greater Noida', 'Uttar Pradesh', '201310', 28.4744, 77.504, 'CCS2', 50, 'available', 'available', 4, 4, 0, 4, 1, 17.7, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(18, 'ABB Charging - Manesar', 'Manesar', 'Gurgaon', 'Haryana', '122050', 28.3544, 77.0125, 'CCS2', 50, 'available', 'available', 4, 4, 0, 4, 1, 20.9, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(19, 'Statiq Charging - Sector 29', 'Sector 29', 'Gurgaon', 'Haryana', '122001', 28.4595, 77.0266, 'CCS2', 50, 'available', 'available', 4, 4, 0, 4, 1, 19.1, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(20, 'Tata Power - Electronic City', 'Electronic City', 'Bangalore', 'Karnataka', '560100', 12.8456, 77.6633, 'Type 2', 30, 'available', 'available', 4, 4, 0, 4, 1, 21.1, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(21, 'ChargeZone - Hinjewadi', 'Hinjewadi', 'Pune', 'Maharashtra', '411057', 18.5912, 73.7389, 'CCS2', 60, 'available', 'available', 4, 4, 0, 4, 1, 16, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(22, 'Ather Grid - HSR Layout', 'HSR Layout', 'Bangalore', 'Karnataka', '560102', 12.912, 77.6446, 'CCS2', 25, 'available', 'available', 4, 4, 0, 4, 1, 14.7, '2026-04-06 15:53:08', '2026-04-09 11:26:27'),
(23, 'Magenta Charging - Gachibowli', 'Gachibowli', 'Hyderabad', 'Telangana', '500032', 17.4229, 78.3498, 'Bharat DC-001', 50, 'available', 'available', 4, 4, 0, 4, 1, 13.7, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(24, 'EESL Charging - Salt Lake Sector 1', 'Sector 1, Salt Lake', 'Kolkata', 'West Bengal', '700064', 22.5749, 88.4059, 'Type 2', 15, 'available', 'available', 4, 4, 0, 4, 1, 12.5, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(25, 'Zeon Charging - Adyar', 'Adyar', 'Chennai', 'Tamil Nadu', '600020', 13.0067, 80.2206, 'Bharat DC-001', 30, 'available', 'available', 4, 4, 0, 4, 1, 19.2, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(26, 'Statiq Charging - Dwarka', 'Dwarka Sector 10', 'New Delhi', 'Delhi', '110075', 28.5844, 77.0478, 'CCS2', 50, 'available', 'available', 4, 4, 0, 4, 1, 16.6, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(27, 'Tata Power - Thane', 'Thane West', 'Thane', 'Maharashtra', '400601', 19.2183, 72.9781, 'Type 2', 30, 'available', 'available', 4, 4, 0, 4, 1, 13.2, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(28, 'ChargeZone - Coimbatore', 'RS Puram', 'Coimbatore', 'Tamil Nadu', '641002', 11.0168, 76.9558, 'CCS2', 60, 'available', 'available', 4, 4, 0, 4, 1, 14.2, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(29, 'Ather Grid - Marathahalli', 'Marathahalli', 'Bangalore', 'Karnataka', '560037', 12.9592, 77.6974, 'CCS2', 25, 'available', 'available', 4, 4, 0, 4, 1, 19.3, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(30, 'Fortum Charge - Faridabad', 'Sector 15, Faridabad', 'Faridabad', 'Haryana', '121007', 28.4089, 77.3178, 'CCS2', 50, 'available', 'available', 4, 4, 0, 4, 1, 12.2, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(31, 'Statiq Charging - Ahmedabad', 'SG Highway', 'Ahmedabad', 'Gujarat', '380054', 23.0225, 72.5714, 'CCS2', 50, 'available', 'available', 4, 4, 0, 5, 1, 21.1, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(32, 'Tata Power EV Charging - Surat', 'Adajan', 'Surat', 'Gujarat', '395009', 21.1702, 72.8311, 'Type 2', 30, 'available', 'available', 4, 4, 0, 5, 1, 16.9, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(33, 'ChargeZone - Vadodara', 'Alkapuri', 'Vadodara', 'Gujarat', '390007', 22.3072, 73.1812, 'CCS2', 60, 'available', 'available', 4, 4, 0, 5, 1, 19.3, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(34, 'EESL Charging Station - Rajkot', 'Race Course Road', 'Rajkot', 'Gujarat', '360001', 22.3039, 70.8022, 'Type 2', 15, 'available', 'available', 4, 4, 0, 5, 1, 13.7, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(35, 'Magenta Charging - Gandhinagar', 'Sector 21', 'Gandhinagar', 'Gujarat', '382021', 23.2156, 72.6369, 'Bharat DC-001', 50, 'available', 'available', 4, 4, 0, 5, 1, 18.7, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(36, 'Statiq Charging - Bhavnagar', 'Waghawadi Road', 'Bhavnagar', 'Gujarat', '364001', 21.7645, 72.1519, 'CCS2', 50, 'available', 'available', 4, 4, 0, 5, 1, 20.2, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(37, 'Tata Power - Jamnagar', 'Bedipara', 'Jamnagar', 'Gujarat', '361001', 22.4707, 70.0587, 'Type 2', 30, 'available', 'available', 4, 4, 0, 5, 1, 12.8, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(38, 'ChargeZone - Anand', 'Vallabh Vidyanagar', 'Anand', 'Gujarat', '388120', 22.5645, 72.9289, 'CCS2', 60, 'available', 'available', 4, 4, 0, 5, 1, 21.7, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(39, 'Ather Grid - Ahmedabad', 'Prahladnagar', 'Ahmedabad', 'Gujarat', '380015', 23.033, 72.5063, 'CCS2', 25, 'available', 'available', 4, 4, 0, 5, 1, 17.8, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(40, 'Statiq Charging - Surat', 'Vesu', 'Surat', 'Gujarat', '395007', 21.1619, 72.7707, 'CCS2', 50, 'available', 'available', 4, 4, 0, 5, 1, 12.2, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(41, 'EESL Charging - Vadodara', 'Sayajigunj', 'Vadodara', 'Gujarat', '390005', 22.31, 73.1808, 'Type 2', 15, 'available', 'available', 4, 4, 0, 5, 1, 15.6, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(42, 'Fortum Charge & Drive - Ahmedabad', 'Satellite', 'Ahmedabad', 'Gujarat', '380015', 23.0267, 72.5126, 'CCS2', 50, 'available', 'available', 4, 4, 0, 5, 1, 19.4, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(43, 'ABB Charging - Surat', 'Piplod', 'Surat', 'Gujarat', '395007', 21.1702, 72.7904, 'CCS2', 50, 'available', 'available', 4, 4, 0, 5, 1, 18.1, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(44, 'ChargeZone - Mehsana', 'Mehsana City', 'Mehsana', 'Gujarat', '384001', 23.588, 72.3693, 'CCS2', 60, 'available', 'available', 4, 4, 0, 5, 1, 20.3, '2026-04-06 15:53:09', '2026-04-09 11:26:27'),
(45, 'Tata Power - Bharuch', 'Bharuch City', 'Bharuch', 'Gujarat', '392001', 21.7051, 72.9959, 'Type 2', 30, 'available', 'available', 4, 4, 0, 5, 1, 15.3, '2026-04-06 15:53:09', '2026-04-09 11:26:27');
