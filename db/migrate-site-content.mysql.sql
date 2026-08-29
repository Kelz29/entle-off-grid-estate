-- Additive CMS tables for an existing Entle MySQL database.
-- Safe to re-run. Does not modify bookings, services, or cocktail specials.

CREATE TABLE IF NOT EXISTS site_content (
  business_id INT          NOT NULL PRIMARY KEY,
  payload     JSON         NOT NULL,
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT site_content_business_fk
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_assets (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  business_id   INT          NOT NULL,
  kind          VARCHAR(16)  NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(128) NOT NULL,
  byte_size     INT UNSIGNED NOT NULL,
  sha256        CHAR(64)     NOT NULL,
  data          LONGBLOB     NOT NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY media_assets_business_idx (business_id),
  KEY media_assets_sha_idx (business_id, sha256),
  CONSTRAINT media_assets_business_fk
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO site_content (business_id, payload) VALUES (1, '{}');
