import { describe, expect, it } from "vitest";
import { createInitialGameState, createPreviewInitialForest } from "@oikos/rules";
import type { PublicRoomState, RoomPlayer, ThreatCardId } from "@oikos/shared";
import { projectRoomForViewer } from "./projection";

function player(playerId: string, speciesId: RoomPlayer["speciesId"]): RoomPlayer {
  return {
    playerId,
    name: playerId,
    speciesId,
    ready: true,
    connected: true
  };
}

function createTestRoom(): PublicRoomState {
  const roomPlayers = [player("wolf", "maned_wolf"), player("coati", "coati")];
  const game = createInitialGameState("ROOM1", roomPlayers, () => 0.5, createPreviewInitialForest());
  game.status = "active";
  game.threatDeckIds = ["threat_1", "threat_2", "threat_3"] as ThreatCardId[];
  game.mataAtlanticaPiles = [
    ["bosque_1", "bosque_2", "campos_1"],
    ["rios_1", "rios_2"],
    []
  ];
  const wolf = game.players.find((p) => p.playerId === "wolf")!;
  wolf.objectiveChoices = ["objective_1", "objective_2"];
  wolf.selectedObjectiveCardId = "objective_1";
  wolf.discardedObjectiveCardId = "objective_2";

  return {
    roomId: "ROOM1",
    status: "active",
    hostPlayerId: "wolf",
    players: roomPlayers,
    enabledMiniExpansions: [],
    game,
    warnings: []
  };
}

describe("projectRoomForViewer", () => {
  it("keeps the viewer's own hand and objectives intact", () => {
    const room = createTestRoom();
    const view = projectRoomForViewer(room, "wolf");
    const self = view.game!.players.find((p) => p.playerId === "wolf")!;
    const original = room.game!.players.find((p) => p.playerId === "wolf")!;

    expect(self.hand).toEqual(original.hand);
    expect(self.hand.length).toBeGreaterThan(0);
    expect(self.objectiveChoices).toEqual(["objective_1", "objective_2"]);
    expect(self.selectedObjectiveCardId).toBe("objective_1");
    expect(self.discardedObjectiveCardId).toBe("objective_2");
  });

  it("hides other players' hands and objectives, exposing only counts/flags", () => {
    const room = createTestRoom();
    const view = projectRoomForViewer(room, "coati");
    const other = view.game!.players.find((p) => p.playerId === "wolf")!;
    const original = room.game!.players.find((p) => p.playerId === "wolf")!;

    expect(other.hand).toEqual([]);
    expect(other.handCount).toBe(original.hand.length);
    expect(other.objectiveChoices).toEqual([]);
    expect(other.selectedObjectiveCardId).toBeNull();
    expect(other.hasSelectedObjective).toBe(true);
    expect(other.discardedObjectiveCardId).toBeNull();
  });

  it("hides deck order, threat deck order, and pile contents below the top card", () => {
    const room = createTestRoom();
    const view = projectRoomForViewer(room, "coati");
    const game = view.game!;

    expect(game.deck.commonCardIds).toEqual([]);
    expect(game.deck.commonCardCount).toBe(room.game!.deck.commonCardIds.length);
    expect(game.threatDeckIds).toEqual([]);
    expect(game.threatDeckCount).toBe(3);
    expect(game.mataAtlanticaPiles).toEqual([["bosque_1"], ["rios_1"], []]);
    expect(game.mataAtlanticaPileCounts).toEqual([3, 2, 0]);
  });

  it("redacts everything for spectators (viewer not seated)", () => {
    const room = createTestRoom();
    const view = projectRoomForViewer(room, "spectator-id");

    for (const p of view.game!.players) {
      expect(p.hand).toEqual([]);
    }
  });

  it("reveals the full state once the game is finished", () => {
    const room = createTestRoom();
    room.game!.status = "finished";
    const view = projectRoomForViewer(room, "coati");

    expect(view.game!.players.find((p) => p.playerId === "wolf")!.hand.length).toBeGreaterThan(0);
    expect(view.game!.deck.commonCardIds).toEqual(room.game!.deck.commonCardIds);
  });

  it("does not mutate the original room state", () => {
    const room = createTestRoom();
    const originalHand = [...room.game!.players[0]!.hand];
    projectRoomForViewer(room, "coati");

    expect(room.game!.players[0]!.hand).toEqual(originalHand);
    expect(room.game!.mataAtlanticaPiles![0]!.length).toBe(3);
  });
});
