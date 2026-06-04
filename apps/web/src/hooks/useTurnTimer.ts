import { useEffect, useMemo, useState } from "react";

export function useTurnTimer(startedAt: number, durationMs: number, tickMs = 500) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  return useMemo(() => {
    const remaining = Math.max(0, durationMs - (now - startedAt));
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const label = minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`;
    const ratio = durationMs > 0 ? Math.max(0, Math.min(1, remaining / durationMs)) : 0;

    return {
      label,
      low: remaining <= 10000,
      ratio,
      remaining
    };
  }, [durationMs, now, startedAt]);
}
