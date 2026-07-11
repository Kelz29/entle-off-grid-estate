# Calendly-Compatible API

A read/write HTTP surface that mirrors the response shapes of the public
[Calendly REST API](https://developer.calendly.com), so Calendly-aware clients
(or a new standalone integration) can read availability and drive bookings on
this system without learning a bespoke contract.

- **Source:** `backend/app/api/v1/endpoints/calendly.py`
- **Schemas:** `backend/app/schemas/calendly.py`
- **Mount point:** `/api/v1/calendly` (see `backend/app/api/v1/router.py`)
- **Auth:** none. This surface is **unauthenticated**, matching `public.py`.
- **Interactive docs:** `http://localhost:8000/docs` → the `calendly` tag.

> **Terminology map.** Calendly nouns map onto this system's domain models:
>
> | Calendly term    | This system | Notes |
> |------------------|-------------|-------|
> | Event Type       | `Service`   | A bookable offering (duration, price, description). |
> | Scheduled Event  | `Booking`   | A confirmed reservation of a time slot. |
> | Invitee          | `User` (customer) | Find-or-created by email on booking. |
> | Organization/User| `Business`  | The tenant. Passed as `business_id`. |

---

## 1. Core concepts

### Tenancy
Every request is scoped to one tenant (a **business**). There is no login;
tenant scoping is by:

- the `business_id` **query parameter** on list endpoints, and
- the resource's own `business_id` on single-resource / write endpoints
  (derived from the `service_id` or `booking_id` in the path/body).

The business must exist and be **active** (`is_active = true`) or you get `404`.

### Envelope shapes (identical to Calendly)
- **List** endpoints return `{ "collection": [...], "pagination": {...} }`.
- **Single-resource** endpoints return `{ "resource": {...} }`.

Pagination is computed in-memory, so `next_page*` / `previous_page*` tokens are
always `null`. Use the `count` query param to cap results (there is no cursor).

### Identifiers: URI or bare id
Anywhere an `event_type` is expected (query param or request body), you may pass
**either**:

- a full URI — `http://localhost:8000/api/v1/calendly/event_types/21`, or
- a bare service id — `21`.

The server extracts the trailing integer either way
(`_service_id_from_event_type`). A non-numeric tail → `400`.

### Base URLs in responses
Generated `uri` and `scheduling_url` fields are built from server config
(`backend/app/core/config.py`), **not** from the incoming request host:

| Config key            | Default                 | Used for |
|-----------------------|-------------------------|----------|
| `API_BASE_URL`        | `http://localhost:8000` | Resource `uri`s (event types, scheduled events). |
| `SCHEDULING_BASE_URL` | `http://localhost:3000` | `scheduling_url` (the customer-facing front-end `/book/{businessId}/{serviceId}`). |

For a real deployment, set both to public URLs in `.env`, or clients will
receive `localhost` links.

### Timezones
- Inputs accept ISO 8601. A **naive** datetime is assumed to be **UTC**.
- Availability is computed in the **business's** timezone
  (`business.timezone`, e.g. `Africa/Johannesburg`) but returned as
  timezone-aware ISO 8601. Convert on the client as needed.

---

## 2. Endpoints

Base path for all of the below: `/api/v1/calendly`.

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/event_types`               | List a business's services as event types. |
| GET  | `/event_types/{service_id}`  | Get one event type. |
| GET  | `/event_type_available_times`| Bookable start times for a date range. |
| GET  | `/scheduled_events`          | List a business's bookings. |
| GET  | `/scheduled_events/{booking_id}` | Get one booking. |
| POST | `/scheduled_events`          | Create + confirm a booking (no online payment). |

---

### 2.1 `GET /event_types` — list event types

List the bookable services for a business.

**Query params**

| Param        | Type | Required | Default | Notes |
|--------------|------|----------|---------|-------|
| `business_id`| int  | ✅       | —       | Tenant. Must be an active business. |
| `active`     | bool | ✖        | —       | `true` → only online-bookable (`is_active AND is_available_online`). `false` → the complement. Omit → all. |
| `count`      | int  | ✖        | 20      | 1–100. |

**Example**

```bash
curl "http://localhost:8000/api/v1/calendly/event_types?business_id=8&active=true"
```

```json
{
  "collection": [
    {
      "uri": "http://localhost:8000/api/v1/calendly/event_types/21",
      "name": "Cafe Table Reservation",
      "active": true,
      "slug": "cafe-table-reservation",
      "scheduling_url": "http://localhost:3000/book/8/21",
      "duration": 120,
      "kind": "solo",
      "pooling_type": null,
      "type": "StandardEventType",
      "color": "#0069ff",
      "description_plain": "Reserve a table at The Cafe ...",
      "description_html": "Reserve a table at The Cafe ...",
      "created_at": "2026-07-03T10:28:52.753403+02:00",
      "updated_at": null
    }
  ],
  "pagination": { "count": 1, "next_page": null, "previous_page": null,
                  "next_page_token": null, "previous_page_token": null }
}
```

**Field notes**

- `duration` is minutes. It drives slot sizing and the derived `end_time` on create.
- `active` = `service.is_active AND service.is_available_online`.
- `slug` is a slugified name (non-alphanumerics → `-`); **not guaranteed unique**.
- `kind`, `pooling_type`, `type`, `color` are static Calendly-compat fields (not modeled here).

**Errors:** `404` if the business doesn't exist or is inactive.

---

### 2.2 `GET /event_types/{service_id}` — one event type

Returns `{ "resource": <EventType> }`. Note this endpoint does **not** filter by
business or active state — any existing `service_id` resolves.

**Errors:** `404` if the service id doesn't exist.

---

### 2.3 `GET /event_type_available_times` — availability

Return bookable **start times** for an event type over a date range. This is the
endpoint a client polls to render a slot picker.

**Query params**

| Param        | Type     | Required | Notes |
|--------------|----------|----------|-------|
| `event_type` | string   | ✅       | Event type URI or bare service id. |
| `start_time` | datetime | ✅       | Window start, ISO 8601. |
| `end_time`   | datetime | ✅       | Window end, ISO 8601. |

**Window rules (mirrors Calendly)**

- `end_time` must be **after** `start_time` → else `400`.
- Range must be **≤ 7 days** → else `400`.
- `end_time` must be in the **future** → else `400`.

**Example**

```bash
curl "http://localhost:8000/api/v1/calendly/event_type_available_times\
?event_type=21\
&start_time=2026-07-04T00:00:00Z\
&end_time=2026-07-06T00:00:00Z"
```

```json
{
  "collection": [
    {
      "status": "available",
      "invitees_remaining": 1,
      "start_time": "2026-07-04T08:00:00+02:00",
      "scheduling_url": "http://localhost:3000/book/8/21?start_time=2026-07-04T06:00:00+00:00"
    },
    {
      "status": "available",
      "invitees_remaining": 1,
      "start_time": "2026-07-04T10:15:00+02:00",
      "scheduling_url": "http://localhost:3000/book/8/21?start_time=2026-07-04T08:15:00+00:00"
    }
  ]
}
```

Only **available** slots are returned. Note this response has **no**
`pagination` envelope (just `collection`). `scheduling_url` carries the chosen
`start_time` as a query param, so a client can deep-link straight into the
front-end booking flow.

**How slots are generated** — see [§3 Availability model](#3-availability-model).

**Errors:** `400` for window-rule violations or an availability `ValueError`
(e.g. service/business mismatch); `404` if the service doesn't exist.

---

### 2.4 `GET /scheduled_events` — list bookings

| Param            | Type     | Required | Default | Notes |
|------------------|----------|----------|---------|-------|
| `business_id`    | int      | ✅       | —       | Tenant (must be active). |
| `status`         | string   | ✖        | —       | `active` or `canceled`. (Query key is `status`.) |
| `min_start_time` | datetime | ✖        | —       | Lower bound on `start_time`. |
| `max_start_time` | datetime | ✖        | —       | Upper bound on `start_time`. |
| `count`          | int      | ✖        | 20      | 1–100. |

Ordered by `start_time` **descending**. Returns the standard
`{collection, pagination}` envelope of `ScheduledEvent` objects.

---

### 2.5 `GET /scheduled_events/{booking_id}` — one booking

Returns `{ "resource": <ScheduledEvent> }`. Not business-scoped — any existing
`booking_id` resolves. `404` if not found.

```json
{
  "resource": {
    "uri": "http://localhost:8000/api/v1/calendly/scheduled_events/66",
    "name": "Cafe Table Reservation",
    "status": "active",
    "start_time": "2026-07-04T08:00:00+02:00",
    "end_time": "2026-07-04T10:00:00+02:00",
    "event_type": "http://localhost:8000/api/v1/calendly/event_types/21",
    "location": { "type": "physical", "location": "182 Lakeview, Bloemfontein, South Africa" },
    "invitees_counter": { "total": 1, "active": 1, "limit": 1 },
    "created_at": "2026-07-03T10:35:09.978135+02:00",
    "updated_at": "2026-07-03T10:35:10.006782+02:00"
  }
}
```

**Field notes**

- `status` is `"active"` unless the booking is `CANCELLED`, then `"canceled"`.
- `location.location` is the **business address** (physical venue). `null` if unset.
- `invitees_counter.active` is `0` for a canceled booking, else `1`.
- `event_type` is the URI of the originating event type.

---

### 2.6 `POST /scheduled_events` — create a booking

Schedule an event for an invitee. The booking is created **and confirmed
immediately with no online payment** — mirroring Calendly's free scheduling
model. (This is different from the public paid flow in `public.py`, which takes
a Yoco deposit before the row exists.)

**Request body** (`CreateScheduledEvent`)

| Field                   | Type   | Required | Notes |
|-------------------------|--------|----------|-------|
| `event_type`            | string | ✅       | Event type URI or bare service id. |
| `start_time`            | datetime | ✅     | Slot start (ISO 8601; naive → UTC). |
| `invitee.name`          | string | ✅       | 1–201 chars. Split on first space into first/last name. |
| `invitee.email`         | email  | ✅       | Find-or-creates the customer by email. |
| `invitee.phone`         | string | ✖        | ≤ 20 chars. |
| `notes`                 | string | ✖        | Free-text, stored on the booking. |
| `questions_and_answers` | array  | ✖        | `[{question, answer}]`; folded into notes as `question: answer` lines. |

> `end_time` is **not** supplied by the client — it is derived as
> `start_time + service.duration`.

**Example**

```bash
curl -X POST "http://localhost:8000/api/v1/calendly/scheduled_events" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "21",
    "start_time": "2026-07-04T06:00:00Z",
    "invitee": { "name": "Thabo Mokoena", "email": "thabo@example.com", "phone": "0821234567" },
    "notes": "Window table if possible",
    "questions_and_answers": [{ "question": "Party size", "answer": "4" }]
  }'
