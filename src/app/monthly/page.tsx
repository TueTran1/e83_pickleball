"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SimpleHours,
  SimpleTier,
  getAvailableMonthlyStartMarks,
  getMonthlyDurationOptions,
  computeEndTime,
  formatDuration,
  calculateRangePrice,
  calculateMonthlyPrice,
  calculateMonthlyPriceBeforeDiscount,
  MONTHLY_DISCOUNT_RATE,
  addDays,
  formatDateStr,
  DEFAULT_DURATION,
  setLiveBookingConfig,
} from "@/lib/bookingLogic";
import Calendar from "@/components/Calendar";
import ContactBar from "@/components/ContactBar";

const DISPLAY_DATE = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
};

interface ConflictDay {
  date: string;
  reason: string;
}

type Court = "1" | "2" | "both";

export default function MonthlyTicketPage() {
  const router = useRouter();

  // Live config — fetched from /api/booking-config, mirrors the booking page.
  const [hours, setHours] = useState<SimpleHours>({ start: "05:30", end: "21:00" });
  const [tiers, setTiers] = useState<SimpleTier[]>([]);

  useEffect(() => {
    const fetchConfig = () => {
      fetch("/api/booking-config")
        .then((r) => r.json())
        .then((d) => {
          const liveHours: SimpleHours = d.operatingHours ?? { start: "05:30", end: "21:00" };
          const liveTiers: SimpleTier[] = d.pricingTiers ?? [];
          setHours(liveHours);
          setTiers(liveTiers);
          setLiveBookingConfig(liveHours, liveTiers);
        })
        .catch(() => {});
    };
    fetchConfig();
    window.addEventListener("focus", fetchConfig);
    return () => window.removeEventListener("focus", fetchConfig);
  }, []);

  const [startDate, setStartDate] = useState(formatDateStr(new Date()));
  const [court, setCourt] = useState<Court>("1");
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(DEFAULT_DURATION);

  const [checking, setChecking] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictDay[] | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const endDate = useMemo(() => addDays(startDate, 29), [startDate]); // 30 days inclusive

  // Start marks depend on the chosen court — Court 2 / Both exclude internal-use windows entirely
  const startMarks = useMemo(() => getAvailableMonthlyStartMarks(court, hours), [court, hours]);

  const durationOptions = useMemo(
    () => (selectedStart ? getMonthlyDurationOptions(selectedStart, court, hours) : []),
    [selectedStart, court, hours]
  );

  const computedEnd = useMemo(
    () => (selectedStart ? computeEndTime(selectedStart, selectedDuration, hours) : null),
    [selectedStart, selectedDuration, hours]
  );

  const startDateObj = useMemo(() => new Date(startDate + "T00:00:00"), [startDate]);

  const dailyRate = useMemo(() => {
    if (!selectedStart || !computedEnd) return 0;
    return calculateRangePrice(selectedStart, computedEnd, court === "both" ? 2 : 1, tiers, startDateObj);
  }, [selectedStart, computedEnd, court, tiers, startDateObj]);

  const priceBeforeDiscount = useMemo(() => {
    if (!selectedStart || !computedEnd) return 0;
    return calculateMonthlyPriceBeforeDiscount(selectedStart, computedEnd, court === "both" ? 2 : 1, tiers);
  }, [selectedStart, computedEnd, court, tiers]);

  const totalPrice = useMemo(() => {
    if (!selectedStart || !computedEnd) return 0;
    return calculateMonthlyPrice(selectedStart, computedEnd, court === "both" ? 2 : 1, tiers);
  }, [selectedStart, computedEnd, court, tiers]);

  const discountAmount = priceBeforeDiscount - totalPrice;

  // When the court changes, the available start marks change too — re-validate the current selection
  useEffect(() => {
    if (selectedStart && !startMarks.includes(selectedStart)) {
      setSelectedStart(null);
      setConflicts(null);
    }
  }, [court, startMarks, selectedStart]);

  const handleStartChange = (value: string) => {
    setSelectedStart(value);
    const opts = getMonthlyDurationOptions(value, court, hours);
    if (!opts.includes(selectedDuration)) {
      setSelectedDuration(opts.includes(DEFAULT_DURATION) ? DEFAULT_DURATION : opts[0] ?? DEFAULT_DURATION);
    }
    setConflicts(null);
  };

  const handleCourtChange = (value: Court) => {
    setCourt(value);
    setConflicts(null);
  };

  const handleCheckAvailability = async () => {
    if (!selectedStart || !computedEnd) return;
    setChecking(true);
    setCheckError(null);
    setConflicts(null);

    try {
      const res = await fetch("/api/monthly-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, startTime: selectedStart, endTime: computedEnd, court }),
      });
      if (!res.ok) throw new Error("Check failed");
      const data = await res.json();
      setConflicts(data.conflicts ?? []);
    } catch {
      setCheckError("Không thể kiểm tra lịch. Vui lòng thử lại.");
    } finally {
      setChecking(false);
    }
  };

  const canProceed = selectedStart && computedEnd && conflicts !== null && conflicts.length === 0;

  const handleContinue = () => {
    if (!canProceed || !selectedStart || !computedEnd) return;
    const params = new URLSearchParams({
      type: "monthly",
      startDate,
      endDate,
      court,
      start: selectedStart,
      end: computedEnd,
    });
    router.push(`/checkout/info?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[#0E2A21] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-[#0E2A21]/90 backdrop-blur-md">
        <Link href="/" className="text-jade hover:opacity-70 transition">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <p className="text-sm font-semibold text-white">Mua vé tháng</p>
      </nav>

      <div className="max-w-md mx-auto px-5 py-6 pb-36 space-y-6">
        {/* Intro */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] uppercase tracking-widest text-jade/70 font-semibold">Vé tháng E83</p>
            <span className="rounded-full bg-jade/15 border border-jade/30 px-2 py-0.5 text-[10px] font-bold text-jade">
              Giảm 10%
            </span>
          </div>
          <h1 className="text-xl font-bold text-white leading-snug">
            Đặt một khung giờ cố định, sử dụng trong 30 ngày liên tiếp.
          </h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Chọn ngày bắt đầu, sân và khung giờ. Hệ thống sẽ kiểm tra toàn bộ 30 ngày — nếu có ngày trùng lịch, bạn cần đặt riêng cho ngày đó.
          </p>
        </div>

        {/* Start date */}
        <div className="rounded-2xl bg-white/4 border border-white/8 p-4">
          <p className="text-[10px] uppercase tracking-widest text-jade/70 mb-3 font-semibold">Ngày bắt đầu</p>
          <Calendar selectedDate={startDate} onChange={(d) => { setStartDate(d); setConflicts(null); }} />
          <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-between text-xs">
            <span className="text-slate-500">Hiệu lực đến</span>
            <span className="text-jade font-semibold tabular-nums">{DISPLAY_DATE(endDate)}</span>
          </div>
        </div>

        {/* Court selection */}
        <div className="rounded-2xl bg-white/4 border border-white/8 p-4">
          <p className="text-[10px] uppercase tracking-widest text-jade/70 mb-3 font-semibold">Chọn sân</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: "1", label: "Sân 1" },
              { id: "2", label: "Sân 2" },
              { id: "both", label: "Cả 2 sân" },
            ] as { id: Court; label: string }[]).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCourtChange(c.id)}
                className={[
                  "rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
                  court === c.id
                    ? "border-jade bg-jade/10 text-jade"
                    : "border-white/8 bg-white/3 text-slate-300 hover:border-jade/40",
                ].join(" ")}
              >
                {c.label}
              </button>
            ))}
          </div>
          {(court === "2" || court === "both") && (
            <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
              Sân 2 có khung giờ nội bộ (16:30–19:00 hàng ngày, 05:30–07:00 cuối tuần) — các khung giờ này không hiển thị để chọn cho vé tháng.
            </p>
          )}
        </div>

        {/* Time selection */}
        <div className="rounded-2xl bg-white/4 border border-white/8 p-4">
          <p className="text-[10px] uppercase tracking-widest text-jade/70 mb-3 font-semibold">Khung giờ hàng ngày</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 uppercase tracking-wide pl-1">Giờ bắt đầu</label>
              <select
                value={selectedStart ?? ""}
                onChange={(e) => handleStartChange(e.target.value)}
                className={[
                  "w-full rounded-xl bg-[#0E2A21] border px-2 py-2.5 text-center text-sm font-bold tabular-nums outline-none transition appearance-none cursor-pointer",
                  selectedStart ? "border-jade/40 text-jade" : "border-white/8 text-slate-600",
                  "focus:border-jade",
                ].join(" ")}
              >
                <option value="" disabled>--:--</option>
                {startMarks.map((t) => (
                  <option key={t} value={t} className="bg-[#0E2A21] text-white">{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 uppercase tracking-wide pl-1">Thời lượng</label>
              <select
                value={selectedDuration}
                onChange={(e) => { setSelectedDuration(e.target.value); setConflicts(null); }}
                disabled={!selectedStart}
                className={[
                  "w-full rounded-xl bg-[#0E2A21] border px-2 py-2.5 text-center text-xs font-bold outline-none transition appearance-none",
                  !selectedStart ? "border-white/8 text-slate-700 cursor-not-allowed" : "border-jade/40 text-jade cursor-pointer",
                  "focus:border-jade",
                ].join(" ")}
              >
                {durationOptions.map((d) => (
                  <option key={d} value={d} className="bg-[#0E2A21] text-white">{formatDuration(d)}</option>
                ))}
              </select>
            </div>
          </div>
          {selectedStart && computedEnd && (
            <p className="text-xs text-slate-400 mt-3">
              Mỗi ngày: <span className="text-jade font-semibold tabular-nums">{selectedStart} – {computedEnd}</span>
              <span className="text-slate-500"> ({formatDuration(selectedDuration)})</span>
            </p>
          )}
          <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
            Thời lượng không thể vượt quá giờ đóng cửa ({hours.end}) hoặc chạm vào khung giờ nội bộ.
          </p>
        </div>

        {/* Check availability */}
        {selectedStart && computedEnd && (
          <button
            type="button"
            onClick={handleCheckAvailability}
            disabled={checking}
            className="w-full rounded-full border border-jade/40 bg-jade/8 py-3.5 text-sm font-bold uppercase tracking-widest text-jade hover:bg-jade/15 active:scale-95 transition disabled:opacity-50"
          >
            {checking ? "Đang kiểm tra..." : "Kiểm tra lịch trống 30 ngày"}
          </button>
        )}

        {checkError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {checkError}
          </div>
        )}

        {/* Conflict results */}
        {conflicts !== null && (
          conflicts.length === 0 ? (
            <div className="rounded-2xl border border-jade/30 bg-jade/10 px-4 py-3 flex items-center gap-3">
              <span className="shrink-0 w-8 h-8 rounded-full bg-jade/20 flex items-center justify-center text-jade">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <p className="text-xs text-jade leading-relaxed">
                Khung giờ này trống trong toàn bộ 30 ngày. Bạn có thể tiếp tục đặt vé tháng.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M8 2L14.5 13.5H1.5L8 2z" strokeLinejoin="round"/>
                    <path d="M8 6.5v3M8 11.5h.01" strokeLinecap="round"/>
                  </svg>
                </span>
                <p className="text-xs text-amber-300 leading-relaxed">
                  Có {conflicts.length} ngày đã trùng lịch trong khung giờ này. Vui lòng đặt riêng cho các ngày dưới đây sau khi mua vé tháng.
                </p>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {conflicts.map((c) => (
                  <div key={c.date} className="flex items-center justify-between rounded-xl bg-[#0E2A21]/60 px-3 py-2 text-xs">
                    <span className="text-white font-medium tabular-nums">{DISPLAY_DATE(c.date)}</span>
                    <span className="text-amber-400">{c.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* Price summary */}
        {selectedStart && computedEnd && (
          <div className="rounded-2xl border border-jade/20 bg-jade/6 p-4">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
              <span>Đơn giá / ngày</span>
              <span className="text-white tabular-nums">{dailyRate.toLocaleString("vi-VN")}đ</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
              <span>Số ngày</span>
              <span className="text-white">30 ngày</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
              <span>Tạm tính</span>
              <span className="text-slate-300 tabular-nums line-through">{priceBeforeDiscount.toLocaleString("vi-VN")}đ</span>
            </div>
            <div className="flex justify-between items-center text-xs mb-3">
              <span className="text-jade">Giảm giá vé tháng ({Math.round(MONTHLY_DISCOUNT_RATE * 100)}%)</span>
              <span className="text-jade tabular-nums">-{discountAmount.toLocaleString("vi-VN")}đ</span>
            </div>
            <div className="pt-3 border-t border-white/8 flex justify-between items-center">
              <span className="text-xs text-slate-400">Tổng vé tháng</span>
              <span className="text-lg font-black text-jade tabular-nums">{totalPrice.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-5 py-4 border-t border-white/8 bg-[#0E2A21]/95 backdrop-blur-md">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canProceed}
          className={[
            "w-full rounded-full py-4 text-sm font-bold uppercase tracking-widest transition",
            canProceed
              ? "bg-jade text-[#0E2A21] shadow-jade hover:bg-jade-light active:scale-95"
              : "bg-white/8 text-slate-600 cursor-not-allowed",
          ].join(" ")}
        >
          {conflicts === null ? "Kiểm tra lịch trước khi tiếp tục" : "Tiếp tục →"}
        </button>
      </div>
    </main>
  );
}
