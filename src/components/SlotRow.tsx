"use client";

import { memo } from "react";
import { BookingSlot, maskPhone, getSlotPrice } from "@/lib/bookingLogic";

interface SlotRowProps {
  slot: BookingSlot;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  available: "Còn trống",
  taken: "Đã đặt",
  restricted: "Nội bộ",
};

const SlotRow = memo(function SlotRow({ slot, isSelected, disabled, onClick }: SlotRowProps) {
  const isAvailable = slot.status === "available" && !disabled;
  const isTaken = slot.status === "taken";
  const isRestricted = slot.status === "restricted";

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={onClick}
      aria-label={`${slot.startTime} — ${STATUS_LABELS[slot.status]}`}
      aria-disabled={!isAvailable}
      className={[
        "w-full text-left transition-all duration-150 relative overflow-hidden",
        "border px-4 py-3 rounded-2xl",
        isSelected
          ? "border-jade bg-jade/10 text-jade"
          : isTaken
          ? "border-white/5 bg-slate-900/40 text-slate-600 cursor-not-allowed"
          : isRestricted
          ? "border-white/5 cursor-not-allowed"
          : "border-white/8 bg-white/3 text-slate-200 hover:border-jade/50 hover:bg-jade/5 active:scale-[0.98]",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        isRestricted
          ? {
              background:
                "repeating-linear-gradient(135deg, #0E2A21 0px, #0E2A21 6px, #1C4938 6px, #1C4938 12px)",
            }
          : undefined
      }
    >
      {/* Left accent bar for selected start */}
      {isSelected && (
        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-jade rounded-r-sm" />
      )}

      <div className="flex items-center justify-between gap-3 pl-1">
        <div className="min-w-0 flex-1">
          <p className={[
            "text-sm font-semibold tabular-nums",
            isTaken ? "line-through text-slate-600" : "",
          ].join(" ")}>
            {slot.startTime}
          </p>

          {isTaken && slot.customerName ? (
            <p className="mt-1 text-xs text-slate-500 truncate">
              {slot.customerName}
              {slot.customerPhone ? ` · ${maskPhone(slot.customerPhone)}` : ""}
            </p>
          ) : (
            <p className={[
              "text-xs mt-0.5",
              isSelected ? "text-jade/70" : "text-slate-500",
            ].join(" ")}>
              {STATUS_LABELS[slot.status]}
            </p>
          )}
        </div>

        {/* Price only shown for available/selected slots — not for taken */}
        {!isRestricted && !isTaken && (
          <div className={[
            "shrink-0 rounded-xl px-2.5 py-1 text-xs font-medium tabular-nums",
            isSelected
              ? "bg-jade/20 text-jade"
              : "bg-white/5 text-slate-400",
          ].join(" ")}>
            {getSlotPrice(slot.startTime).toLocaleString("vi-VN")}đ
          </div>
        )}
      </div>
    </button>
  );
});

export default SlotRow;
