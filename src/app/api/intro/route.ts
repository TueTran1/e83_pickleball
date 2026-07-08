import { NextResponse } from "next/server";
import { getPublishedDraft } from "@/lib/cms";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

export async function GET() {
  const draft = await getPublishedDraft();
  return NextResponse.json({ draft });
}
