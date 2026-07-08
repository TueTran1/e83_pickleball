"use client";

import { memo } from "react";
import {
  BookingSlot,
  TimetableRow,
  SimpleTier,
  collapseSlots,
  maskPhone,
  getLiveTiers,
} from "@/lib/bookingLogic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DesktopTimetableProps {
  slots: BookingSlot[];
  selectedStart: string | null;
  onSlotClick: (slot: BookingSlot) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Live pricing tiers — pass the value fetched from /api/booking-config so the
   *  tier stripe color + legend always reflect the current Admin Settings price.
   *  Falls back to the in-memory live config if omitted. */
  tiers?: SimpleTier[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find which tier a slot's start time falls into, used for the colored stripe + legend */
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

/** Highest-rate tier gets the amber accent, everything else uses jade */
const tierStripeClass = (startTime: string, tiers: SimpleTier[]): string => {
  if (tiers.length === 0) return "bg-jade/30";
  const maxRate = Math.max(...tiers.map((t) => t.rate));
  const tier = findTier(startTime, tiers);
  return tier && tier.rate === maxRate && maxRate > 0 ? "bg-amber-500/40" : "bg-jade/30";
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-1.5 p-3">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded-xl bg-white/5 animate-pulse"
          style={{ opacity: 1 - i * 0.035 }}
        />
      ))}
    </div>
  );
}

// ─── Individual slot cell ─────────────────────────────────────────────────────

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
  const isPast  = slot.status === "restricted";

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
          : isPast
          ? "bg-white/3 border border-white/5 cursor-not-allowed"
          : !isAvail
          ? "bg-white/3 border border-white/5 cursor-not-allowed opacity-40"
          : "bg-white/6 border border-white/10 hover:border-jade/40 hover:bg-jade/8 cursor-pointer",
      ].join(" ")}
      style={
        isPast
          ? {
              background:
                "repeating-linear-gradient(135deg, #0E2A21 0px, #0E2A21 5px, #1C4938 5px, #1C4938 10px)",
            }
          : undefined
      }
    >
      {/* Tier stripe */}
      {!isPast && !isSelected && (
        <span className={`shrink-0 w-1 h-4 rounded-full ${tierStripeClass(slot.startTime, tiers)}`} />
      )}
      <span
        className={[
          "text-xs font-bold tabular-nums leading-none",
          isSelected ? "text-[#0E2A21]" : isPast ? "text-slate-600" : "text-white",
        ].join(" ")}
      >
        {slot.startTime}
      </span>
    </button>
  );
});

// ─── Taken block — full width ─────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function DesktopTimetable({
  slots,
  selectedStart,
  onSlotClick,
  disabled = false,
  loading = false,
  tiers,
}: DesktopTimetableProps) {
  const liveTiers = tiers ?? getLiveTiers();
  const rows: TimetableRow[] = collapseSlots(slots);

  // Build two-column layout (same logic as MobileTimetable)
  let colIndex = 0;
  const cells: React.ReactNode[] = [];

  for (const row of rows) {
    if (row.type === "taken_block") {
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
  const lowTier  = liveTiers.find((t) => t.rate !== maxRate) ?? liveTiers[0];
  const highTier = liveTiers.find((t) => t.rate === maxRate && maxRate > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Two-column grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-2 gap-1.5 p-3">
          {cells}
        </div>

        {/* Legend — reflects live pricing from Admin Settings */}
        <div className="flex items-center gap-4 px-3 pb-3">
          {lowTier && (
            <div className="flex items-center gap-1">
              <span className="w-1 h-3.5 rounded-full bg-jade/30" />
              <span className="text-[9px] text-slate-600 tabular-nums">{(lowTier.rate / 1000).toFixed(0)}k/h</span>
            </div>
          )}
          {highTier && (
            <div className="flex items-center gap-1">
              <span className="w-1 h-3.5 rounded-full bg-amber-500/40" />
              <span className="text-[9px] text-slate-600 tabular-nums">{(highTier.rate / 1000).toFixed(0)}k/h</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{
                background:
                  "repeating-linear-gradient(135deg,#0E2A21 0px,#0E2A21 3px,#1C4938 3px,#1C4938 6px)",
              }}
            />
            <span className="text-[9px] text-slate-600">Đã đặt</span>
          </div>
        </div>
      </div>
    </div>
  );
}
