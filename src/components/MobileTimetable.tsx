"use client";

import { memo } from "react";
import {
  BookingSlot,
  TimetableRow,
  SimpleTier,
  collapseSlots,
  getDurationOptions,
  formatDuration,
  maskPhone,
  getLiveTiers,
} from "@/lib/bookingLogic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MobileTimetableProps {
  slots: BookingSlot[];
  selectedStart: string | null;
  selectedDuration: string;
  onSlotClick: (slot: BookingSlot) => void;
  onDurationChange: (d: string) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Live pricing tiers from /api/booking-config. Falls back to in-memory live config if omitted. */
  tiers?: SimpleTier[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const findTier = (startTime: string, tiers: SimpleTier[]): SimpleTier | undefined => {
  const [hStr, mStr] = startTime.split(":");
  const totalMin = Number(hStr) * 60 + Number(mStr);
  return tiers.find((t) => {
    const [sh, sm] = t.start.split(":").map(Number);
    const [eh, em] = t.end.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return totalMin >= start && totalMin < end;
  });
};

/** Colour of the tier stripe on the left edge of each available slot cell */
const tierStripeClass = (startTime: string, tiers: SimpleTier[]): string => {
  if (tiers.length === 0) return "bg-jade/30";
  const maxRate = Math.max(...tiers.map((t) => t.rate));
  const tier = findTier(startTime, tiers);
  return tier && tier.rate === maxRate && maxRate > 0 ? "bg-amber-500/40" : "bg-jade/30";
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-1.5 px-3 pt-2">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded-xl bg-white/5 animate-pulse"
          style={{ opacity: 1 - i * 0.04 }}
        />
      ))}
    </div>
  );
}

// ─── Individual available/restricted slot cell ────────────────────────────────

const SlotCell = memo(function SlotCell({
  slot,
  isSelected,
  disabled,
  onClick,
  tiers,
}: {
  slot: BookingSlot;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
  tiers: SimpleTier[];
}) {
  const isAvail = slot.status === "available" && !disabled;
  const isRestricted = slot.status === "restricted";

  return (
    <button
      type="button"
      disabled={!isAvail}
      onClick={onClick}
      aria-label={`Chọn ${slot.startTime}`}
      className={[
        "relative flex items-center gap-1.5 w-full rounded-xl px-2.5 py-2 text-left transition active:scale-[0.97]",
        isSelected
          ? "bg-jade text-[#0E2A21] shadow-jade-sm"
          : isRestricted
          ? "bg-white/3 border border-white/5 cursor-not-allowed"
          : !isAvail
          ? "bg-white/3 border border-white/5 cursor-not-allowed opacity-40"
          : "bg-white/6 border border-white/10 hover:border-jade/40 hover:bg-jade/8 cursor-pointer",
      ].join(" ")}
      style={isRestricted ? {
        background: "repeating-linear-gradient(135deg, #0E2A21 0px, #0E2A21 5px, #1C4938 5px, #1C4938 10px)",
      } : undefined}
    >
      {/* Tier stripe */}
      {!isRestricted && !isSelected && (
        <span className={`shrink-0 w-1 h-4 rounded-full ${tierStripeClass(slot.startTime, tiers)}`} />
      )}
      <span className={[
        "text-xs font-bold tabular-nums leading-none",
        isSelected ? "text-[#0E2A21]" : isRestricted ? "text-slate-600" : "text-white",
      ].join(" ")}>
        {slot.startTime}
      </span>
    </button>
  );
});

// ─── Taken block — spans full width ──────────────────────────────────────────

