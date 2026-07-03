import { NextResponse } from "next/server";
import { getAllBookings } from "@/lib/bookingStore";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expected = process.env.ADMIN_TOKEN;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = getAllBookings();
  return NextResponse.json({ bookings });
}


