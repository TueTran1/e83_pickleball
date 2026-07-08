import { NextRequest, NextResponse } from "next/server";
import { getConfirmedBookingsForDate, seedDemoDataIfEmpty } from "@/lib/db";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

seedDemoDataIfEmpty();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date  = searchParams.get("date");
  const court = searchParams.get("court");

  if (!date || !court || (court !== "1" && court !== "2")) {
    return NextResponse.json({ error: "Missing or invalid date/court" }, { status: 400 });
  }

  // Customer-facing endpoint: only CONFIRMED bookings block the slot.
  // Pending bookings are visible only inside the Admin panel.
  const bookings = await getConfirmedBookingsForDate(date, court);

  return NextResponse.json(
    bookings.map((b) => ({ start: b.start, end: b.end, name: b.name, phone: b.phone }))
  );
}
