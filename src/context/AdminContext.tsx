"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminContextValue {
  pendingCount: number;
  decrementPending: () => void;
  refreshPending: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AdminContext = createContext<AdminContextValue>({
  pendingCount: 0,
  decrementPending: () => {},
  refreshPending: () => {},
});

export function useAdminContext() {
  return useContext(AdminContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AdminProvider({
  children,
  authed,
}: {
  children: React.ReactNode;
  authed: boolean;
}) {
  const [pendingCount, setPendingCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    if (!authed) return;
    try {
      const res  = await fetch("/api/admin-pending");
      const data = await res.json();
      setPendingCount((data.groups ?? []).length);
    } catch {
      // silently ignore — network blip
    }
  }, [authed]);

  // Load on mount + poll every 30 s
  useEffect(() => {
    if (!authed) return;
    fetchCount();
    intervalRef.current = setInterval(fetchCount, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [authed, fetchCount]);

  /** Immediately decrement the badge when an admin acts on a pending booking */
  const decrementPending = useCallback(() => {
    setPendingCount((c) => Math.max(0, c - 1));
  }, []);

  /** Force a fresh fetch (e.g. after navigating to the pending tab) */
  const refreshPending = useCallback(() => {
    fetchCount();
  }, [fetchCount]);

  return (
    <AdminContext.Provider value={{ pendingCount, decrementPending, refreshPending }}>
      {children}
    </AdminContext.Provider>
  );
}
