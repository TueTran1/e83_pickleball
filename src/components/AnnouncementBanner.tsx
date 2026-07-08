"use client";

import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  message: string;
  affectedTimeStart?: string;
  affectedTimeEnd?: string;
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed]         = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/announcements")
      .then((r) => r.json())
      .then((d) => setAnnouncements(d.announcements ?? []))
      .catch(() => {});
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-0.5">
      {visible.map((a) => (
        <div key={a.id} className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center gap-3">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f59e0b" strokeWidth="1.5" className="shrink-0">
            <path d="M7 1.5L13 12H1L7 1.5z" strokeLinejoin="round"/>
            <path d="M7 5.5v3M7 10h.01" strokeLinecap="round"/>
          </svg>
          <p className="flex-1 text-xs text-amber-200 leading-relaxed">
            {a.message}
            {a.affectedTimeStart && a.affectedTimeEnd && (
              <span className="ml-1 text-amber-400/80">({a.affectedTimeStart}&ndash;{a.affectedTimeEnd})</span>
            )}
          </p>
          <button type="button" onClick={() => setDismissed((prev) => new Set(Array.from(prev).concat(a.id)))}
            className="shrink-0 text-amber-500/60 hover:text-amber-300 transition">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l8 8M10 2L2 10" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
