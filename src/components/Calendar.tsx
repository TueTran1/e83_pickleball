"use client";

import { useMemo, useState } from "react";

interface CalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  /** When true, past dates are selectable (admin viewing historical schedule) */
  allowPastDates?: boolean;
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS = [
  "Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
  "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12",
];

/** Format a Date using its LOCAL year/month/day — never use toISOString() here,
 *  since that converts to UTC first and silently shifts the date by one day
 *  in timezones ahead of UTC (e.g. Vietnam, UTC+7) for any local time before 07:00. */
const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = formatDate(new Date());

export default function Calendar({ selectedDate, onChange, allowPastDates = false }: CalendarProps) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const days = useMemo(() => {
    const firstDay = new Date(viewDate.year, viewDate.month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // week starts Monday
    const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewDate]);

  const prevMonth = () => {
    setViewDate((v) => {
      const d = new Date(v.year, v.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const nextMonth = () => {
    setViewDate((v) => {
      const d = new Date(v.year, v.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const handleSelect = (day: number) => {
    const d = new Date(viewDate.year, viewDate.month, day);
    const dateStr = formatDate(d);
    if (!allowPastDates && dateStr < today) return; // past dates unselectable for normal users
    onChange(dateStr);
  };

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-full text-jade-400 hover:bg-jade-900/40 transition"
          aria-label="Tháng trước"
        >
          ‹
        </button>
        <span className="text-xs font-semibold text-white tracking-wide">
          {MONTHS[viewDate.month]} {viewDate.year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-full text-jade-400 hover:bg-jade-900/40 transition"
          aria-label="Tháng sau"
        >
          ›
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-center text-[10px] font-medium text-slate-500 py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isPast = dateStr < today;
          const isDisabled = isPast && !allowPastDates;
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => handleSelect(day)}
              disabled={isDisabled}
              aria-disabled={isDisabled}
              title={isDisabled ? "Ngày đã qua — không thể đặt sân" : undefined}
              className={[
                "aspect-square w-full flex items-center justify-center rounded-full text-[11px] font-medium transition",
                isDisabled ? "text-slate-700 cursor-not-allowed" : "hover:bg-jade-800/40 cursor-pointer",
                isPast && allowPastDates && !isSelected ? "text-slate-500" : "",
                isSelected ? "!bg-jade text-[#0E2A21] font-bold shadow-jade-sm" : "",
                isToday && !isSelected ? "border border-jade/60 text-jade" : "",
                !isSelected && !isDisabled && !isToday && !(isPast && allowPastDates) ? "text-slate-300" : "",
              ].join(" ")}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
