import fs from "fs";
import path from "path";
import type { Booking, Space } from "./bookings";

const DATA_DIR = path.join(process.cwd(), "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
  if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([]), "utf-8");
  }
}

export function getAllBookings(): Booking[] {
  ensureDataFile();
  const raw = fs.readFileSync(BOOKINGS_FILE, "utf-8");
  try {
    return JSON.parse(raw) as Booking[];
  } catch {
    return [];
  }
}

export function saveBookings(bookings: Booking[]) {
  ensureDataFile();
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), "utf-8");
}

export function createBooking(input: {
  date: string;
  space: Space;
  eventType: string;
  guests: number;
  name: string;
  email: string;
}): Booking {
  const bookings = getAllBookings();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const booking: Booking = {
    id,
    date: input.date,
    space: input.space,
    eventType: input.eventType,
    guests: input.guests,
    name: input.name,
    email: input.email,
    status: "pending",
    createdAt: now,
    paymentProvider: "yoco",
    paymentStatus: "unpaid",
  };

  bookings.push(booking);
  saveBookings(bookings);

  return booking;
}

