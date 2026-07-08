import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminSession";
import { ensureSettingsLoaded, getServerSettings, updateServerSettings, Announcement, InternalSlot } from "@/lib/serverSettings";
import { createHmac } from "crypto";
import { ADMIN_PASSWORD } from "@/lib/adminSession";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

function auth() {
  if (!isAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

function hashPassword(pw: string): string {
  return createHmac("sha256", "e83-pw-salt").update(pw).digest("hex");
}

function maskSmtp(settings: ReturnType<typeof getServerSettings>) {
  const s = settings.smtpSettings;
  // Support legacy single-field installs during migration
  const legacySingle = s?.ownerEmail ?? "";
  return {
    notificationEmail:      s?.notificationEmail ?? legacySingle,
    smtpEmail:              s?.smtpEmail         ?? legacySingle,
    gmailAppPasswordMasked: s?.gmailAppPassword
      ? `${s.gmailAppPassword.slice(0, 4)}${"*".repeat(12)}`
      : "",
    hasPassword: Boolean(s?.gmailAppPassword),
  };
}

export async function GET() {
  const deny = auth(); if (deny) return deny;
  await ensureSettingsLoaded();
  const settings = getServerSettings();
  const { adminPasswordHash: _, ...safe } = settings;
  return NextResponse.json({ ...safe, smtpSettings: maskSmtp(settings) });
}

export async function POST(request: NextRequest) {
  const deny = auth(); if (deny) return deny;
  await ensureSettingsLoaded();
  const body = await request.json();
  const { action } = body;

  if (action === "update") {
    const patch: Record<string, unknown> = {};
    if ("bookingLocked"  in body) patch.bookingLocked  = body.bookingLocked;
    if ("pricingTiers"   in body) patch.pricingTiers   = body.pricingTiers;
    if ("operatingHours" in body) patch.operatingHours = body.operatingHours;
    if ("paymentInfo"    in body) patch.paymentInfo    = body.paymentInfo;
    if ("contactInfo"    in body) patch.contactInfo    = body.contactInfo;
    if ("internalSlots"  in body) patch.internalSlots  = body.internalSlots;

    if ("smtpSettings" in body) {
      const smtp = body.smtpSettings as {
        notificationEmail?: string;
        smtpEmail?: string;
        gmailAppPassword?: string;
      };

      if (smtp.gmailAppPassword && smtp.gmailAppPassword !== "__UNCHANGED__") {
        const pass = smtp.gmailAppPassword.replace(/\s/g, "");
        if (pass.length !== 16) {
          return NextResponse.json({ error: "Gmail App Password phải có đúng 16 ký tự." }, { status: 400 });
        }
        smtp.gmailAppPassword = pass;
      } else if (smtp.gmailAppPassword === "__UNCHANGED__") {
        const current = getServerSettings();
        smtp.gmailAppPassword = current.smtpSettings?.gmailAppPassword ?? "";
      }

      // Merge into existing smtpSettings so unset fields aren't wiped
      const current = getServerSettings();
      patch.smtpSettings = { ...current.smtpSettings, ...smtp };
      // Keep ownerEmail for backward compat with older installations
      if (smtp.notificationEmail) patch.ownerEmail = smtp.notificationEmail;
    }

    const updated = await updateServerSettings(patch);
    const { adminPasswordHash: _h, ...safe } = updated;
    return NextResponse.json({ ...safe, smtpSettings: maskSmtp(updated) });
  }

  if (action === "changePassword") {
    const { currentPassword, newPassword, confirmPassword } = body;
    if (!currentPassword || !newPassword || !confirmPassword)
      return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
    if (newPassword !== confirmPassword)
      return NextResponse.json({ error: "Mật khẩu mới không khớp" }, { status: 400 });
    if (newPassword.length < 8)
      return NextResponse.json({ error: "Mật khẩu mới phải có ít nhất 8 ký tự" }, { status: 400 });
    const settings = getServerSettings();
    const expectedHash = settings.adminPasswordHash || hashPassword(ADMIN_PASSWORD);
    if (hashPassword(currentPassword) !== expectedHash)
      return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 403 });
    await updateServerSettings({ adminPasswordHash: hashPassword(newPassword) });
    return NextResponse.json({ ok: true });
  }

  if (action === "addAnnouncement") {
    const { message, startDate, endDate, affectedTimeStart, affectedTimeEnd } = body;
    if (!message) return NextResponse.json({ error: "Missing message" }, { status: 400 });
    const settings = getServerSettings();
    const ann: Announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      message, startDate: startDate ?? "", endDate: endDate ?? "",
      affectedTimeStart: affectedTimeStart ?? undefined,
      affectedTimeEnd:   affectedTimeEnd   ?? undefined,
      createdAt: Date.now(),
    };
    await updateServerSettings({ announcements: [...settings.announcements, ann] });
    return NextResponse.json({ announcement: ann });
  }

  if (action === "updateAnnouncement") {
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const settings = getServerSettings();
    const updated = settings.announcements.map((a) => a.id === id ? { ...a, ...patch } : a);
    await updateServerSettings({ announcements: updated });
    return NextResponse.json({ ok: true });
  }

  if (action === "deleteAnnouncement") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const settings = getServerSettings();
    await updateServerSettings({ announcements: settings.announcements.filter((a) => a.id !== id) });
    return NextResponse.json({ ok: true });
  }

  if (action === "addInternalSlot") {
    const { startTime, endTime, reason, courtIds, daysOfWeek } = body;
    if (!startTime || !endTime) return NextResponse.json({ error: "Missing startTime or endTime" }, { status: 400 });
    if (!courtIds?.length)      return NextResponse.json({ error: "Missing courtIds" },            { status: 400 });
    if (!daysOfWeek?.length)    return NextResponse.json({ error: "Missing daysOfWeek" },          { status: 400 });
    const settings = getServerSettings();
    const slot: InternalSlot = {
      id: `isl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      courtIds,
      daysOfWeek,
      startTime,
      endTime,
      reason: reason ?? "",
      active: true,
      createdAt: Date.now(),
    };
    await updateServerSettings({ internalSlots: [...settings.internalSlots, slot] });
    return NextResponse.json({ slot });
  }

  if (action === "updateInternalSlot") {
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const settings = getServerSettings();
    const updated = settings.internalSlots.map((s) => s.id === id ? { ...s, ...patch } : s);
    await updateServerSettings({ internalSlots: updated });
    return NextResponse.json({ ok: true });
  }

  if (action === "deleteInternalSlot") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const settings = getServerSettings();
    await updateServerSettings({ internalSlots: settings.internalSlots.filter((s) => s.id !== id) });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
