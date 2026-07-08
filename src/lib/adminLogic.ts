// ─── Admin Settings ───────────────────────────────────────────────────────────
// In production, these would be fetched from a database / CMS.
// For now they are stored in localStorage (client) or a simple JSON (server).

export interface AdminSettings {
  bookingLocked: boolean;
  announcement: string | null;
}

const DEFAULT_SETTINGS: AdminSettings = {
  bookingLocked: false,
  announcement: null,
};

export const getAdminSettings = (): AdminSettings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem("admin_settings");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const isBookingLocked = (): boolean => getAdminSettings().bookingLocked;
export const getAnnouncement = (): string | null => getAdminSettings().announcement;
