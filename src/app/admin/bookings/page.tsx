"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookingRecord, BookingStatus } from "@/lib/db";
import { RevenueSummary, DateRange, PeriodPreset } from "@/lib/report";
import { formatDateStr, maskPhone, toMinutes, minutesToDuration, formatDuration } from "@/lib/bookingLogic";
import Calendar from "@/components/Calendar";
import { useToast } from "@/app/admin/layout";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
}

type ViewMode = "calendar" | "revenue";
type CourtFilter = "all" | "1" | "2";

const STATUS_LABEL: Record<string, string> = {
  pending_verification: "Chờ xác nhận",
  confirmed:            "Đã xác nhận",
  rejected:             "Từ chối",
  cancelled:            "Đã hủy",
};

const STATUS_COLOR: Record<string, string> = {
  pending_verification: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  confirmed:            "text-jade bg-jade/10 border-jade/25",
  rejected:             "text-red-400 bg-red-500/10 border-red-500/25",
  cancelled:            "text-slate-500 bg-white/5 border-white/10",
};

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "today",      label: "Hôm nay" },
  { value: "yesterday",  label: "Hôm qua" },
  { value: "this_week",  label: "Tuần này" },
  { value: "last_week",  label: "Tuần trước" },
  { value: "this_month", label: "Tháng này" },
  { value: "last_month", label: "Tháng trước" },
  { value: "this_year",  label: "Năm nay" },
  { value: "custom",     label: "Tuỳ chọn..." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VND = (n: number) => n.toLocaleString("vi-VN") + "đ";

const DISPLAY_DATETIME = (ts: number) =>
  new Date(ts).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

function groupByCourt(bookings: BookingRecord[]) {
  const c1 = bookings.filter((b) => b.court === "1").sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const c2 = bookings.filter((b) => b.court === "2").sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  return { c1, c2 };
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-jade/30 bg-jade/8" : "border-white/8 bg-white/4"}`}>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-black tabular-nums leading-none ${accent ? "text-jade" : "text-white"}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Edit Modal (same as before) ──────────────────────────────────────────────


// ─── Booking block card ────────────────────────────────────────────────────────

function BookingBlock({ booking, onView }: { booking: BookingRecord; onView: (b: BookingRecord) => void }) {
  // Compute duration label using shared formatDuration
  const durationMin = (() => {
    const [sh, sm] = booking.start.split(":").map(Number);
    const [eh, em] = booking.end.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  })();
  const durationLabel = formatDuration(minutesToDuration(durationMin));

  return (
    <div className="rounded-2xl border border-white/10 bg-[#15392C] overflow-hidden cursor-pointer hover:border-jade/30 transition" onClick={() => onView(booking)}>
      {/* Card header: status + court + edit button */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-white/8 bg-white/3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${STATUS_COLOR[booking.status]}`}>
            {STATUS_LABEL[booking.status]}
          </span>
          <span className="text-[10px] text-slate-500 font-medium shrink-0">Sân {booking.court}</span>
        </div>

      </div>

      {/* Card body */}
      <div className="px-3.5 py-3 space-y-2.5">
        {/* Time block — prominent */}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-black text-white tabular-nums leading-none">
            {booking.start} – {booking.end}
          </span>
          <span className="text-xs text-slate-500 tabular-nums">({durationLabel})</span>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-jade/60 shrink-0">
            <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 1v2M8 1v2M1 5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span className="text-xs text-slate-300 tabular-nums">{booking.date}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-white/6" />

        {/* Customer details */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-jade/60 shrink-0">
              <circle cx="6" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1.5 10.5c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-semibold text-white truncate">{booking.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-jade/60 shrink-0">
              <path d="M2 2.5C2 2 2.5 1.5 3 1.5l1.5.5.5 2-1 .5c.3 1.1 1 2 2.2 2.8l.5-1 2 .5.5 1.5c0 .5-.5 1-1 1C4.5 10 2 6.5 2 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs text-slate-400 tabular-nums">{booking.phone}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/6" />

        {/* Price + booking type row */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-0.5">Loại đặt</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-slate-300 bg-white/5 border-white/10">
              {booking.bookingType === "monthly" ? "Vé tháng" : "Đặt lẻ"}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-0.5">Tổng tiền</p>
            <p className="text-base font-black text-jade tabular-nums leading-none">
              {VND(booking.totalPrice ?? 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Revenue row in the booking list ─────────────────────────────────────────

function BookingRow({ booking, onView }: { booking: BookingRecord; onView: (b: BookingRecord) => void }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 items-center px-3 py-2.5 rounded-xl border border-white/6 bg-white/3 hover:bg-white/5 hover:border-jade/20 transition text-xs cursor-pointer" onClick={() => onView(booking)}>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLOR[booking.status]}`}>
        {STATUS_LABEL[booking.status]}
      </span>
      <div className="min-w-0">
        <p className="text-white font-medium truncate">{booking.name}</p>
        <p className="text-slate-400 tabular-nums text-[10px]">{booking.phone}</p>
        {booking.email && <p className="text-slate-500 tabular-nums text-[10px] truncate">{booking.email}</p>}
        <p className="text-slate-600 tabular-nums text-[9px]">{booking.date} · Sân {booking.court} · {booking.start}–{booking.end}</p>
      </div>
      <span className="text-jade font-semibold tabular-nums shrink-0">{VND(booking.totalPrice ?? 0)}</span>
      <span className="text-slate-600 text-[10px] tabular-nums shrink-0 hidden sm:block">{DISPLAY_DATETIME(booking.createdAt)}</span>
    </div>
  );
}


// ─── Booking Details Dialog ───────────────────────────────────────────────────


// ─── Details Dialog — shows full booking info + status actions ──────────────

function DetailsDialog({
  booking: initialBooking,
  onStatusChange,
  onClose,
}: {
  booking: BookingRecord;
  onStatusChange: (id: string, groupId: string, status: BookingStatus) => Promise<void>;
  onClose: () => void;
}) {
  const [booking, setBooking] = useState(initialBooking);
  const [busy,        setBusy]       = useState<string | null>(null);  // which button is loading

  const durationMin = (() => {
    const [sh, sm] = booking.start.split(":").map(Number);
    const [eh, em] = booking.end.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  })();
  const durationLabel = formatDuration(minutesToDuration(durationMin));

  const handleStatus = async (newStatus: BookingStatus) => {
    setBusy(newStatus);
    await onStatusChange(booking.id, booking.groupId, newStatus);
    setBooking((b) => ({ ...b, status: newStatus }));
    setBusy(null);
  };

  const payLabel =
    booking.status === "confirmed"           ? "Đã thanh toán"  :
    booking.status === "pending_verification" ? "Chờ xác nhận"  :
    booking.status === "rejected"            ? "Không thanh toán" :
                                               "Đã hủy";

  const infoRows: [string, string | React.ReactNode][] = [
    ["Mã đặt sân",   <code key="id" className="text-[10px] font-mono text-slate-400 break-all">{booking.id}</code>],
    ["Loại vé",      booking.bookingType === "monthly" ? "Vé tháng" : "Đặt lẻ"],
    ["Sân",          `Sân ${booking.court}`],
    ["Ngày",         booking.date],
    ["Giờ",          `${booking.start} – ${booking.end}`],
    ["Thời lượng",   durationLabel],
    ["Tổng tiền",    VND(booking.totalPrice ?? 0)],
    ["Thanh toán",   payLabel],
    ["Tạo lúc",      new Date(booking.createdAt).toLocaleString("vi-VN")],
    ...(booking.verifiedAt
      ? [["Xác nhận lúc", new Date(booking.verifiedAt).toLocaleString("vi-VN")] as [string, string]]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[#15392C] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div>
            <p className="text-sm font-bold text-white">Chi tiết đặt sân</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {booking.date} · Sân {booking.court} · {booking.start}–{booking.end}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white transition p-1.5 rounded-lg hover:bg-white/8"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Current status badge */}
          <div className="flex items-center justify-center">
            <span className={`text-xs font-bold px-5 py-2 rounded-full border ${STATUS_COLOR[booking.status]}`}>
              {STATUS_LABEL[booking.status]}
            </span>
          </div>

          {/* ── Status action buttons ──────────────────────────────────── */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-3">
            <p className="text-[10px] uppercase tracking-widest text-jade/60 font-semibold mb-2.5">
              Thay đổi trạng thái
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={booking.status === "confirmed" || busy !== null}
                onClick={() => handleStatus("confirmed")}
                className={[
                  "rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5",
                  booking.status === "confirmed"
                    ? "bg-jade/20 text-jade border border-jade/30 cursor-not-allowed opacity-60"
                    : "bg-jade text-[#0E2A21] hover:bg-jade-light active:scale-95",
                ].join(" ")}
              >
                {busy === "confirmed" ? (
                  <span className="animate-pulse">Đang xử lý...</span>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Xác nhận
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={booking.status === "rejected" || busy !== null}
                onClick={() => handleStatus("rejected")}
                className={[
                  "rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5",
                  booking.status === "rejected"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed opacity-60"
                    : "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 active:scale-95",
                ].join(" ")}
              >
                {busy === "rejected" ? (
                  <span className="animate-pulse">Đang xử lý...</span>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2 2l8 8M10 2L2 10" strokeLinecap="round"/>
                    </svg>
                    Từ chối
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={booking.status === "pending_verification" || busy !== null}
                onClick={() => handleStatus("pending_verification")}
                className={[
                  "rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5",
                  booking.status === "pending_verification"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed opacity-60"
                    : "bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 active:scale-95",
                ].join(" ")}
              >
                {busy === "pending_verification" ? (
                  <span className="animate-pulse">Đang xử lý...</span>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="6" cy="6" r="4.5"/><path d="M6 4v2.5l1.5 1.5" strokeLinecap="round"/>
                    </svg>
                    Chờ xác nhận
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={booking.status === "cancelled" || busy !== null}
                onClick={() => handleStatus("cancelled")}
                className={[
                  "rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5",
                  booking.status === "cancelled"
                    ? "bg-slate-700/50 text-slate-500 border border-slate-600/30 cursor-not-allowed opacity-60"
                    : "bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 active:scale-95",
                ].join(" ")}
              >
                {busy === "cancelled" ? (
                  <span className="animate-pulse">Đang xử lý...</span>
                ) : "Hủy đặt sân"}
              </button>
            </div>
          </div>

          {/* ── Customer info ──────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-jade/60 font-semibold mb-2">Khách hàng</p>
            <div className="rounded-2xl border border-white/8 bg-white/3 divide-y divide-white/5">
              <div className="flex items-center gap-3 px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-jade/60 shrink-0">
                  <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M2 12.5c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <div>
                  <p className="text-[10px] text-slate-500">Họ tên</p>
                  <p className="text-sm font-semibold text-white">{booking.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-jade/60 shrink-0">
                  <path d="M2.5 3C2.5 2.3 3 1.8 3.6 1.8L5.4 2.4l.6 2.4-1.2.6C5.2 6.7 6 7.8 7 8.5l.6-1.2L10 7.9l.6 1.8c0 .6-.5 1.1-1.2 1.1C4.8 10.8 2.5 6.9 2.5 3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
                <div>
                  <p className="text-[10px] text-slate-500">Số điện thoại</p>
                  <a href={`tel:${booking.phone}`} className="text-sm font-semibold text-white hover:text-jade transition">
                    {booking.phone}
                  </a>
                </div>
              </div>
              {booking.email && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-jade/60 shrink-0">
                    <rect x="1.5" y="3" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M1.5 5.5l5.5 3.5 5.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <p className="text-[10px] text-slate-500">Email</p>
                    <a href={`mailto:${booking.email}`} className="text-sm font-semibold text-white hover:text-jade transition break-all">
                      {booking.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Booking details ────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-jade/60 font-semibold mb-2">Thông tin đặt sân</p>
            <div className="rounded-2xl border border-white/8 bg-white/3 divide-y divide-white/5">
              {infoRows.map(([label, value]) => (
                <div key={String(label)} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
                  <span className={`text-[11px] font-semibold text-right ${label === "Tổng tiền" ? "text-jade" : "text-white"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-5 py-4 border-t border-white/8 bg-[#0E2A21]/50">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-300 hover:border-jade/40 hover:text-jade transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminBookingsPage() {
  const { showToast } = useToast();

  // ── View mode & date state ─────────────────────────────────────────────────
  const [viewMode, setViewMode]   = useState<ViewMode>("revenue");
  const [selectedDate, setSelectedDate] = useState(formatDateStr(new Date()));
  const [courtFilter, setCourtFilter]   = useState<CourtFilter>("all");

  // ── Revenue period state ───────────────────────────────────────────────────
  const [preset, setPreset]       = useState<PeriodPreset>("this_month");
  const [customStart, setCustomStart] = useState(formatDateStr(new Date()));
  const [customEnd,   setCustomEnd]   = useState(formatDateStr(new Date()));
  const [showCustom, setShowCustom]   = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [summary,    setSummary]    = useState<RevenueSummary | null>(null);
  const [range,      setRange]      = useState<DateRange | null>(null);
  const [revBookings, setRevBookings] = useState<BookingRecord[]>([]);
  const [quickStats, setQuickStats]   = useState<QuickStats | null>(null);
  const [calBookings, setCalBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading]         = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [viewing, setViewing]           = useState<BookingRecord | null>(null);

  const fetchRef = useRef<AbortController | null>(null);

  // ── Fetch revenue data ─────────────────────────────────────────────────────
  const fetchRevenue = useCallback(async () => {
    if (fetchRef.current) fetchRef.current.abort();
    const ctrl = new AbortController();
    fetchRef.current = ctrl;
    setLoading(true);

    const params = new URLSearchParams({ preset, court: courtFilter });
    if (preset === "custom") {
      params.set("start", customStart);
      params.set("end",   customEnd);
    }

    try {
      const res  = await fetch(`/api/admin-report?${params}`, { signal: ctrl.signal });
      const data = await res.json();
      if (ctrl.signal.aborted) return;
      setSummary(data.summary);
      setRange(data.range);
      setRevBookings(data.bookings ?? []);
      setQuickStats(data.quickStats);
    } catch (e) {
      if (!(e instanceof DOMException)) showToast("Không thể tải dữ liệu báo cáo", "error");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [preset, courtFilter, customStart, customEnd, showToast]);

  // ── Fetch calendar bookings ────────────────────────────────────────────────
  const fetchCalendar = useCallback(async (date: string) => {
    try {
      const res  = await fetch(`/api/admin-bookings?date=${date}&court=${courtFilter === "all" ? "all" : courtFilter}`);
      const data = await res.json();
      setCalBookings(data.bookings ?? []);
    } catch {
      // silently ignore
    }
  }, [courtFilter]);

  useEffect(() => {
    if (viewMode === "revenue") fetchRevenue();
  }, [viewMode, fetchRevenue]);

  useEffect(() => {
    if (viewMode === "calendar") fetchCalendar(selectedDate);
  }, [viewMode, selectedDate, courtFilter, fetchCalendar]);

  // ── Status change + delete (called from DetailsDialog) ─────────────────────

  const handleStatusChange = async (id: string, _groupId: string, status: BookingStatus): Promise<void> => {
    await fetch("/api/admin-bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch: { status } }),
    });
    fetchCalendar(selectedDate);
    showToast(`Đã cập nhật: ${STATUS_LABEL[status]}`, "success");
  };

  // Handle preset switch
  const handlePreset = (p: PeriodPreset) => {
    setPreset(p);
    setShowCustom(p === "custom");
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = { preset, court: courtFilter };
      if (preset === "custom") { params.start = customStart; params.end = customEnd; }

      const res = await fetch("/api/admin-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob     = await res.blob();
      const filename = res.headers.get("Content-Disposition")
        ?.match(/filename="(.+)"/)?.[1] ?? "revenue_report.xlsx";
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      showToast("Xuất Excel thành công", "success");
    } catch {
      showToast("Xuất Excel thất bại. Vui lòng thử lại.", "error");
    } finally {
      setExporting(false);
    }
  };



  // ── Calendar view data ─────────────────────────────────────────────────────
  const { c1, c2 } = useMemo(() => groupByCourt(calBookings), [calBookings]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top bar: mode toggle + court filter + export ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-white/8 bg-[#0E2A21] shrink-0">
        {/* View toggle */}
        <div className="flex rounded-xl border border-white/10 overflow-hidden">
          {(["revenue", "calendar"] as ViewMode[]).map((m) => (
            <button key={m} type="button" onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === m ? "bg-jade text-[#0E2A21]" : "text-slate-400 hover:text-white"
              }`}>
              {m === "revenue" ? "Doanh thu" : "Lịch đặt sân"}
            </button>
          ))}
        </div>

        {/* Court filter */}
        <div className="flex rounded-xl border border-white/10 overflow-hidden">
          {(["all","1","2"] as CourtFilter[]).map((c) => (
            <button key={c} type="button" onClick={() => setCourtFilter(c)}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                courtFilter === c ? "bg-jade/20 text-jade" : "text-slate-400 hover:text-white"
              }`}>
              {c === "all" ? "Tất cả" : `Sân ${c}`}
            </button>
          ))}
        </div>

        {/* Revenue: period selector */}
        {viewMode === "revenue" && (
          <select value={preset} onChange={(e) => handlePreset(e.target.value as PeriodPreset)}
            className="bg-[#15392C] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-jade appearance-none">
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        {/* Custom date range pickers */}
        {viewMode === "revenue" && showCustom && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="bg-[#15392C] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-jade"/>
            <span className="text-slate-500 text-xs">→</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-[#15392C] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-jade"/>
            <button type="button" onClick={fetchRevenue}
              className="rounded-xl bg-jade px-3 py-1.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light transition">
              Áp dụng
            </button>
          </div>
        )}

        {/* Export button */}
        <div className="ml-auto">
          <button type="button" onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 rounded-xl border border-jade/30 bg-jade/8 px-4 py-1.5 text-xs font-semibold text-jade hover:bg-jade/15 transition disabled:opacity-50">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6.5 1v8M3 6l3.5 3.5L10 6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 10.5h11" strokeLinecap="round"/>
            </svg>
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
        </div>
      </div>

      {/* ── Revenue view ── */}
      {viewMode === "revenue" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Quick stats row — always shows today / this week / this month */}
          {quickStats && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Hôm nay" value={VND(quickStats.today)} />
              <StatCard label="Tuần này" value={VND(quickStats.thisWeek)} />
              <StatCard label="Tháng này" value={VND(quickStats.thisMonth)} accent />
            </div>
          )}

          {/* Period header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Kỳ báo cáo</p>
              <p className="text-sm font-semibold text-white mt-0.5">{range?.label ?? "..."}</p>
            </div>
            {loading && <div className="w-5 h-5 rounded-full border-2 border-jade/30 border-t-jade animate-spin" />}
          </div>

          {/* Main stats grid */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Doanh thu xác nhận" value={VND(summary.confirmedRevenue)} accent />
              <StatCard label="Doanh thu chờ xác nhận" value={VND(summary.pendingRevenue)} />
              <StatCard label="Doanh thu ròng" value={VND(summary.netRevenue)} />
              <StatCard label="Tổng lịch đặt" value={String(summary.totalBookings)}
                sub={`${summary.confirmedBookings} xác nhận · ${summary.pendingBookings} chờ`} />
              <StatCard label="Đã hủy / Từ chối" value={String(summary.cancelledBookings)} />
              <StatCard label="Trung bình / lịch" value={VND(summary.avgBookingValue)} />
            </div>
          )}

          {/* Booking list for this period */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
              Danh sách lịch đặt ({revBookings.length})
            </p>
            {revBookings.length === 0 && !loading && (
              <p className="text-xs text-slate-600 text-center py-6">Không có lịch đặt trong kỳ này.</p>
            )}
            <div className="space-y-1.5">
              {revBookings.map((b) => (
                <BookingRow key={b.id} booking={b} onView={setViewing} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Calendar view ── */}
      {viewMode === "calendar" && (
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Sidebar: calendar */}
          <aside className="sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r border-white/8 bg-[#15392C] overflow-y-auto">
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-jade/70 font-bold mb-3">Chọn ngày</p>
              <Calendar selectedDate={selectedDate} onChange={setSelectedDate} allowPastDates />
            </div>
          </aside>

          {/* Booking blocks */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-white">{selectedDate}</p>
              <p className="text-[10px] text-slate-500">{calBookings.length} lịch đặt</p>
            </div>

            {calBookings.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-10">Không có lịch đặt sân nào trong ngày này.</p>
            ) : (
              <div className={courtFilter === "all" ? "grid sm:grid-cols-2 gap-4" : ""}>
                {/* Court 1 */}
                {(courtFilter === "all" || courtFilter === "1") && c1.length > 0 && (
                  <div>
                    {courtFilter === "all" && (
                      <p className="text-[10px] uppercase tracking-widest text-jade/60 font-bold mb-2">Sân 1</p>
                    )}
                    <div className="space-y-2">
                      {c1.map((b) => <BookingBlock key={b.id} booking={b} onView={setViewing} />)}
                    </div>
                  </div>
                )}
                {/* Court 2 */}
                {(courtFilter === "all" || courtFilter === "2") && c2.length > 0 && (
                  <div>
                    {courtFilter === "all" && (
                      <p className="text-[10px] uppercase tracking-widest text-jade/60 font-bold mb-2">Sân 2</p>
                    )}
                    <div className="space-y-2">
                      {c2.map((b) => <BookingBlock key={b.id} booking={b} onView={setViewing} />)}
                    </div>
                  </div>
                )}
                {courtFilter !== "all" && c1.length === 0 && c2.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-6">Không có lịch cho sân này.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details dialog */}
      {viewing && (
        <DetailsDialog
          booking={viewing}
          onStatusChange={handleStatusChange}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
