// ═════════════════════════════════════════════════════════════════════════════
// DATABASE LAYER — backed by Turso (libSQL / SQLite over HTTP)
// ═════════════════════════════════════════════════════════════════════════════
//
// In production (Vercel): connects to a remote Turso database via
//   TURSO_DB_URL + TURSO_AUTH_TOKEN environment variables.
//
// In development (npm run dev): falls back to a local SQLite file at
//   .data/local.db — no credentials or internet connection needed.
//
// All exported function signatures are IDENTICAL to the old JSON-file version,
// so every API route and page works without any changes.
// ═════════════════════════════════════════════════════════════════════════════

import { getDb, ensureSchema } from "./turso";
import { deepNormalize } from "./textNormalize";

export type BookingStatus = "pending_verification" | "confirmed" | "rejected" | "cancelled";

export interface BookingRecord {
  id: string;
  groupId: string;
  date: string;
  court: "1" | "2";
  start: string;
  end: string;
  name: string;
  phone: string;
  email: string;
  status: BookingStatus;
  totalPrice: number;
  bookingType: "single" | "monthly";
  createdAt: number;
  verifiedAt?: number;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecord(row: Record<string, any>): BookingRecord {
  return {
    id:          String(row.id),
    groupId:     String(row.group_id),
    date:        String(row.date),
    court:       String(row.court) as "1" | "2",
    start:       String(row.start),
    end:         String(row.end),
    name:        String(row.name   ?? ""),
    phone:       String(row.phone  ?? ""),
    email:       String(row.email  ?? ""),
    status:      String(row.status ?? "pending_verification") as BookingStatus,
    totalPrice:  Number(row.total_price ?? 0),
    bookingType: String(row.booking_type ?? "single") as "single" | "monthly",
    createdAt:   Number(row.created_at ?? 0),
    verifiedAt:  row.verified_at != null ? Number(row.verified_at) : undefined,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean =>
  toMinutes(aStart) < toMinutes(bEnd) && toMinutes(aEnd) > toMinutes(bStart);

// Only CONFIRMED bookings block new ones.
// Pending bookings (pending_verification) are allowed to overlap — the admin
// resolves conflicts when verifying. This lets multiple customers request the
// same slot simultaneously without one blocking the others.
const isBlocking = (status: BookingStatus): boolean =>
  status === "confirmed";

const genId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Ensure schema is initialized before first query ─────────────────────────

async function ready() {
  await ensureSchema();
  return getDb();
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC API  — signatures identical to the old JSON-file version
// ═════════════════════════════════════════════════════════════════════════════

export async function getBookingsForDate(date: string, court: "1" | "2"): Promise<BookingRecord[]> {
  const db = await ready();
  const res = await db.execute({
    sql: `SELECT * FROM bookings WHERE date = ? AND court = ? AND status IN ('pending_verification','confirmed') ORDER BY start`,
    args: [date, court],
  });
  return res.rows.map(rowToRecord);
}

export async function getConfirmedBookingsForDate(date: string, court: "1" | "2"): Promise<BookingRecord[]> {
  const db = await ready();
  const res = await db.execute({
    sql: `SELECT * FROM bookings WHERE date = ? AND court = ? AND status = 'confirmed' ORDER BY start`,
    args: [date, court],
  });
  return res.rows.map(rowToRecord);
}

export async function getBookingsByGroupId(groupId: string): Promise<BookingRecord[]> {
  const db = await ready();
  const res = await db.execute({
    sql: `SELECT * FROM bookings WHERE group_id = ? ORDER BY date, start`,
    args: [groupId],
  });
  return res.rows.map(rowToRecord);
}

export async function getBookingById(id: string): Promise<BookingRecord | null> {
  const db = await ready();
  const res = await db.execute({ sql: `SELECT * FROM bookings WHERE id = ?`, args: [id] });
  if (res.rows.length === 0) return null;
  return rowToRecord(res.rows[0]);
}

export async function createPendingBooking(input: {
  date: string;
  courts: ("1" | "2")[];
  start: string;
  end: string;
  name: string;
  phone: string;
  email: string;
  totalPrice: number;
}): Promise<BookingRecord[]> {
  const norm = deepNormalize(input);
  const db = await ready();

  // Check conflicts for all requested courts first
  for (const court of norm.courts) {
    const existing = await db.execute({
      sql: `SELECT start, end FROM bookings WHERE date = ? AND court = ? AND status = 'confirmed'`,
      args: [norm.date, court],
    });
    const conflict = existing.rows.some((r) =>
      rangesOverlap(norm.start, norm.end, String(r.start), String(r.end))
    );
    if (conflict) throw new Error(`Booking conflict on ${norm.date} court ${court} ${norm.start}-${norm.end}`);
  }

  const groupId = genId("grp");
  const now = Date.now();
  const records: BookingRecord[] = [];

  for (const court of norm.courts) {
    const id = genId("bk");
    await db.execute({
      sql: `INSERT INTO bookings (id,group_id,date,court,start,end,name,phone,email,status,total_price,booking_type,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [id, groupId, norm.date, court, norm.start, norm.end, norm.name, norm.phone, norm.email,
             "pending_verification", norm.totalPrice, "single", now],
    });
    records.push({
      id, groupId, date: norm.date, court, start: norm.start, end: norm.end,
      name: norm.name, phone: norm.phone, email: norm.email,
      status: "pending_verification", totalPrice: norm.totalPrice,
      bookingType: "single", createdAt: now,
    });
  }

  return records;
}

export async function createPendingMonthlyBooking(input: {
  startDate: string;
  days: number;
  courts: ("1" | "2")[];
  start: string;
  end: string;
  name: string;
  phone: string;
  email: string;
  totalPrice: number;
}): Promise<{ groupId: string; created: BookingRecord[]; skipped: { date: string; court: string }[] }> {
  const norm = deepNormalize(input);
  const db = await ready();
  const groupId = genId("grp");
  const now = Date.now();
  const created: BookingRecord[] = [];
  const skipped: { date: string; court: string }[] = [];

  const startDate = new Date(norm.startDate + "T00:00:00");

  for (let i = 0; i < norm.days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    for (const court of norm.courts) {
      const existing = await db.execute({
        sql: `SELECT start, end FROM bookings WHERE date = ? AND court = ? AND status = 'confirmed'`,
        args: [dateStr, court],
      });
      const hasConflict = existing.rows.some((r) =>
        rangesOverlap(norm.start, norm.end, String(r.start), String(r.end))
      );
      if (hasConflict) {
        skipped.push({ date: dateStr, court });
        continue;
      }

      const id = genId("bk");
      await db.execute({
        sql: `INSERT INTO bookings (id,group_id,date,court,start,end,name,phone,email,status,total_price,booking_type,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [id, groupId, dateStr, court, norm.start, norm.end, norm.name, norm.phone, norm.email,
               "pending_verification", norm.totalPrice, "monthly", now],
      });
      const record: BookingRecord = {
        id, groupId, date: dateStr, court, start: norm.start, end: norm.end,
        name: norm.name, phone: norm.phone, email: norm.email,
        status: "pending_verification", totalPrice: norm.totalPrice,
        bookingType: "monthly", createdAt: now,
      };
      created.push(record);
    }
  }

  return { groupId, created, skipped };
}

export async function confirmBookingGroup(groupId: string): Promise<BookingRecord[]> {
  const db = await ready();
  const now = Date.now();
  await db.execute({
    sql: `UPDATE bookings SET status = 'confirmed', verified_at = ? WHERE group_id = ?`,
    args: [now, groupId],
  });
  return getBookingsByGroupId(groupId);
}

export async function rejectBookingGroup(groupId: string): Promise<BookingRecord[]> {
  const db = await ready();
  const now = Date.now();
  await db.execute({
    sql: `UPDATE bookings SET status = 'rejected', verified_at = ? WHERE group_id = ?`,
    args: [now, groupId],
  });
  return getBookingsByGroupId(groupId);
}

export async function checkMonthlyConflicts(input: {
  startDate: string;
  days: number;
  courts: ("1" | "2")[];
  start: string;
  end: string;
}): Promise<{ date: string; court: string }[]> {
  const db = await ready();
  const conflicts: { date: string; court: string }[] = [];
  const startDate = new Date(input.startDate + "T00:00:00");

  for (let i = 0; i < input.days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    for (const court of input.courts) {
      const existing = await db.execute({
        sql: `SELECT start, end FROM bookings WHERE date = ? AND court = ? AND status = 'confirmed'`,
        args: [dateStr, court],
      });
      const hasConflict = existing.rows.some((r) =>
        rangesOverlap(input.start, input.end, String(r.start), String(r.end))
      );
      if (hasConflict) conflicts.push({ date: dateStr, court });
    }
  }

  return conflicts;
}

export async function getPendingBookingGroups(): Promise<{ groupId: string; rows: BookingRecord[] }[]> {
  const db = await ready();
  const res = await db.execute({
    sql: `SELECT * FROM bookings WHERE status = 'pending_verification' ORDER BY created_at DESC`,
    args: [],
  });
  const records = res.rows.map(rowToRecord);
  const groups = new Map<string, BookingRecord[]>();
  for (const b of records) {
    if (!groups.has(b.groupId)) groups.set(b.groupId, []);
    groups.get(b.groupId)!.push(b);
  }
  return Array.from(groups.entries())
    .map(([groupId, rows]) => ({ groupId, rows }))
    .sort((a, b) => b.rows[0].createdAt - a.rows[0].createdAt);
}

export async function updateBooking(
  id: string,
  patch: Partial<Pick<BookingRecord, "date" | "start" | "end" | "name" | "phone" | "email" | "status">>
): Promise<BookingRecord | null> {
  const norm = deepNormalize(patch);
  const db = await ready();
  const fields: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args: any[] = [];
  if (norm.date   !== undefined) { fields.push("date = ?");   args.push(norm.date); }
  if (norm.start  !== undefined) { fields.push("start = ?");  args.push(norm.start); }
  if (norm.end    !== undefined) { fields.push("end = ?");    args.push(norm.end); }
  if (norm.name   !== undefined) { fields.push("name = ?");   args.push(norm.name); }
  if (norm.phone  !== undefined) { fields.push("phone = ?");  args.push(norm.phone); }
  if (norm.email  !== undefined) { fields.push("email = ?");  args.push(norm.email); }
  if (norm.status !== undefined) { fields.push("status = ?"); args.push(norm.status); }
  if (fields.length === 0) return getBookingById(id);
  args.push(id);
  await db.execute({ sql: `UPDATE bookings SET ${fields.join(", ")} WHERE id = ?`, args });
  return getBookingById(id);
}

export async function deleteBooking(id: string): Promise<boolean> {
  const db = await ready();
  const res = await db.execute({ sql: `DELETE FROM bookings WHERE id = ?`, args: [id] });
  return (res.rowsAffected ?? 0) > 0;
}

export async function getAllBookingsForDate(date: string): Promise<BookingRecord[]> {
  const db = await ready();
  const res = await db.execute({
    sql: `SELECT * FROM bookings WHERE date = ? AND status IN ('pending_verification','confirmed') ORDER BY court, start`,
    args: [date],
  });
  return res.rows.map(rowToRecord);
}

export async function getBookingsInDateRange(startDate: string, endDate: string): Promise<BookingRecord[]> {
  const db = await ready();
  const res = await db.execute({
    sql: `SELECT * FROM bookings WHERE date >= ? AND date <= ? AND status IN ('pending_verification','confirmed') ORDER BY date, court, start`,
    args: [startDate, endDate],
  });
  return res.rows.map(rowToRecord);
}

export async function getAllBookings(): Promise<BookingRecord[]> {
  const db = await ready();
  const res = await db.execute({
    sql: `SELECT * FROM bookings ORDER BY created_at DESC`,
    args: [],
  });
  return res.rows.map(rowToRecord);
}

/** No-op in Turso version — kept for API compatibility */
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function seedDemoDataIfEmpty(): void {}
