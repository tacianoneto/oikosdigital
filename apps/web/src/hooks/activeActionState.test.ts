import { speciesDefinitions } from "@oikos/content";
import {
  createInitialGameState,
  createPreviewInitialForest
} from "@oikos/rules";
import type {
  GameState,
  RoomPlayer,
  SpeciesId
} from "@oikos/shared";
import { describe, expect, it } from "vitest";
import {
  getActiveActionState,
  type ActiveActionStateOptions
} from "./activeActionState";

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

function createGame(
  activePlayerId: string = "coati",
  activeActionIndex = 0
): GameState {
  return {
    ...createInitialGameState(
      "active-action-state",
      roomPlayers,
      () => 0.999999,
      createPreviewInitialForest()
    ),
    status: "active",
    activePlayerId,
    activeActionIndex
  };
}

function options(
  game: GameState | null,
  playerId = "coati",
  overrides: Partial<ActiveActionStateOptions> = {}
): ActiveActionStateOptions {
  const speciesId = game?.players.find(
    (player) => player.playerId === game.activePlayerId
  )?.speciesId as SpeciesId | null | undefined;
  return {
    activeSpecies: speciesId ? speciesDefinitions[speciesId] : null,
    currentGamePlayer:
      game?.players.find((player) => player.playerId === playerId) ?? null,
    currentPlayer:
      roomPlayers.find((player) => player.playerId === playerId) ?? null,
    game,
    hasPendingCoatiPairBonus: false,
    isLocalRoom: false,
    localPlayerId: playerId,
    selectedHandCardId: null,
    ...overrides
  };
}

describe("getActiveActionState", () => {
  it("returns disabled permissions without a game", () => {
    const state = getActiveActionState(options(null));

    expect(state.activeActionId).toBeNull();
    expect(state.canControlActivePlayer).toBe(false);
    expect(state.canPlaceSetupPiece).toBe(false);
    expect(state.handPlayableThisAction).toBe(false);
    expect(state.canSelectHandCards).toBe(false);
  });

  it("allows the active forest-card species to play a held card", () => {
    const game = createGame();
    const cardId = game.players.find(
      (player) => player.playerId === "coati"
    )!.hand[0]!;
    const state = getActiveActionState(
      options(game, "coati", { selectedHandCardId: cardId })
    );

    expect(state.activeActionId).toBe("A");
    expect(state.ownActiveActionId).toBe("A");
    expect(state.canControlActivePlayer).toBe(true);
    expect(state.handPlayableThisAction).toBe(true);
    expect(state.playableCardIds.has(cardId)).toBe(true);
    expect(state.canPlaceSelectedForestCard).toBe(true);
    expect(state.hasPlayableForestCardThisAction).toBe(true);
  });

  it("does not expose action control to a non-active player", () => {
    const state = getActiveActionState(options(createGame(), "jaguar"));

    expect(state.activeActionId).toBe("A");
    expect(state.ownActiveActionId).toBeNull();
    expect(state.canControlActivePlayer).toBe(false);
    expect(state.handPlayableThisAction).toBe(false);
  });

  it("blocks another card after the action already played one", () => {
    const base = createGame();
    const game: GameState = {
      ...base,
      activePlayedForestCardId: "bosque_1"
    };
    const state = getActiveActionState(options(game));

    expect(state.canControlActivePlayer).toBe(true);
    expect(state.handPlayableThisAction).toBe(false);
    expect(state.canPlaceSelectedForestCard).toBe(false);
  });

  it.each([
    ["local bot", { isLocalRoom: true, currentPlayer: { ...roomPlayers[1]!, isBot: true } }],
    ["Caatinga pending", { game: { ...createGame(), caatingaPending: { playerId: "coati", resource: "meat", location: { x: 0, y: 0 }, trigger: "add", round: 1 } } }],
    ["Cerrado pending", { game: { ...createGame(), cerradoPending: { playerId: "coati", resource: "meat", location: { x: 0, y: 0 }, round: 1 } } }],
    ["Coati pair pending", { hasPendingCoatiPairBonus: true }]
  ])("blocks card play with %s", (_label, overrides) => {
    const game = ("game" in overrides ? overrides.game : createGame()) as GameState;
    const state = getActiveActionState(
      options(game, "coati", overrides as Partial<ActiveActionStateOptions>)
    );

    expect(state.handPlayableThisAction).toBe(false);
    expect(state.canPlaceSelectedForestCard).toBe(false);
  });

  it("blocks a non-card species until Mata Atlantica discard resolves", () => {
    const base = createGame("jaguar");
    const jaguar = base.players.find(
      (player) => player.playerId === "jaguar"
    )!;
    const game: GameState = {
      ...base,
      mataAtlanticaPiles: [["bosque_1"], [], []],
      mataAtlanticaDiscardByPlayer: {}
    };
    const state = getActiveActionState(options(game, "jaguar"));

    expect(state.mataAtlanticaBlocksTurn).toBe(true);
    expect(state.canControlActivePlayer).toBe(false);

    const resolved = getActiveActionState(
      options(
        {
          ...game,
          mataAtlanticaDiscardByPlayer: {
            jaguar: jaguar.turnsTaken
          }
        },
        "jaguar"
      )
    );
    expect(resolved.mataAtlanticaBlocksTurn).toBe(false);
    expect(resolved.canControlActivePlayer).toBe(true);
    expect(resolved.handPlayableThisAction).toBe(false);
  });

  it("applies setup permission for local and online games", () => {
    const base = createGame();
    const game: GameState = {
      ...base,
      status: "setup",
      setupActivePlayerId: "coati"
    };

    expect(
      getActiveActionState(options(game, "coati")).canPlaceSetupPiece
    ).toBe(true);
    expect(
      getActiveActionState(
        options(game, "jaguar", { localPlayerId: "jaguar" })
      ).canPlaceSetupPiece
    ).toBe(false);
    expect(
      getActiveActionState(
        options(game, "jaguar", {
          isLocalRoom: true,
          localPlayerId: null
        })
      ).canPlaceSetupPiece
    ).toBe(true);
  });

  it("allows skipping an extra-turn card action with no valid card", () => {
    const base = createGame();
    const game: GameState = {
      ...base,
      extraTurnPlayerId: "coati",
      players: base.players.map((player) =>
        player.playerId === "coati"
          ? { ...player, hand: ["missing_card"] }
          : player
      )
    };
    const state = getActiveActionState(options(game));

    expect(state.handPlayableThisAction).toBe(true);
    expect(state.hasPlayableForestCardThisAction).toBe(false);
    expect(state.canSkipExtraTurnNoCardAction).toBe(true);
  });

  it("detects endgame overflow repair without extra-turn state", () => {
    const base = createGame();
    const state = getActiveActionState(
      options({
        ...base,
        round: base.maxRounds + 1
      })
    );
    const pendingExtraTurn = getActiveActionState(
      options({
        ...base,
        round: base.maxRounds + 1,
        pendingExtraTurnPlayerId: "coati"
      })
    );

    expect(state.needsEndgameOverflowRepair).toBe(true);
    expect(pendingExtraTurn.needsEndgameOverflowRepair).toBe(false);
  });
});
