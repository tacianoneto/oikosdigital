import type { GameState, GridPosition } from "@oikos/shared";
import { cloneGameState, findPlayer, getCurrentAction, positionKey } from "../state";
import {
  createPieceLocation,
  findFirstForestSiteWithResource,
  getCardDefinitionOrNull,
  getForestPositionsWithResource
} from "../forest";
import { applyCaatingaTrigger } from "../scenarios";
import { advanceActiveAction } from "../turn";

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

export function addMacawForCurrentAction(game: GameState, playerId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Pecas so podem ser adicionadas durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "macaw") {
    throw new Error("Adicao de peca implementada apenas para a Arara-azul nesta etapa.");
  }

  const action = getCurrentAction(game);
  if (action !== "A" && action !== "C") {
    throw new Error("A Arara-azul adiciona peca durante as acoes A e C.");
  }

  const validPositions = action === "A" ? getMacawEggPlacementPositions(game, playerId) : getMacawActionCTargets(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error(action === "A" ? "Escolha uma carta com local de ovo." : "Escolha uma carta ao redor da arara movida.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Nao ha araras na reserva para adicionar.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location, action === "A" ? findFirstForestSiteWithResource(game, location, "egg")?.siteId : undefined);
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  applyCaatingaTrigger(next, playerId, location, "add");
  const macawTargetCard = next.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  next.log = [
    ...next.log,
    {
      id: `add_macaw_${pieceId}_${next.log.length + 1}`,
      message: action === "A" ? `${nextPlayer.name} adicionou 1 arara em local de ovo.` : `${nextPlayer.name} adicionou 1 arara ao redor da arara movida.`,
      createdAt: Date.now(),
      payload: {
        kind: "add_piece",
        actorPlayerId: playerId,
        cardInstanceId: macawTargetCard?.instanceId,
        cardDefinitionId: macawTargetCard?.definitionId,
        habitat: macawTargetCard ? getCardDefinitionOrNull(macawTargetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        actionId: action
      }
    }
  ];

  if (action === "C") {
    next.pendingMacawMovedPiece = null;
  }
  advanceActiveAction(next);
  return next;
}

export function relocateMacawForCurrentAction(game: GameState, playerId: string, pieceId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Movimentos so podem acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "macaw" || getCurrentAction(game) !== "C") {
    throw new Error("A Arara-azul realoca outra arara durante a acao C.");
  }

  if (!getMacawRelocatablePieceIds(game, playerId).includes(pieceId)) {
    throw new Error("Selecione uma arara diferente da arara movida na acao B.");
  }

  const validPositions = getMacawActionCTargets(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error("Escolha uma carta ao redor da arara movida.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location);
  next.pendingMacawMovedPiece = null;
  const relocateTargetCard = next.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  next.log = [
    ...next.log,
    {
      id: `relocate_macaw_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} realocou 1 arara ao redor da arara movida.`,
      createdAt: Date.now(),
      payload: {
        kind: "move_piece",
        actorPlayerId: playerId,
        cardInstanceId: relocateTargetCard?.instanceId,
        cardDefinitionId: relocateTargetCard?.definitionId,
        habitat: relocateTargetCard ? getCardDefinitionOrNull(relocateTargetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        actionId: "C"
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function scoreMacawLines(game: GameState, playerId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Pontuacao so pode acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "macaw" || getCurrentAction(game) !== "D") {
    throw new Error("A Arara-azul pontua linhas durante a acao D.");
  }

  const points = getMacawLineScore(game, playerId);
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.score += points;
  next.log = [
    ...next.log,
    {
      id: `macaw_score_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} marcou ${points} ponto(s) por linhas retas de 3 araras.`,
      createdAt: Date.now(),
      payload: { kind: "score", actorPlayerId: playerId, points, actionId: "D" }
    }
  ];

  advanceActiveAction(next);
  return next;
}
