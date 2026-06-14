import {
  addCoatiForCurrentAction,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getRequiredCoatiRemovalCount,
  getValidPieceMovementDestinations,
  movePieceForCurrentAction,
  placeForestCard,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus
} from "@oikos/rules";
import type { PublicRoomState, SpeciesId } from "@oikos/shared";
import { describe, expect, it } from "vitest";
import {
  createArmadilloTutorialRoom,
  createCapuchinTutorialRoom,
  createCoatiTutorialRoom,
  createInitialTutorialRoom,
  createJaguarTutorialRoom,
  createMacawTutorialRoom,
  createWolfTutorialRoom,
  getTutorialPlayerId,
  getTutorialSteps,
  type TutorialId
} from "./tutorials";

const tutorialCases: Array<{
  id: TutorialId;
  speciesId: SpeciesId;
  stepCount: number;
  createRoom: () => PublicRoomState;
}> = [
  { id: "initial", speciesId: "armadillo", stepCount: 11, createRoom: createInitialTutorialRoom },
  { id: "jaguar", speciesId: "jaguar", stepCount: 8, createRoom: createJaguarTutorialRoom },
  { id: "wolf", speciesId: "maned_wolf", stepCount: 10, createRoom: createWolfTutorialRoom },
  { id: "armadillo", speciesId: "armadillo", stepCount: 14, createRoom: createArmadilloTutorialRoom },
  { id: "macaw", speciesId: "macaw", stepCount: 11, createRoom: createMacawTutorialRoom },
  { id: "capuchin", speciesId: "capuchin", stepCount: 11, createRoom: createCapuchinTutorialRoom },
  { id: "coati", speciesId: "coati", stepCount: 13, createRoom: createCoatiTutorialRoom }
];

describe("tutorial chapter contracts", () => {
  it.each(tutorialCases)("keeps the $id chapter wired to its scripted room", (tutorial) => {
    const room = tutorial.createRoom();
    const playerId = getTutorialPlayerId(tutorial.id, null);
    const game = room.game;

    expect(getTutorialSteps(tutorial.id)).toHaveLength(tutorial.stepCount);
    expect(playerId).not.toBeNull();
    expect(room.status).toBe("active");
    expect(game?.status).toBe("active");
    expect(game?.activePlayerId).toBe(playerId);
    expect(game?.turnOrder).toContain(playerId);
    expect(game?.forest.cards.length).toBeGreaterThan(0);
    expect(game?.players.find((player) => player.playerId === playerId)?.speciesId).toBe(tutorial.speciesId);
  });

  it("defaults missing tutorial ids to the basic chapter", () => {
    expect(getTutorialSteps(null)).toBe(getTutorialSteps("initial"));
  });
});

describe("Quati tutorial", () => {
  it("scores three passive additions before recovering the reserve", () => {
    let game = createCoatiTutorialRoom().game!;
    const playerId = game.activePlayerId!;
    const getPlayer = () => game.players.find((candidate) => candidate.playerId === playerId)!;
    const movingPieceId = `${playerId}_piece_2`;

    expect(getTutorialSteps("coati")).toHaveLength(13);
    expect(getPlayer().piecesInForest).toHaveLength(4);
    expect(getPlayer().reservePieces).toHaveLength(4);

    game = placeForestCard(game, playerId, "bosque_1_copy", { x: 2, y: 0 });
    expect(getCoatiFruitPlacementPositions(game, playerId)).toContainEqual({ x: -1, y: -1 });

    game = addCoatiForCurrentAction(game, playerId, { x: -1, y: -1 });
    expect(game.pendingCoatiPairBonus?.origin).toEqual({ x: -1, y: -1 });
    expect(getCoatiPairBonusTargets(game, playerId)).toContainEqual({ x: 0, y: -1 });

    game = resolveCoatiPairBonus(game, playerId, { x: 0, y: -1 });
    expect(getPlayer().score).toBe(1);
    expect(getPlayer().reservePieces).toHaveLength(2);
    expect(game.pendingCoatiPairBonus?.origin).toEqual({ x: 0, y: -1 });
    expect(getCoatiPairBonusTargets(game, playerId)).toContainEqual({ x: 1, y: -1 });

    game = resolveCoatiPairBonus(game, playerId, { x: 1, y: -1 });
    expect(getPlayer().score).toBe(2);
    expect(getPlayer().reservePieces).toHaveLength(1);
    expect(game.pendingCoatiPairBonus?.origin).toEqual({ x: 1, y: -1 });
    expect(getCoatiPairBonusTargets(game, playerId)).toContainEqual({ x: 1, y: 0 });

    game = resolveCoatiPairBonus(game, playerId, { x: 1, y: 0 });
    expect(getPlayer().score).toBe(3);
    expect(getPlayer().reservePieces).toHaveLength(0);
    expect(game.pendingCoatiPairBonus).toBeNull();
    expect(game.activeActionIndex).toBe(1);
    expect(getValidPieceMovementDestinations(game, playerId, movingPieceId)).toContainEqual({ x: 1, y: 0 });

    game = movePieceForCurrentAction(game, playerId, movingPieceId, { x: 1, y: 0 });
    expect(game.activeActionIndex).toBe(2);
    expect(getRequiredCoatiRemovalCount(game, playerId)).toBe(2);

    const removalIds = getPlayer().piecesInForest.filter((pieceId) => pieceId !== movingPieceId).slice(0, 2);
    game = removePiecesForCurrentAction(game, playerId, removalIds);

    expect(game.round).toBe(3);
    expect(getPlayer().score).toBe(3);
    expect(getPlayer().reservePieces).toHaveLength(2);
    expect(getPlayer().piecesInForest).toHaveLength(6);
  });
});
