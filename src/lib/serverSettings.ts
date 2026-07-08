// ═════════════════════════════════════════════════════════════════════════════
// SERVER SETTINGS — backed by Turso (libSQL / SQLite over HTTP)
// ═════════════════════════════════════════════════════════════════════════════
//
// Settings are stored as a single JSON blob in the `settings` table
// (id = "singleton"). This exactly mirrors the old settings.json file
// but persists across Vercel deployments.
// ═════════════════════════════════════════════════════════════════════════════

import { getDb, ensureSchema } from "./turso";
import { deepNormalize } from "./textNormalize";

export interface PricingTier {
  id: string;
  label: string;
  start: string;
  end: string;
  rate: number;
  weekendRate?: number;
  effectiveDate?: string;
}

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface InternalSlot {
  id: string;
  courtIds:   (1 | 2)[];    // courts this rule applies to
  daysOfWeek: DayOfWeek[];  // days of the week this rule applies to
  startTime:  string;       // "HH:MM"
  endTime:    string;       // "HH:MM"
  reason?:    string;
  active:     boolean;
  createdAt:  number;
}

export interface Announcement {
  id: string;
  message: string;
  startDate: string;
  endDate: string;
  affectedTimeStart?: string;
  affectedTimeEnd?: string;
  createdAt: number;
}

export interface PaymentInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrImageBase64: string;
}

export interface OperatingHours {
  start: string;
  end: string;
  slotMinutes: number;
}

export interface ContactInfo {
  phone: string;
  facebook: string;
  zalo: string;
}

export interface SmtpSettings {
  /** Email that RECEIVES notifications (payment alerts, booking alerts sent to owner) */
  notificationEmail: string;
  /** Email used to SEND via Gmail SMTP (must be a real Gmail address) */
  smtpEmail: string;
  gmailAppPassword: string;
  /** @deprecated kept for migration — copy to notificationEmail + smtpEmail on first load */
  ownerEmail?: string;
}

export interface ServerSettings {
  bookingLocked: boolean;
  ownerEmail: string;
  adminPasswordHash: string;
  pricingTiers: PricingTier[];
  operatingHours: OperatingHours;
  pendingOperatingHours?: { hours: OperatingHours; effectiveDate: string };
  announcements: Announcement[];
  paymentInfo: PaymentInfo;
  smtpSettings: SmtpSettings;
  contactInfo: ContactInfo;
  internalSlots: InternalSlot[];
}

export const DEFAULT_SETTINGS: ServerSettings = {
  bookingLocked: false,
  ownerEmail: "",
  adminPasswordHash: "",
  pricingTiers: [
    { id: "tier_day",     label: "Ban ngày",  start: "05:30", end: "16:30", rate: 70000 },
    { id: "tier_evening", label: "Buổi tối",  start: "16:30", end: "21:00", rate: 120000 },
  ],
  operatingHours: { start: "05:30", end: "21:00", slotMinutes: 30 },
  announcements: [],
  paymentInfo: {
    bankName: "Techcombank",
    accountNumber: "1907 5954 3620 11",
    accountName: "TRAN NGOC QUYET",
    qrImageBase64: "",
  },
  smtpSettings: { notificationEmail: "", smtpEmail: "", gmailAppPassword: "" },
  contactInfo: { phone: "", facebook: "", zalo: "" },
  internalSlots: [
    {
      id: "default_court2_daily",
      courtIds:   [2],
      daysOfWeek: ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],
      startTime:  "16:30",
      endTime:    "19:00",
      reason:     "Luyện tập CLB",
      active:     true,
      createdAt:  0,
    },
    {
      id: "default_court2_weekend",
      courtIds:   [2],
      daysOfWeek: ["saturday","sunday"],
      startTime:  "05:30",
      endTime:    "07:00",
      reason:     "Luyện tập sáng",
      active:     true,
      createdAt:  0,
    },
  ],
};

const SETTINGS_ID = "singleton";

// ─── In-process cache ─────────────────────────────────────────────────────────
// Turso calls are async HTTP in production. We cache the result in memory
// for the lifetime of the server process so reads (which happen on every
// request to /api/booking-config etc.) don't pay a network round-trip every
// time. The cache is invalidated on every write.

let _cache: ServerSettings | null = null;

