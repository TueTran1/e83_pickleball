"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BookingRecord } from "@/lib/db";
import { formatDuration, minutesToDuration } from "@/lib/bookingLogic";
import { useAdminContext } from "@/context/AdminContext";
import { useToast } from "@/app/admin/layout";

type StatusFilter = "all" | "pending_verification" | "confirmed" | "rejected" | "cancelled";

const STATUS_LABELS: Record<string, string> = {
  pending_verification: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

const STATUS_COLORS: Record<string, string> = {
  pending_verification: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  confirmed:            "text-jade bg-jade/10 border-jade/25",
  rejected:             "text-red-400 bg-red-500/10 border-red-500/25",
  cancelled:            "text-slate-500 bg-white/5 border-white/10",
};

const DISPLAY_DT = (ts: number) =>
  new Date(ts).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

export default function AdminHistoryPage() {
  const { decrementPending } = useAdminContext();
  const { showToast }         = useToast();

  const [bookings, setBookings]         = useState<BookingRecord[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [courtFilter, setCourtFilter]   = useState("all");
  const [dateFilter, setDateFilter]     = useState("");
  const [search, setSearch]             = useState("");
  const [changingId, setChangingId]     = useState<string | null>(null);
  const [viewing, setViewing]           = useState<BookingRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (courtFilter  !== "all") params.set("court",  courtFilter);
    if (dateFilter)              params.set("date",   dateFilter);
    if (search)                  params.set("search", search);

    try {
      const res  = await fetch(`/api/admin-history?${params.toString()}`);
      const data = await res.json();
      setBookings(data.bookings ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter, courtFilter, dateFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, newStatus: string, oldStatus: string) => {
    setChangingId(id);
    try {
      const res = await fetch("/api/admin-history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      // If we just approved a pending booking, decrement badge
      if (oldStatus === "pending_verification" && newStatus === "confirmed") {
        decrementPending();
      }
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: newStatus as BookingRecord["status"], verifiedAt: Date.now() } : b))
      );
      showToast("Đã cập nhật trạng thái", "success");
    } catch {
      showToast("Cập nhật thất bại", "error");
    } finally {
      setChangingId(null);
    }
  };


  const VND = (n: number) => n.toLocaleString("vi-VN") + "đ";

  const renderDetailsDialog = () => {
    if (!viewing) return null;
    const b = viewing;
    const dmin = (() => {
      const [sh,sm]=b.start.split(":").map(Number);
      const [eh,em]=b.end.split(":").map(Number);
      return (eh*60+em)-(sh*60+sm);
    })();
    const dur = formatDuration(minutesToDuration(dmin));
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setViewing(null)}>
        <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-[#15392C] border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
            <div>
              <p className="text-sm font-bold text-white">Chi tiết đặt sân</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{b.date} · Sân {b.court} · {b.start}–{b.end}</p>
            </div>
            <button type="button" onClick={() => setViewing(null)} className="text-slate-500 hover:text-white transition p-1 rounded-lg hover:bg-white/8">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-jade/60 font-semibold mb-2">Khách hàng</p>
              <div className="rounded-2xl border border-white/8 bg-white/3 divide-y divide-white/5">
                <div className="px-4 py-3"><p className="text-[10px] text-slate-500">Họ tên</p><p className="text-sm font-semibold text-white">{b.name}</p></div>
                <div className="px-4 py-3"><p className="text-[10px] text-slate-500">Số điện thoại</p><a href={`tel:${b.phone}`} className="text-sm font-semibold text-white hover:text-jade transition">{b.phone}</a></div>
                {b.email && <div className="px-4 py-3"><p className="text-[10px] text-slate-500">Email</p><a href={`mailto:${b.email}`} className="text-sm font-semibold text-white hover:text-jade transition break-all">{b.email}</a></div>}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-jade/60 font-semibold mb-2">Thông tin đặt sân</p>
              <div className="rounded-2xl border border-white/8 bg-white/3 divide-y divide-white/5">
                {[
                  ["Sân", `Sân ${b.court}`],
                  ["Ngày", b.date],
                  ["Giờ", `${b.start} – ${b.end}`],
                  ["Thời lượng", dur],
                  ["Loại vé", b.bookingType === "monthly" ? "Vé tháng" : "Đặt lẻ"],
                  ["Tổng tiền", VND(b.totalPrice ?? 0)],
                  ["Tạo lúc", new Date(b.createdAt).toLocaleString("vi-VN")],
                  ...(b.verifiedAt ? [["Xác nhận lúc", new Date(b.verifiedAt).toLocaleString("vi-VN")]] : []),
                ].map(([lbl, val]) => (
                  <div key={lbl} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-[11px] text-slate-500">{lbl}</span>
                    <span className={`text-[11px] font-semibold ${lbl === "Tổng tiền" ? "text-jade" : "text-white"}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <span className={`text-xs font-semibold px-4 py-2 rounded-full border ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span>
            </div>
          </div>
          <div className="shrink-0 px-5 py-4 border-t border-white/8">
            <button type="button" onClick={() => setViewing(null)} className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-300 hover:border-jade/40 hover:text-jade transition">Đóng</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-white/8 bg-[#0E2A21]">
        <input
          type="text"
          placeholder="Tìm tên, SĐT, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#15392C] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-jade w-40"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="bg-[#15392C] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-jade"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-[#15392C] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-jade appearance-none">
          <option value="all">Tất cả trạng thái</option>
          <option value="pending_verification">Chờ xác nhận</option>
          <option value="confirmed">Đã xác nhận</option>
          <option value="rejected">Từ chối</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <select value={courtFilter} onChange={(e) => setCourtFilter(e.target.value)}
          className="bg-[#15392C] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-jade appearance-none">
          <option value="all">Tất cả sân</option>
          <option value="1">Sân 1</option>
          <option value="2">Sân 2</option>
        </select>
        {(search || dateFilter || statusFilter !== "all" || courtFilter !== "all") && (
          <button type="button" onClick={() => { setSearch(""); setDateFilter(""); setStatusFilter("all"); setCourtFilter("all"); }}
            className="text-xs text-slate-500 hover:text-jade">
            Xóa bộ lọc
          </button>
        )}
        <span className="ml-auto text-[10px] text-slate-500">{total} kết quả</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 rounded-full border-2 border-jade/30 border-t-jade animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500">Không tìm thấy lịch sử nào.</div>
        ) : (
          <div className="min-w-[700px]">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_80px_110px_110px_130px_130px_120px] gap-x-3 px-4 py-2 border-b border-white/8 text-[10px] uppercase tracking-wide text-slate-500">
              <span>Khách hàng</span>
              <span>Ngày · Giờ</span>
              <span>Sân</span>
              <span>Loại</span>
              <span>Tổng tiền</span>
              <span>Tạo lúc</span>
              <span>Cập nhật</span>
              <span>Trạng thái</span>
            </div>
            {bookings.map((b) => (
              <div key={b.id}
                className="grid grid-cols-[1fr_1fr_80px_110px_110px_130px_130px_120px] gap-x-3 px-4 py-3 border-b border-white/5 hover:bg-white/2 transition text-xs items-center">
                <div className="min-w-0 cursor-pointer" onClick={() => setViewing(b)}>
                  <p className="text-white font-medium truncate hover:text-jade transition">{b.name}</p>
                  <p className="text-slate-400 tabular-nums">{b.phone}</p>
                  {b.email && <p className="text-slate-500 tabular-nums text-[10px] truncate">{b.email}</p>}
                </div>
                <div className="min-w-0">
                  <p className="text-white tabular-nums">{b.date}</p>
                  <p className="text-slate-500 tabular-nums">{b.start}–{b.end}</p>
                  <p className="text-[10px] text-slate-600 tabular-nums">{(() => { const [sh,sm]=b.start.split(":").map(Number); const [eh,em]=b.end.split(":").map(Number); return formatDuration(minutesToDuration((eh*60+em)-(sh*60+sm))); })()}</p>
                </div>
                <span className="text-slate-300">Sân {b.court}</span>
                <span className="text-slate-400">
                  {b.bookingType === "monthly" ? "Vé tháng" : "Lẻ"}
                </span>
                <span className="text-jade font-semibold tabular-nums">
                  {b.totalPrice.toLocaleString("vi-VN")}đ
                </span>
                <span className="text-slate-500 tabular-nums text-[10px]">{DISPLAY_DT(b.createdAt)}</span>
                <span className="text-slate-500 tabular-nums text-[10px]">
                  {b.verifiedAt ? DISPLAY_DT(b.verifiedAt) : "—"}
                </span>
                <select
                  value={b.status}
                  disabled={changingId === b.id}
                  onChange={(e) => handleStatusChange(b.id, e.target.value, b.status)}
                  className={[
                    "rounded-lg border px-2 py-1 text-[10px] font-semibold outline-none transition appearance-none cursor-pointer disabled:opacity-50",
                    STATUS_COLORS[b.status] ?? "text-slate-400 bg-white/5 border-white/10",
                    "bg-transparent",
                  ].join(" ")}
                >
                  <option value="pending_verification">Chờ xác nhận</option>
                  <option value="confirmed">Đã xác nhận</option>
                  <option value="rejected">Từ chối</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
      {renderDetailsDialog()}
    </div>
  );
}
