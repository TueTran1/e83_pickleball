import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminSession";
import { getBookingsByGroupId } from "@/lib/db";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { groupId: string } }) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getBookingsByGroupId(params.groupId);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const first = rows[0];
  const courts = Array.from(new Set(rows.map((r) => r.court)));
  const dates = rows.map((r) => r.date).sort();

  return NextResponse.json({
    groupId: params.groupId,
    status: first.status,
    bookingType: first.bookingType,
    customerName: first.name,
    customerPhone: first.phone,
    customerEmail: first.email,
    date: dates[0],
    endDate: first.bookingType === "monthly" ? dates[dates.length - 1] : undefined,
    court: courts.length === 2 ? "both" : courts[0],
    start: first.start,
    end: first.end,
    totalPrice: first.totalPrice,
    createdAt: first.createdAt,
    dayCount: first.bookingType === "monthly" ? new Set(dates).size : 1,
  });
}
