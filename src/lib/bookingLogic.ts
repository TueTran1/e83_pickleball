// ─── Types ────────────────────────────────────────────────────────────────────

export type SlotStatus = "available" | "taken" | "restricted";

/** A bookable 30-minute start mark in the timetable */
export interface BookingSlot {
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM" — startTime + 30min, used for display/status checks only
  status: SlotStatus;
  customerName?: string;
  customerPhone?: string; // raw phone; masking happens at display time
}

export interface TimeRange {
  start: string;
  end: string;
  name?: string;
  phone?: string;
}

// ─── Constants (fallback defaults — overridden by live config, see below) ─────

export const OPERATING_HOURS = { start: "05:30", end: "21:00" };

/** Slot granularity for the timetable display (minutes) */
export const SLOT_GRANULARITY_MIN = 30;

/** Pricing tiers: inclusive start, exclusive end */
export const PRICING_TIERS: { start: string; end: string; rate: number }[] = [
  { start: "05:30", end: "16:30", rate: 70_000 },
  { start: "16:30", end: "21:00", rate: 120_000 },
];

/** Default booking duration shown when a start time is first picked, e.g. "01:00" = 1 hour */
export const DEFAULT_DURATION = "01:00";

/** Minimum selectable duration */
export const MIN_DURATION_MIN = 30;

/** Monthly ticket discount — 10% off the standard daily rate × 30 days */
export const MONTHLY_DISCOUNT_RATE = 0.10;

// ─── Live Config Injection ─────────────────────────────────────────────────────
//
// All functions below that used to read OPERATING_HOURS / PRICING_TIERS directly
// now accept an optional `hours` / `tiers` parameter. When omitted, they fall back
// to `getLiveHours()` / `getLiveTiers()`, which return whatever was last set via
// `setLiveBookingConfig()`. This lets every page in the app (client or server)
// stay in sync with Admin Settings without hardcoding values, while still working
// with zero setup (falls back to the constants above).
//
// Client pages should call `setLiveBookingConfig(...)` once they've fetched
// `/api/booking-config`, before calling any slot/price functions.

export interface SimpleHours { start: string; end: string }
export interface SimpleTier  { start: string; end: string; rate: number; weekendRate?: number }
export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface SimpleInternalSlot {
  id:         string;
  courtIds:   (1 | 2)[];
  daysOfWeek: DayOfWeek[];
  startTime:  string;
  endTime:    string;
  reason?:    string;
  active:     boolean;
}

let _liveHours: SimpleHours = OPERATING_HOURS;
let _liveTiers: SimpleTier[] = PRICING_TIERS;
let _liveInternalSlots: SimpleInternalSlot[] = [];

/** Update the in-memory "live" operating hours + pricing tiers + internal slots. */
export const setLiveBookingConfig = (
  hours?: SimpleHours,
  tiers?: SimpleTier[],
  internalSlots?: SimpleInternalSlot[]
): void => {
  if (hours && hours.start && hours.end) _liveHours = hours;
  if (tiers && tiers.length > 0) _liveTiers = tiers;
  if (internalSlots !== undefined) _liveInternalSlots = internalSlots.filter((s) => s.active);
};

export const getLiveHours = (): SimpleHours => _liveHours;
export const getLiveTiers = (): SimpleTier[] => _liveTiers;
export const getLiveInternalSlots = (): SimpleInternalSlot[] => _liveInternalSlots;

// ─── Time Helpers ─────────────────────────────────────────────────────────────

/** Convert "HH:MM" to total minutes from midnight */
export const toMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/** Convert minutes from midnight to "HH:MM" */
export const toTimeString = (minutes: number): string => {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

/** Parse a "HH:MM" duration string (e.g. "01:30") into total minutes */
export const durationToMinutes = (duration: string): number => {
  const [h, m] = duration.split(":").map(Number);
  return h * 60 + m;
};

/** Convert total minutes into a "HH:MM" duration string */
export const minutesToDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

/**
 * Format a "HH:MM" duration string as human-readable Vietnamese, e.g.:
 * "01:00" -> "1 giờ"
 * "01:30" -> "1 giờ 30 phút"
 * "00:30" -> "30 phút"
 * Used wherever a DURATION (length of time) is shown, so it's never confused
 * with a clock TIME like the start-time selector (which uses "HH:MM" as-is).
 */
export const formatDuration = (duration: string): string => {
  const totalMin = durationToMinutes(duration);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  if (hours === 0) return `${mins} phút`;
  if (mins === 0) return `${hours} giờ`;
  return `${hours} giờ ${mins} phút`;
};

/** Check if `time` is within [start, end) */
const inRange = (time: string, start: string, end: string): boolean =>
  toMinutes(time) >= toMinutes(start) && toMinutes(time) < toMinutes(end);

/** Returns true if dateStr (YYYY-MM-DD) is strictly before today's local date */
export const isPastDate = (dateStr: string): boolean => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dateStr < todayStr;
};

