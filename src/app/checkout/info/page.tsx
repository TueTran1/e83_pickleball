"use client";

import React, { Suspense, useState } from "react";
import { useSessionState } from "@/hooks/useSessionState";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const DISPLAY_DATE = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

function InfoForm() {
  const router = useRouter();
  const params = useSearchParams();

  const isMonthly = params.get("type") === "monthly";

  // Single-booking params
  const date = params.get("date") ?? "";
  const court = params.get("court") ?? "1";
  const bothCourts = params.get("bothCourts") === "true";

  // Monthly-ticket params
  const startDate = params.get("startDate") ?? "";
  const endDate = params.get("endDate") ?? "";

  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";

  // Persist contact info in sessionStorage so data survives back navigation.
  // When the user hits Back from /checkout/payment, InfoForm remounts fresh,
  // but useSessionState reads the stored value and restores the form instantly.
  const [name,  setName]  = useSessionState<string>("checkout_name",  "");
  const [phone, setPhone] = useSessionState<string>("checkout_phone", "");
  const [email, setEmail] = useSessionState<string>("checkout_email", "");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim() || name.trim().length < 2) e.name = "Vui lòng nhập họ tên đầy đủ";
    if (!/^(0|\+84)[0-9]{8,10}$/.test(phone.replace(/\s/g, ""))) e.phone = "Số điện thoại không hợp lệ";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email không hợp lệ";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    const p = new URLSearchParams({
      start, end,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });

    if (isMonthly) {
      p.set("type", "monthly");
      p.set("startDate", startDate);
      p.set("endDate", endDate);
      p.set("court", court === "both" ? "both" : court);
    } else {
      p.set("date", date);
      p.set("court", court);
      p.set("bothCourts", String(bothCourts));
    }

    router.push(`/checkout/payment?${p.toString()}`);
  };

  const backHref = isMonthly ? "/monthly" : "/booking";

  return (
    <main className="min-h-screen bg-[#0E2A21] text-white flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-[#0E2A21]/90 backdrop-blur-md">
        <Link href={backHref} className="text-jade hover:opacity-70 transition">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <p className="text-sm font-semibold text-white">Thông tin đặt sân</p>
      </nav>

      <div className="flex-1 px-5 py-8 max-w-md mx-auto w-full space-y-6">
        {/* Booking summary */}
        <div className="rounded-2xl border border-jade/20 bg-jade/6 p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-jade/70 font-semibold mb-2">
            {isMonthly ? "Tóm tắt vé tháng" : "Tóm tắt đặt sân"}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {isMonthly ? (
              <>
                <span className="text-slate-500">Hiệu lực</span>
                <span className="text-white font-medium tabular-nums">{DISPLAY_DATE(startDate)} – {DISPLAY_DATE(endDate)}</span>
                <span className="text-slate-500">Thời hạn</span>
                <span className="text-white font-medium">30 ngày</span>
              </>
            ) : (
              <>
                <span className="text-slate-500">Ngày</span>
                <span className="text-white font-medium tabular-nums">{date}</span>
              </>
            )}
            <span className="text-slate-500">Sân</span>
            <span className="text-white font-medium">{(isMonthly ? court === "both" : bothCourts) ? "Sân 1 + 2" : `Sân ${court}`}</span>
            <span className="text-slate-500">Giờ</span>
            <span className="text-white font-medium tabular-nums">{start} – {end}</span>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <p className="text-[10px] uppercase tracking-widest text-jade/70 font-semibold">Thông tin người đặt</p>

          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs text-slate-400">
              Họ và tên <span className="text-jade">*</span>
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((v) => ({ ...v, name: undefined })); }}
              className={[
                "w-full rounded-2xl border bg-[#15392C] px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none transition",
                errors.name ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-jade",
              ].join(" ")}
            />
            {errors.name && <p className="text-[11px] text-red-400 pl-1">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-xs text-slate-400">
              Số điện thoại <span className="text-jade">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="0912 345 678"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setErrors((v) => ({ ...v, phone: undefined })); }}
              className={[
                "w-full rounded-2xl border bg-[#15392C] px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none transition",
                errors.phone ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-jade",
              ].join(" ")}
            />
            {errors.phone && <p className="text-[11px] text-red-400 pl-1">{errors.phone}</p>}
          </div>

          {/* Email — optional but recommended */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs text-slate-400">
              Email <span className="text-slate-600">(để nhận xác nhận)</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((v) => ({ ...v, email: undefined })); }}
              className={[
                "w-full rounded-2xl border bg-[#15392C] px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none transition",
                errors.email ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-jade",
              ].join(" ")}
            />
            {errors.email && <p className="text-[11px] text-red-400 pl-1">{errors.email}</p>}
            <p className="text-[11px] text-slate-600 pl-1">
              Không bắt buộc. Email xác nhận sẽ được gửi nếu bạn điền địa chỉ này.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed">
          Số điện thoại hiển thị trên lịch sẽ được ẩn 7 số đầu để bảo mật.
        </p>
      </div>

      {/* Bottom CTA */}
      <div className="sticky bottom-0 px-5 py-4 border-t border-white/8 bg-[#0E2A21]/95 backdrop-blur-md">
        <button
          type="button"
          onClick={handleContinue}
          className="w-full rounded-full bg-jade py-4 text-sm font-bold uppercase tracking-widest text-[#0E2A21] shadow-jade hover:bg-jade-light active:scale-95 transition"
        >
          Tiếp tục →
        </button>
      </div>
    </main>
  );
}

export default function CheckoutInfoPage() {
  return (
    <Suspense>
      <InfoForm />
    </Suspense>
  );
}
