import type { GameState, Resource } from "@oikos/shared";
import { speciesDefinitions } from "@oikos/content";
import { canSpeciesRemovePieceForCacaIlegal } from "./speciesRules";

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

export function mataAtlanticaRequiresDiscard(game: GameState, playerId: string): boolean {
  if (!game.mataAtlanticaPiles) return false;
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player?.speciesId) return false;
  if (speciesDefinitions[player.speciesId].usesForestCards) return false;
  if ((game.mataAtlanticaDiscardByPlayer ?? {})[playerId] === player.turnsTaken) return false;
  return getMataAtlanticaPileTops(game).length > 0;
}