```

**Success:** `201 Created` with `{ "resource": <ScheduledEvent> }` (same shape
as §2.5).

**Behavior & side effects**

1. Validates the service exists and is online-bookable
   (`is_active AND is_available_online`), and its business is active.
2. Find-or-creates the customer by email (reuses `public.py:_find_or_create_customer`).
   New customers get an unguessable placeholder password (they have no login).
3. Runs through `BookingEngine.create_booking` → `confirm_booking`, so the
   **full race-condition defense applies** (Redis lock → in-Python availability
   check → Postgres exclusion constraint). See [§4](#4-concurrency--conflicts).
4. Sends a best-effort confirmation email **if email is configured**
   (`email_configured()`); SMTP failure is logged and never undoes the booking.

**Errors**

| Status | When |
|--------|------|
| `409 Conflict` | `{"detail": "Time slot is not available"}` — slot already taken (pre-check or exclusion constraint). |
| `400 Bad Request` | Service not online-bookable, or bad `event_type` format. |
| `404 Not Found` | Unknown service, or inactive business. |
| `422 Unprocessable Entity` | Body fails schema validation (bad email, missing name, etc.). |

---

## 3. Availability model

**Important:** the Calendly surface uses **business-hours-based** availability
(`BookingEngine.get_business_hours_slots`), which is **different** from the
per-staff-schedule availability used by the admin/public `/availability`
endpoints (`get_availability`). Do not conflate them.

Slot generation, per day in the requested window:

1. **Operating hours** come from `business.settings["business_hours"]`, keyed by
   weekday index **`"0"` = Monday … `"6"` = Sunday**. Each value is either
   `{"start": "HH:MM", "end": "HH:MM"}` or `null`/`{}` (**closed** that day).
   If `business_hours` is absent entirely, the default is **Mon–Fri 09:00–17:00,
   closed weekends**.
2. **Slot size / step** = `service.duration + service.buffer_time`. Slots are
   laid end-to-end from the day's open time; a slot must fully fit before close
   (`slot_start + duration <= close`).
3. **Window clamping** — the requested `[start_time, end_time)` is intersected with:
   - `now + service.min_advance_booking_hours` (earliest bookable), and
   - `now + (service.max_advance_booking_days or business.advance_booking_days)`
     (latest bookable).
4. **Conflict removal** — each candidate is checked with
   `BookingRepository.check_availability(..., service_id=...)`. Conflicts are
   scoped **by `service_id`** (consistent with the `bookings_service_no_overlap`
   exclusion constraint), so this works even for services with **no staff
   assigned**.

Worked example — a 120-min service with 15-min buffer on a Saturday configured
`08:00–18:00` yields starts at **08:00, 10:15, 12:30, 14:45** (the next, 17:00,
is dropped because 17:00 + 120 min = 19:00 > 18:00).

---

## 4. Concurrency & conflicts

Booking creation (via `POST /scheduled_events`) funnels through `BookingEngine`,
which defends against double-booking in three layers, in order:

1. **Redis distributed lock** keyed `booking_lock:{staff_id or service_id}:{start_iso}`
   around the create critical section.
2. **In-Python availability check** (`check_availability`, scoped by `service_id`).
3. **Postgres exclusion constraints** (`bookings_service_no_overlap` via
   `btree_gist`). The engine catches the resulting `IntegrityError` and
   translates it into the same `"Time slot is not available"` error a pre-check
   conflict raises.

All three surface to the client as **`409 Conflict`**. A client should treat 409
as "slot just got taken — refresh availability and let the user pick again."

---

## 5. End-to-end flow (recommended client sequence)

```
1. GET  /event_types?business_id={id}&active=true      → list offerings
2. GET  /event_type_available_times?event_type={id}    → render slot picker
        &start_time=...&end_time=...    (≤ 7-day windows; page across days)
