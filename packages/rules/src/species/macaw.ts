import type { GameState, GridPosition } from "@oikos/shared";
import { getCurrentAction, positionKey } from "../state";
import { getForestPositionsWithResource } from "../forest";

/**
 * Side-effect-free queries for the Macaw (arara): where it lays eggs, the action
 * C relocation targets/relocatable pieces, and its action D scoring of straight
 * 3-in-a-row lines.
 *
 * These only read game state (via the shared state/forest helpers), so they live
 * here independently of setup.ts. The mutating action functions
 * (addMacawForCurrentAction, relocateMacawForCurrentAction, scoreMacawLines) stay
 * in setup.ts for now because they drive the turn loop.
 */

const surroundingDirections = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 }
];

function getSurroundingDestinations(game: GameState, origin: GridPosition): GridPosition[] {
  const forestPositions = new Set(game.forest.cards.map((card) => positionKey(card)));

  return surroundingDirections
    .map((direction) => ({ x: origin.x + direction.x, y: origin.y + direction.y }))
    .filter((position) => forestPositions.has(positionKey(position)))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function getMacawEggPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "macaw" || getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    return [];
  }

  if (player.reservePieces.length === 0) {
    return [];
  }

  return getForestPositionsWithResource(game, "egg");
}

export function getMacawActionCTargets(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const pending = game.pendingMacawMovedPiece;
  if (player?.speciesId !== "macaw" || getCurrentAction(game) !== "C" || pending?.playerId !== playerId) {
    return [];
  }

  return getSurroundingDestinations(game, pending.location);
}

export function getMacawRelocatablePieceIds(game: GameState, playerId: string): string[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const pending = game.pendingMacawMovedPiece;
  if (player?.speciesId !== "macaw" || getCurrentAction(game) !== "C" || pending?.playerId !== playerId) {
    return [];
  }

  return game.pieces
    .filter((piece) => piece.ownerId === playerId && piece.speciesId === "macaw" && piece.location && piece.pieceId !== pending.pieceId)
    .map((piece) => piece.pieceId);
}

export function getMacawLineScore(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "macaw" || getCurrentAction(game) !== "D") {
    return 0;
  }

  const positionSet = new Set(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "macaw" && piece.location)
      .map((piece) => positionKey(piece.location!))
  );
  const directions = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 }
  ];
  const lineKeys = new Set<string>();

  for (const key of positionSet) {
    const [x, y] = key.split(":").map(Number);
    for (const direction of directions) {
      const before = `${x - direction.x}:${y - direction.y}`;
      const second = `${x + direction.x}:${y + direction.y}`;
      const third = `${x + direction.x * 2}:${y + direction.y * 2}`;
      if (positionSet.has(before) || !positionSet.has(second) || !positionSet.has(third)) {
        continue;
      }

      lineKeys.add(`${x}:${y}|${direction.x}:${direction.y}`);
    }
  }

  return lineKeys.size;
}

export interface MacawScoringLine {
  origin: GridPosition;
  direction: GridPosition;
  positions: [GridPosition, GridPosition, GridPosition];
}

export function getMacawScoringLines(game: GameState, playerId: string): MacawScoringLine[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "macaw" || getCurrentAction(game) !== "D") {
    return [];
  }

  const positionSet = new Set(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "macaw" && piece.location)
      .map((piece) => positionKey(piece.location!))
  );
  const directions: GridPosition[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 }
  ];
  const lines: MacawScoringLine[] = [];

  for (const key of positionSet) {
    const [x, y] = key.split(":").map(Number);
    for (const direction of directions) {
      const before = `${x - direction.x}:${y - direction.y}`;
      const second = `${x + direction.x}:${y + direction.y}`;
      const third = `${x + direction.x * 2}:${y + direction.y * 2}`;
      if (positionSet.has(before) || !positionSet.has(second) || !positionSet.has(third)) {
        continue;
      }

      lines.push({
        origin: { x, y },
        direction,
        positions: [
          { x, y },
          { x: x + direction.x, y: y + direction.y },
          { x: x + direction.x * 2, y: y + direction.y * 2 }
        ]
      });
    }
  }

  return lines;
}
