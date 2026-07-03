export type Space = "Cafe" | "Venue" | "Garden";

export type BookingStatus = "pending" | "reserved" | "cancelled";

export interface Booking {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  space: Space;
  eventType: string;
  guests: number;
  name: string;
  email: string;
  status: BookingStatus;
  createdAt: string;
  paymentProvider?: "yoco" | "stripe" | "manual";
  paymentStatus?: "unpaid" | "paid" | "refunded";
}

