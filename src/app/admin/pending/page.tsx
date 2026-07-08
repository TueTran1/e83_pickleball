"use client";

import { useEffect, useState } from "react";
import { formatDuration, minutesToDuration } from "@/lib/bookingLogic";
import { useAdminContext } from "@/context/AdminContext";
import { useToast } from "@/app/admin/layout";

interface PendingGroup {
  groupId: string;
  bookingType: "single" | "monthly";
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: string;
  endDate?: string;
  court: string;
  start: string;
  end: string;
  totalPrice: number;
  createdAt: number;
  dayCount: number;
}

const DISPLAY_DATETIME = (ts: number) =>
  new Date(ts).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AdminPendingPage() {
  const { decrementPending, refreshPending } = useAdminContext();
  const { showToast } = useToast();

  const [pendingGroups, setPendingGroups] = useState<PendingGroup[]>([]);
  const [loading, setLoading]             = useState(true);
  const [actioningId, setActioningId]     = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  const load = () => {
    setLoading(true); setError(null);
    fetch("/api/admin-pending")
      .then((r) => r.json())
      .then((data) => setPendingGroups(data.groups ?? []))
      .catch(() => setError("Không thể tải dữ liệu."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    refreshPending();
  }, []);

  const handleAction = async (groupId: string, action: "confirm" | "reject") => {
    setActioningId(groupId);
    try {
      const res = await fetch("/api/admin-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, action }),
      });
      if (!res.ok) throw new Error("Action failed");
      setPendingGroups((prev) => prev.filter((g) => g.groupId !== groupId));
      decrementPending(); // immediate badge update — no refresh needed
      showToast(
        action === "confirm" ? "Đã xác nhận thanh toán thành công" : "Đã từ chối đơn đặt sân",
        action === "confirm" ? "success" : "error"
      );
    } catch {
      showToast("Thao tác thất bại. Vui lòng thử lại.", "error");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#0E2A21]">
        <p className="text-sm font-semibold text-white">
          Đơn chờ xác nhận
          {pendingGroups.length > 0 && (
            <span className="ml-2 text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full">
              {pendingGroups.length}
            </span>
          )}
        </p>
        <button type="button" onClick={load} className="text-xs text-jade hover:underline">Làm mới</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full space-y-3">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 rounded-full border-2 border-jade/30 border-t-jade animate-spin" />
          </div>
        )}
        {error && <p className="text-xs text-red-400 text-center py-4">{error}</p>}
        {!loading && !error && pendingGroups.length === 0 && (
          <div className="text-center py-12 text-xs text-slate-500">Không có đơn nào đang chờ xác nhận.</div>
        )}

        {pendingGroups.map((g) => (
          <div key={g.groupId} className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-amber-400 font-semibold">
                {g.bookingType === "monthly" ? "Vé tháng" : "Đặt sân lẻ"}
              </span>
              <span className="text-[10px] text-slate-500">{DISPLAY_DATETIME(g.createdAt)}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {(
                [
                  ["Người đặt", g.customerName],
                  ["SĐT", g.customerPhone],
                  ...(g.customerEmail ? [["Email", g.customerEmail]] : []),
                  [
                    g.bookingType === "monthly" ? "Bắt đầu" : "Ngày",
                    g.date + (g.endDate ? ` – ${g.endDate}` : ""),
                  ],
                  [
                    "Sân",
                    (g.court === "both" ? "Sân 1 + 2" : `Sân ${g.court}`) +
                      (g.bookingType === "monthly" ? ` (${g.dayCount} ngày)` : ""),
                  ],
                  ["Giờ", `${g.start} – ${g.end}`],
                  ["Thời lượng", (() => { const [sh,sm]=g.start.split(":").map(Number); const [eh,em]=g.end.split(":").map(Number); return formatDuration(minutesToDuration((eh*60+em)-(sh*60+sm))); })()],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="contents">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-white font-medium truncate">{value}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/8 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Tổng tiền</p>
                <p className="text-base font-black text-jade tabular-nums">
                  {g.totalPrice.toLocaleString("vi-VN")}đ
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => handleAction(g.groupId, "confirm")}
                  disabled={actioningId === g.groupId}
                  className="rounded-full bg-jade px-4 py-2 text-xs font-bold text-[#0E2A21] hover:bg-jade-light active:scale-95 transition disabled:opacity-50">
                  {actioningId === g.groupId ? "..." : "Xác nhận"}
                </button>
                <button type="button"
                  onClick={() => handleAction(g.groupId, "reject")}
                  disabled={actioningId === g.groupId}
                  className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50">
                  Từ chối
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
