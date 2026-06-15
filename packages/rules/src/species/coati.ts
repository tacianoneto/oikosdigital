import type { GameState, GridPosition } from "@oikos/shared";
import { getCurrentAction, positionKey } from "../state";
import { getForestPositionsWithResource } from "../forest";
import { getPotentialDestinations } from "../movement";

/**
 * Side-effect-free queries for the Coati: where it may add a piece on fruit
 * sites, which adjacent positions complete a pending pair bonus, and how many
 * pieces it must remove during action C.
 *
 * These only read game state (via the shared state/forest/movement helpers), so
 * they live here independently of setup.ts. The mutating action functions
 * (addCoatiForCurrentAction, resolveCoatiPairBonus) stay in setup.ts for now
 * because they drive the turn loop.
 */

export function getCoatiFruitPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  if (game.pendingCoatiPairBonus) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "coati" || getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    return [];
  }

  if (player.reservePieces.length === 0) {
    return [];
  }

  return getForestPositionsWithResource(game, "fruit");
}

export function getCoatiPairBonusTargets(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const pending = game.pendingCoatiPairBonus;
  if (!pending || pending.playerId !== playerId) {
    return [];
  }

  const forestPositions = new Set(game.forest.cards.map((card) => positionKey(card)));

  return getPotentialDestinations(pending.origin, "adjacent")
    .filter((position) => forestPositions.has(positionKey(position)))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function getRequiredCoatiRemovalCount(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "coati" || getCurrentAction(game) !== "C") {
    return 0;
  }

  return player.reservePieces.length < 2 ? 2 : 0;
}