/**
 * Returns true if a slot on a given date + startTime is too soon to book.
 * Rule: customers cannot book a slot that starts within 10 minutes of the current time.
 * Only applies on today's date.
 * e.g. current time 09:20 → slots at 09:00, 09:30 are both blocked (09:30 - 09:20 = 10 min, not > 10)
 */
export const isTooSoonToBook = (dateStr: string, startTime: string): boolean => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (dateStr !== todayStr) return false; // only matters for today's slots

  const nowMinutes     = now.getHours() * 60 + now.getMinutes();
  const slotStartMins  = toMinutes(startTime);
  // Block if the slot starts less than or equal to 10 minutes from now
  return slotStartMins - nowMinutes <= 10;
};

// ─── Business Rules ───────────────────────────────────────────────────────────

/**
/** Map JS getDay() (0=Sun, 6=Sat) → DayOfWeek string */
const JS_DAY_TO_DOW: DayOfWeek[] = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

/**
 * Returns true if the given slot on the given date + court is blocked by
 * any active internal schedule rule.
 *
 * Replaces the old hardcoded `isCourt2Restricted` function entirely.
 * The schedule is now configured via Admin Settings → Lịch & Giá → Khung giờ nội bộ.
 */
export const isSlotBlockedByInternal = (
  startTime:     string,
  endTime:       string,
  court:         1 | 2,
  date:          Date,
  internalSlots: SimpleInternalSlot[] = getLiveInternalSlots()
): boolean => {
  const dow    = JS_DAY_TO_DOW[date.getDay()];
  const sMin   = toMinutes(startTime);
  const eMin   = toMinutes(endTime);

  return internalSlots.some((rule) => {
    if (!rule.active)                        return false;
    if (!rule.courtIds.includes(court))      return false;
    if (!rule.daysOfWeek.includes(dow))      return false;
    // Overlap: slot starts before rule ends AND slot ends after rule starts
    const rStart = toMinutes(rule.startTime);
    const rEnd   = toMinutes(rule.endTime);
    return sMin < rEnd && eMin > rStart;
  });
};

/** @deprecated Use isSlotBlockedByInternal — kept temporarily for monthly start-mark filtering */
export const isCourt2Restricted = (startTime: string, date: Date): boolean =>
  isSlotBlockedByInternal(startTime, toTimeString(toMinutes(startTime) + SLOT_GRANULARITY_MIN), 2, date);

// ─── Price Calculation ────────────────────────────────────────────────────────

/**
 * Calculate VND price for a single 30-minute slot based on its start time.
 * Tiers are quoted per hour, so a 30-min slot is half the tier rate.
 * Pass `tiers` explicitly to price against a specific pricing table (e.g. server-side
 * validation); omit it to use the current live config (set via setLiveBookingConfig).
 * Pass `isWeekend = true` to use each tier's `weekendRate` when set (falls back to `rate`).
 */
export const getSlotPrice = (
  startTime: string,
  tiers: SimpleTier[] = getLiveTiers(),
  isWeekend = false
): number => {
  const tier = tiers.find((t) => inRange(startTime, t.start, t.end));
  const hourlyRate = (isWeekend ? tier?.weekendRate ?? tier?.rate : tier?.rate) ?? tiers[0]?.rate ?? 70_000;
  return Math.round((hourlyRate * SLOT_GRANULARITY_MIN) / 60);
};

/**
 * Calculate total price for a time range (may span multiple tiers) × court count.
 * Walks the range in 30-minute increments so straddling a tier boundary prices correctly.
 * Pass `date` so weekend pricing (tier.weekendRate) is applied automatically on Sat/Sun.
 */
export const calculateRangePrice = (
  start: string,
  end: string,
  courts: 1 | 2 = 1,
  tiers: SimpleTier[] = getLiveTiers(),
  date?: Date
): number => {
  const isWeekend = date ? date.getDay() === 0 || date.getDay() === 6 : false;
  let total = 0;
  let current = toMinutes(start);
  const endMin = toMinutes(end);

  while (current < endMin) {
    total += getSlotPrice(toTimeString(current), tiers, isWeekend);
    current += SLOT_GRANULARITY_MIN;
  }

  return total * courts;
};

