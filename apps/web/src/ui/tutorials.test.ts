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
import { describe, expect, it } from "vitest";
import { createCoatiTutorialRoom, getTutorialSteps } from "./tutorials";

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