const TakenBlock = memo(function TakenBlock({
  startTime,
  endTime,
  customerName,
  customerPhone,
}: {
  startTime: string;
  endTime: string;
  customerName?: string;
  customerPhone?: string;
}) {
  return (
    <div className="col-span-2 flex items-center gap-3 rounded-xl bg-slate-900/60 border border-white/5 px-3 py-2.5">
      {/* Strikethrough time badge */}
      <div className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1.5 text-center">
        <p className="text-[11px] font-bold tabular-nums text-slate-500 line-through leading-none">
          {startTime}
        </p>
        <p className="text-[9px] text-slate-600 mt-0.5 leading-none tabular-nums">–{endTime}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide leading-none">
          Đã đặt
        </p>
        {customerName && (
          <p className="text-xs text-slate-400 mt-0.5 truncate leading-none">
            {customerName}
            {customerPhone ? ` · ${maskPhone(customerPhone)}` : ""}
          </p>
        )}
      </div>
      <div className="shrink-0 w-2 h-2 rounded-full bg-red-400/60" />
    </div>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

export default function MobileTimetable({
  slots,
  selectedStart,
  selectedDuration,
  onSlotClick,
  onDurationChange,
  disabled = false,
  loading = false,
  tiers,
}: MobileTimetableProps) {
  const liveTiers = tiers ?? getLiveTiers();
  const rows: TimetableRow[] = collapseSlots(slots);
  const durationOptions = selectedStart ? getDurationOptions(selectedStart) : [];

  // Build the two-column layout: track which column the next available/restricted
  // slot lands in. Taken blocks reset the column counter (they're full-width).
  let colIndex = 0; // 0 = left, 1 = right

  const cells: React.ReactNode[] = [];

  for (const row of rows) {
    if (row.type === "taken_block") {
      // If we're mid-row (colIndex === 1), pad the empty left cell first
      if (colIndex === 1) {
        cells.push(<div key={`pad-${row.startTime}`} />);
        colIndex = 0;
      }
      cells.push(
        <TakenBlock
          key={`taken-${row.startTime}`}
          startTime={row.startTime}
          endTime={row.endTime}
          customerName={row.customerName}
          customerPhone={row.customerPhone}
        />
      );
      // colIndex stays 0 after a full-width block
    } else {
      const slot = row.slot;
      cells.push(
        <SlotCell
          key={slot.startTime}
          slot={slot}
          isSelected={slot.startTime === selectedStart}
          disabled={disabled}
          onClick={() => onSlotClick(slot)}
          tiers={liveTiers}
        />
      );
      colIndex = colIndex === 0 ? 1 : 0;
    }
  }

  if (loading) return <GridSkeleton />;

  const maxRate = liveTiers.length > 0 ? Math.max(...liveTiers.map((t) => t.rate)) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Two-column slot grid ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-1.5 px-3 pt-2 pb-3">
          {cells}
        </div>

        {/* Legend — reflects live pricing from Admin Settings */}
        <div className="flex items-center gap-4 px-3 pb-2 pt-0.5">
          {liveTiers.filter((t) => t.rate !== maxRate).slice(0, 1).map((t) => (
            <div key={`legend-low-${t.start}`} className="flex items-center gap-1">
              <span className="w-1 h-3.5 rounded-full bg-jade/30" />
              <span className="text-[9px] text-slate-600 tabular-nums">{(t.rate / 1000).toFixed(0)}k/h</span>
            </div>
          ))}
          {liveTiers.filter((t) => t.rate === maxRate && maxRate > 0).slice(0, 1).map((t) => (
            <div key={`legend-high-${t.start}`} className="flex items-center gap-1">
              <span className="w-1 h-3.5 rounded-full bg-amber-500/40" />
              <span className="text-[9px] text-slate-600 tabular-nums">{(t.rate / 1000).toFixed(0)}k/h</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "repeating-linear-gradient(135deg,#0E2A21 0px,#0E2A21 3px,#1C4938 3px,#1C4938 6px)" }} />
            <span className="text-[9px] text-slate-600">Nội bộ</span>
          </div>
        </div>
      </div>

      {/* ── Bottom panel: Pricing left | Duration right ── */}
      <div className="border-t border-white/8 grid grid-cols-2 divide-x divide-white/8">

        {/* Left: Pricing table — live from Admin Settings */}
        <div className="px-3 py-3 space-y-2">
          <p className="text-[9px] uppercase tracking-widest text-jade/60 font-bold mb-1.5">Bảng giá</p>
          {liveTiers.length === 0 && (
            <p className="text-[10px] text-slate-600">Đang tải...</p>
          )}
          {liveTiers.map((tier) => {
            const isHighest = tier.rate === maxRate && maxRate > 0;
            return (
              <div key={`${tier.start}-${tier.end}`} className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1 h-3.5 rounded-full shrink-0 ${isHighest ? "bg-amber-500/50" : "bg-jade/40"}`} />
                  <span className="text-[10px] text-slate-500 tabular-nums leading-none">
                    {tier.start}–{tier.end}
                  </span>
                </div>
                <span className={`text-[11px] font-bold tabular-nums leading-none ${isHighest ? "text-amber-300" : "text-jade"}`}>
                  {(tier.rate / 1000).toFixed(0)}k
                </span>
              </div>
            );
          })}
        </div>

        {/* Right: Duration selector */}
        <div className="px-3 py-3">
          <p className="text-[9px] uppercase tracking-widest text-jade/60 font-bold mb-1.5">Thời lượng</p>
          {!selectedStart ? (
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Chọn giờ bắt đầu để chọn thời lượng
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {durationOptions.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDurationChange(d)}
                  className={[
                    "rounded-lg px-2 py-1 text-[10px] font-semibold transition leading-none",
                    selectedDuration === d
                      ? "bg-jade text-[#0E2A21]"
                      : "bg-white/6 border border-white/10 text-slate-300 hover:border-jade/40 hover:text-jade",
                  ].join(" ")}
                >
                  {formatDuration(d)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
