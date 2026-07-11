# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **yarn** (see `yarn.lock`).

- `yarn dev` — start the dev server (http://localhost:3000)
- `yarn build` — production build
- `yarn start` — serve the production build
- `yarn lint` — run ESLint

There is no test runner configured in this project.

### Database setup
The booking system needs Postgres. Configure `DATABASE_URL` in `.env.local` (see `.env.example`), then:

```bash
createdb entle_off
psql -d entle_off -f db/schema.sql   # tables + btree_gist exclusion constraint (idempotent)
psql -d entle_off -f db/seed.sql     # business id 1 + placeholder event types (idempotent)
```

Both SQL files are safe to re-run.

## Architecture

Next.js 16 (App Router) + React 19 + Tailwind CSS v4 marketing/landing site for "Entle Off-Grid Estate" (a cafe / event venue / private estate) with a Calendly-compatible, Postgres-backed booking system.

### Page composition
`src/app/page.tsx` is a single long-scroll landing page assembled from section components in `src/components/sections/` (Hero, Estate, Spaces, Experiences, **Food**, Booking, Gallery, Testimonials, Contact), plus `layout/SiteHeader` and `ui/CustomCursor`. Global chrome (fonts, base colors) lives in `src/app/layout.tsx`. Add a new section by creating a component under `src/components/sections/` and inserting it into the `<main>` in `page.tsx`.

Import alias: `@/*` maps to `src/*` (see `tsconfig.json`).

### Website media (portrait photos & video)
The marketing site uses the estate's own **portrait** photography & video, all served locally from `public/{indoor,outdoor,food,video}/` (filenames are clean slugs — the originals had emojis/spaces, renamed for reliable serving). One manifest, `src/lib/media.ts`, maps every asset to `{src, caption/title}` and is imported by the sections (single source of truth; the captions come from the original filenames).

- **Hero** — full-bleed ambient `<video>` (muted/loop/autoplay, small `slow-down.mp4`) with a poster fallback.
- **Experiences** — a horizontal "reels" strip of 9:16 video cards. `src/components/ui/HoverVideo.tsx` shows a poster and plays a muted preview on hover; clicking opens `src/components/ui/Lightbox.tsx` (image/video, Esc/backdrop close) with sound.
- **Gallery** — portrait grid → Lightbox. **Food** — the shared-table photo + menu tags.

Large videos (wine/birthday/wivesmas, 28–40 MB) only load on hover/click, so the page stays light. Images use `next/image`; local `/public` files need no `remotePatterns`. `next.config.ts` still allows `images.unsplash.com` + `grainy-gradients.vercel.app` (only the grain-noise overlay still uses a remote URL; Unsplash is no longer used on the page).

### Booking flow (Calendly-compatible)
The one piece of real functionality. It implements the HTTP contract in `CALENDLY_API.md`, adapted from that doc's Python/FastAPI backend to Next.js App Router routes backed by local Postgres. It is **single-tenant** — one seeded business (id 1, `NEXT_PUBLIC_BUSINESS_ID`) — but keeps the multi-tenant `business_id` param for Calendly faithfulness.

Domain model = `businesses` (tenant) → `services` (Calendly "event types": duration, buffer, hours) → `bookings` (Calendly "scheduled events") + `customers` (invitees). Schema in `db/schema.sql`.

**Availability / hours.** Operating hours live in `businesses.settings.business_hours` (weekday key `"0"`=Mon … `"6"`=Sun; `null` = closed). Seeded as **Fri–Sun 11:00–18:00, Mon–Thu closed**. Slot generation is business-hours-based (`availability.ts:getSlotUsage`/`getAvailableSlots`, `CALENDLY_API.md` §3): step = duration+buffer, and the **closing time itself is offered as the final "last seating"** so the last bookable start equals the posted close (e.g. 18:00), even though that booking runs past close. The booking widget's calendar greys out Mon–Thu via `filterDate` (`isOpenDay` = Fri/Sat/Sun).

**Guest identity is snapshotted on the booking.** `customers` is deduped by `(business_id, email)`, so `bookings` also stores `guest_name`/`guest_email`/`guest_phone` captured at booking time; reads use `COALESCE(b.guest_*, c.*)`. `findOrCreateCustomer` no longer overwrites the customer's name on conflict. (Without this, re-booking with the same email under a different name renamed every past booking.)

- **API** under `src/app/api/v1/calendly/` — `event_types` (list/one + admin `PATCH {capacity}`), `event_type_available_times` (slot picker feed), `scheduled_events` (list/create + `[bookingId]` get/PATCH), plus admin-only `admin/slots` (per-slot seats) and `admin/seen` (mark all seen). Response envelopes match Calendly (`{collection, pagination}` for lists, `{resource}` for singles). Read is unauthenticated; the `PATCH` on `scheduled_events/[bookingId]` is gated by `ADMIN_TOKEN` and branches on the body: `{status:"canceled"}` cancels (frees seats), `{start_time:"<ISO>"}` reschedules (re-checks capacity, frees the old slot — `bookings.ts:rescheduleBooking`), `{guests:N}` edits the party size (`updateBookingGuests`), `{seen:bool}` marks the notification seen.
- **Business logic** in `src/lib/calendly/`: `repository.ts` (all SQL), `availability.ts` (business-hours slot generation, `CALENDLY_API.md` §3), `bookings.ts` (create + conflict handling), `serializers.ts` (row → Calendly JSON), `time.ts` (IANA-timezone math, no date lib), `config.ts` (URI builders, `event_type` URI/bare-id parsing).
- `src/lib/db.ts` — pooled `pg` client (single pool cached on `globalThis` across hot reloads).
- `src/components/sections/Booking.tsx` — Calendly-style multi-step widget (pick experience → date + time slot → details → confirm), fetches the API above.
- `src/app/admin/page.tsx` — client dashboard (SWR, 20s auto-refresh + a Refresh button). KPIs, a 14-day load chart, filters/search, and **agenda + table** views. Per booking: cancel, **reschedule** (inline date/time picker, in both views), and guest-count edit (agenda ✎). Header has a **notifications bell** (new bookings) and a **"Manage seats"** panel (default capacity, per-slot seats). Reads `NEXT_PUBLIC_ADMIN_TOKEN`.

### New-booking notifications
`bookings.seen` (bool, default false) tracks whether admin has viewed a booking. New bookings are unseen; the admin header bell shows the unseen count and lists latest bookings (by `created_at`). Toggle per-booking via `PATCH /scheduled_events/[id]` `{seen}` (`setBookingSeen`); mark all via `PATCH /api/v1/calendly/admin/seen` `{seen}` (`markAllBookingsSeen`). `seen` is exposed on the serialized scheduled event.

### Payments (Yoco Checkout API + webhooks)
Every booking made through the website widget is paid up front (deposit = `services.price_cents`). Integration is the **hosted Checkout API** (redirect) with **webhook** confirmation. (The legacy Popup SDK + `/v1/charges` API was sunsetted by Yoco.)

Flow:
1. `Booking.tsx` "details" step → `POST /api/bookings/checkout` (no card data).
2. `src/app/api/bookings/checkout/route.ts` reserves the slot as a **`pending`** booking (409 if taken — *before* creating a checkout), then `createCheckout` (`src/lib/yoco.ts` → `POST https://payments.yoco.com/api/checkouts`) with our success/cancel/failure URLs + `metadata.bookingId`, stores `checkout_id`, and returns `redirectUrl`. On Yoco error it releases the slot and returns `502`.
3. Browser redirects to Yoco's hosted page; on completion Yoco redirects to `/booking/{success,cancelled,failed}?booking={id}`.
4. **`POST /api/payments/yoco/webhook`** verifies the Svix-style signature over the raw body (`verifyWebhookSignature`) and on `payment.succeeded` calls `markBookingPaid` (sets `active` + `paid`, idempotent). This is the authoritative confirmation — **not** the success redirect.
5. `/booking/success` polls the booking until `payment_status === "paid"`. `/booking/cancelled` and `/booking/failed` call `POST /api/bookings/release` to free the held (unpaid) slot.

Separate from the payment-free Calendly `scheduled_events` POST (which stays faithful to `CALENDLY_API.md` §2.6).

**Webhook setup (needs a public URL):** the webhook receiver must be reachable by Yoco, so local dev needs a tunnel (e.g. `ngrok http 3000`). Register once with `YOCO_SECRET_KEY=… node scripts/register-yoco-webhook.mjs https://<public-host>/api/payments/yoco/webhook`, then put the returned `whsec_…` secret in `YOCO_WEBHOOK_SECRET`. Success/cancel/failure redirects go to `APP_BASE_URL` (can be `localhost` — that's the customer's browser). Test card: `4111 1111 1111 1111`, any future expiry & CVV.

**Stale holds:** an abandoned checkout where the customer never returns leaves a `pending` booking holding the slot (the cancel/fail pages release it, but a hard-closed tab won't). A periodic cleanup of old `pending` bookings is a sensible follow-up; none exists yet.

### Email notifications
`src/lib/email.ts` (nodemailer, SMTP from `SMTP_*` env) sends branded booking emails, best-effort (a mail failure never breaks the booking flow; unconfigured SMTP silently no-ops):
- **Confirmation** — from the Yoco webhook on `payment.succeeded`, only when `markBookingPaid` reports a first-time payment (idempotent — no duplicate on webhook retries).
- **Reschedule** & **Cancellation** — from the admin `PATCH /scheduled_events/[id]` branches (cancellation only fires when an *active* booking is actually cancelled).

Confirmation therefore depends on the webhook being reachable (see Payments — needs a tunnel locally).

### Slot capacity & double-booking defense
Each service has a concurrency model (`services.exclusive`, `services.capacity`):
- **Exclusive** (`exclusive = true`, e.g. events / Estate Tour) — one booking per slot. Enforced by a Postgres **exclusion constraint** (`bookings_service_no_overlap`, via `btree_gist`, scoped `WHERE is_exclusive`). Violation → `409`.
- **Shared** (`exclusive = false`, e.g. the café with `capacity = 50`) — up to `capacity` **guests** may book the same slot. The exclusion constraint can't express "≤ N guests", so this is enforced in `bookings.ts:insertShared` inside a transaction under a `pg_advisory_xact_lock(service_id, slot_epoch)`: it sums `guests` of live bookings overlapping the slot and rejects (`409`) if the party would exceed capacity. Café seatings never overlap across different start times (steps are duration+buffer apart), so locking by (service, slot-start) is sufficient.

`bookings.is_exclusive` is copied from `services.exclusive` at create time so the partial exclusion constraint only covers exclusive rows. Availability (`getAvailableSlots`) returns `remaining` per slot (seats left for shared, `1` for exclusive), surfaced as Calendly's `invitees_remaining`.

**Seat counts are admin-only.** The public booking widget never displays remaining seats; a guest only learns their limit via the "Almost full" modal that fires if they try to book more than the slot holds. The admin dashboard shows seats per slot in the **reschedule** picker, and admin frees seats by cancelling or rescheduling a booking.

**Editing capacity** (admin "Manage seats" panel, all token-gated):
- **Default** per service — `PATCH /api/v1/calendly/event_types/[serviceId]` `{capacity}` (`setServiceCapacity`).
- **Per-slot seats-left** — the `slot_overrides` table (service_id, slot_start, **held_seats**) is a manual **hold** of blocked seats, NOT a capacity override. Effective `booked = real booking guests + held_seats`; `remaining = service.capacity − booked`; capacity is unchanged. Managed via `GET/PATCH /api/v1/calendly/admin/slots`: GET (`getSlotUsage`) returns per-slot `{capacity, booked, held, remaining}`; PATCH takes `{seats_left}` and derives the hold (`held = capacity − real − seats_left`, clamped ≥0; deletes the row when 0), or `{reset:true}`. Availability and all capacity checks add `held_seats` to used seats (`getSlotHolds`/`slotHeld`).
- **Per-booking guests** — `PATCH /scheduled_events/[id]` `{guests}` (`updateBookingGuests`, re-checks slot capacity for shared), editable inline on each booking card.

### Editing event types
Event types are rows in `services`. Seeded (`db/seed.sql`): **Cafe Table Reservation** (shared, capacity 50, 120 min, R150) and **Estate Tour** (exclusive, 60 min, R150) — both `price_cents = 15000`; the R150 is a **deposit deducted from the bill on arrival** (widget/emails say so). Change offerings/durations/prices/hours by editing `services` rows and `business_hours` in `businesses.settings`; the API and UI pick them up with no code change. Capacity and per-slot seats are editable in the admin "Manage seats" panel, but there's no admin UI for full service CRUD (name/price/duration).

## Styling

Tailwind CSS v4 via `@import "tailwindcss"` in `src/app/globals.css` (no `tailwind.config.js` — theme is defined inline). Brand tokens are CSS variables exposed as Tailwind colors (`bg-eoe-ivory`, `text-eoe-espresso`, `eoe-gold`, `eoe-sage`, `eoe-ink`).

**Palette = clay + white.** The token values (in `globals.css :root`) are: `--eoe-ivory: #ffffff` (surfaces), `--eoe-espresso: #9a6552` **and** `--eoe-gold: #9a6552` (unified to the clay brand colour — used for headings, dark bands, buttons, accents), `--eoe-ink: #2a1a12` (deep warm — overlays + base text), `--eoe-sage: #b3c0ae`. Because clay-on-white fails small-text contrast, clay is expressed via fills/active-states and buttons that fill with it use **white text** (`text-eoe-ivory`); a deeper clay `#a97f2e`/`#9a6552` is used for the few readable clay text bits (admin uses hardcoded `GOLD`/`GOLD_TEXT` constants). The admin dashboard is light (white/clay); the public dark "bands" (Experiences/Gallery/booking rail) are clay with white text.

Two fonts loaded via `next/font/google` in `layout.tsx`: DM Sans (`font-sans`) and Cormorant Garamond (`font-display`). Animations use `framer-motion` (`whileInView` scroll reveals). Custom `react-datepicker` styling for the booking calendar lives at the bottom of `globals.css` under `.booking-calendar`.

## Environment variables

See `.env.example`. Copy it to `.env.local` (gitignored).

- `DATABASE_URL` — Postgres connection string for the booking store.
- `API_BASE_URL` / `SCHEDULING_BASE_URL` — hosts baked into Calendly `uri` / `scheduling_url` response fields (from server config, **not** the request host). Both default to `http://localhost:3000`.
- `NEXT_PUBLIC_BUSINESS_ID` — the single tenant this site serves (seeded as `1`).
- `ADMIN_TOKEN` — server-side secret gating all admin write endpoints (cancel, reschedule, guest edit, mark-seen, capacity, per-slot seats).
- `NEXT_PUBLIC_ADMIN_TOKEN` — client-readable token the admin dashboard sends; must equal `ADMIN_TOKEN`.
- `YOCO_SECRET_KEY` — server-only Yoco key (`sk_test_…`/`sk_live_…`) for the Checkout API.
- `YOCO_WEBHOOK_SECRET` — `whsec_…` signing secret from `scripts/register-yoco-webhook.mjs`; used to verify webhook signatures.
- `YOCO_CURRENCY` — ISO currency (default `ZAR`).
- `APP_BASE_URL` — public base for Yoco success/cancel/failure browser redirects (default `http://localhost:3000`).
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM_EMAIL` — booking-notification email (587 = STARTTLS, 465 = implicit TLS). If unset, emails are skipped.

## Notes

- Remote images are restricted to `images.unsplash.com` and `grainy-gradients.vercel.app` in `next.config.ts` — add hostnames there before using `next/image` with new sources.
- `CALENDLY_API.md` is the **spec** this booking system implements. It's written against a Python/FastAPI + Redis backend that does **not** exist here; this repo realizes the same HTTP contract in Next.js + Postgres, single-tenant, without Redis (the DB exclusion constraint replaces the Redis lock). Timezone/availability semantics (§3), envelope shapes, and error codes are matched; some multi-tenant/webhook/OAuth aspects in §6 are intentionally out of scope.
- `@supabase/supabase-js` is still an unused dependency (the store uses `pg` directly against local Postgres). Supabase is Postgres, so `DATABASE_URL` can point at a Supabase instance to deploy on Vercel.
