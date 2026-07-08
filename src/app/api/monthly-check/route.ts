import { NextRequest, NextResponse } from "next/server";
import { checkMonthlyConflicts, seedDemoDataIfEmpty } from "@/lib/db";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

seedDemoDataIfEmpty();

const VIETNAMESE_REASON: Record<string, string> = {
  "1": "Sân 1 đã có lịch đặt",
  "2": "Sân 2 đã có lịch đặt",
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { startDate, startTime, endTime, court } = body as {
    startDate: string;
    startTime: string;
    endTime: string;
    court: string; // "1" | "2" | "both"
  };

  if (!startDate || !startTime || !endTime || !court) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const courts: ("1" | "2")[] = court === "both" ? ["1", "2"] : [court as "1" | "2"];

  // Queries the SAME database the booking timetable and /api/bookings write to —
  // this is what makes the conflict check accurate: it sees real, current bookings
  // rather than a separate hardcoded mock that could never reflect actual reservations.
  const rawConflicts = await checkMonthlyConflicts({
    startDate,
    days: 30,
    courts,
    start: startTime,
    end: endTime,
  });

  // Merge same-date conflicts across courts into one entry when "both" is selected
  // and both courts conflict on the same day, so the UI doesn't show duplicate rows.
  const byDate = new Map<string, Set<string>>();
  for (const c of rawConflicts) {
    if (!byDate.has(c.date)) byDate.set(c.date, new Set());
    byDate.get(c.date)!.add(c.court);
  }

  const conflicts = Array.from(byDate.entries()).map(([date, courtsSet]) => {
    const courtList = Array.from(courtsSet);
    const reason =
      courtList.length === 2
        ? "Sân 1 và Sân 2 đã có lịch đặt"
        : VIETNAMESE_REASON[courtList[0]] ?? "Đã có lịch đặt";
    return { date, reason };
  });

  conflicts.sort((a, b) => (a.date < b.date ? -1 : 1));

  return NextResponse.json({
    totalDays: 30,
    conflictCount: conflicts.length,
    conflicts,
  });
}
