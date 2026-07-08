"use client";
import { useEffect } from "react";
import { clearCheckoutSession } from "@/hooks/useSessionState";
import { formatDuration, minutesToDuration } from "@/lib/bookingLogic";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { maskPhone } from "@/lib/bookingLogic";

function SuccessContent() {
  const params    = useSearchParams();
  const date      = params.get("date")   ?? "";
  const court     = params.get("court")  ?? "";
  const start     = params.get("start")  ?? "";
  const end       = params.get("end")    ?? "";
  const name      = decodeURIComponent(params.get("name")  ?? "");
  const phone     = decodeURIComponent(params.get("phone") ?? "");
  const emailSent = params.get("emailSent") === "1";
  const isMonthly = params.get("type") === "monthly";

  return (
    <main className="min-h-screen bg-[#0E2A21] text-white flex flex-col items-center justify-center px-5 py-12">

      {/* Pending icon — clock, not checkmark */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="#f59e0b" strokeWidth="2.5"/>
            <path d="M20 12v9l5 3" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="absolute inset-0 rounded-full bg-amber-500/8 blur-xl" />
      </div>

      <p className="text-[11px] uppercase tracking-widest text-amber-400/80 font-semibold mb-2">
        Đang chờ xác nhận
      </p>
      <h1 className="text-2xl font-black text-white text-center leading-tight mb-3">
        Yêu cầu đã được ghi nhận!
      </h1>
      <p className="text-sm text-slate-400 text-center max-w-xs leading-relaxed mb-6">
        Admin sẽ kiểm tra giao dịch ngân hàng và xác nhận lịch của bạn trong thời gian sớm nhất.
      </p>

      {/* What happens next */}
      <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-white/4 p-4 mb-5 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-jade/70 font-semibold">Bước tiếp theo</p>
        {[
          { n: "1", text: "Admin nhận email thông báo và kiểm tra tài khoản ngân hàng." },
          { n: "2", text: emailSent ? `Email xác nhận sẽ gửi đến ${params.get("email") ?? "hộp thư của bạn"} khi được duyệt.` : "Lịch của bạn sẽ được cập nhật trên bảng giờ khi được duyệt." },
          { n: "3", text: "Vui lòng có mặt tại sân đúng giờ sau khi nhận xác nhận." },
        ].map((step) => (
          <div key={step.n} className="flex items-start gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-jade/15 border border-jade/30 flex items-center justify-center text-[10px] font-bold text-jade mt-0.5">
              {step.n}
            </span>
            <p className="text-xs text-slate-400 leading-relaxed">{step.text}</p>
          </div>
        ))}
      </div>

      {/* Booking summary */}
      <div className="w-full max-w-sm rounded-2xl border border-amber-500/20 bg-amber-500/6 p-4 space-y-2 mb-8">
        <p className="text-[10px] uppercase tracking-widest text-amber-400/80 font-semibold mb-1">
          Chi tiết đơn đặt
        </p>
        {[
          { label: "Người đặt", value: name },
          { label: "SĐT",       value: maskPhone(phone) },
          { label: isMonthly ? "Bắt đầu" : "Ngày", value: date },
          { label: "Sân",       value: court === "both" ? "Sân 1 + 2" : `Sân ${court}` },
          { label: "Giờ",       value: `${start} – ${end}` },
          { label: "Thời lượng", value: (() => { const [sh,sm]=start.split(":").map(Number); const [eh,em]=end.split(":").map(Number); return formatDuration(minutesToDuration((eh*60+em)-(sh*60+sm))); })() },
        ].map((row) => (
          <div key={row.label} className="flex justify-between items-center">
            <span className="text-slate-500 text-xs">{row.label}</span>
            <span className="text-white text-xs font-semibold tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Contact note */}
      <p className="text-xs text-slate-600 text-center leading-relaxed max-w-xs mb-7">
        Nếu cần hỗ trợ gấp, liên hệ admin qua Zalo hoặc Facebook.
        Địa chỉ: 01 Nguyễn Phan Vinh, Sơn Trà, Đà Nẵng.
      </p>

      <Link
        href={isMonthly ? "/monthly" : "/booking"}
        className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-semibold text-slate-300 hover:border-jade/40 hover:text-jade transition"
      >
        {isMonthly ? "Mua vé tháng khác" : "Đặt sân khác"}
      </Link>
      <Link href="/" className="mt-3 text-xs text-slate-600 hover:text-jade transition">
        Về trang chủ
      </Link>
    </main>
  );
}

export default function SuccessPage() {
  useEffect(() => { clearCheckoutSession(); }, []);
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
