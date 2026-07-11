-- Entle Off-Grid Estate — Calendly-compatible booking schema (Postgres)
-- Idempotent: safe to re-run. Applied to the `entle_off` database.
--
-- Mirrors the domain model in CALENDLY_API.md:
--   business  = tenant (Organization/User)   services = event types
--   customers = invitees                      bookings = scheduled events
--
-- Overlap protection is enforced at the DB level with an exclusion constraint
-- (see §3/§4 of CALENDLY_API.md): two non-cancelled bookings for the same
-- service can never have overlapping [start_time, end_time) ranges.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS businesses (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT        NOT NULL,
  slug                  TEXT        NOT NULL UNIQUE,
  timezone              TEXT        NOT NULL DEFAULT 'Africa/Johannesburg',
  address               TEXT,
  advance_booking_days  INTEGER     NOT NULL DEFAULT 60,
  -- settings.business_hours: { "0": {"start":"09:00","end":"17:00"} | null, ... "6": ... }
  -- weekday index "0"=Monday ... "6"=Sunday. null/absent = closed that day.
  settings              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id                        SERIAL PRIMARY KEY,
  business_id               INTEGER     NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                      TEXT        NOT NULL,
  slug                      TEXT        NOT NULL,
  description               TEXT        NOT NULL DEFAULT '',
  duration_minutes          INTEGER     NOT NULL DEFAULT 60,
  buffer_minutes            INTEGER     NOT NULL DEFAULT 0,
  price_cents               INTEGER     NOT NULL DEFAULT 0,   -- deposit / price in cents (ZAR)
  color                     TEXT        NOT NULL DEFAULT '#0069ff',
  min_advance_booking_hours INTEGER     NOT NULL DEFAULT 0,
  max_advance_booking_days  INTEGER,    -- null → fall back to business.advance_booking_days
  is_active                 BOOLEAN     NOT NULL DEFAULT true,
  is_available_online       BOOLEAN     NOT NULL DEFAULT true,
  -- Concurrency model per slot:
  --   exclusive = true  → one booking per slot (events / venue hire)
  --   exclusive = false → shared; up to `capacity` guests may book the slot (café)
  exclusive                 BOOLEAN     NOT NULL DEFAULT true,
  capacity                  INTEGER     NOT NULL DEFAULT 1,   -- total guests per slot when shared
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ,
  UNIQUE (business_id, slug)
);

CREATE INDEX IF NOT EXISTS services_business_idx ON services(business_id);

CREATE TABLE IF NOT EXISTS customers (
  id          SERIAL PRIMARY KEY,
  business_id INTEGER     NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, email)
);

CREATE TABLE IF NOT EXISTS bookings (
  id               SERIAL PRIMARY KEY,
  business_id      INTEGER     NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id       INTEGER     NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
  customer_id      INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'cancelled', 'pending')),
  guests           INTEGER     NOT NULL DEFAULT 1,
  is_exclusive     BOOLEAN     NOT NULL DEFAULT true, -- copied from service.exclusive at create
  seen             BOOLEAN     NOT NULL DEFAULT false, -- admin has viewed this booking notification
  -- Guest details snapshotted at booking time so a booking always shows the
  -- name it was made with, independent of the (deduped) customer record.
  guest_name       TEXT,
  guest_email      TEXT,
  guest_phone      TEXT,
  notes            TEXT,
  payment_provider TEXT        NOT NULL DEFAULT 'yoco',
  payment_status   TEXT        NOT NULL DEFAULT 'unpaid'
                     CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  checkout_id      TEXT,        -- Yoco checkout id (ch_...) while payment is pending
  payment_id       TEXT,        -- Yoco payment id once paid (from webhook)
  payment_amount_cents INTEGER, -- amount actually charged, in cents
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS bookings_business_start_idx ON bookings(business_id, start_time);
CREATE INDEX IF NOT EXISTS bookings_service_idx        ON bookings(service_id);
CREATE INDEX IF NOT EXISTS bookings_checkout_idx       ON bookings(checkout_id);

-- Per-slot manual holds: admin blocks extra seats on a specific slot (walk-ins,
-- phone bookings, etc). effective booked = real booking guests + held_seats,
-- and seats-left = service capacity − that. Capacity itself is unchanged.
CREATE TABLE IF NOT EXISTS slot_overrides (
  id         SERIAL      PRIMARY KEY,
  service_id INTEGER     NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  slot_start TIMESTAMPTZ NOT NULL,
  held_seats INTEGER     NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, slot_start)
);

-- Exclusive (event) bookings: no two live bookings for the same service may
-- overlap. Shared (café) bookings are NOT covered here — their per-slot guest
-- capacity is enforced in application code under an advisory lock, since an
-- exclusion constraint can't express "up to N guests".
-- Cancelled bookings are excluded so a slot frees up on cancel.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_service_no_overlap'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_service_no_overlap
      EXCLUDE USING gist (
        service_id WITH =,
        tstzrange(start_time, end_time) WITH &&
      ) WHERE (status <> 'cancelled' AND is_exclusive);
  END IF;
END$$;
