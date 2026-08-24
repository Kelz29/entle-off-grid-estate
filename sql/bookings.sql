CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(64) PRIMARY KEY,
  date DATE NOT NULL,
  space ENUM('Cafe', 'Venue', 'Garden') NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  guests INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status ENUM('pending', 'reserved', 'cancelled') NOT NULL DEFAULT 'pending',
  payment_provider ENUM('yoco', 'stripe', 'manual') NULL DEFAULT 'yoco',
  payment_status ENUM('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_bookings_date (date),
  INDEX idx_bookings_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
