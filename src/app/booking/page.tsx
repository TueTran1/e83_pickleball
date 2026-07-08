"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BookingSlot,
  TimeRange,
  SimpleHours,
  SimpleTier,
  SimpleInternalSlot,
  generateSlots,
  markTakenSlots,
  mergeJointAvailability,
  buildSelectedRange,
  isRangeValid,
  calculateRangePrice,
  computeEndTime,
  getDurationOptions,
  getAllStartMarks,
  isPastDate,
  isTooSoonToBook,
  formatDateStr,
  formatDuration,
  DEFAULT_DURATION,
  setLiveBookingConfig,
  getLiveInternalSlots,
} from "@/lib/bookingLogic";
import Calendar from "@/components/Calendar";
import Logo from "@/components/Logo";
import MobileTimetable from "@/components/MobileTimetable";
import DesktopTimetable from "@/components/DesktopTimetable";
import ContactBar from "@/components/ContactBar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DISPLAY_DATE = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
};

// ─── Main Content ─────────────────────────────────────────────────────────────

function BookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminMode = searchParams.get("admin") === "1";

  // Live config — fetched from /api/booking-config so the page always reflects
  // whatever the admin last saved in Admin Settings (hours + pricing).
  const [hours, setHours] = useState<SimpleHours>({ start: "05:30", end: "21:00" });
  const [tiers, setTiers] = useState<SimpleTier[]>([]);
  const [internalSlots, setInternalSlots] = useState<SimpleInternalSlot[]>([]);
  const [configReady, setConfigReady] = useState(false);

  const fetchConfig = useCallback(() => {
    fetch("/api/booking-config")
      .then((r) => r.json())
      .then((d) => {
        const liveHours: SimpleHours = d.operatingHours ?? { start: "05:30", end: "21:00" };
        const liveTiers: SimpleTier[] = d.pricingTiers ?? [];
        const liveSlots: SimpleInternalSlot[] = d.internalSlots ?? [];
        setHours(liveHours);
        setTiers(liveTiers);
        setInternalSlots(liveSlots);
        setLiveBookingConfig(liveHours, liveTiers, liveSlots);
        setBookingLocked(Boolean(d.bookingLocked));
        setConfigReady(true);
      })
      .catch(() => setConfigReady(true));
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // Re-sync config whenever the tab regains focus, so changes made by an admin
  // in another tab/session are picked up without a manual refresh.
  useEffect(() => {
    const onFocus = () => fetchConfig();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchConfig]);

  const ALL_START_MARKS = useMemo(() => getAllStartMarks(hours), [hours]);

  // Core state
  const [selectedDate, setSelectedDate] = useState(formatDateStr(new Date()));
  const [activeCourtTab, setActiveCourtTab] = useState<1 | 2>(1);
  const [bothCourts, setBothCourts] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<string>(DEFAULT_DURATION);

  // Server data
  const [bookedC1, setBookedC1] = useState<TimeRange[]>([]);
  const [bookedC2, setBookedC2] = useState<TimeRange[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingLocked, setBookingLocked] = useState(false);

  const dateIsPast = isPastDate(selectedDate);
  const readOnlyMode = isAdminMode && dateIsPast;

  // ── Fetch bookings ─────────────────────────────────────────────────────────
  const fetchRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (fetchRef.current) fetchRef.current.abort();
    const ctrl = new AbortController();
    fetchRef.current = ctrl;
    setLoading(true);
    setSelectedStart(null);
    setSelectedDuration(DEFAULT_DURATION);

    const fetchCourt = async (court: 1 | 2): Promise<TimeRange[]> => {
      const res = await fetch(`/api/bookings?date=${selectedDate}&court=${court}`, { signal: ctrl.signal });
      if (!res.ok) return [];
      return res.json();
    };

    Promise.all([fetchCourt(1), fetchCourt(2)])
      .then(([c1, c2]) => {
        if (ctrl.signal.aborted) return;
        setBookedC1(c1);
        setBookedC2(c2);
      })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });

    return () => ctrl.abort();
  }, [selectedDate]);

  // ── Slot computation ───────────────────────────────────────────────────────
  const dateObj = useMemo(() => new Date(selectedDate + "T00:00:00"), [selectedDate]);

  const rawC1 = useMemo(() => generateSlots(dateObj, 1, false, hours, internalSlots), [dateObj, hours, internalSlots]);
  const rawC2 = useMemo(() => generateSlots(dateObj, 2, false, hours, internalSlots), [dateObj, hours, internalSlots]);
  const slotsC1 = useMemo(() => markTakenSlots(rawC1, bookedC1), [rawC1, bookedC1]);
  const slotsC2 = useMemo(() => markTakenSlots(rawC2, bookedC2), [rawC2, bookedC2]);

  const applyTimeCutoff = useCallback(
    (slots: BookingSlot[]): BookingSlot[] => {
      if (isAdminMode) return slots;
      return slots.map((slot) =>
        slot.status === "available" && isTooSoonToBook(selectedDate, slot.startTime)
          ? { ...slot, status: "restricted" as const }
          : slot
      );
    },
    [selectedDate, isAdminMode]
  );

  const finalC1 = useMemo(() => applyTimeCutoff(slotsC1), [slotsC1, applyTimeCutoff]);
  const finalC2 = useMemo(() => applyTimeCutoff(slotsC2), [slotsC2, applyTimeCutoff]);

  const jointSlots = useMemo(() => mergeJointAvailability(finalC1, finalC2), [finalC1, finalC2]);

  const displaySlots: BookingSlot[] = useMemo(() => {
    if (bothCourts) return jointSlots;
    return activeCourtTab === 1 ? finalC1 : finalC2;
  }, [bothCourts, activeCourtTab, finalC1, finalC2, jointSlots]);

  // ── Duration options ────────────────────────────────────────────────────────
  const durationOptions = useMemo(
    () => (selectedStart ? getDurationOptions(selectedStart, hours) : []),
    [selectedStart, hours]
  );

  const computedEnd = useMemo(
    () => (selectedStart ? computeEndTime(selectedStart, selectedDuration, hours) : null),
    [selectedStart, selectedDuration, hours]
  );

  // ── Selection logic ────────────────────────────────────────────────────────
  const selectedRange = useMemo(() => {
    if (!selectedStart || !computedEnd) return [];
    return buildSelectedRange(displaySlots, selectedStart, computedEnd);
  }, [displaySlots, selectedStart, computedEnd]);

  const selectionValid = useMemo(() => isRangeValid(selectedRange), [selectedRange]);

  const totalPrice = useMemo(() => {
    if (!selectionValid || !selectedStart || !computedEnd) return 0;
    return calculateRangePrice(selectedStart, computedEnd, bothCourts ? 2 : 1, tiers, dateObj);
  }, [selectionValid, selectedStart, computedEnd, bothCourts, tiers, dateObj]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSlotClick = useCallback(
    (slot: BookingSlot) => {
      if (readOnlyMode) return;
      if (slot.status !== "available") return;
      setSelectedStart(slot.startTime);
      const opts = getDurationOptions(slot.startTime, hours);
      setSelectedDuration(opts.includes(DEFAULT_DURATION) ? DEFAULT_DURATION : opts[0] ?? DEFAULT_DURATION);
    },
    [readOnlyMode, hours]
  );

  const handleManualStart = (value: string) => {
    setSelectedStart(value);
    const opts = getDurationOptions(value, hours);
    if (!opts.includes(selectedDuration)) {
      setSelectedDuration(opts.includes(DEFAULT_DURATION) ? DEFAULT_DURATION : opts[0] ?? DEFAULT_DURATION);
    }
  };

  const handleContinue = () => {
    if (readOnlyMode || !selectionValid || bookingLocked || !selectedStart || !computedEnd) return;
    const params = new URLSearchParams({
      date: selectedDate,
      court: bothCourts ? "both" : String(activeCourtTab),
      start: selectedStart,
      end: computedEnd,
      bothCourts: String(bothCourts),
    });
    router.push(`/checkout/info?${params.toString()}`);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0E2A21] text-white">
      {/* Admin banner */}
      {readOnlyMode && (
        <div className="w-full bg-jade/15 border-b border-jade/30 px-4 py-2 text-center text-xs text-jade">
          Chế độ admin — đang xem lịch của ngày đã qua (chỉ xem, không thể đặt sân)
        </div>
      )}

      {/* ══ MOBILE LAYOUT ══════════════════════════════════════════════════════ */}
      <div className="sm:hidden flex flex-col h-screen">
        {/* Mobile top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-[#15392C] shrink-0">
          <Link
            href="/"
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-slate-300 hover:text-jade transition"
            aria-label="Trang chủ"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l5-5 5 5M4 6v6h6V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <input
            type="date"
            value={selectedDate}
            min={isAdminMode ? undefined : formatDateStr(new Date())}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-jade"
          />
          <button
            type="button"
            role="switch"
            aria-checked={bothCourts}
            disabled={readOnlyMode}
            onClick={() => { setBothCourts((v) => !v); setSelectedStart(null); }}
            className={[
              "relative shrink-0 inline-flex items-center w-10 h-5 rounded-full transition-colors duration-200 disabled:opacity-50",
              bothCourts ? "bg-jade" : "bg-white/15",
            ].join(" ")}
          >
            <span className={[
              "block w-4 h-4 rounded-full shadow bg-white transition-transform duration-200",
              bothCourts ? "translate-x-[20px]" : "translate-x-[2px]",
            ].join(" ")} />
          </button>
          <span className="text-[10px] text-slate-400 shrink-0">2 sân</span>
        </div>

        {/* Mobile court tabs */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-[#15392C] shrink-0">
          {[1, 2].map((court) => (
            <button
              key={court}
              type="button"
              onClick={() => setActiveCourtTab(court as 1 | 2)}
              disabled={bothCourts}
              className={[
                "px-4 py-1.5 rounded-full text-xs font-semibold transition",
                bothCourts
                  ? "opacity-40 cursor-not-allowed border border-white/10 text-slate-500"
                  : activeCourtTab === court
                  ? "bg-jade text-[#0E2A21]"
                  : "border border-white/10 text-slate-400 hover:border-jade/50 hover:text-jade",
              ].join(" ")}
            >
              Sân {court}
            </button>
          ))}
          {bothCourts && <span className="text-[10px] text-jade font-medium">· Đặt cả 2</span>}
        </div>

        {/* Mobile timetable */}
        <div className="flex-1 overflow-hidden" style={{ paddingBottom: "88px" }}>
          <MobileTimetable
            slots={displaySlots}
            selectedStart={selectedStart}
            selectedDuration={selectedDuration}
            onSlotClick={handleSlotClick}
            onDurationChange={(d) => setSelectedDuration(d)}
            disabled={readOnlyMode}
            loading={loading}
            tiers={tiers}
          />
        </div>

        {/* Mobile sticky bottom bar */}
        {!readOnlyMode && (
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-jade/20 bg-[#0E2A21]/95 backdrop-blur-md px-4 py-3 shadow-[0_-8px_32px_rgba(107,213,172,0.1)]">
            {bookingLocked ? (
              <div className="text-center text-xs text-red-300 py-2">
                Đặt sân tạm thời bị khóa. Vui lòng thử lại sau.
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                    {bothCourts ? "Sân 1 + 2" : `Sân ${activeCourtTab}`}
                    {" · "}{selectedDate}
                  </p>
                  {selectedStart && computedEnd ? (
                    <p className="text-xs text-slate-300 mt-0.5 tabular-nums">
                      {selectedStart} – {computedEnd}
                      <span className="text-slate-500 ml-1.5">({formatDuration(selectedDuration)})</span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600 mt-0.5">Chưa chọn giờ</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {selectionValid && (
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Tổng</p>
                      <p className="text-base font-bold text-jade tabular-nums">
                        {totalPrice.toLocaleString("vi-VN")}đ
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!selectionValid || bookingLocked}
                    className={[
                      "rounded-full px-5 py-3 text-xs font-bold uppercase tracking-widest transition",
                      selectionValid && !bookingLocked
                        ? "bg-jade text-[#0E2A21] hover:bg-jade-light active:scale-95 shadow-jade"
                        : "bg-white/8 text-slate-600 cursor-not-allowed",
                    ].join(" ")}
                  >
                    Tiếp tục →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ DESKTOP LAYOUT — 3 columns ══════════════════════════════════════════ */}
      <div className="hidden sm:flex h-screen overflow-hidden">

        {/* ── LEFT: Calendar only ────────────────────────────────────────────── */}
        <aside className="w-[230px] shrink-0 h-full border-r border-white/8 bg-[#15392C] flex flex-col overflow-y-auto scrollbar-thin">
          {/* Logo/Nav */}
          <div className="px-4 pt-5 pb-4 border-b border-white/8 shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-jade transition mb-4"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M9 2.5L4 6.5l5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Trang chủ
            </Link>
            <Logo size={32} textSize="sm" />
          </div>

          {/* Calendar */}
          <div className="flex-1 px-3 py-4">
            <p className="text-[10px] uppercase tracking-widest text-jade/70 mb-3 font-semibold px-1">Chọn ngày</p>
            <Calendar selectedDate={selectedDate} onChange={setSelectedDate} allowPastDates={isAdminMode} />
            {!isAdminMode && (
              <p className="text-[10px] text-slate-600 mt-2 px-1 leading-relaxed">
                Không thể chọn ngày đã qua.
              </p>
            )}
          </div>
        </aside>

        {/* ── CENTER: Two-column timetable ───────────────────────────────────── */}
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden border-r border-white/8">
          {/* Court tab bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-[#15392C] shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mr-1">Sân</p>
            {[1, 2].map((court) => (
              <button
                key={court}
                type="button"
                onClick={() => setActiveCourtTab(court as 1 | 2)}
                disabled={bothCourts}
                className={[
                  "px-4 py-1.5 rounded-full text-xs font-semibold transition",
                  bothCourts
                    ? "opacity-40 cursor-not-allowed border border-white/10 text-slate-500"
                    : activeCourtTab === court
                    ? "bg-jade text-[#0E2A21]"
                    : "border border-white/10 text-slate-400 hover:border-jade/50 hover:text-jade",
                ].join(" ")}
              >
                Sân {court}
              </button>
            ))}
            {bothCourts && <span className="text-[10px] text-jade font-medium ml-1">· Đặt cả 2</span>}
            <div className="ml-auto text-xs text-slate-500 tabular-nums">
              {DISPLAY_DATE(selectedDate)}
            </div>
          </div>

          {/* Timetable */}
          <div className="flex-1 overflow-hidden">
            <DesktopTimetable
              slots={displaySlots}
              selectedStart={selectedStart}
              onSlotClick={handleSlotClick}
              disabled={readOnlyMode}
              loading={loading}
              tiers={tiers}
            />
          </div>
        </div>

        {/* ── RIGHT: Booking controls sidebar ───────────────────────────────── */}
        <aside className="w-[220px] shrink-0 h-full bg-[#15392C] flex flex-col overflow-y-auto scrollbar-thin">
          <div className="flex-1 px-3 py-4 space-y-4">

            {/* Section header */}
            <p className="text-[10px] uppercase tracking-widest text-jade/70 font-semibold px-1">
              Tùy chọn đặt sân
            </p>

            {/* Start time + Duration */}
            <div className="rounded-2xl bg-white/4 border border-white/8 p-3 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-jade/60 font-bold">Khung giờ</p>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase tracking-wide pl-1">Giờ bắt đầu</label>
                <select
                  value={selectedStart ?? ""}
                  onChange={(e) => handleManualStart(e.target.value)}
                  disabled={readOnlyMode}
                  className={[
                    "w-full rounded-xl bg-[#0E2A21] border px-2 py-2.5 text-center text-sm font-bold tabular-nums outline-none transition appearance-none",
                    readOnlyMode ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    selectedStart ? "border-jade/40 text-jade" : "border-white/8 text-slate-600",
                    "focus:border-jade",
                  ].join(" ")}
                >
                  <option value="" disabled>--:--</option>
                  {ALL_START_MARKS.map((t) => (
                    <option key={t} value={t} className="bg-[#0E2A21] text-white">{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase tracking-wide pl-1">Thời lượng</label>
                <select
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(e.target.value)}
                  disabled={!selectedStart || readOnlyMode}
                  className={[
                    "w-full rounded-xl bg-[#0E2A21] border px-2 py-2.5 text-center text-sm font-bold tabular-nums outline-none transition appearance-none",
                    !selectedStart || readOnlyMode
                      ? "border-white/8 text-slate-700 cursor-not-allowed opacity-50"
                      : "border-jade/40 text-jade cursor-pointer",
                    "focus:border-jade",
                  ].join(" ")}
                >
                  {durationOptions.map((d) => (
                    <option key={d} value={d} className="bg-[#0E2A21] text-white">{formatDuration(d)}</option>
                  ))}
                </select>
              </div>

              {selectedStart && computedEnd && (
                <p className="text-[10px] text-slate-500 px-1">
                  {selectedStart} – <span className="text-jade font-semibold">{computedEnd}</span>
                </p>
              )}
            </div>

            {/* Both Courts Toggle */}
            <div className="rounded-2xl bg-white/4 border border-white/8 p-3">
              <p className="text-[10px] uppercase tracking-widest text-jade/60 font-bold mb-2.5">Số sân</p>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Đặt cả 2 sân</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Giá nhân đôi</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={bothCourts}
                  disabled={readOnlyMode}
                  onClick={() => { setBothCourts((v) => !v); setSelectedStart(null); }}
                  className={[
                    "relative shrink-0 inline-flex items-center w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-jade disabled:opacity-50",
                    bothCourts ? "bg-jade" : "bg-white/15",
                  ].join(" ")}
                >
                  <span className={[
                    "block w-5 h-5 rounded-full shadow-md transition-transform duration-200 bg-white",
                    bothCourts ? "translate-x-[22px]" : "translate-x-[2px]",
                  ].join(" ")} />
                </button>
              </div>
            </div>

            {/* Pricing reference */}
            <div className="rounded-2xl bg-white/4 border border-white/8 p-3">
              <p className="text-[10px] uppercase tracking-widest text-jade/60 font-bold mb-2.5">Bảng giá</p>
              <div className="space-y-2">
                {tiers.length === 0 && (
                  <p className="text-[10px] text-slate-600">Đang tải bảng giá...</p>
                )}
                {(() => {
                  const maxRate = Math.max(...tiers.map((t) => t.rate), 0);
                  return tiers.map((tier) => {
                    const isHighest = tier.rate === maxRate && maxRate > 0;
                    return (
                      <div key={`${tier.start}-${tier.end}`} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1 h-3.5 rounded-full shrink-0 ${isHighest ? "bg-amber-500/50" : "bg-jade/40"}`} />
                          <span className="text-[10px] text-slate-500 tabular-nums leading-none">
                            {tier.start}–{tier.end}
                          </span>
                        </div>
                        <span className={`text-[11px] font-bold tabular-nums leading-none ${isHighest ? "text-amber-300" : "text-jade"}`}>
                          {(tier.rate / 1000).toFixed(0)}k/h
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Desktop sticky bottom action */}
          {!readOnlyMode && (
            <div className="shrink-0 border-t border-jade/15 bg-[#0E2A21]/95 p-3">
              {bookingLocked ? (
                <p className="text-center text-xs text-red-300 py-2">
                  Đặt sân tạm thời bị khóa.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectionValid && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Tổng</span>
                      <span className="text-sm font-bold text-jade tabular-nums">
                        {totalPrice.toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!selectionValid || bookingLocked}
                    className={[
                      "w-full rounded-full py-3 text-xs font-bold uppercase tracking-widest transition",
                      selectionValid && !bookingLocked
                        ? "bg-jade text-[#0E2A21] hover:bg-jade-light active:scale-95 shadow-jade"
                        : "bg-white/8 text-slate-600 cursor-not-allowed",
                    ].join(" ")}
                  >
                    Tiếp tục →
                  </button>
                  {!selectionValid && (
                    <p className="text-[10px] text-slate-600 text-center">
                      Chọn giờ bắt đầu trong bảng
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

export default function BookingPage() {
  return (
    <Suspense>
      <BookingPageContent />
    </Suspense>
  );
}
