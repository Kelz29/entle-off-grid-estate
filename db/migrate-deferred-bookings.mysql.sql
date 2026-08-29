-- Outbox for paid bookings received while MySQL was unreachable. Safe to re-run.

CREATE TABLE IF NOT EXISTS deferred_bookings (
  id                   CHAR(36)     NOT NULL PRIMARY KEY,
  checkout_id          VARCHAR(128) NOT NULL,
  payload              JSON         NOT NULL,
  payment_id           VARCHAR(128) NULL,
  payment_amount_cents INT          NULL,
  status               VARCHAR(16)  NOT NULL DEFAULT 'pending',
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  synced_at            DATETIME(3)  NULL,
  KEY deferred_bookings_status_idx (status),
  KEY deferred_bookings_checkout_idx (checkout_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
