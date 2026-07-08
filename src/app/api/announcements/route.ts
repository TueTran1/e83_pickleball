import { NextResponse } from "next/server";
import { ensureSettingsLoaded, getActiveAnnouncements } from "@/lib/serverSettings";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSettingsLoaded();
  return NextResponse.json({ announcements: getActiveAnnouncements() });
}
