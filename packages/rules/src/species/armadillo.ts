import type { GameState, GridPosition, SpeciesId } from "@oikos/shared";
import { getCurrentAction, positionKey } from "../state";
import { getForestPositionsWithResource } from "../forest";

/**
 * Side-effect-free queries for the Tatu-bola (armadillo): where it may add a
 * piece, which pieces it may hide, and how much its location-sharing scores.
 *
 * These only read game state (via the shared state/forest helpers), so they live
 * here independently of setup.ts. The mutating "action" functions
 * (add/hide/score) stay in setup.ts for now because they drive the turn loop
 * (advanceActiveAction); they can move once that coupling is inverted.
 */

export function getArmadilloSeedPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "armadillo" || getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    return [];
  }

  if (player.reservePieces.length === 0) {
    return [];
  }

  return getForestPositionsWithResource(game, "seed");
}

export function getArmadilloHidePieceIds(game: GameState, playerId: string): string[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "armadillo" || getCurrentAction(game) !== "C") {
    return [];
  }

  return game.pieces
    .filter((piece) => piece.ownerId === playerId && piece.speciesId === "armadillo" && piece.location && !piece.state.hidden)
    .map((piece) => piece.pieceId);
}

export function getArmadilloShareScore(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "armadillo" || getCurrentAction(game) !== "D") {
    return 0;
  }

  const armadilloPositions = new Set(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "armadillo" && piece.location)
      .map((piece) => positionKey(piece.location!))
  );

  const opponentSpecies = new Set(
    game.players
      .filter((candidate) => candidate.playerId !== playerId && candidate.speciesId)
      .map((candidate) => candidate.speciesId!)
  );

  let sharingCount = 0;
  let notSharingCount = 0;
  for (const speciesId of opponentSpecies) {
    const sharesLocation = game.pieces.some(
      (piece) => piece.speciesId === speciesId && piece.location && armadilloPositions.has(positionKey(piece.location))
    );
    if (!sharesLocation) {
      notSharingCount += 1;
    } else {
      sharingCount += 1;
    }
  }

  if (sharingCount === 0) {
    return 0;
  }

  return Math.max(1, 3 - notSharingCount);
}

export function getArmadilloSharingDetails(game: GameState, playerId: string): {
  points: number;
  sharedSpecies: SpeciesId[];
  missingSpecies: SpeciesId[];
  sharedPositions: GridPosition[];
} {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return { points: 0, sharedSpecies: [], missingSpecies: [], sharedPositions: [] };
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "armadillo" || getCurrentAction(game) !== "D") {
    return { points: 0, sharedSpecies: [], missingSpecies: [], sharedPositions: [] };
  }

  const armadilloPositions = new Map(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "armadillo" && piece.location)
      .map((piece) => [positionKey(piece.location!), { x: piece.location!.x, y: piece.location!.y }])
  );
  const opponentSpecies = new Set(
    game.players
      .filter((candidate) => candidate.playerId !== playerId && candidate.speciesId)
      .map((candidate) => candidate.speciesId!)
  );
  const sharedSpecies: SpeciesId[] = [];
  const missingSpecies: SpeciesId[] = [];
  const sharedPositionKeys = new Set<string>();

  for (const speciesId of opponentSpecies) {
    const sharedPieces = game.pieces.filter(
      (piece) => piece.speciesId === speciesId && piece.location && armadilloPositions.has(positionKey(piece.location))
    );
    if (sharedPieces.length === 0) {
      missingSpecies.push(speciesId);
      continue;
    }

    sharedSpecies.push(speciesId);
    for (const piece of sharedPieces) {
      if (piece.location) {
        sharedPositionKeys.add(positionKey(piece.location));
      }
    }
  }

  const points = sharedSpecies.length === 0 ? 0 : Math.max(1, 3 - missingSpecies.length);
  return {
    points,
    sharedSpecies,
    missingSpecies,
    sharedPositions: [...sharedPositionKeys].map((key) => armadilloPositions.get(key)).filter((position): position is GridPosition => Boolean(position))
  };
}
