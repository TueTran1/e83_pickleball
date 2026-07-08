import { NextRequest, NextResponse } from "next/server";

// ─── Web Crypto HMAC verification ────────────────────────────────────────────
// Middleware runs in the Edge runtime — no Node.js `crypto` module available.
// We use the Web Crypto API (globalThis.crypto) which is available everywhere.

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? "e83-dev-secret-change-in-production";
const COOKIE_NAME    = "e83_admin_session";

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [role, expiresStr, signature] = parts;
  const expires = Number(expiresStr);
  if (role !== "admin" || Number.isNaN(expires) || Date.now() > expires) return false;

  try {
    const expectedHex = await hmacHex(SESSION_SECRET, `${role}:${expiresStr}`);
    return timingSafeEqual(hexToBytes(signature), hexToBytes(expectedHex));
  } catch {
    return false;
  }
}

// ─── Route patterns ────────────────────────────────────────────────────────────

const ADMIN_ROUTES    = [/^\/admin(\/|$)/];
const CUSTOMER_ROUTES = [/^\/booking(\/|$)/, /^\/monthly(\/|$)/, /^\/checkout(\/|$)/, /^\/intro(\/|$)/];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static/API pass-through
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.match(/\.(ico|jpg|jpeg|png|gif|svg|webp)$/)
  ) {
    return NextResponse.next();
  }

  const token    = request.cookies.get(COOKIE_NAME)?.value;
  const isAdmin  = await verifyAdminToken(token);
  const wantsAdmin    = ADMIN_ROUTES.some((r)    => r.test(pathname));
  const wantsCustomer = CUSTOMER_ROUTES.some((r) => r.test(pathname));

  // Admin on customer page → redirect to admin dashboard
  if (isAdmin && wantsCustomer) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Unauthenticated on admin page → let layout handle auth gate
  // (the verify page handles its own inline login, so we never hard-block admin routes
  //  at the middleware level — we let the layout's client-side auth check handle it,
  //  which gives a better UX than a middleware redirect loop)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:jpg|jpeg|png|gif|svg|ico|webp)).*)",
  ],
};
