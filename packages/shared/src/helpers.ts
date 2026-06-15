import type { GridPosition, ScenarioCardId } from "./index";

export const TURN_TIMER_MIN_MS = 15_000;
export const TURN_TIMER_MAX_MS = 300_000;
export const TURN_TIMER_DEFAULT_MS = 60_000;
export const TURN_TIMER_OPTIONS_MS = [30_000, 45_000, 60_000, 90_000, 120_000, 180_000] as const;

export function gridPositionKey(position: GridPosition): string {
  return `${position.x}:${position.y}`;
}

export function parseGridPositionKey(key: string): GridPosition {
  const [x, y] = key.split(":").map(Number);
  return { x, y };
}

export function areScenariosExclusive(a: ScenarioCardId, b: ScenarioCardId): boolean {
  return (
    (a === "pantanal" && b === "mata_atlantica") ||
    (a === "mata_atlantica" && b === "pantanal")
  );
}

export function clampTurnTimerMs(value: number): number {
  if (!Number.isFinite(value)) {
    return TURN_TIMER_DEFAULT_MS;
  }

  return Math.max(TURN_TIMER_MIN_MS, Math.min(TURN_TIMER_MAX_MS, Math.round(value)));
}

export function formatTurnTimer(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}min ${rest}s` : `${minutes}min`;
}
