import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminSession";

export async function GET() {
  return NextResponse.json({ authed: isAdminSession() });
}
