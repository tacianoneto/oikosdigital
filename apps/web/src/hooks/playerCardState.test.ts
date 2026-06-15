import {
  createInitialGameState,
  createPreviewInitialForest
} from "@oikos/rules";
import type { GameState, RoomPlayer } from "@oikos/shared";
import { describe, expect, it } from "vitest";
import { getPlayerCardState } from "./playerCardState";

function createGame(): GameState {
  const players: RoomPlayer[] = [
    {
      playerId: "player",
      name: "Player",
      speciesId: "jaguar",
      ready: true,
      connected: true
    },
    {
      playerId: "rival",
      name: "Rival",
      speciesId: "coati",
      ready: true,
      connected: true
    }
  ];
  return createInitialGameState(
    "player-card-state",
    players,
    () => 0.999999,
    createPreviewInitialForest()
  );
}

describe("getPlayerCardState", () => {
  it("returns empty card state without game or player", () => {
    const state = getPlayerCardState(null, null, "habitat", false, null);

    expect(state.handCards).toEqual([]);
    expect(state.objectiveChoices).toEqual([]);
    expect(state.objectivePreviewCard).toBeNull();
    expect(state.needsObjectiveChoice).toBe(false);
  });

  it("combines personal hand and Mata Atlantica pile tops", () => {
    const base = createGame();
    const game: GameState = {
      ...base,
      mataAtlanticaPiles: [
        ["campo_1", "campo_2"],
        [],
        ["bosque_1", "bosque_2"]
      ],
      players: base.players.map((player) =>
        player.playerId === "player"
          ? { ...player, hand: ["rio_1"] }
          : player
      )
    };
    const state = getPlayerCardState(
      game,
      game.players[0]!,
      "habitat",
      false,
      null
    );

    expect(state.mataAtlanticaPileTopIds).toEqual([
      "campo_1",
      "bosque_1"
    ]);
    expect(state.mataAtlanticaPileIndexByCardId.get("campo_1")).toBe(0);
    expect(state.mataAtlanticaPileIndexByCardId.get("bosque_1")).toBe(1);
    expect(state.handCards.map((card) => card.id)).toEqual([
      "rio_1",
      "campo_1",
      "bosque_1"
    ]);
  });

  it("sorts hand stably by habitat and resource", () => {
    const base = createGame();
    const cardIds = ["rio_1", "campo_1", "bosque_1", "bosque_2"];
    const game: GameState = {
      ...base,
      players: base.players.map((player) =>
        player.playerId === "player"
          ? { ...player, hand: cardIds }
          : player
      )
    };
    const player = game.players[0]!;

    expect(
      getPlayerCardState(game, player, "habitat", false, null)
        .sortedHandCards.map(({ card }) => card.id)
    ).toEqual(["bosque_1", "bosque_2", "campo_1", "rio_1"]);
    expect(
      getPlayerCardState(game, player, "resource", false, null)
        .sortedHandCards.map(({ card }) => card.id)
    ).toEqual(["bosque_2", "bosque_1", "rio_1", "campo_1"]);
  });

  it("derives objective choice and pending state", () => {
    const base = createGame();
    const game: GameState = {
      ...base,
      status: "active",
      players: base.players.map((player) =>
        player.playerId === "player"
          ? {
              ...player,
              objectiveChoices: ["objective_2", "objective_18"],
              selectedObjectiveCardId: null
            }
          : player
      )
    };
    const player = game.players[0]!;

    const available = getPlayerCardState(
      game,
      player,
      "habitat",
      false,
      null
    );
    const pending = getPlayerCardState(
      game,
      player,
      "habitat",
      false,
      "objective_2"
    );

    expect(available.objectiveChoices.map((card) => card.id)).toEqual([
      "objective_2",
      "objective_18"
    ]);
    expect(available.needsObjectiveChoice).toBe(true);
    expect(pending.needsObjectiveChoice).toBe(false);
  });

  it("derives selected and discarded objective behavior", () => {
    const base = createGame();
    const selectedGame: GameState = {
      ...base,
      status: "active",
      players: base.players.map((player) =>
        player.playerId === "player"
          ? {
              ...player,
              objectiveChoices: [],
              selectedObjectiveCardId: "objective_18"
            }
          : player
      )
    };
    const selectedPlayer = selectedGame.players[0]!;
    const selected = getPlayerCardState(
      selectedGame,
      selectedPlayer,
      "resource",
      false,
      null
    );
    const spectator = getPlayerCardState(
      selectedGame,
      selectedPlayer,
      "resource",
      true,
      null
    );
    const discardedGame: GameState = {
      ...selectedGame,
      players: selectedGame.players.map((player) =>
        player.playerId === "player"
          ? {
              ...player,
              selectedObjectiveCardId: null,
              discardedObjectiveCardId: "objective_18"
            }
          : player
      )
    };
    const discarded = getPlayerCardState(
      discardedGame,
      discardedGame.players[0]!,
      "resource",
      false,
      null
    );

    expect(selected.selectedObjectiveCard?.id).toBe("objective_18");
    expect(selected.canDiscardSelectedObjective).toBe(true);
    expect(selected.selectedObjectiveProgress).toBe(0);
    expect(spectator.canDiscardSelectedObjective).toBe(false);
    expect(discarded.objectiveWasDiscarded).toBe(true);
    expect(discarded.objectivePreviewCard?.id).toBe("objective_18");
  });

  it("reports live progress for point objectives", () => {
    const base = createGame();
    const game: GameState = {
      ...base,
      status: "active",
      players: base.players.map((player) =>
        player.playerId === "player"
          ? { ...player, selectedObjectiveCardId: "objective_14" }
          : player
      )
    };
    const state = getPlayerCardState(
      game,
      game.players[0]!,
      "habitat",
      false,
      null
    );

    expect(state.selectedObjectiveScoresPoints).toBe(true);
    expect(state.selectedObjectiveProgress).toBe(2);
    expect(state.selectedObjectiveCompleted).toBe(true);
  });
});