// ─── Slot Generation (30-minute granularity) ──────────────────────────────────

/**
 * Generate all 30-minute start-slots for a given date and court,
 * marking restricted ones. Taken slots are marked separately via `markTakenSlots`.
 * The displayed timetable shows START marks only — duration is chosen separately.
 */
/** Returns true if the given slot overlaps any active internal rule for the given court + date.
 *  When court + date are omitted, checks all rules regardless of court/day (generic check). */
export const isInternalSlot = (
  startTime:     string,
  endTime:       string,
  internalSlots: SimpleInternalSlot[] = getLiveInternalSlots(),
  court?:        1 | 2,
  date?:         Date
): boolean => {
  if (court !== undefined && date !== undefined) {
    return isSlotBlockedByInternal(startTime, endTime, court, date, internalSlots);
  }
  // Generic fallback: checks time overlap across all rules (no court/day filter)
  const sMin = toMinutes(startTime);
  const eMin = toMinutes(endTime);
  return internalSlots.some((rule) => {
    if (!rule.active) return false;
    const rStart = toMinutes(rule.startTime);
    const rEnd   = toMinutes(rule.endTime);
    return sMin < rEnd && eMin > rStart;
  });
};

export const generateSlots = (
  date: Date,
  court: 1 | 2,
  applyTimeCutoff = false,
  hours: SimpleHours = getLiveHours(),
  internalSlots: SimpleInternalSlot[] = getLiveInternalSlots()
): BookingSlot[] => {
  const slots: BookingSlot[] = [];
  let current = toMinutes(hours.start);
  const end = toMinutes(hours.end);

  // Date string for same-day cutoff check
  const dateStr = formatDateStr(date);

  while (current < end) {
    const startTime = toTimeString(current);
    const endTime   = toTimeString(current + SLOT_GRANULARITY_MIN);

    // isSlotBlockedByInternal handles both court2 hardcoded rules (now data-driven)
    // and any admin-configured internal slots, checking court + day correctly.
    const blocked = isSlotBlockedByInternal(startTime, endTime, court, date, internalSlots);
    const tooSoon = applyTimeCutoff && isTooSoonToBook(dateStr, startTime);

    slots.push({
      startTime,
      endTime,
      status: (blocked || tooSoon) ? "restricted" : "available",
    });

    current += SLOT_GRANULARITY_MIN;
  }

  return slots;
};

/**
 * Mark slots as "taken" based on booked ranges from DB.
 * Skips slots already marked "restricted". Attaches customer name/phone if present.
 */
export const markTakenSlots = (
  slots: BookingSlot[],
  bookedRanges: TimeRange[]
): BookingSlot[] =>
  slots.map((slot) => {
    if (slot.status === "restricted") return slot;
    const slotStart = toMinutes(slot.startTime);

    const match = bookedRanges.find(({ start, end }) => {
      const bStart = toMinutes(start);
      const bEnd = toMinutes(end);
      return slotStart >= bStart && slotStart < bEnd;
    });

    if (!match) return slot;

    return {
      ...slot,
      status: "taken",
      customerName: match.name,
      customerPhone: match.phone,
    };
  });

/**
 * For "book both courts" mode: a slot is available only if available on BOTH courts.
 */
export const mergeJointAvailability = (
  slotsC1: BookingSlot[],
  slotsC2: BookingSlot[]
): BookingSlot[] =>
  slotsC1.map((slot, i) => {
    const c2 = slotsC2[i];
    if (!c2) return slot;
    if (slot.status !== "available" || c2.status !== "available") {
      return {
        ...slot,
        status: slot.status === "restricted" || c2.status === "restricted"
          ? "restricted"
          : "taken",
        customerName: slot.customerName ?? c2.customerName,
        customerPhone: slot.customerPhone ?? c2.customerPhone,
      };
    }
    return slot;
  });

// ─── Selection Helpers (start + duration model) ───────────────────────────────

/**
 * Given a chosen start time and duration ("HH:MM"), return the resulting end time.
 * Clamped so it never exceeds operating close time.
 */
export const computeEndTime = (start: string, duration: string, hours: SimpleHours = getLiveHours()): string => {
  const endMin = toMinutes(start) + durationToMinutes(duration);
  const closeMin = toMinutes(hours.end);
  return toTimeString(Math.min(endMin, closeMin));
};

/** Maximum selectable duration (in minutes) for a given start time, capped at closing time */
export const getMaxDurationMinutes = (start: string, hours: SimpleHours = getLiveHours()): number =>
  toMinutes(hours.end) - toMinutes(start);

