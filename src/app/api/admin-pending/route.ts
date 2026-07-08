import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminSession";
import { getPendingBookingGroups, confirmBookingGroup, rejectBookingGroup } from "@/lib/db";
import { sendCustomerConfirmation } from "@/lib/email";
import { ensureSettingsLoaded } from "@/lib/serverSettings";

// Force dynamic so Next.js never statically caches this route
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await getPendingBookingGroups();

  const shaped = groups.map(({ groupId, rows }) => {
    const first = rows[0];
    const courts = Array.from(new Set(rows.map((r) => r.court)));
    const dates = rows.map((r) => r.date).sort();

    return {
      groupId,
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
    };
  });

  return NextResponse.json({ groups: shaped });
}

export async function POST(request: NextRequest) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── FIX: Load settings from Turso before any settings-dependent operation.
  //    Without this, getSmtpCredentials() inside sendCustomerConfirmation()
  //    returns DEFAULT_SETTINGS (empty credentials) on every Vercel cold start
  //    because the in-process _cache is always null for serverless functions.
  //    This was why admin notifications worked (confirm-transfer calls this)
  //    but customer confirmation emails were silently dropped.
  await ensureSettingsLoaded();

  const body = await request.json();
  const { groupId, action } = body as { groupId: string; action: "confirm" | "reject" };

  if (!groupId || (action !== "confirm" && action !== "reject")) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  if (action === "reject") {
    await rejectBookingGroup(groupId);
    return NextResponse.json({ success: true, action: "rejected" });
  }

  const confirmedRows = await confirmBookingGroup(groupId);
  if (confirmedRows.length === 0) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const first = confirmedRows[0];
  const courts = Array.from(new Set(confirmedRows.map((r) => r.court)));
  const dates = confirmedRows.map((r) => r.date).sort();

  // Notify the customer their booking is now confirmed
  await sendCustomerConfirmation({
    groupId,
    bookingType: first.bookingType,
    customerName: first.name,
    customerEmail: first.email,
    customerPhone: first.phone,
    date: dates[0],
    endDate: first.bookingType === "monthly" ? dates[dates.length - 1] : undefined,
    court: courts.length === 2 ? "both" : courts[0],
    start: first.start,
    end: first.end,
    totalPrice: first.totalPrice,
  });

  return NextResponse.json({ success: true, action: "confirmed" });
}
