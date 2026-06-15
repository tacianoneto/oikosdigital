import { commonForestCards, initialForestCardCandidates } from "@oikos/content";
import type {
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
