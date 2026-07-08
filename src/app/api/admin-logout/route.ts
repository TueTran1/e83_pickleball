import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/adminSession";

export async function POST() {
  const res = NextResponse.json({ success: true });
  const cookie = clearAdminSessionCookie();
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
