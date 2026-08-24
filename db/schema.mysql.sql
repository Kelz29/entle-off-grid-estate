-- Entle Off-Grid Estate — Calendly-compatible booking schema (MySQL / MariaDB)
-- Idempotent where practical. Applied to MYSQL_DATABASE.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS businesses (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(255) NOT NULL,
  slug                  VARCHAR(255) NOT NULL UNIQUE,
  timezone              VARCHAR(64)  NOT NULL DEFAULT 'Africa/Johannesburg',
  address               TEXT,
  advance_booking_days  INT          NOT NULL DEFAULT 60,
  settings              JSON         NOT NULL,
  is_active             TINYINT(1)   NOT NULL DEFAULT 1,
  created_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  business_id               INT          NOT NULL,
  name                      VARCHAR(255) NOT NULL,
  slug                      VARCHAR(255) NOT NULL,
  description               TEXT         NOT NULL,
  duration_minutes          INT          NOT NULL DEFAULT 60,
  buffer_minutes            INT          NOT NULL DEFAULT 0,
  price_cents               INT          NOT NULL DEFAULT 0,
  color                     VARCHAR(32)  NOT NULL DEFAULT '#0069ff',
  min_advance_booking_hours INT          NOT NULL DEFAULT 0,
  max_advance_booking_days  INT          NULL,
  is_active                 TINYINT(1)   NOT NULL DEFAULT 1,
  is_available_online       TINYINT(1)   NOT NULL DEFAULT 1,
  exclusive                 TINYINT(1)   NOT NULL DEFAULT 1,
  capacity                  INT          NOT NULL DEFAULT 1,
  created_at                DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                DATETIME(3)  NULL,
  UNIQUE KEY services_business_slug (business_id, slug),
  KEY services_business_idx (business_id),
  CONSTRAINT services_business_fk
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  business_id INT          NOT NULL,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  phone       VARCHAR(64)  NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY customers_business_email (business_id, email),
  CONSTRAINT customers_business_fk
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  business_id          INT          NOT NULL,
  service_id           INT          NOT NULL,
  customer_id          INT          NOT NULL,
  start_time           DATETIME(3)  NOT NULL,
  end_time             DATETIME(3)  NOT NULL,
  status               VARCHAR(32)  NOT NULL DEFAULT 'active',
  guests               INT          NOT NULL DEFAULT 1,
  is_exclusive         TINYINT(1)   NOT NULL DEFAULT 1,
  seen                 TINYINT(1)   NOT NULL DEFAULT 0,
  guest_name           VARCHAR(255) NULL,
  guest_email          VARCHAR(255) NULL,
  guest_phone          VARCHAR(64)  NULL,
  notes                TEXT         NULL,
  payment_provider     VARCHAR(32)  NOT NULL DEFAULT 'yoco',
  payment_status       VARCHAR(32)  NOT NULL DEFAULT 'unpaid',
  checkout_id          VARCHAR(128) NULL,
  payment_id           VARCHAR(128) NULL,
  payment_amount_cents INT          NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY bookings_business_start_idx (business_id, start_time),
  KEY bookings_service_idx (service_id),
  KEY bookings_checkout_idx (checkout_id),
  CONSTRAINT bookings_business_fk
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT bookings_service_fk
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT bookings_customer_fk
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT bookings_end_after_start CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS slot_overrides (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT         NOT NULL,
  slot_start DATETIME(3) NOT NULL,
  held_seats INT         NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY slot_overrides_service_start (service_id, slot_start),
  CONSTRAINT slot_overrides_service_fk
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
