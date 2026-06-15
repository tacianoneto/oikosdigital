import { describe, expect, it } from "vitest";
import {
  TURN_TIMER_DEFAULT_MS,
  TURN_TIMER_MAX_MS,
  TURN_TIMER_MIN_MS,
  areScenariosExclusive,
  clampTurnTimerMs,
  formatTurnTimer,
  gridPositionKey,
  parseGridPositionKey
} from "./helpers";

describe("coordinate helpers", () => {
  it("round-trips grid positions", () => {
    const position = { x: -2, y: 3 };
    expect(parseGridPositionKey(gridPositionKey(position))).toEqual(position);
  });
});

describe("scenario helpers", () => {
  it("identifies only the mutually exclusive scenario pair", () => {
    expect(areScenariosExclusive("pantanal", "mata_atlantica")).toBe(true);
    expect(areScenariosExclusive("mata_atlantica", "pantanal")).toBe(true);
    expect(areScenariosExclusive("pantanal", "cerrado")).toBe(false);
  });
});

describe("turn timer helpers", () => {
  it("clamps and normalizes timer values", () => {
    expect(clampTurnTimerMs(Number.NaN)).toBe(TURN_TIMER_DEFAULT_MS);
    expect(clampTurnTimerMs(1_000)).toBe(TURN_TIMER_MIN_MS);
    expect(clampTurnTimerMs(400_000)).toBe(TURN_TIMER_MAX_MS);
    expect(clampTurnTimerMs(45_000.6)).toBe(45_001);
  });

  it("formats seconds and minutes", () => {
    expect(formatTurnTimer(45_000)).toBe("45s");
    expect(formatTurnTimer(60_000)).toBe("1min");
    expect(formatTurnTimer(90_000)).toBe("1min 30s");
  });
});
