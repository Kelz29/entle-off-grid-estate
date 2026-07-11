// DB row shapes (snake_case as returned by pg).

export interface BusinessRow {
  id: number;
  name: string;
  slug: string;
  timezone: string;
  address: string | null;
  advance_booking_days: number;
  settings: { business_hours?: Record<string, BusinessHours | null> };
  is_active: boolean;
  created_at: string;
}

export interface BusinessHours {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export interface ServiceRow {
  id: number;
  business_id: number;
  name: string;
  slug: string;
  description: string;
  duration_minutes: number;
  buffer_minutes: number;
  price_cents: number;
  color: string;
  min_advance_booking_hours: number;
  max_advance_booking_days: number | null;
  is_active: boolean;
  is_available_online: boolean;
  exclusive: boolean; // true → one booking per slot; false → shared up to `capacity`
  capacity: number; // total guests per slot when shared
  created_at: string;
  updated_at: string | null;
}

export type BookingStatus = "active" | "cancelled" | "pending";
export type PaymentStatus = "unpaid" | "paid" | "refunded";

export interface BookingRow {
  id: number;
  business_id: number;
  service_id: number;
  customer_id: number;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  guests: number;
  notes: string | null;
  payment_provider: string;
  payment_status: PaymentStatus;
  payment_id: string | null;
  payment_amount_cents: number | null;
  seen: boolean;
  created_at: string;
  updated_at: string;
  // joined
  service_name?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string | null;
}

// Default business hours when a business has none configured
// (CALENDLY_API.md §3: Mon–Fri 09:00–17:00, closed weekends).
export const DEFAULT_BUSINESS_HOURS: Record<string, BusinessHours | null> = {
  "0": { start: "09:00", end: "17:00" },
  "1": { start: "09:00", end: "17:00" },
  "2": { start: "09:00", end: "17:00" },
  "3": { start: "09:00", end: "17:00" },
  "4": { start: "09:00", end: "17:00" },
  "5": null,
  "6": null,
};
