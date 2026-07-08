import { NextResponse } from "next/server";
import { ensureSettingsLoaded, getServerSettings } from "@/lib/serverSettings";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSettingsLoaded();
  const { paymentInfo } = getServerSettings();
  const { qrImageBase64, ...rest } = paymentInfo;
  return NextResponse.json({ ...rest, qrImageBase64: qrImageBase64 ?? null });
}
