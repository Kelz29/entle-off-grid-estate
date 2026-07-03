import { NextResponse } from "next/server";
import type { Space } from "@/lib/bookings";
import { getAllBookings, createBooking } from "@/lib/bookingStore";

export async function GET() {
  const bookings = getAllBookings();
  return NextResponse.json({ bookings });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { date, space, eventType, guests, name, email } = body as {
    date: string;
    space: Space;
    eventType: string;
    guests: number;
    name: string;
    email: string;
  };

  if (!date || !space || !eventType || !guests || !name || !email) {
    return NextResponse.json(
      { error: "Missing required booking fields" },
      { status: 400 }
    );
  }

  const booking = createBooking({
    date,
    space,
    eventType,
    guests,
    name,
    email,
  });

  return NextResponse.json({ booking });
}


