import type { GameState, GridPosition, SpeciesId } from "@oikos/shared";
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

export function addArmadilloForCurrentAction(game: GameState, playerId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Pecas so podem ser adicionadas durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "armadillo") {
    throw new Error("Adicao de peca implementada apenas para o Tatu-bola nesta etapa.");
  }

  if (getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    throw new Error("O Tatu-bola adiciona peca durante a acao A depois de expandir a floresta.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Nao ha tatus na reserva para adicionar.");
  }

  const validPositions = getArmadilloSeedPlacementPositions(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error("Escolha uma carta com local de semente para adicionar o tatu.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location, findFirstForestSiteWithResource(game, location, "seed")?.siteId);
  nextPiece.state.hidden = false;
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  applyCaatingaTrigger(next, playerId, location, "add");
  const armadilloTargetCard = next.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  next.log = [
    ...next.log,
    {
      id: `add_armadillo_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} adicionou 1 tatu em local de semente.`,
      createdAt: Date.now(),
      payload: {
        kind: "add_piece",
        actorPlayerId: playerId,
        cardInstanceId: armadilloTargetCard?.instanceId,
        cardDefinitionId: armadilloTargetCard?.definitionId,
        habitat: armadilloTargetCard ? getCardDefinitionOrNull(armadilloTargetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        actionId: "A"
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function hideArmadilloForCurrentAction(game: GameState, playerId: string, pieceId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Acoes so podem acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "armadillo" || getCurrentAction(game) !== "C") {
    throw new Error("O Tatu-bola esconde uma peca propria durante a acao C.");
  }

  if (!getArmadilloHidePieceIds(game, playerId).includes(pieceId)) {
    throw new Error("Selecione um Tatu-bola proprio visivel na floresta.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.state.hidden = true;
  const hideLocation = nextPiece.location ? { x: nextPiece.location.x, y: nextPiece.location.y } : undefined;
  const hideCard = hideLocation ? next.forest.cards.find((card) => card.x === hideLocation.x && card.y === hideLocation.y) : undefined;
  next.log = [
    ...next.log,
    {
      id: `hide_armadillo_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} escondeu 1 Tatu-bola.`,
      createdAt: Date.now(),
      payload: {
        kind: "hide_piece",
        actorPlayerId: playerId,
        cardInstanceId: hideCard?.instanceId,
        cardDefinitionId: hideCard?.definitionId,
        habitat: hideCard ? getCardDefinitionOrNull(hideCard.definitionId)?.habitat ?? undefined : undefined,
        location: hideLocation,
        pieceIds: [pieceId],
        actionId: "C"
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function scoreArmadilloSharing(game: GameState, playerId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Pontuacao so pode acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "armadillo" || getCurrentAction(game) !== "D") {
    throw new Error("O Tatu-bola pontua compartilhamento durante a acao D.");
  }

  const points = getArmadilloShareScore(game, playerId);
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.score += points;
  next.log = [
    ...next.log,
    {
      id: `armadillo_score_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} marcou ${points} ponto(s) por compartilhamento de locais.`,
      createdAt: Date.now(),
      payload: { kind: "score", actorPlayerId: playerId, points, actionId: "D" }
    }
  ];

  advanceActiveAction(next);
  return next;
}
