import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminSession";
import { getAllBookings, updateBooking } from "@/lib/db";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

function auth() {
  if (!isAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

// GET /api/admin-history?status=...&court=...&date=...&search=...
export async function GET(request: NextRequest) {
  const deny = auth(); if (deny) return deny;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") ?? "all";
  const courtFilter  = searchParams.get("court")  ?? "all";
  const dateFilter   = searchParams.get("date")   ?? "";
  const search       = (searchParams.get("search") ?? "").toLowerCase().trim();

  let bookings = await getAllBookings();

  if (statusFilter !== "all") {
    bookings = bookings.filter((b) => b.status === statusFilter);
  }
  if (courtFilter !== "all") {
    bookings = bookings.filter((b) => b.court === courtFilter);
  }
  if (dateFilter) {
    bookings = bookings.filter((b) => b.date === dateFilter);
  }
  if (search) {
    bookings = bookings.filter(
      (b) =>
        b.name.toLowerCase().includes(search) ||
        b.phone.includes(search) ||
        b.email.toLowerCase().includes(search) ||
        b.id.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({ bookings, total: bookings.length });
}

// PATCH /api/admin-history  { id, status }
export async function PATCH(request: NextRequest) {
  const deny = auth(); if (deny) return deny;
  const { id, status } = await request.json();

  const allowed = ["pending_verification", "confirmed", "rejected", "cancelled"];
  if (!id || !allowed.includes(status))
    return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const updated = await updateBooking(id, { status });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ booking: updated });
}