3. POST /scheduled_events                               → book a chosen slot
        { event_type, start_time, invitee, notes? }     → 201, or 409 to retry
4. GET  /scheduled_events/{booking_id}                  → confirmation details
   GET  /scheduled_events?business_id={id}&status=active→ list a tenant's bookings
```

Pseudocode:

```python
import requests

BASE = "http://localhost:8000/api/v1/calendly"
BIZ  = 8

# 1. pick an event type
ev = requests.get(f"{BASE}/event_types", params={"business_id": BIZ, "active": True}).json()
service = ev["collection"][0]

# 2. find a slot (windows must be <= 7 days and in the future)
times = requests.get(f"{BASE}/event_type_available_times", params={
    "event_type": service["uri"],
    "start_time": "2026-07-04T00:00:00Z",
    "end_time":   "2026-07-06T00:00:00Z",
}).json()
slot = times["collection"][0]["start_time"]

# 3. book it
resp = requests.post(f"{BASE}/scheduled_events", json={
    "event_type": service["uri"],
    "start_time": slot,
    "invitee": {"name": "Thabo Mokoena", "email": "thabo@example.com", "phone": "0821234567"},
    "notes": "Window table",
    "questions_and_answers": [{"question": "Party size", "answer": "4"}],
})
if resp.status_code == 409:
    ...  # slot taken — refetch availability
