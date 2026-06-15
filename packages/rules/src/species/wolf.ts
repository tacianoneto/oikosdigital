import { speciesDefinitions } from "@oikos/content";
import type { GameState, GridPosition, Resource } from "@oikos/shared";
import { getCurrentAction, positionKey } from "../state";
import { getForestPositionsWithResource } from "../forest";

/**
 * Side-effect-free queries for the Maned Wolf (lobo-guará): which opponent base
 * pieces it may remove (action B), which resources it may spend for points and
 * how many (action C), and where it may add a piece on meat sites (action D).
 *
 * These only read game state (via the shared state/forest helpers), so they live
 * here independently of setup.ts. The mutating action functions
 * (removeBasePieceForWolfAction, spendWolfResourcesForPoints, addWolfForCurrentAction)
 * stay in setup.ts for now because they drive the turn loop.
 */

export function getWolfRemovableBasePieceIds(game: GameState, playerId: string): string[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "maned_wolf" || getCurrentAction(game) !== "B") {
    return [];
  }

  const wolfPositions = new Set(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "maned_wolf" && piece.location)
      .map((piece) => positionKey(piece.location!))
  );

  return game.pieces
    .filter((piece) => {
      if (piece.ownerId === playerId || piece.state.hidden || !piece.location || !wolfPositions.has(positionKey(piece.location))) {
        return false;
      }

      return speciesDefinitions[piece.speciesId].category === "base";
    })
    .sort((a, b) => a.pieceId.localeCompare(b.pieceId))
    .map((piece) => piece.pieceId);
}

export function getWolfSpendableResourceTypes(game: GameState, playerId: string): Resource[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "maned_wolf" || getCurrentAction(game) !== "C") {
    return [];
  }

  const maxCount = getAvailableWolfPointSpendCount(game, playerId);
  if (maxCount === 0) {
    return [];
  }

  return (["meat", "egg", "fruit", "seed"] as Resource[]).filter((resource) => player.resources[resource] > 0);
}

export function getAvailableWolfPointSpendCount(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "maned_wolf" || getCurrentAction(game) !== "C") {
    return 0;
  }

  const wolvesInForest = game.pieces.filter((piece) => piece.ownerId === playerId && piece.speciesId === "maned_wolf" && piece.location).length;
  const resourceTypesInStock = (["meat", "egg", "fruit", "seed"] as Resource[]).filter((resource) => player.resources[resource] > 0).length;

  return Math.min(wolvesInForest, resourceTypesInStock);
}

export function getWolfMeatPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "maned_wolf" || getCurrentAction(game) !== "D" || player.reservePieces.length === 0) {
    return [];
  }

  return getForestPositionsWithResource(game, "meat");
}
