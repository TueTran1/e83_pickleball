import { NextResponse } from "next/server";
import { ensureSettingsLoaded, getServerSettings } from "@/lib/serverSettings";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

// Public — exposes only phone/facebook/zalo, never sensitive fields
export async function GET() {
  await ensureSettingsLoaded();
  const { contactInfo } = getServerSettings();
  return NextResponse.json(contactInfo ?? { phone: "", facebook: "", zalo: "" });
}
