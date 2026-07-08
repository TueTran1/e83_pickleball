import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminSession";
import {
  getAllBookingsForDate,
  getBookingsInDateRange,
  updateBooking,
  deleteBooking,
  getBookingsByGroupId,
} from "@/lib/db";
import { seedDemoDataIfEmpty } from "@/lib/db";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

seedDemoDataIfEmpty();

function auth() {
  if (!isAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

// GET /api/admin-bookings?date=YYYY-MM-DD&court=1|2|all
//     /api/admin-bookings?startDate=...&endDate=...
export async function GET(request: NextRequest) {
  const deny = auth(); if (deny) return deny;
  const { searchParams } = new URL(request.url);
  const date      = searchParams.get("date");
  const court     = searchParams.get("court");
  const startDate = searchParams.get("startDate");
  const endDate   = searchParams.get("endDate");

  if (date) {
    const bookings = await getAllBookingsForDate(date);
    const filtered = court && court !== "all"
      ? bookings.filter((b) => b.court === court)
      : bookings;
    return NextResponse.json({ bookings: filtered });
  }

  if (startDate && endDate) {
    const bookings = await getBookingsInDateRange(startDate, endDate);
    return NextResponse.json({ bookings });
  }

  return NextResponse.json({ error: "Missing date or range" }, { status: 400 });
}

// PATCH /api/admin-bookings  body: { id, patch: { status } }
// Admin can only change booking status — editing booking details is not permitted.
export async function PATCH(request: NextRequest) {
  const deny = auth(); if (deny) return deny;
  const body = await request.json();
  const { id, patch } = body;

  if (!id || !patch) return NextResponse.json({ error: "Missing id or patch" }, { status: 400 });

  // Only status changes are allowed — all other fields are read-only
  if (!patch.status) return NextResponse.json({ error: "Only status changes are permitted" }, { status: 400 });

  const validStatuses = ["pending_verification", "confirmed", "rejected", "cancelled"];
  if (!validStatuses.includes(patch.status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  const updated = await updateBooking(id, { status: patch.status });
  if (!updated) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  return NextResponse.json({ booking: updated });
}
