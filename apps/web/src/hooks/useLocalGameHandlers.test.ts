import { createInitialGameState, createPreviewInitialForest } from "@oikos/rules";
import type { PublicRoomState, RoomPlayer } from "@oikos/shared";
import { describe, expect, it } from "vitest";
import { getLocalBotActingPlayerId } from "./useLocalGameHandlers";

const players: RoomPlayer[] = [
  {
    playerId: "local_jaguar",
    name: "Onca",
    speciesId: "jaguar",
    ready: true,
    connected: true
  },
  {
    playerId: "local_galo_de_campina",
    name: "Galo-de-campina",
    speciesId: "galo_de_campina",
    ready: true,
    connected: true,
    isBot: true
  }
];

function createRoom(): PublicRoomState {
  const game = createInitialGameState("local-test", players, () => 0.999999, createPreviewInitialForest());
  return {
    roomId: "LOCAL",
    status: "active",
    hostPlayerId: "local_host",
    players,
    enabledMiniExpansions: [],
    game: {
      ...game,
      status: "active",
      activePlayerId: "local_jaguar",
      pendingGaloInterrupt: {
        ownerId: "local_galo_de_campina",
        location: { x: 1, y: 0 },
        interruptedPlayerId: "local_jaguar"
      }
    },
    warnings: []
  };
}

describe("getLocalBotActingPlayerId", () => {
  it("lets a local Galo bot act during its interrupt on a human Onca turn", () => {
    expect(getLocalBotActingPlayerId(createRoom())).toBe("local_galo_de_campina");
  });
});
