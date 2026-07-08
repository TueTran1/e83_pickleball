"use client";
import Logo from "@/components/Logo";
import { formatDuration, minutesToDuration } from "@/lib/bookingLogic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface GroupDetail {
  groupId: string;
  status: "pending_verification" | "confirmed" | "rejected";
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
  new Date(ts).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function VerifyBookingPage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const [checkingSession, setCheckingSession] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);
  const [actionResult, setActionResult] = useState<"confirmed" | "rejected" | null>(null);

  useEffect(() => {
    fetch("/api/admin-session-check")
      .then((r) => r.json())
      .then((data) => setAuthed(Boolean(data.authed)))
      .catch(() => setAuthed(false))
      .finally(() => setCheckingSession(false));
  }, []);

  const loadDetail = () => {
    setLoadingDetail(true);
    setDetailError(null);
    fetch(`/api/admin-pending/${groupId}`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error ?? "Không tìm thấy đơn đặt sân");
        }
        return r.json();
      })
      .then((data) => setDetail(data))
      .catch((err) => setDetailError(err instanceof Error ? err.message : "Lỗi không xác định"))
      .finally(() => setLoadingDetail(false));
  };

  useEffect(() => {
    if (authed && groupId) loadDetail();
  }, [authed, groupId]);

  const handleLogin = async () => {
    setLoggingIn(true);
    setLoginError(false);
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) setAuthed(true);
      else setLoginError(true);
    } catch {
      setLoginError(true);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleAction = async (action: "confirm" | "reject") => {
    setActioning(true);
    try {
      const res = await fetch("/api/admin-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, action }),
      });
      if (res.ok) {
        setActionResult(action === "confirm" ? "confirmed" : "rejected");
      }
    } finally {
      setActioning(false);
    }
  };

  // ── Loading session ─────────────────────────────────────────────────────────
  if (checkingSession) {
    return <main className="min-h-screen bg-[#0E2A21]" />;
  }

  // ── Not logged in — inline login, stays on this same verify URL ────────────
  if (!authed) {
    return (
      <main className="min-h-screen bg-[#0E2A21] flex items-center justify-center px-5">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <Logo size={56} showText={false} />
            </div>
            <h1 className="text-xl font-bold text-white">Đăng nhập để xác nhận</h1>
            <p className="text-xs text-slate-500">Cần quyền admin để xác nhận thanh toán này</p>
          </div>
          <input
            type="password"
            placeholder="Mật khẩu admin"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className={[
              "w-full rounded-2xl border bg-[#15392C] px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none transition",
              loginError ? "border-red-500/60" : "border-white/10 focus:border-jade",
            ].join(" ")}
          />
          {loginError && <p className="text-xs text-red-400 text-center">Mật khẩu không đúng</p>}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loggingIn}
            className="w-full rounded-full bg-jade py-3.5 text-sm font-bold uppercase tracking-widest text-[#0E2A21] hover:bg-jade-light active:scale-95 transition shadow-jade disabled:opacity-60"
          >
            {loggingIn ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </div>
      </main>
    );
  }

  // ── Action just completed ────────────────────────────────────────────────────
  if (actionResult) {
    return (
      <main className="min-h-screen bg-[#0E2A21] flex flex-col items-center justify-center px-5 text-center">
        <div className={[
          "w-16 h-16 rounded-full flex items-center justify-center mb-5",
          actionResult === "confirmed" ? "bg-jade/15 border border-jade/30" : "bg-red-500/15 border border-red-500/30",
        ].join(" ")}>
          {actionResult === "confirmed" ? (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M6 14L11 19L22 8" stroke="#6BD5AC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/>
            </svg>
          )}
        </div>
        <h1 className="text-xl font-bold text-white mb-2">
          {actionResult === "confirmed" ? "Đã xác nhận thanh toán" : "Đã từ chối đơn đặt sân"}
        </h1>
        <p className="text-sm text-slate-400 max-w-xs">
          {actionResult === "confirmed"
            ? "Lịch đã được xác nhận và email thông báo đã được gửi đến khách hàng (nếu có email)."
            : "Đơn đặt sân đã bị từ chối, khung giờ đã được giải phóng."}
        </p>
        <Link href="/admin" className="mt-6 text-sm text-jade hover:underline">
          Về trang quản trị
        </Link>
      </main>
    );
  }

  // ── Detail error (not found, etc) ───────────────────────────────────────────
  if (detailError) {
    return (
      <main className="min-h-screen bg-[#0E2A21] flex flex-col items-center justify-center px-5 text-center">
        <p className="text-sm text-red-400 mb-4">{detailError}</p>
        <Link href="/admin" className="text-sm text-jade hover:underline">Về trang quản trị</Link>
      </main>
    );
  }

  // ── Loading detail ───────────────────────────────────────────────────────────
  if (loadingDetail || !detail) {
    return (
      <main className="min-h-screen bg-[#0E2A21] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-jade/30 border-t-jade animate-spin" />
      </main>
    );
  }

  // ── Already resolved (e.g. someone else already confirmed it) ───────────────
  if (detail.status !== "pending_verification") {
    return (
      <main className="min-h-screen bg-[#0E2A21] flex flex-col items-center justify-center px-5 text-center">
        <p className="text-sm text-slate-300 mb-2">
          Đơn này đã được {detail.status === "confirmed" ? "xác nhận" : "từ chối"} trước đó.
        </p>
        <Link href="/admin" className="text-sm text-jade hover:underline">Về trang quản trị</Link>
      </main>
    );
  }

  // ── Main verify screen ───────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0E2A21] text-white flex flex-col">
      <nav className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
        <Logo size={28} showText={false} />
        <p className="text-sm font-semibold text-white">Xác nhận thanh toán</p>
      </nav>

      <div className="flex-1 px-5 py-6 max-w-md mx-auto w-full space-y-5">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-amber-400 font-semibold">
              {detail.bookingType === "monthly" ? "Vé tháng" : "Đặt sân lẻ"} · Đang chờ
            </span>
            <span className="text-[10px] text-slate-500">{DISPLAY_DATETIME(detail.createdAt)}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <span className="text-slate-500 text-xs">Người đặt</span>
            <span className="text-white font-medium">{detail.customerName}</span>
            <span className="text-slate-500 text-xs">Số điện thoại</span>
            <span className="text-white font-medium tabular-nums">{detail.customerPhone}</span>
            {detail.customerEmail && <>
              <span className="text-slate-500 text-xs">Email</span>
              <span className="text-white font-medium truncate">{detail.customerEmail}</span>
            </>}
            <span className="text-slate-500 text-xs">{detail.bookingType === "monthly" ? "Bắt đầu" : "Ngày"}</span>
            <span className="text-white font-medium tabular-nums">
              {detail.date}{detail.endDate ? ` – ${detail.endDate}` : ""}
            </span>
            <span className="text-slate-500 text-xs">Sân</span>
            <span className="text-white font-medium">
              {detail.court === "both" ? "Sân 1 + 2" : `Sân ${detail.court}`}
              {detail.bookingType === "monthly" ? ` (${detail.dayCount} ngày)` : ""}
            </span>
            <span className="text-slate-500 text-xs">Giờ</span>
            <span className="text-white font-medium tabular-nums">{detail.start} – {detail.end}</span>
            <span className="text-xs text-slate-500 tabular-nums">{(() => { const [sh,sm]=detail.start.split(":").map(Number); const [eh,em]=detail.end.split(":").map(Number); return formatDuration(minutesToDuration((eh*60+em)-(sh*60+sm))); })()}</span>
          </div>

          <div className="pt-3 border-t border-white/8 flex items-center justify-between">
            <span className="text-sm text-slate-400">Tổng tiền</span>
            <span className="text-2xl font-black text-jade tabular-nums">{detail.totalPrice.toLocaleString("vi-VN")}đ</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Vui lòng kiểm tra tài khoản ngân hàng để xác nhận đã nhận đủ số tiền trên trước khi bấm xác nhận.
        </p>
      </div>

      <div className="px-5 py-5 border-t border-white/8 space-y-2.5">
        <button
          type="button"
          onClick={() => handleAction("confirm")}
          disabled={actioning}
          className="w-full rounded-full bg-jade py-4 text-sm font-bold uppercase tracking-widest text-[#0E2A21] hover:bg-jade-light active:scale-95 transition shadow-jade disabled:opacity-60"
        >
          {actioning ? "Đang xử lý..." : "Xác nhận đã nhận tiền"}
        </button>
        <button
          type="button"
          onClick={() => handleAction("reject")}
          disabled={actioning}
          className="w-full rounded-full border border-red-500/30 bg-red-500/10 py-3.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-60"
        >
          Từ chối (chưa nhận được tiền)
        </button>
      </div>
    </main>
  );
}