resp.raise_for_status()
booking = resp.json()["resource"]
print(booking["uri"], booking["status"])   # -> ".../scheduled_events/66 active"
```

---

## 6. Gaps vs. real Calendly (know before you build)

The surface is a **compatibility shim**, not a full Calendly clone. Notable
differences a separate integration should account for:

- **No authentication / no OAuth.** Real Calendly requires a Personal Access
  Token or OAuth. Here, anyone who knows a `business_id` can read event types &
  availability and **create bookings**. Put a gateway/allowlist in front before
  exposing publicly.
- **No pagination cursors.** `next_page*`/`previous_page*` are always `null`;
  use `count` + time bounds (`min_start_time`/`max_start_time`) instead.
- **No cancel/reschedule endpoints** on this surface. Cancellation status is
  *readable* (`status: "canceled"`) but there is no Calendly-shaped
  cancel/reschedule route — use the admin/public booking endpoints for that.
- **No webhooks.** Real Calendly pushes `invitee.created` / `.canceled` events.
  This surface is poll-only; there is no subscription mechanism.
- **No custom-question validation.** `questions_and_answers` are free-form and
  simply folded into notes; there's no per-event-type question schema.
- **Single invitee, `limit: 1`.** Group events / seats aren't modeled
  (`invitees_counter` is effectively 0/1).
- **`event_types/{id}` and `scheduled_events/{id}` are not tenant-scoped** — a
  known id resolves regardless of `business_id`. The list endpoints are scoped.
- **Availability is business-hours-based**, not per-staff round-robin or
  team-pooled as Calendly supports.

---

## 7. Configuration reference

| Setting | Location | Effect on this surface |
|---------|----------|------------------------|
| `API_BASE_URL` | `.env` / `config.py` | Host used in `uri` fields. Set to your public API URL. |
| `SCHEDULING_BASE_URL` | `.env` / `config.py` | Host used in `scheduling_url` (front-end `/book/...`). |
| `business.settings["business_hours"]` | DB (JSON) | Operating hours driving availability. `"0"`=Mon … `"6"`=Sun; `null`=closed. |
| `business.timezone` | DB | Timezone availability is computed in. |
| `business.advance_booking_days` | DB | Default booking horizon (overridable per service). |
| `service.duration`, `service.buffer_time` | DB | Slot size and spacing. |
| `service.min_advance_booking_hours`, `service.max_advance_booking_days` | DB | Per-service earliest/latest bounds. |
| `service.is_active`, `service.is_available_online` | DB | Whether the service is a bookable event type. |
| Email (SMTP) config | `.env` | If configured, a confirmation email is sent on create (best-effort). |

---

## 8. Quick reference (curl)

```bash
BASE=http://localhost:8000/api/v1/calendly

# List event types
curl "$BASE/event_types?business_id=8&active=true"

# One event type
curl "$BASE/event_types/21"

# Availability (<=7 day, future window)
curl "$BASE/event_type_available_times?event_type=21&start_time=2026-07-04T00:00:00Z&end_time=2026-07-06T00:00:00Z"

# List bookings
curl "$BASE/scheduled_events?business_id=8&status=active"

# One booking
curl "$BASE/scheduled_events/66"

# Create a booking
curl -X POST "$BASE/scheduled_events" -H "Content-Type: application/json" -d '{
  "event_type": "21",
  "start_time": "2026-07-04T06:00:00Z",
  "invitee": {"name": "Thabo Mokoena", "email": "thabo@example.com"}
}'
```
