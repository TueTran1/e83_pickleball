import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PASSWORD, createAdminSessionCookie } from "@/lib/adminSession";
import { getServerSettings , ensureSettingsLoaded } from "@/lib/serverSettings";
import { createHmac } from "crypto";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

function hashPassword(pw: string): string {
  return createHmac("sha256", "e83-pw-salt").update(pw).digest("hex");
}

export async function POST(request: NextRequest) {
  await ensureSettingsLoaded();
  const body = await request.json();
  const { password } = body as { password?: string };

  if (!password) {
    return NextResponse.json({ error: "Thiếu mật khẩu" }, { status: 400 });
  }

  // Check against stored hash first (admin may have changed password via settings)
  const settings = getServerSettings();
  let valid = false;

  if (settings.adminPasswordHash) {
    // Compare against stored hash
    valid = hashPassword(password) === settings.adminPasswordHash;
  } else {
    // Fall back to env/default password
    valid = password === ADMIN_PASSWORD;
  }

  if (!valid) {
    return NextResponse.json({ error: "Mật khẩu không đúng" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  const cookie = createAdminSessionCookie();
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
