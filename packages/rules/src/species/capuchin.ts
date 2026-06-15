import type { GameState, GridPosition } from "@oikos/shared";
import { cloneGameState, findPlayer, getCurrentAction, positionKey, toGridPosition } from "../state";
import {
  createPieceLocation,
  getCardDefinitionOrNull,
  getForestCardAtPosition,
  getPlayedForestCardForCurrentAction
} from "../forest";
import { applyCaatingaTrigger } from "../scenarios";
import { advanceActiveAction } from "../turn";

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

export function addCapuchinForCurrentAction(game: GameState, playerId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Pecas so podem ser adicionadas durante a fase ativa.");
  }

  if (game.pendingCoatiPairBonus) {
    throw new Error("Resolva o bonus da dupla de quatis antes de continuar a acao.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "capuchin") {
    throw new Error("Adicao de peca implementada apenas para o Macaco-prego nesta etapa.");
  }

  const action = getCurrentAction(game);
  if (action !== "A" && action !== "C") {
    throw new Error("O Macaco-prego adiciona peca durante as acoes A e C.");
  }

  if (action === "A" && !game.activePlayedForestCardId) {
    throw new Error("O Macaco-prego adiciona peca na carta jogada depois de expandir a floresta.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Nao ha macacos na reserva para adicionar.");
  }

  const validPositions = getCapuchinPlacementPositions(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error(action === "A" ? "Adicione o Macaco-prego na carta jogada." : "Escolha um local com outro Macaco-prego.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location);
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  applyCaatingaTrigger(next, playerId, location, "add");
  const capuchinTargetCard = next.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  next.log = [
    ...next.log,
    {
      id: `add_capuchin_${pieceId}_${next.log.length + 1}`,
      message:
        action === "A"
          ? `${nextPlayer.name} adicionou 1 macaco-prego na carta jogada.`
          : `${nextPlayer.name} adicionou 1 macaco-prego em local com outro macaco.`,
      createdAt: Date.now(),
      payload: {
        kind: "add_piece",
        actorPlayerId: playerId,
        cardInstanceId: capuchinTargetCard?.instanceId,
        cardDefinitionId: capuchinTargetCard?.definitionId,
        habitat: capuchinTargetCard ? getCardDefinitionOrNull(capuchinTargetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        actionId: action
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function scoreCapuchinHabitatPresence(game: GameState, playerId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Pontuacao so pode acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "capuchin") {
    throw new Error("Pontuacao por habitat implementada apenas para o Macaco-prego nesta etapa.");
  }

  if (getCurrentAction(game) !== "D") {
    throw new Error("O Macaco-prego pontua habitats durante a acao D.");
  }

  const points = getCapuchinHabitatScore(game, playerId);
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.score += points;
  next.log = [
    ...next.log,
    {
      id: `capuchin_score_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} marcou ${points} ponto(s) por presenca em habitats diferentes.`,
      createdAt: Date.now(),
      payload: {
        kind: "score",
        actorPlayerId: playerId,
        points,
        actionId: "D"
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}
