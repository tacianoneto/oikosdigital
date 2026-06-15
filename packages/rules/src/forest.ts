import { commonForestCards, initialForestCardCandidates } from "@oikos/content";
import type {
  CardConnections,
  ForestCardDefinition,
  ForestCardSiteDefinition,
  ForestCardState,
  GameState,
  GridPosition,
  Habitat,
  PieceLocation,
  PieceState,
  Resource
} from "@oikos/shared";
import { positionKey } from "./state";

/**
 * Pure, side-effect-free readers over the forest board (cards, sites and the
 * pieces standing on them). Previously defined privately inside setup.ts; moved
 * here so the per-species modules can query the board without importing setup.ts
 * (which would create circular imports). Nothing here calls species or turn-loop
 * logic, so it sits below them in the dependency graph.
 */

export const defaultCardSiteId = "main";

export function getCardDefinitionOrNull(definitionId: string): ForestCardDefinition | null {
  const commonCard = commonForestCards.find((card) => card.id === definitionId);
  if (commonCard) {
    return commonCard;
  }

  return initialForestCardCandidates.find((card) => card.id === definitionId) ?? null;
}

function isSamePieceLocation(first: PieceLocation, second: PieceLocation): boolean {
  return first.x === second.x && first.y === second.y && first.siteId === second.siteId;
}

export function getForestCardAtPosition(game: GameState, location: GridPosition): ForestCardState | null {
  return game.forest.cards.find((card) => card.x === location.x && card.y === location.y) ?? null;
}

export function getPlayedForestCardForCurrentAction(game: GameState): ForestCardState | null {
  if (!game.activePlayedForestCardId) {
    return null;
  }

  return (
    [...game.forest.cards]
      .reverse()
      .find((card) => !card.isInitial && card.definitionId === game.activePlayedForestCardId) ?? null
  );
}

export interface ForestSiteOccupancy {
  card: ForestCardState;
  site: ForestCardSiteDefinition;
  pieces: PieceState[];
  isOccupied: boolean;
  isAtCapacity: boolean;
}

export function getForestSitesAtPosition(game: GameState, location: GridPosition): ForestSiteOccupancy[] {
  const card = getForestCardAtPosition(game, location);
  if (!card) {
    return [];
  }

  const definition = getCardDefinitionOrNull(card.definitionId);
  if (!definition) {
    return [];
  }

  return definition.sites.map((site) => {
    const pieces = getForestSitePieces(game, location, site.siteId);

    return {
      card,
      site,
      pieces,
      isOccupied: pieces.length > 0,
      isAtCapacity: site.maxPieces !== null && pieces.length >= site.maxPieces
    };
  });
}

export function getForestSiteOccupancy(game: GameState, location: GridPosition, siteId = defaultCardSiteId): ForestSiteOccupancy | null {
  return getForestSitesAtPosition(game, location).find((siteState) => siteState.site.siteId === siteId) ?? null;
}

export function getForestSitePieces(game: GameState, location: GridPosition, siteId = defaultCardSiteId): PieceState[] {
  return game.pieces.filter((piece) => piece.location && isSamePieceLocation(piece.location, { ...location, siteId }));
}

export function hasForestSiteResource(game: GameState, location: GridPosition, resource: Resource): boolean {
  return getForestSitesAtPosition(game, location).some((siteState) => siteState.site.resource === resource);
}

