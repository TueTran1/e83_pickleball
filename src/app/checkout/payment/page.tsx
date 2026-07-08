"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ContactBar from "@/components/ContactBar";
import {
  calculateRangePrice,
  calculateMonthlyPrice,
  maskPhone,
  formatDuration,
  minutesToDuration,
  SimpleTier,
  setLiveBookingConfig,
} from "@/lib/bookingLogic";

interface PaymentInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrImageBase64: string | null;
}

const DEFAULT_PAYMENT: PaymentInfo = {
  bankName: "Techcombank",
  accountNumber: "1907 5954 3620 11",
  accountName: "TRAN NGOC QUYET",
  qrImageBase64: null,
};

const DISPLAY_DATE = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

function PaymentForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [payInfo, setPayInfo] = useState<PaymentInfo>(DEFAULT_PAYMENT);
  const [tiers, setTiers] = useState<SimpleTier[]>([]);
  const [configReady, setConfigReady] = useState(false);

  useEffect(() => {
    fetch("/api/payment-info")
      .then((r) => r.json())
      .then((d) => { if (d.bankName) setPayInfo({ ...d, qrImageBase64: d.qrImageBase64 ?? null }); })
      .catch(() => {});
  }, []);

  // Re-fetch live operating hours + pricing here too — this page can be reached
  // directly (deep link, page refresh) without ever visiting /booking first, so
  // it cannot assume setLiveBookingConfig() was already called by another page.
  useEffect(() => {
    fetch("/api/booking-config")
      .then((r) => r.json())
      .then((d) => {
        const liveHours = d.operatingHours ?? { start: "05:30", end: "21:00" };
        const liveTiers: SimpleTier[] = d.pricingTiers ?? [];
        setLiveBookingConfig(liveHours, liveTiers);
        setTiers(liveTiers);
      })
      .finally(() => setConfigReady(true));
  }, []);

  const isMonthly   = params.get("type") === "monthly";
  const date        = params.get("date")        ?? "";
  const startDate   = params.get("startDate")   ?? "";
  const endDate     = params.get("endDate")      ?? "";
  const court       = params.get("court")       ?? "1";
  const bothCourts  = params.get("bothCourts")  === "true";
  const start       = params.get("start")       ?? "";
  const end         = params.get("end")         ?? "";
  const name        = params.get("name")        ?? "";
  const phone       = params.get("phone")       ?? "";
  const email       = params.get("email")       ?? "";

  const courtIsBoth  = isMonthly ? court === "both" : bothCourts;
  const maskedPhone  = maskPhone(phone);

  const refDate = new Date((isMonthly ? startDate : date) + "T00:00:00");
  const totalPrice = isMonthly
    ? calculateMonthlyPrice(start, end, courtIsBoth ? 2 : 1, tiers.length ? tiers : undefined)
    : calculateRangePrice(start, end, courtIsBoth ? 2 : 1, tiers.length ? tiers : undefined, refDate);

  // Transfer content: customer must include this in the bank-transfer note
  const transferContent = `E83 ${(isMonthly ? startDate : date).replace(/-/g, "")} ${start.replace(":", "")} ${maskedPhone}`;

  const [confirmed, setConfirmed]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [copied, setCopied]         = useState<"account" | "content" | null>(null);

  const copy = (text: string, type: "account" | "content") => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  const handleConfirm = async () => {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/confirm-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingType: isMonthly ? "monthly" : "single",
          date:       isMonthly ? undefined : date,
          startDate:  isMonthly ? startDate  : undefined,
          court:      courtIsBoth ? "both" : court,
          start,
          end,
          name,
          phone,
          email,
          totalPrice,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Đã xảy ra lỗi");

      const p = new URLSearchParams({
        type:   isMonthly ? "monthly" : "single",
        date:   isMonthly ? startDate : date,
        court:  courtIsBoth ? "both" : court,
        start,
        end,
        name:   encodeURIComponent(name),
        phone:  encodeURIComponent(phone),
        emailSent: email ? "1" : "0",
      });
      router.push(`/checkout/success?${p.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi. Vui lòng thử lại.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0E2A21] text-white flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-[#0E2A21]/90 backdrop-blur-md">
        <Link href="/checkout/info" className="text-jade hover:opacity-70 transition">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <p className="text-sm font-semibold text-white">Thanh toán</p>
      </nav>

      <div className="flex-1 px-5 py-6 max-w-md mx-auto w-full space-y-5 pb-36">

        {/* ── Order summary ── */}
        <div className="rounded-2xl border border-jade/20 bg-jade/6 p-4">
          <p className="text-[10px] uppercase tracking-widest text-jade/70 font-semibold mb-3">
            {isMonthly ? "Vé tháng" : "Đơn đặt sân"}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-3">
            {isMonthly ? (
              <>
                <span className="text-slate-500">Hiệu lực</span>
                <span className="text-white font-medium tabular-nums">
                  {DISPLAY_DATE(startDate)} – {DISPLAY_DATE(endDate)}
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-500">Ngày</span>
                <span className="text-white font-medium tabular-nums">{date}</span>
              </>
            )}
            <span className="text-slate-500">Sân</span>
            <span className="text-white font-medium">
              {courtIsBoth ? "Sân 1 + 2" : `Sân ${court}`}
            </span>
            <span className="text-slate-500">Giờ</span>
            <span className="text-white font-medium tabular-nums">{start} – {end}</span>
            <span className="text-slate-500">Thời lượng</span>
            <span className="text-white font-medium tabular-nums">{(() => { const [sh,sm]=start.split(":").map(Number); const [eh,em]=end.split(":").map(Number); return formatDuration(minutesToDuration((eh*60+em)-(sh*60+sm))); })()}</span>
            <span className="text-slate-500">Người đặt</span>
            <span className="text-white font-medium">{name}</span>
            <span className="text-slate-500">SĐT</span>
            <span className="text-white font-medium tabular-nums">{maskedPhone}</span>
            {email && (
              <>
                <span className="text-slate-500">Email</span>
                <span className="text-white font-medium truncate">{email}</span>
              </>
            )}
          </div>
          <div className="pt-3 border-t border-white/8 flex justify-between items-center">
            <span className="text-xs text-slate-400">Tổng thanh toán</span>
            <span className="text-xl font-black text-jade tabular-nums">
              {totalPrice.toLocaleString("vi-VN")}đ
            </span>
          </div>
        </div>

        {/* ── Email notice ── */}
        {email ? (
          <div className="rounded-2xl border border-jade/20 bg-jade/5 px-4 py-3 flex items-center gap-3">
            <span className="shrink-0 w-8 h-8 rounded-full bg-jade/15 flex items-center justify-center text-jade">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="1.5" y="3" width="13" height="10" rx="1.5"/>
                <path d="M1.5 4l6.5 5 6.5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              Email xác nhận sẽ gửi đến <strong className="text-jade">{email}</strong> sau khi admin duyệt.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 flex items-center gap-3">
            <span className="shrink-0 w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-slate-400">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="8" cy="8" r="6.5"/>
                <path d="M8 5.5v3.5M8 11h.01" strokeLinecap="round"/>
              </svg>
            </span>
            <p className="text-xs text-slate-500 leading-relaxed">
              Bạn chưa nhập email — sẽ không nhận được thông báo xác nhận.{" "}
              <Link href="/checkout/info" className="text-jade underline">Quay lại để thêm.</Link>
            </p>
          </div>
        )}

        {/* ── Bank QR code ── */}
        <div className="rounded-2xl border border-white/8 bg-[#15392C] overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <p className="text-sm font-bold text-white mb-1">Chuyển khoản ngân hàng</p>
            <p className="text-xs text-slate-400">Quét mã QR hoặc chuyển khoản thủ công bên dưới</p>
          </div>

          {/* QR image */}
          <div className="flex flex-col items-center gap-3 px-5 pb-4">
            {payInfo.qrImageBase64 ? (
              <div className="rounded-2xl overflow-hidden bg-white p-3 shadow-jade-sm w-full max-w-[260px]">
                <img
                  src={payInfo.qrImageBase64}
                  alt="QR chuyển khoản"
                  className="w-full h-auto rounded-xl"
                />
              </div>
            ) : (
              <div className="w-full max-w-[260px] h-48 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <p className="text-xs text-slate-600 text-center px-4">Chưa có QR thanh toán.<br/>Admin vui lòng cập nhật trong Settings.</p>
              </div>
            )}
            {payInfo.qrImageBase64 && (
              <button
                type="button"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = payInfo.qrImageBase64!;
                  const ext = payInfo.qrImageBase64!.includes("image/png") ? "png" : payInfo.qrImageBase64!.includes("image/webp") ? "webp" : "jpg";
                  const dateStr = new Date().toISOString().slice(0, 10);
                  link.download = `e83-payment-qr-${dateStr}.${ext}`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex items-center gap-2 rounded-full border border-jade/30 bg-jade/8 hover:bg-jade/15 px-5 py-2 text-xs font-semibold text-jade transition active:scale-95"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1v7.5M3.5 5.5l3 3 3-3M1 10.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Lưu mã QR
              </button>
            )}
          </div>

          {/* Bank details */}
          <div className="px-5 pb-5 space-y-2.5">
            {[
              { label: "Ngân hàng",     value: payInfo.bankName },
              { label: "Tên tài khoản", value: payInfo.accountName },
            ].map((r) => (
              <div key={r.label} className="flex justify-between items-center text-xs">
                <span className="text-slate-500">{r.label}</span>
                <span className="text-white font-semibold">{r.value}</span>
              </div>
            ))}

            {/* Account number — copyable */}
            <div className="flex items-center justify-between rounded-xl bg-[#0E2A21]/80 border border-white/8 px-3 py-2.5">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Số tài khoản</p>
                <p className="text-sm font-black text-jade tabular-nums tracking-widest">
                  {payInfo.accountNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copy(payInfo.accountNumber.replace(/\s/g, ""), "account")}
                className={[
                  "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition",
                  copied === "account" ? "bg-jade/20 text-jade" : "bg-white/8 text-slate-400 hover:bg-jade/15 hover:text-jade",
                ].join(" ")}
                title="Sao chép số tài khoản"
              >
                {copied === "account" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <rect x="4" y="4" width="8" height="8" rx="1.5"/>
                    <path d="M2 10V2h8"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Transfer content — copyable */}
            <div className="rounded-xl bg-[#0E2A21]/80 border border-white/8 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Nội dung chuyển khoản</p>
                  <p className="text-xs text-jade font-mono font-semibold break-all">{transferContent}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(transferContent, "content")}
                  className={[
                    "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition mt-0.5",
                    copied === "content" ? "bg-jade/20 text-jade" : "bg-white/8 text-slate-400 hover:bg-jade/15 hover:text-jade",
                  ].join(" ")}
                  title="Sao chép nội dung"
                >
                  {copied === "content" ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <rect x="4" y="4" width="8" height="8" rx="1.5"/>
                      <path d="M2 10V2h8"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Instruction */}
            <p className="text-[10px] text-slate-600 leading-relaxed pt-1">
              Nhập đúng nội dung chuyển khoản để admin xác nhận nhanh hơn. Sau khi chuyển xong, bấm xác nhận bên dưới.
            </p>
          </div>
        </div>

        {/* ── Confirmation checkbox ── */}
        <button
          type="button"
          onClick={() => setConfirmed((v) => !v)}
          className="flex items-start gap-3 w-full text-left"
        >
          <div className={[
            "mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition",
            confirmed ? "bg-jade border-jade" : "border-slate-600",
          ].join(" ")}>
            {confirmed && (
              <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                <path d="M1 4.5L4 7.5L10 1" stroke="#0E2A21" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tôi xác nhận đã chuyển khoản đúng số tiền{" "}
            <strong className="text-white">{totalPrice.toLocaleString("vi-VN")}đ</strong>{" "}
            với nội dung chuyển khoản chính xác đến tài khoản trên.
          </p>
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* ── Sticky CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 px-5 py-4 border-t border-white/8 bg-[#0E2A21]/95 backdrop-blur-md">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!confirmed || submitting}
          className={[
            "w-full rounded-full py-4 text-sm font-bold uppercase tracking-widest transition",
            confirmed && !submitting
              ? "bg-jade text-[#0E2A21] shadow-jade hover:bg-jade-light active:scale-95"
              : "bg-white/8 text-slate-600 cursor-not-allowed",
          ].join(" ")}
        >
          {submitting ? "Đang xử lý..." : "Tôi đã chuyển khoản"}
        </button>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense>
      <PaymentForm />
    </Suspense>
  );
}
