"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import ContactBar from "@/components/ContactBar";

export default function HomePage() {
  const glowRef = useRef<HTMLDivElement>(null);
  const [hours, setHours] = useState({ start: "05:30", end: "21:00" });

  useEffect(() => {
    fetch("/api/booking-config")
      .then((r) => r.json())
      .then((d) => { if (d.operatingHours) setHours(d.operatingHours); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!glowRef.current) return;
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      glowRef.current.style.background = `radial-gradient(ellipse 60% 50% at ${x}% ${y}%, rgba(107,213,172,0.16) 0%, transparent 70%)`;
    };
    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, []);

  return (
    <main
      className="relative bg-[#0E2A21] text-white"
      style={{ width: "100vw", height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      {/* Ambient glow */}
      <div
        ref={glowRef}
        className="pointer-events-none fixed inset-0 z-0 transition-[background] duration-300"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(107,213,172,0.12) 0%, transparent 70%)" }}
      />

      {/* Grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(107,213,172,1) 1px,transparent 1px),linear-gradient(90deg,rgba(107,213,172,1) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-10 shrink-0 flex items-center justify-between px-6 sm:px-10"
        style={{ paddingTop: "clamp(0.75rem, 2vh, 1.25rem)", paddingBottom: "clamp(0.5rem, 1.5vh, 1rem)" }}>
        <Logo size={32} textSize="sm" />
        <Link
          href="/admin"
          className="text-[10px] uppercase tracking-widest text-slate-600 hover:text-jade transition px-3 py-1.5 rounded-full border border-white/5 hover:border-jade/30"
        >
          Admin
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────
           Uses flex column + justify-center so content centres vertically
           in the remaining height. All gaps use clamp() to compress on short
           screens before anything gets cut off.
      ─────────────────────────────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center px-6"
        style={{ flex: 1, minHeight: 0, gap: "clamp(0.5rem, 1.5vh, 1rem)" }}
      >
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-jade/25 bg-jade/8 px-4"
          style={{ paddingTop: "clamp(0.25rem, 0.8vh, 0.375rem)", paddingBottom: "clamp(0.25rem, 0.8vh, 0.375rem)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-jade animate-pulse" />
          <span className="font-semibold text-jade uppercase tracking-widest"
            style={{ fontSize: "clamp(0.6rem, 1.2vw, 0.6875rem)" }}>
            E83 - Câu lạc bộ Pickleball
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-black text-white leading-[1.05] tracking-tight max-w-2xl"
          style={{ fontSize: "clamp(1.75rem, 5.5vw, 3.5rem)", margin: 0 }}
        >
          Đặt sân{" "}
          <span className="text-jade relative">
            Pickleball
            <span className="absolute -inset-1 blur-2xl bg-jade/20 -z-10 rounded-full" />
          </span>
          <br />
          nhanh chóng.
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 max-w-md leading-relaxed"
          style={{ fontSize: "clamp(0.75rem, 1.8vw, 0.9375rem)", margin: 0 }}>
          Chọn ngày, khung giờ và thanh toán trong vài giây.
        </p>

        {/* Address */}
        <div className="flex items-center gap-1.5 text-slate-500"
          style={{ fontSize: "clamp(0.6rem, 1.3vw, 0.7rem)", margin: 0 }}>
          <svg width="11" height="11" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" className="shrink-0">
            <path d="M6.5 12s4-3.8 4-7a4 4 0 10-8 0c0 3.2 4 7 4 7z"/>
            <circle cx="6.5" cy="5" r="1.4"/>
          </svg>
          01 Nguyễn Phan Vinh, Sơn Trà, Đà Nẵng
        </div>

        {/* ── CTA buttons ─────────────────────────────────────────────────────
             Both buttons MUST be visually identical.
             - Same width: both are flex-1 inside a fixed-width row
             - Same height: enforced by identical padding + font-size + line-height
             - Same everything else: shared className
             The badge wrapper around "Mua vé tháng" uses position:relative with
             absolute badge so it NEVER affects the button's own dimensions.
        ──────────────────────────────────────────────────────────────────── */}
        <div
          className="flex flex-row items-stretch gap-3 w-full"
          style={{ maxWidth: "clamp(320px, 58vw, 520px)", margin: 0 }}
        >
          {/* Shared button style — applied to both */}
          {(() => {
            const btnCls = "flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-jade font-bold uppercase tracking-wider text-[#0E2A21] hover:bg-jade-light active:scale-[0.97] transition whitespace-nowrap";
            const btnStyle = {
              padding: "clamp(0.6rem, 1.8vh, 0.875rem) clamp(1rem, 2.5vw, 1.5rem)",
              fontSize: "clamp(0.65rem, 1.4vw, 0.8125rem)",
              lineHeight: "1.2",
              boxShadow: "0 4px 24px rgba(107,213,172,0.35)",
            };
            const ArrowIcon = () => (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            );
            return (
              <>
                {/* Button 1 — Đặt sân ngay */}
                <Link href="/booking" className={btnCls} style={btnStyle} aria-label="Đặt sân ngay">
                  <span>Đặt sân ngay</span>
                  <ArrowIcon />
                </Link>

                {/* Button 2 — Mua vé tháng (badge wrapper is zero-height) */}
                <div className="relative flex-1" style={{ minWidth: 0 }}>
                  {/* Badge — absolute, does NOT affect button layout */}
                  <span
                    aria-label="Giảm 10%"
                    className="absolute z-10 inline-flex items-center justify-center rounded-full bg-red-500 text-white font-black select-none pointer-events-none"
                    style={{
                      top: "-9px", right: "-9px",
                      width: "clamp(1.4rem, 2.8vw, 1.75rem)",
                      height: "clamp(1.4rem, 2.8vw, 1.75rem)",
                      fontSize: "clamp(0.5rem, 1.1vw, 0.6rem)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                      lineHeight: 1,
                    }}
                  >
                    -10%
                  </span>
                  {/* The button itself — width:100% so it fills the flex-1 wrapper */}
                  <Link
                    href="/monthly"
                    className={btnCls}
                    style={{ ...btnStyle, width: "100%" }}
                    aria-label="Mua vé tháng — giảm 10%"
                  >
                    <span>Mua vé tháng</span>
                    <ArrowIcon />
                  </Link>
                </div>
              </>
            );
          })()}
        </div>

        {/* Intro link */}
        <Link
          href="/intro"
          className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/5 font-semibold text-slate-300 hover:border-jade/40 hover:text-jade hover:bg-jade/5 active:scale-[0.97] transition"
          style={{
            width: "clamp(320px, 58vw, 520px)",
            padding: "clamp(0.55rem, 1.6vh, 0.8rem) clamp(1rem, 2.5vw, 1.5rem)",
            fontSize: "clamp(0.65rem, 1.4vw, 0.8125rem)",
            margin: 0,
          }}
        >
          Xem giới thiệu
        </Link>

        {/* Stats strip */}
        <div className="flex items-center gap-6 sm:gap-10 text-center" style={{ margin: 0 }}>
          {[
            { value: "2",         label: "Sân thi đấu" },
            { value: hours.start, label: "Mở cửa từ"   },
            { value: hours.end,   label: "Đóng cửa lúc" },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-black text-jade tabular-nums"
                style={{ fontSize: "clamp(0.9rem, 2.5vw, 1.375rem)", lineHeight: 1 }}>
                {s.value}
              </p>
              <p className="text-slate-500 uppercase tracking-wide mt-0.5"
                style={{ fontSize: "clamp(0.55rem, 1.1vw, 0.6rem)" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Contact bar — must always be fully visible */}
        <div className="w-full" style={{ maxWidth: "clamp(320px, 58vw, 520px)", margin: 0 }}>
          <ContactBar variant="inline" />
        </div>
      </div>

      {/* Decorative court lines */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 overflow-hidden opacity-[0.07]"
        style={{ height: "clamp(4rem, 12vh, 8rem)" }}>
        <svg viewBox="0 0 400 150" className="w-full h-full" preserveAspectRatio="none">
          <rect x="40" y="20" width="320" height="120" stroke="#6BD5AC" strokeWidth="1.5" fill="none"/>
          <line x1="200" y1="20" x2="200" y2="140" stroke="#6BD5AC" strokeWidth="1.5"/>
          <ellipse cx="200" cy="80" rx="30" ry="30" stroke="#6BD5AC" strokeWidth="1.5" fill="none"/>
          <line x1="40" y1="80" x2="360" y2="80" stroke="#6BD5AC" strokeWidth="0.8" strokeDasharray="4 4"/>
        </svg>
      </div>
    </main>
  );
}
