import { Clock } from "lucide-react";
import { useTurnTimer } from "../hooks/useTurnTimer";

// Live turn countdown shown in the turn banner for timed online games.
export function TurnCountdown({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const { label, low, ratio } = useTurnTimer(startedAt, durationMs);

  return (
    <div className={`turn-countdown ${low ? "is-low" : ""}`} role="timer" aria-label="Tempo restante do turno">
      <Clock aria-hidden="true" />
      <span className="turn-countdown-value">{label}</span>
      <span className="turn-countdown-bar" aria-hidden="true">
        <span className="turn-countdown-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </span>
    </div>
  );
}
