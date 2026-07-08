"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminProvider, useAdminContext } from "@/context/AdminContext";
import Logo from "@/components/Logo";

// ─── Toast context (shared across all admin pages) ────────────────────────────

interface ToastMsg { id: number; message: string; type: "success" | "error" }
interface ToastContextValue { showToast: (msg: string, type?: "success" | "error") => void }
const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });
export function useToast() { return useContext(ToastContext); }

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast stack */}
      <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={[
            "rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md animate-in slide-in-from-right-4 fade-in-0 duration-200",
            t.type === "success"
              ? "bg-jade/20 border-jade/40 text-jade"
              : "bg-red-500/20 border-red-500/40 text-red-300",
          ].join(" ")}>
            <div className="flex items-center gap-2">
              {t.type === "success" ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 7l3.5 3.5L12 3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="7" cy="7" r="6"/><path d="M7 4v4M7 10h.01" strokeLinecap="round"/>
                </svg>
              )}
              {t.message}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Navigation tabs ──────────────────────────────────────────────────────────

const TABS = [
  {
    href: "/admin/bookings",
    label: "Lịch đặt sân",
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5 2v3M11 2v3"/></svg>,
  },
  {
    href: "/admin/pending",
    label: "Chờ xác nhận",
    badge: true,
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v4l2.5 1.5" strokeLinecap="round"/></svg>,
  },
  {
    href: "/admin/history",
    label: "Lịch sử",
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 1.5C3.9 1.5 3 2.4 3 3.5v9C3 13.6 3.9 14.5 5 14.5h7a1 1 0 001-1V5.5L10 1.5H5z" strokeLinejoin="round"/><path d="M10 1.5v3.5a.5.5 0 00.5.5H13M6 7.5h4M6 10h4M6 12.5h2" strokeLinecap="round"/><path d="M3 4.5C3 3.4 2.1 2.5 1 2.5" strokeLinecap="round"/></svg>,
  },
  {
    href: "/admin/intro",
    label: "Giới thiệu",
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 5.5h6M5 8h6M5 10.5h4" strokeLinecap="round"/></svg>,
  },
  {
    href: "/admin/settings",
    label: "Cài đặt",
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.2 3.2l.85.85M11.95 11.95l.85.85M12.8 3.2l-.85.85M4.05 11.95l-.85.85"/></svg>,
  },
];

// ─── Inner layout (inside providers) ─────────────────────────────────────────

function AdminShell({ children, authed, onLogout }: { children: React.ReactNode; authed: boolean; onLogout: () => void }) {
  const pathname = usePathname();
  const { pendingCount } = useAdminContext();

  return (
    <main className="min-h-screen bg-[#0E2A21] text-white flex flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/8 bg-[#0E2A21]/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Logo size={28} showText={false} />
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-white leading-none">Admin Panel</p>
              <p className="text-[10px] text-slate-500">E83 - Câu lạc bộ Pickleball</p>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none mx-3">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link key={tab.href} href={tab.href}
                className={["relative shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium transition",
                  active ? "bg-jade text-[#0E2A21]" : "text-slate-400 hover:text-white hover:bg-white/5",
                ].join(" ")}>
                <span className="shrink-0">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <button type="button" onClick={onLogout}
          className="shrink-0 text-xs text-slate-600 hover:text-red-400 transition">
          Đăng xuất
        </button>
      </header>

      <div className="flex-1 overflow-hidden">{children}</div>
    </main>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const [authed,      setAuthed]    = useState<boolean | null>(null);
  const [password,    setPassword]  = useState("");
  const [loginError,  setLoginError]= useState(false);
  const [loggingIn,   setLoggingIn] = useState(false);

  useEffect(() => {
    fetch("/api/admin-session-check")
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.authed)))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed && pathname === "/admin") router.replace("/admin/bookings");
  }, [authed, pathname, router]);

  const handleLogin = async () => {
    setLoggingIn(true); setLoginError(false);
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) setAuthed(true); else setLoginError(true);
    } catch { setLoginError(true); }
    finally  { setLoggingIn(false); }
  };

  const handleLogout = async () => {
    await fetch("/api/admin-logout", { method: "POST" }).catch(() => {});
    setAuthed(false); setPassword("");
  };

  if (authed === null) return <main className="min-h-screen bg-[#0E2A21]" />;

  if (!authed) {
    if (pathname.startsWith("/admin/verify/")) return <>{children}</>;
    return (
      <main className="min-h-screen bg-[#0E2A21] flex items-center justify-center px-5">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <Logo size={64} showText={false} />
            </div>
            <h1 className="text-xl font-bold text-white">Quản trị viên</h1>
            <p className="text-xs text-slate-500">E83 - Câu lạc bộ Pickleball</p>
          </div>
          <input type="password" placeholder="Mật khẩu" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className={["w-full rounded-2xl border bg-[#15392C] px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none transition",
              loginError ? "border-red-500/60" : "border-white/10 focus:border-jade"].join(" ")} />
          {loginError && <p className="text-xs text-red-400 text-center">Mật khẩu không đúng</p>}
          <button type="button" onClick={handleLogin} disabled={loggingIn}
            className="w-full rounded-full bg-jade py-3.5 text-sm font-bold uppercase tracking-widest text-[#0E2A21] hover:bg-jade-light active:scale-95 transition shadow-jade disabled:opacity-60">
            {loggingIn ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
          <Link href="/" className="flex items-center justify-center gap-1.5 text-xs text-slate-600 hover:text-jade transition">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2.5L3.5 6 8 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Về trang chủ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AdminProvider authed={authed}>
      <ToastProvider>
        <AdminShell authed={authed} onLogout={handleLogout}>
          {children}
        </AdminShell>
      </ToastProvider>
    </AdminProvider>
  );
}