export function getForestPositionsWithResource(game: GameState, resource: Resource): GridPosition[] {
  return game.forest.cards
    .filter((card) => hasForestSiteResource(game, card, resource))
    .map((card) => ({ x: card.x, y: card.y }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function getForestPositionsWithHabitat(game: GameState, habitat: Habitat): GridPosition[] {
  return game.forest.cards
    .filter((card) => getCardDefinitionOrNull(card.definitionId)?.habitat === habitat)
    .map((card) => ({ x: card.x, y: card.y }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function findFirstForestSiteWithResource(game: GameState, location: GridPosition, resource: Resource): ForestCardSiteDefinition | null {
  return getForestSitesAtPosition(game, location).find((siteState) => siteState.site.resource === resource)?.site ?? null;
}

export function findFirstForestSiteWithHabitat(game: GameState, location: GridPosition, habitat: Habitat): ForestCardSiteDefinition | null {
  return getForestSitesAtPosition(game, location).find((siteState) => siteState.site.habitat === habitat)?.site ?? null;
}

export function createPieceLocation(game: GameState, location: GridPosition, siteId = defaultCardSiteId): PieceLocation {
  const site = getForestSiteOccupancy(game, location, siteId);
  if (!site) {
    throw new Error("Local interno da carta nao encontrado.");
  }

  if (site.isAtCapacity) {
    throw new Error("Local interno da carta ja esta ocupado no limite permitido.");
  }

  return {
    x: location.x,
    y: location.y,
    siteId
  };
}

const FOREST_LIMIT_MIN = -3;
const FOREST_LIMIT_MAX = 3;

const cardinalDirections = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 }
];

type ConnectionDirection = keyof CardConnections;

export const connectionDirections: ConnectionDirection[] = ["north", "east", "south", "west"];
export const directionOffsets: Record<ConnectionDirection, GridPosition> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 }
};

export const oppositeDirection: Record<ConnectionDirection, ConnectionDirection> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east"
};

export function isWithinForestLimit(position: GridPosition): boolean {
  return (
    position.x >= FOREST_LIMIT_MIN &&
    position.x <= FOREST_LIMIT_MAX &&
    position.y >= FOREST_LIMIT_MIN &&
    position.y <= FOREST_LIMIT_MAX
  );
}

export function getAvailableForestExpansionPositions(cards: ForestCardState[]): GridPosition[] {
  const occupied = new Set(cards.map((card) => positionKey(card)));
  const targets = new Map<string, GridPosition>();

  for (const card of cards) {
    for (const direction of cardinalDirections) {
      const candidate = { x: card.x + direction.x, y: card.y + direction.y };
      const key = positionKey(candidate);

      if (!occupied.has(key) && isWithinForestLimit(candidate)) {
        targets.set(key, candidate);
      }
    }
  }

  return [...targets.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

function noConnections(): CardConnections {
  return {
    north: null,
    east: null,
    south: null,
    west: null
  };
}

export function getRotatedConnections(cardDefinition: ForestCardDefinition, rotation: ForestCardState["rotation"]): CardConnections {
  const connections = cardDefinition.connections ?? noConnections();
  const rotated = noConnections();
  const steps = rotation / 90;

  for (const direction of connectionDirections) {
    const nextDirection = connectionDirections[(connectionDirections.indexOf(direction) + steps) % connectionDirections.length];
    rotated[nextDirection] = connections[direction];
  }

  return rotated;
}

function isForestCardRiverConnectionValid(
  game: GameState,
  cardDefinition: ForestCardDefinition,
  location: GridPosition,
  rotation: ForestCardState["rotation"]
): boolean {
  const candidateConnections = getRotatedConnections(cardDefinition, rotation);

  for (const direction of connectionDirections) {
    const offset = directionOffsets[direction];
    const neighbor = getForestCardAtPosition(game, { x: location.x + offset.x, y: location.y + offset.y });
    if (!neighbor) {
      continue;
    }

    const neighborDefinition = getCardDefinitionOrNull(neighbor.definitionId);
    if (!neighborDefinition) {
      return false;
    }

    const neighborConnections = getRotatedConnections(neighborDefinition, neighbor.rotation);
    const candidateHasRiver = candidateConnections[direction] === "river";
    const neighborHasRiver = neighborConnections[oppositeDirection[direction]] === "river";
    if (candidateHasRiver !== neighborHasRiver) {
      return false;
    }
  }

  return true;
}

export function getAvailableForestExpansionPositionsForCard(
  game: GameState,
  cardId: string,
  rotation: ForestCardState["rotation"] = 0
): GridPosition[] {
  const cardDefinition = commonForestCards.find((card) => card.id === cardId);
  if (!cardDefinition) {
    return [];
  }

  const basePositions =
    game.activeThreatCardId === "threat_2"
      ? game.forest.cards.map((card) => ({ x: card.x, y: card.y }))
      : getAvailableForestExpansionPositions(game.forest.cards);

  return basePositions.filter((position) =>
    isForestCardRiverConnectionValid(game, cardDefinition, position, rotation)
  );
}
