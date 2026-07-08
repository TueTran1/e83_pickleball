"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Works exactly like useState but persists the value in sessionStorage.
 *
 * Why sessionStorage (not localStorage)?
 *   - sessionStorage lives only for the current browser tab session.
 *   - It survives route changes and back/forward navigation (component unmounts
 *     then remounts, but the stored value is still there).
 *   - It is automatically cleared when the tab is closed — no stale checkout
 *     data left behind after the customer completes or abandons their booking.
 *   - It does NOT share data across tabs, which is correct for checkout flows.
 *
 * Why does form data disappear without this?
 *   - When you navigate from /checkout/info to /checkout/payment, React unmounts
 *     the InfoForm component and all its useState values are garbage-collected.
 *   - When you hit the browser back button, React remounts InfoForm fresh with
 *     empty initial state — it has no memory of what the user typed.
 *   - This hook restores the value from sessionStorage on mount, so the user
 *     sees their data exactly as they left it.
 */
export function useSessionState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setStateInternal] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored === null) return initialValue;
      return JSON.parse(stored) as T;
    } catch {
      return initialValue;
    }
  });

  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStateInternal((prev) => {
        const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        try {
          if (typeof window !== "undefined") {
            sessionStorage.setItem(key, JSON.stringify(next));
          }
        } catch {
          // sessionStorage may be unavailable (private mode quota, etc.) — fail silently
        }
        return next;
      });
    },
    [key]
  );

  /** Call this after a successful checkout to clear stored data */
  const clear = useCallback(() => {
    try {
      if (typeof window !== "undefined") sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    setStateInternal(initialValue);
  }, [key, initialValue]);

  return [state, setState, clear];
}

/** Clear all checkout-related sessionStorage keys at once (call on success) */
export function clearCheckoutSession(): void {
  if (typeof window === "undefined") return;
  const CHECKOUT_KEYS = ["checkout_name", "checkout_phone", "checkout_email"];
  for (const key of CHECKOUT_KEYS) {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  }
}
