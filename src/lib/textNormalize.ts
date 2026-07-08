// ─── Vietnamese / Unicode text normalization ──────────────────────────────────
//
// Vietnamese text can arrive in different Unicode normalization forms depending
// on the OS, keyboard, or browser the admin used to type it (e.g. macOS often
// produces NFD — decomposed accents — while Windows/Android usually produce NFC
// — precomposed accents). If text is stored in mixed forms, two strings that
// LOOK identical on screen can fail equality checks, search/filter incorrectly,
// or in rare font-rendering edge cases show tone marks as separated from the
// base character.
//
// The fix: always normalize to NFC (Normalization Form C — precomposed, the
// form virtually all fonts and rendering engines expect) at the moment text
// is written to storage. This file is the single place that does that, so
// every settings/CMS/booking write goes through the same rule.

/** Normalize a single string to NFC. Safe to call on already-NFC text (no-op). */
export function normalizeText(value: string): string {
  if (typeof value !== "string") return value;
  return value.normalize("NFC");
}

/**
 * Recursively walk an object/array/string and normalize every string value
 * to NFC. Non-string values (numbers, booleans, null) pass through unchanged.
 * Use this at the boundary where user-submitted JSON is about to be persisted.
 */
export function deepNormalize<T>(value: T): T {
  if (typeof value === "string") {
    return normalizeText(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepNormalize(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepNormalize(v);
    }
    return out as T;
  }
  return value;
}
