import {
  createInitialGameState,
  createPreviewInitialForest
} from "@oikos/rules";
import type {
  GameState,
  PublicRoomState,
  RoomPlayer
} from "@oikos/shared";
import { describe, expect, it } from "vitest";
import { getPlayerHudState } from "./playerHudState";

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
  },
  {
    playerId: "macaw",
    name: "Macaw",
    speciesId: "macaw",
    ready: true,
    connected: true
  }
];

function createRoom(game: GameState | null): PublicRoomState {
  return {
    roomId: "hud-state",
    status: game ? "active" : "lobby",
    hostPlayerId: "jaguar",
    players: roomPlayers,
    enabledMiniExpansions: [],
    game,
    warnings: []
  };
}

function createGame(): GameState {
  return createInitialGameState(
    "hud-state",
    roomPlayers,
    () => 0.999999,
    createPreviewInitialForest()
  );
}

describe("getPlayerHudState", () => {
  it("returns empty state without a room", () => {
    const state = getPlayerHudState(null, null, null);

    expect(state.currentPlayer).toBeNull();
    expect(state.hudGamePlayer).toBeNull();
    expect(state.playerInspectorEntries).toEqual([]);
    expect(state.resourceLeaders).toEqual({});
  });

  it("keeps lobby order and resolves species without game state", () => {
    const state = getPlayerHudState(
      createRoom(null),
      "coati",
      "macaw"
    );

    expect(
      state.playerInspectorEntries.map((entry) => entry.player.playerId)
    ).toEqual(["jaguar", "coati", "macaw"]);
    expect(state.playerInspectorEntries[1]?.species?.speciesId).toBe("coati");
    expect(state.playerInspectorEntries.every((entry) => !entry.gamePlayer))
      .toBe(true);
    expect(state.selectedOpponentEntry?.player.playerId).toBe("macaw");
  });

  it("orders setup inspector entries and marks active setup player", () => {
    const base = createGame();
    const game: GameState = {
      ...base,
      status: "setup",
      setupOrder: ["macaw", "jaguar", "coati"],
      setupActivePlayerId: "macaw"
    };
    const state = getPlayerHudState(
      createRoom(game),
      "jaguar",
      "coati"
    );

    expect(
      state.playerInspectorEntries.map((entry) => entry.player.playerId)
    ).toEqual(["macaw", "jaguar", "coati"]);
    expect(state.playerInspectorEntries[0]?.isActivePlayer).toBe(true);
    expect(state.opponentInspectorEntries.map((entry) => entry.player.playerId))
      .toEqual(["macaw", "coati"]);
    expect(state.selectedOpponentRailIndex).toBe(1);
  });

  it("derives resource leaders, including ties but excluding seed", () => {
    const base = createGame();
    const game: GameState = {
      ...base,
      status: "active",
      activePlayerId: "coati",
      players: base.players.map((player) => ({
        ...player,
        resources:
          player.playerId === "jaguar"
            ? { meat: 3, egg: 0, fruit: 2, seed: 9 }
            : player.playerId === "coati"
              ? { meat: 3, egg: 0, fruit: 1, seed: 10 }
              : { meat: 1, egg: 0, fruit: 2, seed: 11 }
      }))
    };
    const state = getPlayerHudState(
      createRoom(game),
      "jaguar",
      null
    );

    expect([...state.resourceLeaders.meat!]).toEqual(["jaguar", "coati"]);
    expect([...state.resourceLeaders.fruit!]).toEqual(["jaguar", "macaw"]);
    expect(state.resourceLeaders.egg).toBeUndefined();
    expect(state.resourceLeaders.seed).toBeUndefined();
    expect(state.currentPlayerResourceMajority).toEqual({
      meat: true,
      egg: false,
      fruit: true,
      seed: false
    });
  });

  it("uses controlled, active, then setup player as HUD fallback", () => {
    const base = createGame();
    const activeGame: GameState = {
      ...base,
      status: "active",
      activePlayerId: "coati",
      setupActivePlayerId: "macaw"
    };
    const controlled = getPlayerHudState(
      createRoom(activeGame),
      "jaguar",
      null
    );
    const active = getPlayerHudState(
      createRoom(activeGame),
      "missing",
      null
    );
    const setupGame: GameState = {
      ...activeGame,
      activePlayerId: null,
      status: "setup"
    };
    const setup = getPlayerHudState(
      createRoom(setupGame),
      "missing",
      null
    );

    expect(controlled.hudGamePlayer?.playerId).toBe("jaguar");
    expect(active.hudGamePlayer?.playerId).toBe("coati");
    expect(setup.hudGamePlayer?.playerId).toBe("macaw");
    expect(active.activeSpecies?.speciesId).toBe("coati");
    expect(setup.hudSpecies?.speciesId).toBe("macaw");
  });
});
