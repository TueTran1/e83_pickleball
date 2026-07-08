import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN SESSION (server-side, httpOnly cookie)
// ═════════════════════════════════════════════════════════════════════════════
// The client-only sessionStorage flag used by the admin page UI is fine for
// "stay logged in while clicking around the dashboard," but it's invisible to
// the server — so a server-rendered page like /admin/verify/[groupId] can't
// know whether the visiting browser is an authenticated admin.
//
// This module issues a signed, httpOnly cookie on login. The signature lets
// the server trust the cookie's contents without needing a database-backed
// session store — anyone can read an httpOnly cookie's NAME but the browser
// won't expose its VALUE to JS, and even if someone copied the value, they
// can't forge a new valid one without ADMIN_SESSION_SECRET.
// ═════════════════════════════════════════════════════════════════════════════

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "E83admin@2026";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? "e83-dev-secret-change-in-production";
const COOKIE_NAME = "e83_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(value: string): string {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function buildToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expires}`;
  const signature = sign(payload);
  return `${payload}:${signature}`;
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [role, expiresStr, signature] = parts;
  const expires = Number(expiresStr);
  if (role !== "admin" || Number.isNaN(expires) || Date.now() > expires) return false;

  const expectedSignature = sign(`${role}:${expiresStr}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Server Component / Route Handler check: is the current request from a logged-in admin? */
export function isAdminSession(): boolean {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifyToken(token);
}

/** Call from a Route Handler after verifying the password, to set the session cookie */
export function createAdminSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: buildToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export function clearAdminSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
