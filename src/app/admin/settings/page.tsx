"use client";

import React, { useEffect, useState } from "react";
import { ServerSettings, Announcement, PricingTier, InternalSlot, DayOfWeek } from "@/lib/serverSettings";
import { useToast } from "@/app/admin/layout";

type SettingsTab = "account" | "hours" | "announcements" | "payment" | "contact";

const TAB_LABELS: Record<SettingsTab, string> = {
  account:       "Tài khoản",
  hours:         "Lịch & Giá",
  announcements: "Thông báo",
  payment:       "Thanh toán",
  contact:       "Liên hệ",
};

const genId = () => `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function validatePricingTiers(tiers: PricingTier[], opStart: string, opEnd: string): string | null {
  if (tiers.length === 0) return "Cần ít nhất một khung giá.";
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (toMinutes(t.start) < toMinutes(opStart)) return `Khung giá "${t.label}": giờ bắt đầu phải từ ${opStart}.`;
    if (toMinutes(t.end) > toMinutes(opEnd)) return `Khung giá "${t.label}": giờ kết thúc không vượt quá ${opEnd}.`;
    if (toMinutes(t.start) >= toMinutes(t.end)) return `Khung giá "${t.label}": giờ bắt đầu phải nhỏ hơn giờ kết thúc.`;
  }
  if (tiers[0].start !== opStart) return `Khung giá đầu tiên phải bắt đầu từ ${opStart}.`;
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].start !== tiers[i - 1].end)
      return `Khung giá "${tiers[i].label}" phải bắt đầu lúc ${tiers[i - 1].end}.`;
  }
  if (tiers[tiers.length - 1].end !== opEnd)
    return `Khung giá cuối cùng phải kết thúc lúc ${opEnd} (giờ đóng cửa).`;
  return null;
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-5 space-y-4">
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, error, desc }: { label: string; children: React.ReactNode; error?: string; desc?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</label>
      {desc && <p className="text-[10px] text-slate-600 leading-relaxed">{desc}</p>}
      {children}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full bg-[#0E2A21] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-jade transition";

function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const options: string[] = [];
  for (let m = 0; m <= 24 * 60; m += 30) {
    const h   = String(Math.floor(m / 60)).padStart(2, "0");
    const min = String(m % 60).padStart(2, "0");
    options.push(`${h}:${min}`);
  }
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls + " appearance-none"}>
        {options.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </Field>
  );
}

function annStatus(a: Announcement): { label: string; color: string } {
  const today = new Date().toISOString().split("T")[0];
  const after = !a.startDate || a.startDate <= today;
  const before = !a.endDate || a.endDate >= today;
  if (after && before) return { label: "Đang hiển thị", color: "text-jade" };
  if (a.startDate && a.startDate > today) return { label: "Chưa bắt đầu", color: "text-amber-400" };
  return { label: "Đã kết thúc", color: "text-slate-500" };
}

function TierRow({ tier, idx, opStart, opEnd, onChange, onDelete, prevEndTime }: {
  tier: PricingTier; idx: number; opStart: string; opEnd: string;
  onChange: (t: PricingTier) => void; onDelete: () => void; prevEndTime?: string;
}) {
  const upd = (p: Partial<PricingTier>) => onChange({ ...tier, ...p });
  useEffect(() => {
    if (idx === 0 && tier.start !== opStart) upd({ start: opStart });
    else if (idx > 0 && prevEndTime && tier.start !== prevEndTime) upd({ start: prevEndTime });
  }, [opStart, prevEndTime]);
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <input type="text" value={tier.label} onChange={(e) => upd({ label: e.target.value })}
          placeholder="Nhãn khung giá..." className="bg-transparent text-sm font-semibold text-jade outline-none flex-1 mr-2" />
        <button type="button" onClick={onDelete} className="text-red-400/60 hover:text-red-400 transition text-xs">Xóa</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TimeSelect label="Từ" value={tier.start} onChange={(v) => upd({ start: v })} />
        <TimeSelect label="Đến" value={tier.end} onChange={(v) => upd({ end: v })} />
        <Field label="Đơn giá (VND/giờ)">
          <input type="number" value={tier.rate} onChange={(e) => upd({ rate: Number(e.target.value) })} className={inputCls} />
        </Field>
        <Field label="Cuối tuần (VND/giờ, bỏ trống = giống thường)">
          <input type="number" value={tier.weekendRate ?? ""} onChange={(e) => upd({ weekendRate: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Như ngày thường" className={inputCls} />
        </Field>
        <div className="col-span-2">
          <Field label="Ngày hiệu lực (để trống = hiệu lực ngay)">
            <input type="date" value={tier.effectiveDate ?? ""} onChange={(e) => upd({ effectiveDate: e.target.value || undefined })} className={inputCls} />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ─── Email Test Panel ─────────────────────────────────────────────────────────

function EmailTestPanel() {
  const [testTo, setTestTo] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean; message?: string; error?: string; hint?: string;
    credStatus?: Record<string, string>; smtpResponse?: string;
  } | null>(null);

  const runTest = async () => {
    if (!testTo) return;
    setTesting(true); setResult(null);
    try {
      const res = await fetch("/api/admin-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      setResult(await res.json());
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">Kiểm tra gửi email</p>
        <p className="text-[11px] text-slate-500 mt-0.5">Gửi email test để xác nhận Gmail SMTP hoạt động đúng.</p>
      </div>
      <div className="flex gap-2">
        <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)}
          placeholder="Nhập email nhận thử..."
          className="flex-1 rounded-xl bg-[#0E2A21] border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-jade" />
        <button type="button" onClick={runTest} disabled={testing || !testTo}
          className="rounded-xl bg-jade px-4 py-2.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light transition disabled:opacity-50 shrink-0">
          {testing ? "Đang gửi..." : "Gửi test"}
        </button>
      </div>
      {result && (
        <div className={`rounded-xl border p-3 space-y-2 text-xs ${result.ok ? "border-jade/30 bg-jade/8" : "border-red-500/30 bg-red-500/8"}`}>
          <p className={`font-bold ${result.ok ? "text-jade" : "text-red-400"}`}>
            {result.ok ? "Gửi thành công!" : "Gửi thất bại"}
          </p>
          {result.message && <p className="text-slate-300">{result.message}</p>}
          {result.error && <p className="text-red-300 font-mono text-[10px] break-all">{result.error}</p>}
          {result.smtpResponse && <p className="text-slate-500 font-mono text-[10px] break-all">SMTP: {result.smtpResponse}</p>}
          {result.hint && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-amber-300 text-[11px] leading-relaxed">{result.hint}</p>
            </div>
          )}
          {result.credStatus && (
            <div className="border-t border-white/8 pt-2 space-y-1">
              <p className="text-[9px] uppercase tracking-widest text-slate-600 font-semibold">Thông tin đã cấu hình</p>
              {Object.entries(result.credStatus).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-slate-500 font-mono text-[10px]">{k}</span>
                  <span className={`font-mono text-[10px] ${String(v).includes("not set") ? "text-red-400" : "text-slate-300"}`}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<SettingsTab>("account");
  const [loading, setLoading] = useState(true);

  // SMTP / Email
  const [notificationEmail, setNotificationEmail] = useState("");
  const [smtpEmail, setSmtpEmail]                 = useState("");
  const [appPassword, setAppPassword]             = useState("");
  const [appPasswordError, setAppPasswordError]   = useState<string | null>(null);
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [showPassword, setShowPassword]           = useState(false);

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError]     = useState<string | null>(null);

  // Pricing
  const [tiers, setTiers]               = useState<PricingTier[]>([]);
  const [opStart, setOpStart]           = useState("05:30");
  const [opEnd, setOpEnd]               = useState("21:00");
  const [pricingError, setPricingError] = useState<string | null>(null);

  // Hours
  const [hoursStart, setHoursStart]         = useState("05:30");
  const [hoursEnd, setHoursEnd]             = useState("21:00");
  const [slotMins, setSlotMins]             = useState(30);
  const [hoursEffective, setHoursEffective] = useState("");

  // Internal slots
  const [internalSlots, setInternalSlots]       = useState<InternalSlot[]>([]);
  const [newSlot, setNewSlot] = useState<{
    courtIds: (1|2)[];
    daysOfWeek: DayOfWeek[];
    startTime: string;
    endTime: string;
    reason: string;
  }>({
    courtIds: [2],
    daysOfWeek: ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],
    startTime: "08:00",
    endTime: "09:00",
    reason: "",
  });
  const [slotError, setSlotError]               = useState<string | null>(null);

  // Contact info
  const [contactPhone, setContactPhone]       = useState("");
  const [contactFacebook, setContactFacebook] = useState("");
  const [contactZalo, setContactZalo]         = useState("");
  const [contactError, setContactError]       = useState<string | null>(null);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [editingAnn, setEditingAnn]       = useState<Announcement | null>(null);
  const [newAnn, setNewAnn] = useState({ message: "", startDate: "", endDate: "", affectedTimeStart: "", affectedTimeEnd: "" });

  // Payment
  const [bankName, setBankName]           = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName]     = useState("");
  const [qrImageBase64, setQrImageBase64] = useState<string>("");
  const [qrUploading, setQrUploading]     = useState(false);

  useEffect(() => {
    fetch("/api/admin-settings")
      .then((r) => r.json())
      .then((data: Partial<ServerSettings> & { smtpSettings?: { ownerEmail: string; gmailAppPasswordMasked: string; hasPassword: boolean } }) => {
        const smtp = data.smtpSettings as {
          notificationEmail?: string;
          smtpEmail?: string;
          ownerEmail?: string; // legacy
          hasPassword?: boolean;
        } | undefined;
        // Support legacy single-email installs
        const legacySingle = smtp?.ownerEmail ?? "";
        setNotificationEmail(smtp?.notificationEmail ?? legacySingle);
        setSmtpEmail(smtp?.smtpEmail ?? legacySingle);
        setHasStoredPassword(smtp?.hasPassword ?? false);

        const tList = data.pricingTiers ?? [];
        setTiers(tList);
        const oh = data.operatingHours ?? { start: "05:30", end: "21:00", slotMinutes: 30 };
        setContactPhone(data.contactInfo?.phone ?? "");
        setContactFacebook(data.contactInfo?.facebook ?? "");
        setContactZalo(data.contactInfo?.zalo ?? "");
        setInternalSlots(data.internalSlots ?? []);
        setOpStart(oh.start); setOpEnd(oh.end);
        setHoursStart(oh.start); setHoursEnd(oh.end); setSlotMins(oh.slotMinutes ?? 30);
        setAnnouncements(data.announcements ?? []);
        const pi = data.paymentInfo ?? { bankName: "", accountNumber: "", accountName: "", qrImageBase64: "" };
        setBankName(pi.bankName ?? "");
        setAccountNumber(pi.accountNumber ?? "");
        setAccountName(pi.accountName ?? "");
        setQrImageBase64((pi as { qrImageBase64?: string }).qrImageBase64 ?? "");
      })
      .catch(() => showToast("Không thể tải cài đặt.", "error"))
      .finally(() => setLoading(false));
  }, []);

  const post = async (body: object): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Lưu thất bại", "error"); return false; }
      return true;
    } catch { showToast("Lưu thất bại", "error"); return false; }
  };

  // Save SMTP settings
  const saveSmtp = async () => {
    setAppPasswordError(null);
    const cleanPass = appPassword.replace(/\s/g, "");
    if (cleanPass && cleanPass.length !== 16) {
      setAppPasswordError("Gmail App Password phải có đúng 16 ký tự.");
      return;
    }
    const smtpPayload = {
      notificationEmail,
      smtpEmail,
      gmailAppPassword: cleanPass || "__UNCHANGED__",
    };
    if (await post({ action: "update", smtpSettings: smtpPayload })) {
      showToast("Đã lưu cấu hình email", "success");
      if (cleanPass) { setAppPassword(""); setHasStoredPassword(true); }
    }
  };

  const changePw = async () => {
    setPwError(null);
    if (!currentPw || !newPw || !confirmPw) { setPwError("Vui lòng điền đầy đủ thông tin"); return; }
    const res = await fetch("/api/admin-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "changePassword", currentPassword: currentPw, newPassword: newPw, confirmPassword: confirmPw }),
    });
    const d = await res.json();
    if (!res.ok) { setPwError(d.error ?? "Thất bại"); return; }
    showToast("Đổi mật khẩu thành công", "success");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
  };

  const savePricing = async () => {
    setPricingError(null);
    const err = validatePricingTiers(tiers, opStart, opEnd);
    if (err) { setPricingError(err); return; }
    if (await post({ action: "update", pricingTiers: tiers }))
      showToast("Đã cập nhật bảng giá", "success");
  };

  const saveHours = async () => {
    if (toMinutes(hoursStart) >= toMinutes(hoursEnd)) { showToast("Giờ mở cửa phải nhỏ hơn giờ đóng cửa", "error"); return; }
    const body: Record<string, unknown> = { action: "update", operatingHours: { start: hoursStart, end: hoursEnd, slotMinutes: slotMins } };
    if (hoursEffective) body.hoursEffectiveDate = hoursEffective;
    if (await post(body)) {
      setOpStart(hoursStart); setOpEnd(hoursEnd);
      showToast(hoursEffective ? `Giờ hoạt động sẽ thay đổi từ ${hoursEffective}` : "Đã cập nhật giờ hoạt động", "success");
    }
  };

  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  const validateSlot = (s: string, e: string, courts: (1|2)[], days: DayOfWeek[]): string | null => {
    if (toMin(s) >= toMin(e))         return "Giờ bắt đầu phải nhỏ hơn giờ kết thúc";
    if (toMin(s) < toMin(hoursStart)) return `Phải nằm trong giờ hoạt động (${hoursStart}–${hoursEnd})`;
    if (toMin(e) > toMin(hoursEnd))   return `Phải nằm trong giờ hoạt động (${hoursStart}–${hoursEnd})`;
    if (courts.length === 0)          return "Vui lòng chọn ít nhất một sân";
    if (days.length === 0)            return "Vui lòng chọn ít nhất một ngày";
    const overlaps = internalSlots.some((sl) =>
      sl.courtIds.some((c) => courts.includes(c)) &&
      sl.daysOfWeek.some((d) => days.includes(d)) &&
      toMin(s) < toMin(sl.endTime) && toMin(e) > toMin(sl.startTime)
    );
    if (overlaps) return "Khung giờ này trùng với một khung giờ nội bộ khác (cùng sân + ngày)";
    return null;
  };

  const addInternalSlot = async () => {
    setSlotError(null);
    const err = validateSlot(newSlot.startTime, newSlot.endTime, newSlot.courtIds, newSlot.daysOfWeek);
    if (err) { setSlotError(err); return; }
    const ok = await post({ action: "addInternalSlot", ...newSlot });
    if (ok) {
      setNewSlot({ courtIds: [2], daysOfWeek: ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"], startTime: "08:00", endTime: "09:00", reason: "" });
      const data = await fetch("/api/admin-settings").then((r) => r.json());
      setInternalSlots(data.internalSlots ?? []);
      showToast("Đã thêm khung giờ nội bộ");
    }
  };

  const deleteInternalSlot = async (id: string) => {
    if (await post({ action: "deleteInternalSlot", id })) {
      setInternalSlots(internalSlots.filter((s) => s.id !== id));
      showToast("Đã xóa khung giờ nội bộ");
    }
  };

  const addAnn = async () => {
    if (!newAnn.message.trim()) return;
    const res = await fetch("/api/admin-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addAnnouncement", ...newAnn }),
    });
    const d = await res.json();
    if (d.announcement) {
      setAnnouncements((prev) => [d.announcement, ...prev]);
      setNewAnn({ message: "", startDate: "", endDate: "", affectedTimeStart: "", affectedTimeEnd: "" });
      showToast("Đã thêm thông báo", "success");
    }
  };

  const updateAnn = async (a: Announcement) => {
    if (await post({ action: "updateAnnouncement", ...a })) {
      setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? a : x)));
      setEditingAnn(null);
      showToast("Đã cập nhật thông báo", "success");
    }
  };

  const deleteAnn = async (id: string) => {
    if (await post({ action: "deleteAnnouncement", id })) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      showToast("Đã xóa thông báo", "success");
    }
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setQrImageBase64(reader.result as string);
      setQrUploading(false);
    };
    reader.onerror = () => setQrUploading(false);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const savePayment = async () => {
    if (await post({ action: "update", paymentInfo: { bankName, accountNumber, accountName, qrImageBase64 } }))
      showToast("Đã cập nhật thông tin thanh toán", "success");
  };

  const saveContact = async () => {
    setContactError(null);
    const phone    = contactPhone.trim();
    const facebook = contactFacebook.trim();
    const zalo     = contactZalo.trim();

    if (phone && !/^(\+84|0)[0-9]{8,10}$/.test(phone.replace(/\s/g, ""))) {
      setContactError("Số điện thoại không hợp lệ. Ví dụ: 0901234567 hoặc +84901234567");
      return;
    }
    if (facebook && !/^https?:\/\//.test(facebook)) {
      setContactError("Facebook phải là URL hợp lệ (bắt đầu bằng https://)");
      return;
    }
    if (await post({ action: "update", contactInfo: { phone, facebook, zalo } }))
      showToast("Đã lưu thông tin liên hệ");
    else
      showToast("Lưu thất bại", "error");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 rounded-full border-2 border-jade/30 border-t-jade animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tab bar */}
      <div className="flex overflow-x-auto scrollbar-none gap-1 px-4 py-2 border-b border-white/8 bg-[#0E2A21]">
        {(Object.keys(TAB_LABELS) as SettingsTab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition ${tab === t ? "bg-jade text-[#0E2A21]" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 max-w-2xl mx-auto w-full space-y-5">

        {/* ── Account ── */}
        {tab === "account" && (
          <>
            {/* Email Config — two separate accounts */}
            <Section
              title="Cấu hình Email"
              desc="Tách biệt email nhận thông báo và email dùng để gửi — có thể dùng cùng một địa chỉ hoặc hai địa chỉ khác nhau."
            >
              {/* 1. Notification email */}
              <Field
                label="Email nhận thông báo"
                desc="Nhận cảnh báo thanh toán, đặt sân mới và các thông báo hệ thống gửi đến chủ sân."
              >
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  className={inputCls}
                  placeholder="owner@e83.vn hoặc yourname@gmail.com"
                />
              </Field>

              {/* Divider */}
              <div className="border-t border-white/6 my-1" />

              {/* 2. Sending email */}
              <Field
                label="Email gửi đi (Gmail SMTP)"
                desc="Tài khoản Gmail dùng để gửi email xác nhận đặt sân tới khách hàng. Phải là địa chỉ Gmail thực."
              >
                <input
                  type="email"
                  value={smtpEmail}
                  onChange={(e) => setSmtpEmail(e.target.value)}
                  className={inputCls}
                  placeholder="e83.notifications@gmail.com"
                />
              </Field>

              {/* 3. App Password */}
              <Field
                label={hasStoredPassword ? "App Password Gmail (đã lưu — nhập mới để thay đổi)" : "App Password Gmail (bắt buộc — 16 ký tự)"}
                desc="Dùng kèm với Email gửi đi. Không phải mật khẩu Gmail thông thường."
                error={appPasswordError ?? undefined}
              >
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={appPassword}
                    onChange={(e) => { setAppPassword(e.target.value.replace(/\s/g, "")); setAppPasswordError(null); }}
                    className={`${inputCls} pr-24 font-mono tracking-widest ${appPasswordError ? "border-red-500/60" : ""}`}
                    placeholder={hasStoredPassword ? "Nhập mới để thay đổi..." : "Dán 16 ký tự App Password..."}
                    maxLength={16}
                    autoComplete="off"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className={`text-[10px] tabular-nums font-mono ${appPassword.length === 16 ? "text-jade" : appPassword.length > 0 ? "text-amber-400" : "text-slate-600"}`}>
                      {appPassword.length}/16
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="text-slate-500 hover:text-jade transition p-0.5"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
                          <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.5"/>
                          <path d="M1.5 1.5l11 11" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
                          <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.5"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                {hasStoredPassword && !appPassword && (
                  <p className="text-[10px] text-jade/70 mt-1.5 flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                      <path d="M6 1a2.5 2.5 0 0 1 2.5 2.5V5H3.5V3.5A2.5 2.5 0 0 1 6 1z"/>
                      <rect x="1.5" y="5" width="9" height="6" rx="1.5"/>
                    </svg>
                    App Password đã được lưu. Để trống nếu không muốn thay đổi.
                  </p>
                )}
                {appPassword.length > 0 && appPassword.length !== 16 && (
                  <p className="text-[10px] text-amber-400 mt-1">
                    App Password phải có đúng 16 ký tự (hiện tại: {appPassword.length}).
                  </p>
                )}
              </Field>

              {/* Setup guide */}
              <div className="rounded-xl bg-jade/5 border border-jade/15 px-4 py-3 space-y-2">
                <p className="text-[11px] font-semibold text-jade/80">Cách tạo Gmail App Password:</p>
                <div className="space-y-1 text-[11px] text-slate-400 leading-relaxed">
                  <p>1. Vào <strong className="text-slate-300">myaccount.google.com/security</strong> → bật <strong className="text-slate-300">2-Step Verification</strong></p>
                  <p>2. Vào <strong className="text-slate-300">myaccount.google.com/apppasswords</strong> → tạo mật khẩu ứng dụng</p>
                  <p>3. Chọn tên bất kỳ → sao chép <strong className="text-slate-300">16 ký tự</strong> (bỏ khoảng trắng)</p>
                </div>
              </div>

              <button type="button" onClick={saveSmtp}
                className="rounded-full bg-jade px-5 py-2.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light transition">
                Lưu cấu hình email
              </button>
            </Section>

            <EmailTestPanel />

            {/* Password change */}
            <Section title="Đổi mật khẩu">
              <Field label="Mật khẩu hiện tại">
                <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Mật khẩu mới">
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Xác nhận mật khẩu mới">
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputCls} />
              </Field>
              {pwError && <p className="text-xs text-red-400">{pwError}</p>}
              <button type="button" onClick={changePw}
                className="rounded-full bg-jade px-5 py-2.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light transition">
                Đổi mật khẩu
              </button>
            </Section>
          </>
        )}

        {/* ── Pricing ── */}
        {/* ── Lịch & Giá (merged hours + pricing + internal slots) ── */}
        {tab === "hours" && (
          <div className="space-y-5">

            {/* ── Operating Hours ── */}
            <Section title="Giờ hoạt động" desc="Thay đổi ảnh hưởng toàn bộ bảng giờ và lịch đặt sân.">
              <div className="grid grid-cols-2 gap-3">
                <TimeSelect label="Giờ mở cửa" value={hoursStart} onChange={setHoursStart} />
                <TimeSelect label="Giờ đóng cửa" value={hoursEnd} onChange={setHoursEnd} />
              </div>
              <Field label="Bước slot (phút)">
                <select value={slotMins} onChange={(e) => setSlotMins(Number(e.target.value))} className={inputCls + " appearance-none"}>
                  <option value={30}>30 phút</option>
                  <option value={60}>60 phút</option>
                </select>
              </Field>
              <Field label="Ngày hiệu lực (để trống = áp dụng ngay)">
                <input type="date" value={hoursEffective} onChange={(e) => setHoursEffective(e.target.value)} className={inputCls} />
              </Field>
              <button type="button" onClick={saveHours}
                className="rounded-full bg-jade px-5 py-2.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light transition">
                Lưu giờ hoạt động
              </button>
            </Section>

            {/* ── Pricing Tiers (merged from old Bảng giá tab) ── */}
            <Section title="Bảng giá" desc={`Các khung giá phải nằm trong giờ hoạt động ${opStart}–${opEnd}.`}>
              <div className="rounded-2xl border border-jade/20 bg-jade/5 px-4 py-3 text-xs text-jade/80 leading-relaxed">
                Khung giá đầu tiên bắt đầu từ <strong>{opStart}</strong>. Khung giá cuối cùng kết thúc lúc <strong>{opEnd}</strong>.
              </div>
              {tiers.map((tier, i) => (
                <TierRow key={tier.id} tier={tier} idx={i} opStart={opStart} opEnd={opEnd}
                  prevEndTime={i > 0 ? tiers[i - 1].end : undefined}
                  onChange={(t) => { const n = [...tiers]; n[i] = t; setTiers(n); }}
                  onDelete={() => setTiers(tiers.filter((_, j) => j !== i))} />
              ))}
              {pricingError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-2.5 text-xs text-red-300">{pricingError}</div>
              )}
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => {
                    const prevEnd = tiers.length > 0 ? tiers[tiers.length - 1].end : opStart;
                    setTiers([...tiers, { id: genId(), label: "Khung giờ mới", start: prevEnd, end: opEnd, rate: 70000 }]);
                  }}
                  className="rounded-xl border border-dashed border-white/15 px-4 py-2 text-xs text-slate-500 hover:border-jade/50 hover:text-jade transition">
                  + Thêm khung giá
                </button>
                <button type="button" onClick={savePricing}
                  className="rounded-full bg-jade px-5 py-2.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light transition">
                  Lưu bảng giá
                </button>
              </div>
            </Section>

            {/* ── Internal Time Slots ── */}
            <Section
              title="Khung giờ nội bộ"
              desc="Các khung giờ đặt riêng cho nội bộ — khách hàng không thể đặt sân trong những khung giờ này."
            >
              {/* Existing slots list */}
              {internalSlots.length === 0 && (
                <p className="text-[11px] text-slate-600 italic">Chưa có khung giờ nội bộ nào.</p>
              )}
              {internalSlots.length > 0 && (
                <div className="space-y-2">
                  {internalSlots
                    .slice()
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((slot) => {
                      const DAY_SHORT: Record<string, string> = {
                        monday:"T2", tuesday:"T3", wednesday:"T4",
                        thursday:"T5", friday:"T6", saturday:"T7", sunday:"CN",
                      };
                      const dayStr = slot.daysOfWeek.map((d) => DAY_SHORT[d]).join("·");
                      const courtStr = slot.courtIds.map((c) => `Sân ${c}`).join("+");
                      return (
                        <div key={slot.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="shrink-0 w-2 h-2 rounded-full bg-amber-400 mt-1.5" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white tabular-nums">{slot.startTime} – {slot.endTime}</span>
                                <span className="text-[10px] font-semibold text-jade/80 bg-jade/10 px-2 py-0.5 rounded-full">{courtStr}</span>
                                <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">{dayStr}</span>
                              </div>
                              {slot.reason && <p className="text-[10px] text-slate-500 mt-1 truncate">{slot.reason}</p>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteInternalSlot(slot.id)}
                            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 transition"
                          >
                            Xóa
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Add new internal slot */}
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/2 px-4 py-4 space-y-4">
                <p className="text-[10px] uppercase tracking-widest text-jade/60 font-semibold">Thêm khung giờ nội bộ</p>

                {/* Courts */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Sân áp dụng</p>
                  <div className="flex gap-3 flex-wrap">
                    {([1, 2] as const).map((c) => (
                      <label key={c} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newSlot.courtIds.includes(c)}
                          onChange={(e) => {
                            const ids = e.target.checked
                              ? [...newSlot.courtIds, c]
                              : newSlot.courtIds.filter((x) => x !== c);
                            setNewSlot({ ...newSlot, courtIds: ids });
                          }}
                          className="accent-jade w-3.5 h-3.5"
                        />
                        <span className="text-sm text-white">Sân {c}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Days */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Ngày áp dụng</p>
                    <div className="flex gap-2">
                      {[
                        { label: "Tất cả", days: ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as DayOfWeek[] },
                        { label: "T2–T6",  days: ["monday","tuesday","wednesday","thursday","friday"] as DayOfWeek[] },
                        { label: "T7–CN",  days: ["saturday","sunday"] as DayOfWeek[] },
                      ].map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => setNewSlot({ ...newSlot, daysOfWeek: q.days })}
                          className="text-[9px] px-2 py-1 rounded-full border border-white/15 text-slate-400 hover:border-jade/40 hover:text-jade transition"
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as DayOfWeek[]).map((d) => {
                      const LABELS: Record<DayOfWeek, string> = {
                        monday:"Thứ 2", tuesday:"Thứ 3", wednesday:"Thứ 4",
                        thursday:"Thứ 5", friday:"Thứ 6", saturday:"Thứ 7", sunday:"Chủ nhật",
                      };
                      return (
                        <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newSlot.daysOfWeek.includes(d)}
                            onChange={(e) => {
                              const days = e.target.checked
                                ? [...newSlot.daysOfWeek, d]
                                : newSlot.daysOfWeek.filter((x) => x !== d);
                              setNewSlot({ ...newSlot, daysOfWeek: days });
                            }}
                            className="accent-jade w-3.5 h-3.5"
                          />
                          <span className="text-xs text-slate-300">{LABELS[d]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Times */}
                <div className="grid grid-cols-2 gap-3">
                  <TimeSelect label="Giờ bắt đầu" value={newSlot.startTime} onChange={(v) => setNewSlot({ ...newSlot, startTime: v })} />
                  <TimeSelect label="Giờ kết thúc" value={newSlot.endTime} onChange={(v) => setNewSlot({ ...newSlot, endTime: v })} />
                </div>

                {/* Reason */}
                <Field label="Lý do (tùy chọn)">
                  <input
                    type="text"
                    value={newSlot.reason}
                    onChange={(e) => setNewSlot({ ...newSlot, reason: e.target.value })}
                    placeholder="Vd: Luyện tập CLB, Giải đấu nội bộ, Bảo trì sân..."
                    className={inputCls}
                  />
                </Field>

                {slotError && <p className="text-[11px] text-red-400">{slotError}</p>}

                <button type="button" onClick={addInternalSlot}
                  className="rounded-full bg-jade px-5 py-2.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light transition">
                  + Thêm khung giờ
                </button>
              </div>
            </Section>
          </div>
        )}

        {/* ── Announcements ── */}
        {tab === "announcements" && (
          <>
            <Section title="Tạo thông báo mới">
              <Field label="Nội dung">
                <textarea value={newAnn.message} onChange={(e) => setNewAnn({ ...newAnn, message: e.target.value })}
                  rows={3} placeholder="Nội dung thông báo..." className={inputCls + " resize-none"} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ngày bắt đầu"><input type="date" value={newAnn.startDate} onChange={(e) => setNewAnn({ ...newAnn, startDate: e.target.value })} className={inputCls} /></Field>
                <Field label="Ngày kết thúc"><input type="date" value={newAnn.endDate} onChange={(e) => setNewAnn({ ...newAnn, endDate: e.target.value })} className={inputCls} /></Field>
                <TimeSelect label="Giờ ảnh hưởng (từ)" value={newAnn.affectedTimeStart || "05:30"} onChange={(v) => setNewAnn({ ...newAnn, affectedTimeStart: v })} />
                <TimeSelect label="Giờ ảnh hưởng (đến)" value={newAnn.affectedTimeEnd || "21:00"} onChange={(v) => setNewAnn({ ...newAnn, affectedTimeEnd: v })} />
              </div>
              <button type="button" onClick={addAnn} disabled={!newAnn.message.trim()}
                className="rounded-full bg-jade px-5 py-2.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light transition disabled:opacity-50">
                Đăng thông báo
              </button>
            </Section>
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Lịch sử thông báo ({announcements.length})</p>
              {announcements.length === 0 && <p className="text-xs text-slate-600 text-center py-4">Chưa có thông báo nào.</p>}
              {announcements.map((a) => {
                const { label: statusLabel, color: statusColor } = annStatus(a);
                return (
                  <div key={a.id} className="rounded-2xl border border-white/8 bg-white/4 p-4 space-y-3">
                    {editingAnn?.id === a.id ? (
                      <div className="space-y-3">
                        <textarea value={editingAnn.message} rows={3} onChange={(e) => setEditingAnn({ ...editingAnn, message: e.target.value })} className={inputCls + " resize-none"} />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="date" value={editingAnn.startDate ?? ""} className={inputCls} onChange={(e) => setEditingAnn({ ...editingAnn, startDate: e.target.value })} />
                          <input type="date" value={editingAnn.endDate ?? ""} className={inputCls} onChange={(e) => setEditingAnn({ ...editingAnn, endDate: e.target.value })} />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => updateAnn(editingAnn)} className="rounded-full bg-jade px-4 py-1.5 text-xs font-bold text-[#0E2A21]">Lưu</button>
                          <button type="button" onClick={() => setEditingAnn(null)} className="rounded-full border border-white/10 px-4 py-1.5 text-xs text-slate-400">Hủy</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
                            <p className="text-xs text-white mt-1 leading-relaxed">{a.message}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{a.startDate || "–"} → {a.endDate || "–"}{a.affectedTimeStart && ` · ${a.affectedTimeStart}–${a.affectedTimeEnd}`}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => setEditingAnn(a)} className="rounded-lg bg-white/6 border border-white/10 px-3 py-1 text-xs text-slate-300 hover:text-jade hover:border-jade/40 transition">Sửa</button>
                          <button type="button" onClick={() => deleteAnn(a.id)} className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20 transition">Xóa</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Payment ── */}
        {tab === "payment" && (
          <Section title="Thông tin thanh toán" desc="Tự động cập nhật trên trang thanh toán.">
            <Field label="Tên ngân hàng">
              <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Số tài khoản">
              <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Tên chủ tài khoản">
              <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} className={inputCls} />
            </Field>

            {/* QR Upload */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 uppercase tracking-wide block">Hình mã QR thanh toán</label>

              <label className="flex items-center gap-2 w-full cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/4 hover:border-jade/40 hover:bg-jade/5 px-3 py-2.5 transition group">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-jade/70 group-hover:text-jade transition">
                  <path d="M7 1v8M4 4l3-3 3 3M1 10.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-xs text-slate-400 group-hover:text-slate-200 transition">
                  {qrUploading ? "Đang xử lý..." : "Chọn ảnh QR (PNG / JPG / WEBP)..."}
                </span>
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="sr-only" onChange={handleQrUpload} disabled={qrUploading} />
              </label>

              {qrImageBase64 && (
                <div className="relative group w-fit">
                  <div className="rounded-2xl overflow-hidden bg-white p-3 shadow-md w-40">
                    <img src={qrImageBase64} alt="QR preview" className="w-full h-auto rounded-xl object-contain" />
                  </div>
                  <button type="button" onClick={() => setQrImageBase64("")}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow">
                    x
                  </button>
                </div>
              )}

              {!qrImageBase64 && (
                <p className="text-[10px] text-slate-600">Chưa có hình QR nào được tải lên.</p>
              )}
            </div>

            <button type="button" onClick={savePayment}
              className="rounded-full bg-jade px-5 py-2.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light transition">
              Lưu thông tin thanh toán
            </button>
          </Section>
        )}

        {tab === "contact" && (
          <div className="space-y-5">
            <Section title="Thông tin liên hệ" desc="Hiển thị trên trang đặt sân, trang chủ và email gửi đến khách hàng.">
              <Field label="Số điện thoại" error={contactError ?? undefined}>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => { setContactPhone(e.target.value); setContactError(null); }}
                  placeholder="0901 234 567"
                  className={inputCls}
                />
              </Field>
              <Field label="Facebook URL">
                <input
                  type="url"
                  value={contactFacebook}
                  onChange={(e) => setContactFacebook(e.target.value)}
                  placeholder="https://facebook.com/e83pickleball"
                  className={inputCls}
                />
              </Field>
              <Field label="Zalo (số điện thoại hoặc link)">
                <input
                  type="text"
                  value={contactZalo}
                  onChange={(e) => setContactZalo(e.target.value)}
                  placeholder="0901234567 hoặc https://zalo.me/..."
                  className={inputCls}
                />
              </Field>
              <button type="button" onClick={saveContact}
                className="rounded-full bg-jade px-5 py-2.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light transition">
                Lưu thông tin liên hệ
              </button>
            </Section>

            {/* Preview */}
            {(contactPhone || contactFacebook || contactZalo) && (
              <Section title="Xem trước" desc="Hiển thị như thế này với khách hàng.">
                <div className="rounded-2xl border border-white/8 bg-white/3 px-5 py-4 space-y-3">
                  <p className="text-[10px] uppercase tracking-widest text-jade/60 font-semibold">Liên hệ hỗ trợ</p>
                  {contactPhone && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-jade/10 border border-jade/20 flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#6BD5AC" strokeWidth="1.4">
                          <path d="M2.5 3C2.5 2.3 3 1.8 3.6 1.8L5.4 2.4l.6 2.4-1.2.6C5.2 6.7 6 7.8 7 8.5l.6-1.2L10 7.9l.6 1.8c0 .6-.5 1.1-1.2 1.1C4.8 10.8 2.5 6.9 2.5 3z" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Điện thoại</p>
                        <p className="text-sm font-semibold text-white">{contactPhone}</p>
                      </div>
                    </div>
                  )}
                  {contactZalo && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#0068FF]/15 border border-[#0068FF]/25 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-[#0068FF]">Zalo</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Zalo</p>
                        <p className="text-sm font-semibold text-white">{contactZalo}</p>
                      </div>
                    </div>
                  )}
                  {contactFacebook && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#1877F2]/15 border border-[#1877F2]/25 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-[#1877F2]">fb</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Facebook</p>
                        <p className="text-sm font-semibold text-white truncate">
                          {contactFacebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, "").replace(/\/$/, "")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
