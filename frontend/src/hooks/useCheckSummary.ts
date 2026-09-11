import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getCheckSummary } from "@/services/api";
import type { CheckSummary } from "@/types";

/** Keep the split and payment status together; ignore reads started before a write. */
export function useCheckSummary(code: string | undefined) {
  const [summary, setSummary] = useState<CheckSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const requestVersion = useRef(0);
  const reading = useRef(false);
  const updating = useRef(false);
  const nextVersion = useCallback(() => ++requestVersion.current, []);

  const refresh = useCallback(async () => {
    if (!code || reading.current || updating.current) return;
    reading.current = true;
    const version = nextVersion();
    try {
      const data = await getCheckSummary(code);
      if (version === requestVersion.current) {
        setSummary(data);
        setError(null);
      }
    } catch (err) {
      if (version === requestVersion.current) {
        setError(err instanceof Error ? err.message : "Could not refresh the check.");
      }
    } finally {
      reading.current = false;
    }
  }, [code, nextVersion]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      nextVersion();
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, nextVersion]);

  const mutate = useCallback(async (operation: () => Promise<CheckSummary>) => {
    if (updating.current) throw new Error("Another change is saving. Please try again.");
    updating.current = true;
    setIsUpdating(true);
    const version = nextVersion();
    try {
      const data = await operation();
      if (version === requestVersion.current) {
        setSummary(data);
        setError(null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && code) {
        try {
          const data = await getCheckSummary(code);
          if (version === requestVersion.current) setSummary(data);
        } catch {
          // Keep the last known share and the original actionable conflict error.
        }
      }
      throw err;
    } finally {
      updating.current = false;
      setIsUpdating(false);
    }
  }, [code, nextVersion]);

  const currentSummary = summary?.check.code === code?.toUpperCase() ? summary : null;
  return { summary: currentSummary, error, isLoading: !currentSummary && !error, isUpdating, refresh, mutate };
}
