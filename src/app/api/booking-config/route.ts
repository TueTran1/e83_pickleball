import { NextResponse } from "next/server";
import {
  ensureSettingsLoaded,
  getServerSettings,
  getEffectiveOperatingHours,
  getActivePricingTiers,
  getInternalSlots,
} from "@/lib/serverSettings";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

// Public endpoint — no auth required.
// Exposes non-sensitive config used by customer booking pages.
export async function GET() {
  await ensureSettingsLoaded();
  const settings      = getServerSettings();
  const operatingHours = await getEffectiveOperatingHours();
  const pricingTiers   = getActivePricingTiers();
  const internalSlots  = getInternalSlots();

  return NextResponse.json({
    bookingLocked: settings.bookingLocked,
    operatingHours,
    pricingTiers,
    internalSlots,
  });
}
