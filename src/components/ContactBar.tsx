"use client";

import { useEffect, useState } from "react";

interface ContactInfo {
  phone: string;
  facebook: string;
  zalo: string;
}

interface ContactBarProps {
  /** Variant: 'footer' renders a full section, 'inline' renders a compact row */
  variant?: "footer" | "inline";
}

export default function ContactBar({ variant = "footer" }: ContactBarProps) {
  const [info, setInfo] = useState<ContactInfo | null>(null);

  useEffect(() => {
    fetch("/api/contact-info")
      .then((r) => r.json())
      .then((d) => { if (d.phone || d.facebook || d.zalo) setInfo(d); })
      .catch(() => {});
  }, []);

  if (!info) return null;

  const hasAny = info.phone || info.facebook || info.zalo;
  if (!hasAny) return null;

  if (variant === "inline") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        {info.phone && (
          <a href={`tel:${info.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-jade transition">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="shrink-0">
              <path d="M2 2.5C2 2 2.5 1.5 3 1.5l1.5.5.5 2-1 .5c.3 1.1 1 2 2.2 2.8l.5-1 2 .5.5 1.5c0 .5-.5 1-1 1C4.5 10 2 6.5 2 2.5z" strokeLinejoin="round"/>
            </svg>
            {info.phone}
          </a>
        )}
        {info.zalo && (
          <a href={info.zalo.startsWith("http") ? info.zalo : `https://zalo.me/${info.zalo.replace(/\s/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-jade transition">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
              <rect width="12" height="12" rx="3" fill="#0068FF" opacity="0.8"/>
              <text x="2" y="9" fontSize="7" fill="white" fontWeight="bold" fontFamily="sans-serif">Za</text>
            </svg>
            Zalo
          </a>
        )}
        {info.facebook && (
          <a href={info.facebook} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-jade transition">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
              <rect width="12" height="12" rx="3" fill="#1877F2" opacity="0.8"/>
              <path d="M7 4H6c-.3 0-.5.2-.5.5V5h1.5l-.2 1.5H5.5V10H4V6.5H3V5h1V4.5C4 3.1 4.9 2.5 6 2.5c.5 0 1 .1 1 .1V4z" fill="white"/>
            </svg>
            Facebook
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 px-5 py-4">
      <p className="text-[10px] uppercase tracking-widest text-jade/60 font-semibold mb-3">Liên hệ hỗ trợ</p>
      <div className="space-y-2.5">
        {info.phone && (
          <a href={`tel:${info.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-jade/10 border border-jade/20 flex items-center justify-center shrink-0 group-hover:bg-jade/20 transition">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-jade">
                <path d="M2.5 3C2.5 2.3 3 1.8 3.6 1.8L5.4 2.4l.6 2.4-1.2.6C5.2 6.7 6 7.8 7 8.5l.6-1.2L10 7.9l.6 1.8c0 .6-.5 1.1-1.2 1.1C4.8 10.8 2.5 6.9 2.5 3z" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Điện thoại</p>
              <p className="text-sm font-semibold text-white group-hover:text-jade transition">{info.phone}</p>
            </div>
          </a>
        )}
        {info.zalo && (
          <a href={info.zalo.startsWith("http") ? info.zalo : `https://zalo.me/${info.zalo.replace(/\s/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-[#0068FF]/15 border border-[#0068FF]/25 flex items-center justify-center shrink-0 group-hover:bg-[#0068FF]/25 transition">
              <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
                <text x="0" y="9" fontSize="10" fill="#0068FF" fontWeight="bold" fontFamily="sans-serif">Zalo</text>
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Zalo</p>
              <p className="text-sm font-semibold text-white group-hover:text-jade transition truncate">{info.zalo}</p>
            </div>
          </a>
        )}
        {info.facebook && (
          <a href={info.facebook} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-[#1877F2]/15 border border-[#1877F2]/25 flex items-center justify-center shrink-0 group-hover:bg-[#1877F2]/25 transition">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M8 5H7c-.3 0-.5.2-.5.5V6.5H8l-.2 1.5H6.5V12H5V8H4V6.5h1V5.5C5 4.1 5.9 3.5 7 3.5c.5 0 1 .1 1 .1V5z" fill="#1877F2"/>
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Facebook</p>
              <p className="text-sm font-semibold text-white group-hover:text-jade transition truncate">
                {info.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, "").replace(/\/$/, "")}
              </p>
            </div>
          </a>
        )}
      </div>
    </div>
  );
}