/**
 * Maximum selectable duration (in minutes) for a MONTHLY TICKET start time on a given court.
 * In addition to the closing-time cap, this also stops the duration right before the next
 * restricted (internal-use) boundary for Court 2, so a monthly ticket can never be scheduled
 * to run into 16:30–19:00 (daily) or 05:30–07:00 (weekends) on any of its 30 days.
 */
export const getMaxMonthlyDurationMinutes = (
  start: string,
  court: "1" | "2" | "both",
  hours: SimpleHours = getLiveHours(),
  internalSlots: SimpleInternalSlot[] = getLiveInternalSlots()
): number => {
  const closingCap = getMaxDurationMinutes(start, hours);
  const startMin   = toMinutes(start);
  const courtNums  = court === "both" ? [1, 2] as const : [Number(court) as 1 | 2] as const;

  // Gather the earliest internal slot boundary that falls after startMin,
  // across all days (weekday + weekend) the 30-day period will cover.
  const refDates = [
    new Date("2026-06-16T00:00:00"), // Monday
    new Date("2026-06-21T00:00:00"), // Saturday
    new Date("2026-06-22T00:00:00"), // Sunday
  ];

  const boundaries: number[] = [];
  for (const c of courtNums) {
    for (const rule of internalSlots) {
      if (!rule.active) continue;
      if (!rule.courtIds.includes(c)) continue;
      for (const rd of refDates) {
        const dow = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][rd.getDay()] as import("./serverSettings").DayOfWeek;
        if (!rule.daysOfWeek.includes(dow)) continue;
        const rStart = toMinutes(rule.startTime);
        if (rStart > startMin) boundaries.push(rStart - startMin);
      }
    }
  }

  if (boundaries.length === 0) return closingCap;
  return Math.min(closingCap, Math.min(...boundaries));
};

/**
 * Build the list of 30-min slots covered by [start, start+duration).
 * Used to validate the whole range is available before confirming.
 */
export const buildSelectedRange = (
  slots: BookingSlot[],
  start: string,
  end: string
): BookingSlot[] => {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  return slots.filter((s) => {
    const sMin = toMinutes(s.startTime);
    return sMin >= startMin && sMin < endMin;
  });
};

export const isRangeValid = (range: BookingSlot[]): boolean =>
  range.length > 0 && range.every((s) => s.status === "available");

// ─── Display Helpers ──────────────────────────────────────────────────────────

/** Mask a phone number, keeping only the last 3 digits visible */
export const maskPhone = (phone: string): string =>
  phone.length >= 3 ? `*******${phone.slice(-3)}` : phone;

/** All valid 30-minute start marks between operating hours (excludes the closing mark itself) */
export const getAllStartMarks = (hours: SimpleHours = getLiveHours()): string[] => {
  const marks: string[] = [];
  let cur = toMinutes(hours.start);
  const end = toMinutes(hours.end);
  while (cur < end) {
    marks.push(toTimeString(cur));
    cur += SLOT_GRANULARITY_MIN;
  }
  return marks;
};

/**
 * Start marks available for a MONTHLY TICKET on a given court.
 * A monthly ticket repeats the same start time across 30 consecutive days, which always
 * spans at least one weekend — so any start time that is EVER restricted for the chosen
 * court (the daily 16:30–19:00 band, or the weekend 05:30–07:00 band for Court 2) is
 * excluded entirely. The customer can only pick a start time that is free on every one
 * of the 30 days, regardless of which day of the week it lands on.
 */
export const getAvailableMonthlyStartMarks = (
  court: "1" | "2" | "both",
  hours: SimpleHours = getLiveHours(),
  internalSlots: SimpleInternalSlot[] = getLiveInternalSlots()
): string[] => {
  if (court === "1") {
    // For court 1, just exclude any internal slots that apply to court 1
    const weekday = new Date("2026-06-16T00:00:00"); // Monday
    const weekend = new Date("2026-06-14T00:00:00"); // Sunday
    return getAllStartMarks(hours).filter((t) => {
      const endT = toTimeString(toMinutes(t) + SLOT_GRANULARITY_MIN);
      return (
        !isSlotBlockedByInternal(t, endT, 1, weekday, internalSlots) &&
        !isSlotBlockedByInternal(t, endT, 1, weekend, internalSlots)
      );
    });
  }

  // Court 2 (or "both") — exclude anything blocked on EITHER a weekday or weekend,
  // since the 30-day monthly run always includes both.
  const weekday = new Date("2026-06-16T00:00:00"); // Monday
  const weekend = new Date("2026-06-14T00:00:00"); // Sunday

  return getAllStartMarks(hours).filter((t) => {
    const endT = toTimeString(toMinutes(t) + SLOT_GRANULARITY_MIN);
    return (
      !isSlotBlockedByInternal(t, endT, 2, weekday, internalSlots) &&
      !isSlotBlockedByInternal(t, endT, 2, weekend, internalSlots)
    );
  });
};

