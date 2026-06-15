import type { GameState, GridPosition } from "@oikos/shared";
import { getCurrentAction, positionKey, toGridPosition } from "../state";
import {
  getCardDefinitionOrNull,
  getForestCardAtPosition,
  getForestPositionsWithHabitat,
  getForestSitesAtPosition
} from "../forest";
import { getPotentialDestinations } from "../movement";

/**
 * Side-effect-free queries for the Galo-de-campina: where it may add pieces on
 * field cards, which adjacent positions accept a follow-up add, and its action D
 * presence scoring over field/seed cards.
 *
 * These only read game state (via the shared state/forest/movement helpers), so
 * they live here independently of setup.ts. The mutating action functions
 * (addGalo*, scoreGaloSeedCards) stay in setup.ts for now because they drive the
 * turn loop.
 */

const GALO_PRESENCE_THRESHOLD = 3;

export function getGaloFieldPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "galo_de_campina" || getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    return [];
  }

  if (player.reservePieces.length === 0) {
    return [];
  }

  return getForestPositionsWithHabitat(game, "field");
}

export function getGaloAdjacentTargetsForLocation(game: GameState, location: GridPosition): GridPosition[] {
  const forestPositions = new Set(game.forest.cards.map((card) => positionKey(card)));
  return getPotentialDestinations(location, "adjacent")
    .filter((position) => forestPositions.has(positionKey(position)))
    .filter((position) => getForestSitesAtPosition(game, position).some((site) => !site.isAtCapacity))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function getGaloAdjacentAddPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const pending = game.pendingGaloAdjacentAdd;
  if (!pending || pending.playerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "galo_de_campina" || player.reservePieces.length === 0) {
    return [];
  }

  return getGaloAdjacentTargetsForLocation(game, pending.location);
}

export function getGaloSeedCardScore(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "galo_de_campina" || getCurrentAction(game) !== "D") {
    return 0;
  }

  return getGaloScorePoints(game, playerId);
}

// Action D score: +1 if the galo is present in at least 3 campinas (field cards)
// and +1 if present in at least 3 seed (semente) locations. Presence counts each
// distinct card once, so max 2 points.
export function getGaloScorePoints(game: GameState, playerId: string): number {
  const fieldBonus = getGaloFieldCardPositions(game, playerId).length >= GALO_PRESENCE_THRESHOLD ? 1 : 0;
  const seedBonus = getGaloSeedCardPositions(game, playerId).length >= GALO_PRESENCE_THRESHOLD ? 1 : 0;
  return fieldBonus + seedBonus;
}

function getGaloPresencePositions(
  game: GameState,
  playerId: string,
  matches: (definition: ReturnType<typeof getCardDefinitionOrNull>) => boolean
): GridPosition[] {
  const positions = new Map<string, GridPosition>();

  for (const piece of game.pieces) {
    if (piece.ownerId !== playerId || piece.speciesId !== "galo_de_campina" || !piece.location) {
      continue;
    }

    const card = getForestCardAtPosition(game, piece.location);
    const definition = card ? getCardDefinitionOrNull(card.definitionId) : null;
    if (matches(definition)) {
      positions.set(positionKey(piece.location), toGridPosition(piece.location));
    }
  }

  return [...positions.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function getGaloSeedCardPositions(game: GameState, playerId: string): GridPosition[] {
  return getGaloPresencePositions(game, playerId, (definition) => definition?.resource === "seed");
}

export function getGaloFieldCardPositions(game: GameState, playerId: string): GridPosition[] {
  return getGaloPresencePositions(game, playerId, (definition) => definition?.habitat === "field");
}
