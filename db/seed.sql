-- Seed data for Entle Off-Grid Estate. Idempotent (upserts by slug).
-- Business hours: weekday index "0"=Monday ... "6"=Sunday.

INSERT INTO businesses (id, name, slug, timezone, address, advance_booking_days, settings, is_active)
VALUES (
  1,
  'Entle Off-Grid Estate',
  'entle-off-grid-estate',
  'Africa/Johannesburg',
  '183 Lakeview, Bloemfontein, South Africa',
  60,
  '{
     "business_hours": {
       "0": null,
       "1": null,
       "2": null,
       "3": null,
       "4": {"start": "11:00", "end": "18:00"},
       "5": {"start": "11:00", "end": "18:00"},
       "6": {"start": "11:00", "end": "18:00"}
     }
   }'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      timezone = EXCLUDED.timezone,
      address = EXCLUDED.address,
      advance_booking_days = EXCLUDED.advance_booking_days,
      settings = EXCLUDED.settings,
      is_active = EXCLUDED.is_active;

-- Keep the businesses sequence ahead of the manually-inserted id.
SELECT setval('businesses_id_seq', (SELECT MAX(id) FROM businesses));

-- Placeholder event types (the user will refine names/durations/prices later).
INSERT INTO services
  (business_id, name, slug, description, duration_minutes, buffer_minutes,
   price_cents, color, min_advance_booking_hours, max_advance_booking_days,
   is_active, is_available_online, exclusive, capacity)
VALUES
  -- Café: shared seating, up to 50 guests may book the same slot.
  (1, 'Cafe Table Reservation', 'cafe-table-reservation',
   'Reserve a table at The Cafe for a relaxed off-grid meal.',
   120, 15, 15000, '#9A6552', 2, 60, true, true, false, 50),
  -- Estate Tour / events: exclusive — one booking per slot.
  (1, 'Estate Tour', 'estate-tour',
   'A guided walk through the gardens, venue and private estate.',
   60, 15, 15000, '#CDA98E', 4, 90, true, true, true, 1)
ON CONFLICT (business_id, slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      duration_minutes = EXCLUDED.duration_minutes,
      buffer_minutes = EXCLUDED.buffer_minutes,
      price_cents = EXCLUDED.price_cents,
      color = EXCLUDED.color,
      min_advance_booking_hours = EXCLUDED.min_advance_booking_hours,
      max_advance_booking_days = EXCLUDED.max_advance_booking_days,
      is_active = EXCLUDED.is_active,
      is_available_online = EXCLUDED.is_available_online,
      exclusive = EXCLUDED.exclusive,
      capacity = EXCLUDED.capacity,
      updated_at = now();
