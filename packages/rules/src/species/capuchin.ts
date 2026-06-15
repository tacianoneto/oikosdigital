import type { GameState, GridPosition } from "@oikos/shared";
import { getCurrentAction, positionKey, toGridPosition } from "../state";
import {
  getCardDefinitionOrNull,
  getForestCardAtPosition,
  getPlayedForestCardForCurrentAction
} from "../forest";

/**
 * Side-effect-free queries for the Capuchin: where it may add/move pieces and
 * its action D habitat-majority scoring (a habitat scores when the capuchin
 * occupies it in at least two distinct positions).
 *
 * These only read game state (via the shared state/forest helpers), so they live
 * here independently of setup.ts. The mutating action functions
 * (addCapuchinForCurrentAction, scoreCapuchinHabitatPresence) stay in setup.ts
 * for now because they drive the turn loop.
 */

export function getCapuchinPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  if (game.pendingCoatiPairBonus) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "capuchin" || player.reservePieces.length === 0) {
    return [];
  }

  const action = getCurrentAction(game);
  if (action === "A") {
    if (!game.activePlayedForestCardId) {
      return [];
    }

    const playedCard = getPlayedForestCardForCurrentAction(game);
    return playedCard ? [{ x: playedCard.x, y: playedCard.y }] : [];
  }

  if (action === "C") {
    const positions = new Map<string, GridPosition>();
    for (const piece of game.pieces) {
      if (piece.ownerId !== playerId || piece.speciesId !== "capuchin" || !piece.location) {
        continue;
      }

      positions.set(positionKey(piece.location), toGridPosition(piece.location));
    }

    return [...positions.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  }

  return [];
}

export function getCapuchinHabitatScore(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "capuchin" || getCurrentAction(game) !== "D") {
    return 0;
  }

  const positionsByHabitat = new Map<string, Set<string>>();
  for (const piece of game.pieces) {
    if (piece.ownerId !== playerId || piece.speciesId !== "capuchin" || !piece.location) {
      continue;
    }

    const card = getForestCardAtPosition(game, piece.location);
    const definition = card ? getCardDefinitionOrNull(card.definitionId) : null;
    if (!definition?.habitat) {
      continue;
    }

    const positions = positionsByHabitat.get(definition.habitat) ?? new Set<string>();
    positions.add(positionKey(piece.location));
    positionsByHabitat.set(definition.habitat, positions);
  }

  return [...positionsByHabitat.values()].filter((positions) => positions.size >= 2).length;
}

export interface CapuchinHabitatGroup {
  habitat: string;
  positions: GridPosition[];
}

export function getCapuchinScoringHabitats(game: GameState, playerId: string): CapuchinHabitatGroup[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "capuchin" || getCurrentAction(game) !== "D") {
    return [];
  }

  const positionsByHabitat = new Map<string, Map<string, GridPosition>>();
  for (const piece of game.pieces) {
    if (piece.ownerId !== playerId || piece.speciesId !== "capuchin" || !piece.location) {
      continue;
    }

    const card = getForestCardAtPosition(game, piece.location);
    const definition = card ? getCardDefinitionOrNull(card.definitionId) : null;
    if (!definition?.habitat) {
      continue;
    }

    const map = positionsByHabitat.get(definition.habitat) ?? new Map<string, GridPosition>();
    map.set(positionKey(piece.location), piece.location);
    positionsByHabitat.set(definition.habitat, map);
  }

  const groups: CapuchinHabitatGroup[] = [];
  for (const [habitat, map] of positionsByHabitat.entries()) {
    if (map.size >= 2) {
      groups.push({ habitat, positions: [...map.values()] });
    }
  }
  return groups;
}