/** Duration options in 30-min steps, capped by the max allowed from a given start time */
export const getDurationOptions = (start: string, hours: SimpleHours = getLiveHours()): string[] => {
  const maxMin = getMaxDurationMinutes(start, hours);
  const options: string[] = [];
  for (let m = MIN_DURATION_MIN; m <= maxMin; m += SLOT_GRANULARITY_MIN) {
    options.push(minutesToDuration(m));
  }
  return options;
};

/** Duration options for a MONTHLY TICKET — capped so the booking never runs into a restricted window */
export const getMonthlyDurationOptions = (
  start: string,
  court: "1" | "2" | "both",
  hours: SimpleHours = getLiveHours()
): string[] => {
  const maxMin = getMaxMonthlyDurationMinutes(start, court, hours);
  const options: string[] = [];
  for (let m = MIN_DURATION_MIN; m <= maxMin; m += SLOT_GRANULARITY_MIN) {
    options.push(minutesToDuration(m));
  }
  return options;
};

/** Format a Date as YYYY-MM-DD */
export const formatDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Add days to a YYYY-MM-DD date string and return the new YYYY-MM-DD string */
export const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatDateStr(d);
};

/**
 * Total price for a 30-day monthly ticket: daily range price × 30 days × court count,
 * with a 10% discount applied to the full total.
 * e.g. 17:00–18:00 (120,000/h tier) × 30 days = 3,600,000 → × 90% = 3,240,000 VND
 */
export const calculateMonthlyPrice = (
  start: string,
  end: string,
  courts: 1 | 2 = 1,
  tiers: SimpleTier[] = getLiveTiers()
): number => {
  const fullPrice = calculateRangePrice(start, end, courts, tiers) * 30;
  return Math.round(fullPrice * (1 - MONTHLY_DISCOUNT_RATE));
};

/** The undiscounted monthly price, useful for showing a strikethrough "before discount" price */
export const calculateMonthlyPriceBeforeDiscount = (
  start: string,
  end: string,
  courts: 1 | 2 = 1,
  tiers: SimpleTier[] = getLiveTiers()
): number => calculateRangePrice(start, end, courts, tiers) * 30;

// ─── Two-column mobile timetable helpers ──────────────────────────────────────

/**
 * A collapsed view row — either a single available/restricted slot (occupies one
 * cell in the column grid) or a merged "taken block" that collapses consecutive
 * 30-min taken slots into one card spanning both columns.
 */
export type TimetableRow =
  | { type: "available"; slot: BookingSlot }
  | { type: "restricted"; slot: BookingSlot }
  | {
      type: "taken_block";
      startTime: string;
      endTime: string;
      customerName?: string;
      customerPhone?: string;
    };

/**
 * Collapse a flat array of BookingSlots into TimetableRows for the mobile
 * two-column grid:
 *  - Consecutive "taken" 30-min slots from the same booking are merged into a
 *    single taken_block row that spans the full duration (e.g. 17:30–19:00).
 *  - Available and restricted slots stay as individual rows.
 *
 * The caller renders the rows in order: taken_block rows are full-width,
 * available/restricted rows fill alternating left/right cells.
 */
export const collapseSlots = (slots: BookingSlot[]): TimetableRow[] => {
  const rows: TimetableRow[] = [];
  let i = 0;

  while (i < slots.length) {
    const slot = slots[i];

    if (slot.status === "available") {
      rows.push({ type: "available", slot });
      i++;
      continue;
    }

    if (slot.status === "restricted") {
      rows.push({ type: "restricted", slot });
      i++;
      continue;
    }

    // status === "taken" — find how far this contiguous block extends.
    // Group consecutive taken slots with the same customer name+phone together.
    const blockName  = slot.customerName;
    const blockPhone = slot.customerPhone;
    let j = i + 1;

    while (
      j < slots.length &&
      slots[j].status === "taken" &&
      slots[j].customerName  === blockName &&
      slots[j].customerPhone === blockPhone
    ) {
      j++;
    }

    rows.push({
      type: "taken_block",
      startTime:     slot.startTime,
      endTime:       slots[j - 1].endTime,
      customerName:  blockName,
      customerPhone: blockPhone,
    });
    i = j;
  }

  return rows;
};