async function readSettings(): Promise<ServerSettings> {
  if (_cache) return _cache;
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT data FROM settings WHERE id = ?`,
    args: [SETTINGS_ID],
  });
  if (res.rows.length === 0) {
    _cache = DEFAULT_SETTINGS;
    return _cache;
  }
  try {
    const saved = JSON.parse(String(res.rows[0].data));
    _cache = mergeWithDefaults(saved);
    return _cache;
  } catch {
    _cache = DEFAULT_SETTINGS;
    return _cache;
  }
}

function mergeWithDefaults(saved: Partial<ServerSettings>): ServerSettings {
  const merged: ServerSettings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    pricingTiers:   saved.pricingTiers   ?? DEFAULT_SETTINGS.pricingTiers,
    operatingHours: { ...DEFAULT_SETTINGS.operatingHours, ...(saved.operatingHours ?? {}) },
    paymentInfo:    { ...DEFAULT_SETTINGS.paymentInfo,    ...(saved.paymentInfo    ?? {}) },
    announcements:  saved.announcements  ?? [],
    smtpSettings:   { ...DEFAULT_SETTINGS.smtpSettings,   ...(saved.smtpSettings  ?? {}) },
    contactInfo:    { ...DEFAULT_SETTINGS.contactInfo,     ...(saved.contactInfo   ?? {}) },
    // If the saved row pre-dates the internalSlots field (field absent or null in the JSON blob),
    // fall back to DEFAULT_SETTINGS.internalSlots which contains the two built-in Court 2 rules.
    // Only use an empty array when the admin has explicitly saved an empty array (field present
    // in the JSON but length === 0 after deliberate deletions).
    internalSlots: saved.internalSlots !== undefined ? saved.internalSlots : DEFAULT_SETTINGS.internalSlots,
  };
  // Migration: old single ownerEmail → split into notificationEmail + smtpEmail
  const legacySingle = saved.smtpSettings?.ownerEmail ?? saved.ownerEmail ?? "";
  if (legacySingle) {
    if (!merged.smtpSettings.notificationEmail) merged.smtpSettings.notificationEmail = legacySingle;
    if (!merged.smtpSettings.smtpEmail)         merged.smtpSettings.smtpEmail         = legacySingle;
  }
  return merged;
}

async function writeSettings(next: ServerSettings): Promise<void> {
  await ensureSchema();
  const db = getDb();
  const data = JSON.stringify(next);
  await db.execute({
    sql: `INSERT INTO settings (id, data) VALUES (?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    args: [SETTINGS_ID, data],
  });
  _cache = next;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Synchronous read — uses in-process cache after first async load.
 *  Call ensureSettingsLoaded() at the top of any route that needs settings
 *  before calling getServerSettings(). */
export function getServerSettings(): ServerSettings {
  return _cache ?? DEFAULT_SETTINGS;
}

/** Must be awaited once per request before getServerSettings() is called.
 *  Subsequent calls within the same process are instant (cache hit). */
export async function ensureSettingsLoaded(): Promise<ServerSettings> {
  return readSettings();
}

export async function updateServerSettings(patch: Partial<ServerSettings>): Promise<ServerSettings> {
  const current = await readSettings();
  const normalizedPatch = deepNormalize(patch);
  const next = { ...current, ...normalizedPatch };
  await writeSettings(next);
  return next;
}

export function getActiveAnnouncements(): Announcement[] {
  const settings = getServerSettings();
  const todayStr = new Date().toISOString().split("T")[0];
  return settings.announcements.filter((a) => {
    const afterStart = !a.startDate || a.startDate <= todayStr;
    const beforeEnd  = !a.endDate   || a.endDate   >= todayStr;
    return afterStart && beforeEnd;
  });
}

export function getLegacyAnnouncement(): string | null {
  const active = getActiveAnnouncements();
  if (active.length === 0) return null;
  return active.map((a) => {
    let msg = a.message;
    if (a.affectedTimeStart && a.affectedTimeEnd) msg += ` (${a.affectedTimeStart}–${a.affectedTimeEnd})`;
    return msg;
  }).join(" · ");
}

export async function getEffectiveOperatingHours(): Promise<OperatingHours> {
  const settings = await readSettings();
  const todayStr = new Date().toISOString().split("T")[0];
  if (settings.pendingOperatingHours && settings.pendingOperatingHours.effectiveDate <= todayStr) {
    const promoted = settings.pendingOperatingHours.hours;
    await updateServerSettings({ operatingHours: promoted, pendingOperatingHours: undefined });
    return promoted;
  }
  return settings.operatingHours;
}

export function getActivePricingTiers(): PricingTier[] {
  const { pricingTiers } = getServerSettings();
  const todayStr = new Date().toISOString().split("T")[0];
  const eligible = pricingTiers.filter((t) => !t.effectiveDate || t.effectiveDate <= todayStr);
  const byRange = new Map<string, PricingTier>();
  for (const tier of eligible) {
    const key = `${tier.start}-${tier.end}`;
    const existing = byRange.get(key);
    if (!existing) { byRange.set(key, tier); continue; }
    const existingDate  = existing.effectiveDate ?? "";
    const candidateDate = tier.effectiveDate     ?? "";
    if (candidateDate > existingDate) byRange.set(key, tier);
  }
  return Array.from(byRange.values()).sort((a, b) => a.start.localeCompare(b.start));
}

/** Returns all active internal (owner-reserved) time slots */
export function getInternalSlots(): InternalSlot[] {
  return getServerSettings().internalSlots.filter((s) => s.active);
}

export function getSmtpCredentials(): { user: string; pass: string } {
  const { smtpSettings } = getServerSettings();
  return {
    user: smtpSettings.smtpEmail        ?? smtpSettings.notificationEmail ?? "",
    pass: smtpSettings.gmailAppPassword ?? "",
  };
}

/** Returns the email address that should RECEIVE owner notifications */
export function getNotificationEmail(): string {
  const { smtpSettings } = getServerSettings();
  return smtpSettings.notificationEmail ?? smtpSettings.smtpEmail ?? "";
}
