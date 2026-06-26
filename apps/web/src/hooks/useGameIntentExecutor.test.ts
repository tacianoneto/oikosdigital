import { createInitialGameState, createPreviewInitialForest } from "@oikos/rules";
import type { GameState, PublicRoomState, RoomPlayer } from "@oikos/shared";
import { describe, expect, it } from "vitest";
import {
  applyLocalGameIntentToRoom,
  getRoomStatusForGameState
} from "./useGameIntentExecutor";

const roomPlayers: RoomPlayer[] = [
  {
    playerId: "jaguar",
    name: "Jaguar",
    speciesId: "jaguar",
    ready: true,
    connected: true
  },
  {
    playerId: "coati",
    name: "Coati",
    speciesId: "coati",
    ready: true,
    connected: true
  }
];

function createActiveGame(): GameState {
  return {
    ...createInitialGameState(
      "game-intent-executor",
      roomPlayers,
      () => 0.999999,
      createPreviewInitialForest()
    ),
    status: "active",
    activePlayerId: "jaguar",
    activeActionIndex: 0
  };
}

function createRoom(game: GameState | null = createActiveGame()): PublicRoomState {
  return {
    roomId: "LOCAL",
    status: game ? getRoomStatusForGameState("lobby", game) : "lobby",
    hostPlayerId: "coati",
    players: roomPlayers,
    enabledMiniExpansions: [],
    game,
    warnings: []
  };
}

describe("game intent executor helpers", () => {
  it("derives the visible room status from the resulting game status", () => {
    const game = createActiveGame();

    expect(getRoomStatusForGameState("setup", { ...game, status: "setup" })).toBe("setup");
    expect(getRoomStatusForGameState("setup", { ...game, status: "active" })).toBe("active");
    expect(getRoomStatusForGameState("active", { ...game, status: "finished" })).toBe("finished");
  });

  it("leaves rooms without a game unchanged", () => {
    const room = createRoom(null);

    expect(applyLocalGameIntentToRoom(room, "coati", { type: "action.complete" })).toBe(room);
  });

  it("applies a local intent and projects status and warnings back into the room", () => {
    const room = createRoom();
    const nextRoom = applyLocalGameIntentToRoom(room, "jaguar", { type: "action.complete" });

    expect(nextRoom).not.toBe(room);
    expect(nextRoom.game?.activeActionIndex).toBe(2);
    expect(nextRoom.status).toBe(nextRoom.game?.status);
    expect(nextRoom.warnings).toEqual(nextRoom.game?.contentWarnings);
  });
});
