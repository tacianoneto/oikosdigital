import { describe, expect, it, vi } from "vitest";
import type { RoomPlayer } from "@oikos/shared";
import {
  applyGameIntent,
  collectCerradoBonus,
  createInitialGameState,
  createPreviewInitialForest,
  placeInitialPiece,
  placeForestCard,
  scoreCapuchinHabitatPresence,
  selectObjectiveCard
} from "./index";
import { getAvailableForestExpansionPositionsForCard } from "./forest";

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

function createActiveCapuchinPlaceCardGame() {
  // Action A (index 0) is where forest-card-using species expand the forest.
  const game = createInitialGameState("intent-test", [player("capuchin", "capuchin")], () => 0.999999, createPreviewInitialForest());
  game.status = "active";
  game.activePlayerId = "capuchin";
  game.activeActionIndex = 0;
  game.setupActivePlayerId = null;
  return game;
}

function createObjectiveSetupGame() {
  return createInitialGameState(
    "intent-test",
    [player("jaguar", "jaguar"), player("coati", "coati")],
    () => 0.999999,
    createPreviewInitialForest(),
    { enabledMiniExpansions: ["objectives"] }
  );
}

function createSetupGame() {
  return createInitialGameState(
    "intent-test",
    [player("jaguar", "jaguar"), player("coati", "coati")],
    () => 0.999999,
    createPreviewInitialForest()
  );
}

function createCerradoPendingGame() {
  const game = createInitialGameState(
    "intent-test",
    [player("capuchin", "capuchin"), player("coati", "coati")],
    () => 0.999999,
    createPreviewInitialForest(),
    { activeScenarioIds: ["cerrado"] }
  );
  game.status = "active";
  game.activePlayerId = "capuchin";
  game.activeActionIndex = 1;
  game.setupActivePlayerId = null;
  game.cerradoPending = {
    playerId: "capuchin",
    resource: "fruit",
    location: { x: 0, y: 0 },
    round: game.round
  };
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

  it("places forest cards through the same rule applier used by legacy calls", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const reference = createActiveCapuchinPlaceCardGame();
    const cardId = reference.players[0].hand[0];
    expect(cardId).toBeTruthy();
    const [position] = getAvailableForestExpansionPositionsForCard(reference, cardId);
    expect(position).toBeTruthy();

    const legacy = placeForestCard(createActiveCapuchinPlaceCardGame(), "capuchin", cardId, position, 90);
    const viaIntent = applyGameIntent(createActiveCapuchinPlaceCardGame(), "capuchin", {
      type: "forest.place-card",
      cardId,
      x: position.x,
      y: position.y,
      rotation: 90
    });

    expect(viaIntent.forest.cards).toEqual(legacy.forest.cards);
    expect(viaIntent.players).toEqual(legacy.players);
    expect(viaIntent.activePlayedForestCardId).toBe(legacy.activePlayedForestCardId);
    expect(viaIntent.log.at(-1)?.payload).toEqual(legacy.log.at(-1)?.payload);
    vi.useRealTimers();
  });

  it("places setup pieces through the same rule applier used by legacy calls", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const position = { x: 0, y: 0 };

    const legacy = placeInitialPiece(createSetupGame(), "jaguar", position);
    const viaIntent = applyGameIntent(createSetupGame(), "jaguar", {
      type: "setup.place-piece",
      x: position.x,
      y: position.y
    });

    expect(viaIntent.players).toEqual(legacy.players);
    expect(viaIntent.pieces).toEqual(legacy.pieces);
    expect(viaIntent.setupActivePlayerId).toBe(legacy.setupActivePlayerId);
    expect(viaIntent.log.at(-1)?.payload).toEqual(legacy.log.at(-1)?.payload);
    vi.useRealTimers();
  });

  it("selects objectives through the same rule applier used by legacy calls", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const reference = createObjectiveSetupGame();
    const objectiveCardId = reference.players.find((candidate) => candidate.playerId === "jaguar")!.objectiveChoices[0]!;

    const legacy = selectObjectiveCard(createObjectiveSetupGame(), "jaguar", objectiveCardId);
    const viaIntent = applyGameIntent(createObjectiveSetupGame(), "jaguar", {
      type: "objective.select",
      objectiveCardId
    });

    expect(viaIntent.players).toEqual(legacy.players);
    expect(viaIntent.log.at(-1)?.message).toBe(legacy.log.at(-1)?.message);
    vi.useRealTimers();
  });

  it("resolves scenario choices through the same rule applier used by legacy calls", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const legacy = collectCerradoBonus(createCerradoPendingGame(), "capuchin", "collect");
    const viaIntent = applyGameIntent(createCerradoPendingGame(), "capuchin", {
      type: "scenario.cerrado-collect",
      mode: "collect"
    });

    expect(viaIntent.players).toEqual(legacy.players);
    expect(viaIntent.cerradoPending).toEqual(legacy.cerradoPending);
    expect(viaIntent.cerradoTriggeredByPlayer).toEqual(legacy.cerradoTriggeredByPlayer);
    expect(viaIntent.log.at(-1)?.message).toBe(legacy.log.at(-1)?.message);
    vi.useRealTimers();
  });
});
