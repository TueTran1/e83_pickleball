import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminSession";
import { getAllBookings } from "@/lib/db";
import {
  getDateRange,
  calculateRevenue,
  buildExcelReport,
  generateFilename,
  PeriodPreset,
} from "@/lib/report";
import { seedDemoDataIfEmpty } from "@/lib/db";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

seedDemoDataIfEmpty();

function auth() {
  if (!isAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

// ── GET /api/admin-report  — revenue stats + booking list for a period ─────────
//
// Query params:
//   preset  = today | yesterday | this_week | last_week | this_month |
//             last_month | this_year | custom
//   start   = YYYY-MM-DD  (required when preset=custom)
//   end     = YYYY-MM-DD  (required when preset=custom)
//   court   = 1 | 2 | all  (optional filter)

export async function GET(request: NextRequest) {
  const deny = auth();
  if (deny) return deny;

  const { searchParams } = new URL(request.url);
  const preset = (searchParams.get("preset") ?? "this_month") as PeriodPreset;
  const customStart = searchParams.get("start") ?? undefined;
  const customEnd   = searchParams.get("end")   ?? undefined;
  const court       = searchParams.get("court") ?? "all";

  const range = getDateRange(
    preset,
    customStart && customEnd ? { start: customStart, end: customEnd } : undefined
  );

  // Fetch all bookings, then filter to the range (we do it in JS since our
  // "db" is a JSON file — for a real SQL db you'd push the WHERE clause)
  const all = await getAllBookings();
  let bookings = all.filter(
    (b) => b.date >= range.startDate && b.date <= range.endDate
  );

  if (court !== "all") {
    bookings = bookings.filter((b) => b.court === court);
  }

  // Also compute quick-access daily/weekly/monthly totals for the dashboard
  // cards regardless of the selected preset — the UI always shows all four
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  // Week: Mon → today
  const dow  = (today.getDay() + 6) % 7;
  const mon  = new Date(today); mon.setDate(today.getDate() - dow);
  const weekStart = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;

  // Month: 1st → today
  const monthStart = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`;

  const confirmedAll = all.filter((b) => b.status === "confirmed");

  const quickStats = {
    today:     confirmedAll.filter((b) => b.date === todayStr).reduce((s,b)=>s+(b.totalPrice??0),0),
    thisWeek:  confirmedAll.filter((b) => b.date >= weekStart && b.date <= todayStr).reduce((s,b)=>s+(b.totalPrice??0),0),
    thisMonth: confirmedAll.filter((b) => b.date >= monthStart && b.date <= todayStr).reduce((s,b)=>s+(b.totalPrice??0),0),
  };

  const summary = calculateRevenue(bookings);

  return NextResponse.json({ range, bookings, summary, quickStats });
}

// ── POST /api/admin-report  — generate Excel and return as file download ──────
//
// Body: { preset, start?, end?, court? }

export async function POST(request: NextRequest) {
  const deny = auth();
  if (deny) return deny;

  const body = await request.json();
  const preset      = (body.preset ?? "this_month") as PeriodPreset;
  const customStart = body.start as string | undefined;
  const customEnd   = body.end   as string | undefined;
  const court       = (body.court ?? "all") as string;

  const range = getDateRange(
    preset,
    customStart && customEnd ? { start: customStart, end: customEnd } : undefined
  );

  const all = await getAllBookings();
  let bookings = all.filter(
    (b) => b.date >= range.startDate && b.date <= range.endDate
  );
  if (court !== "all") {
    bookings = bookings.filter((b) => b.court === court);
  }

  const summary = calculateRevenue(bookings);

  const buf = buildExcelReport({
    bookings,
    range,
    summary,
    reportTitle: "E83 - Câu lạc bộ Pickleball — Báo cáo doanh thu",
  });

  const filename = generateFilename(range);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(buf.length),
    },
  });
}
