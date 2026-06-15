import type { GameState, GridPosition, Resource } from "@oikos/shared";
import { speciesDefinitions } from "@oikos/content";
import { canSpeciesRemovePieceForCacaIlegal } from "./speciesRules";
import { findPlayer } from "./state";
import { getCardDefinitionOrNull, getForestCardAtPosition } from "./forest";

export function applyCaatingaTrigger(
  game: GameState,
  playerId: string,
  location: GridPosition,
  trigger: "add" | "remove"
): void {
  if (!(game.activeScenarioIds ?? []).includes("caatinga")) return;
  if (game.activePlayerId !== playerId) return;
  const player = findPlayer(game, playerId);
  if (!player.speciesId) return;
  if ((game.caatingaUsedByPlayer ?? {})[playerId] === game.round) return;
  const card = getForestCardAtPosition(game, location);
  const def = card ? getCardDefinitionOrNull(card.definitionId) : null;
  const resource = def?.resource ?? null;
  if (!resource) return;
  game.caatingaPending = {
    playerId,
    resource,
    location: { x: location.x, y: location.y },
    trigger,
    round: game.round
  };
}

const ALL_RESOURCES: Resource[] = ["meat", "egg", "fruit", "seed"];

export function getCacaIlegalTopResources(game: GameState, playerId: string): Resource[] {
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player) return [];
  let max = 0;
  for (const resource of ALL_RESOURCES) {
    const count = player.resources[resource] ?? 0;
    if (count > max) max = count;
  }
  if (max <= 0) return [];
  return ALL_RESOURCES.filter((resource) => (player.resources[resource] ?? 0) === max);
}

export function getCacaIlegalRemovablePieceIds(game: GameState, playerId: string): string[] {
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!canSpeciesRemovePieceForCacaIlegal(player?.speciesId ?? null)) return [];
  return game.pieces
    .filter((piece) => piece.ownerId === playerId && piece.location)
    .map((piece) => piece.pieceId);
}

export function getMataAtlanticaPileTops(game: GameState): string[] {
  if (!game.mataAtlanticaPiles) return [];
  return game.mataAtlanticaPiles
    .map((pile) => pile[0])
    .filter((id): id is string => Boolean(id));
}

export function removeFromMataAtlanticaPile(
  game: GameState,
  cardId: string
): boolean {
  if (!game.mataAtlanticaPiles) return false;
  let removedPileIndex = -1;
  game.mataAtlanticaPiles = game.mataAtlanticaPiles.map((pile, index) => {
    if (removedPileIndex >= 0) return [...pile];
    const cardIndex = pile.indexOf(cardId);
    if (cardIndex < 0) return [...pile];
    removedPileIndex = index;
    return [...pile.slice(0, cardIndex), ...pile.slice(cardIndex + 1)];
  });
  if (removedPileIndex >= 0 && game.deck.commonCardIds.length > 0) {
    const [refillId, ...rest] = game.deck.commonCardIds;
    game.deck = { ...game.deck, commonCardIds: rest };
    game.mataAtlanticaPiles = game.mataAtlanticaPiles.map((pile, index) =>
      index === removedPileIndex ? [...pile, refillId] : pile
    );
  }
  return removedPileIndex >= 0;
}

export function mataAtlanticaRequiresDiscard(game: GameState, playerId: string): boolean {
  if (!game.mataAtlanticaPiles) return false;
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player?.speciesId) return false;
  if (speciesDefinitions[player.speciesId].usesForestCards) return false;
  if ((game.mataAtlanticaDiscardByPlayer ?? {})[playerId] === player.turnsTaken) return false;
  return getMataAtlanticaPileTops(game).length > 0;
}

export function assertMataAtlanticaDiscarded(game: GameState, playerId: string): void {
  if (mataAtlanticaRequiresDiscard(game, playerId)) {
    throw new Error("Descarte 1 carta de uma das pilhas (Mata Atlantica) antes de agir.");
  }
}
