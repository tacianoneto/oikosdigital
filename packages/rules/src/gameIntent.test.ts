import { describe, expect, it, vi } from "vitest";
import type { RoomPlayer } from "@oikos/shared";
import {
  applyGameIntent,
  createInitialGameState,
  createPreviewInitialForest,
  scoreCapuchinHabitatPresence
} from "./index";

function player(playerId: string, speciesId: RoomPlayer["speciesId"]): RoomPlayer {
  return {
    playerId,
    name: playerId,
    speciesId,
    ready: true,
    connected: true
  };
}

function createActiveCapuchinScoreGame() {
  const game = createInitialGameState("intent-test", [player("capuchin", "capuchin")], () => 0.999999, createPreviewInitialForest());
  game.status = "active";
  game.activePlayerId = "capuchin";
  game.activeActionIndex = 3;
  game.setupActivePlayerId = null;
  return game;
}

describe("game intent", () => {
  it("applies scoring intents through the same rule applier used by legacy calls", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const legacy = scoreCapuchinHabitatPresence(createActiveCapuchinScoreGame(), "capuchin");
    const viaIntent = applyGameIntent(createActiveCapuchinScoreGame(), "capuchin", {
      type: "species.score",
      speciesId: "capuchin"
    });

    expect(viaIntent.players).toEqual(legacy.players);
    expect(viaIntent.activeActionIndex).toBe(legacy.activeActionIndex);
    expect(viaIntent.activePlayerId).toBe(legacy.activePlayerId);
    expect(viaIntent.log.at(-1)?.payload).toEqual(legacy.log.at(-1)?.payload);
    vi.useRealTimers();
  });
});
