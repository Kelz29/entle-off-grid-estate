-- Seed data for Entle Off-Grid Estate (MySQL / MariaDB). Idempotent upserts.

INSERT INTO businesses (id, name, slug, timezone, address, advance_booking_days, settings, is_active)
VALUES (
  1,
  'Entle Off Grid Estate',
  'entle-off-grid-estate',
  'Africa/Johannesburg',
  '183 Lakeview, Bloemfontein, South Africa',
  60,
  '{"business_hours":{"0":null,"1":null,"2":null,"3":null,"4":{"start":"11:00","end":"18:00"},"5":{"start":"11:00","end":"18:00"},"6":{"start":"11:00","end":"18:00"}}}',
  1
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  slug = VALUES(slug),
  timezone = VALUES(timezone),
  address = VALUES(address),
  advance_booking_days = VALUES(advance_booking_days),
  settings = VALUES(settings),
  is_active = VALUES(is_active);

INSERT INTO services
  (business_id, name, slug, description, duration_minutes, buffer_minutes,
   price_cents, color, min_advance_booking_hours, max_advance_booking_days,
   is_active, is_available_online, exclusive, capacity)
VALUES
  (1, 'Cafe Table Reservation', 'cafe-table-reservation',
   'Reserve a table at The Cafe for a relaxed off grid meal.',
   120, 15, 10000, '#9A6552', 2, 60, 1, 1, 0, 50),
  (1, 'Estate Tour', 'estate-tour',
   'A guided walk through the gardens, venue and private estate.',
   60, 15, 10000, '#CDA98E', 4, 90, 1, 1, 1, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  duration_minutes = VALUES(duration_minutes),
  buffer_minutes = VALUES(buffer_minutes),
  price_cents = VALUES(price_cents),
  color = VALUES(color),
  min_advance_booking_hours = VALUES(min_advance_booking_hours),
  max_advance_booking_days = VALUES(max_advance_booking_days),
  is_active = VALUES(is_active),
  is_available_online = VALUES(is_available_online),
  exclusive = VALUES(exclusive),
  capacity = VALUES(capacity),
  updated_at = NOW(3);
