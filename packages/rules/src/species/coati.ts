import type { GameState, GridPosition, PieceState } from "@oikos/shared";
import { cloneGameState, findPlayer, getCurrentAction, positionKey, pushUniqueWarning, toGridPosition } from "../state";
import {
  createPieceLocation,
  findFirstForestSiteWithResource,
  getCardDefinitionOrNull,
  getForestPositionsWithResource
} from "../forest";
import { getPotentialDestinations } from "../movement";
import { applyCaatingaTrigger } from "../scenarios";
import { advanceActiveAction } from "../turn";

/**
 * Side-effect-free queries for the Coati: where it may add a piece on fruit
 * sites, which adjacent positions complete a pending pair bonus, and how many
 * pieces it must remove during action C.
 *
 * These only read game state (via the shared state/forest/movement helpers), so
 * they live here independently of setup.ts. The mutating action functions
 * (addCoatiForCurrentAction, resolveCoatiPairBonus) stay in setup.ts for now
 * because they drive the turn loop.
 */

export function getCoatiFruitPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  if (game.pendingCoatiPairBonus) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "coati" || getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    return [];
  }

  if (player.reservePieces.length === 0) {
    return [];
  }

  return getForestPositionsWithResource(game, "fruit");
}

export function getCoatiPairBonusTargets(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const pending = game.pendingCoatiPairBonus;
  if (!pending || pending.playerId !== playerId) {
    return [];
  }

  const forestPositions = new Set(game.forest.cards.map((card) => positionKey(card)));

  return getPotentialDestinations(pending.origin, "adjacent")
    .filter((position) => forestPositions.has(positionKey(position)))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function getRequiredCoatiRemovalCount(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "coati" || getCurrentAction(game) !== "C") {
    return 0;
  }

  return player.reservePieces.length < 2 ? 2 : 0;
}

function getCoatiPiecesByLocation(game: GameState, playerId: string): Map<string, PieceState[]> {
  const piecesByLocation = new Map<string, PieceState[]>();

  for (const piece of game.pieces) {
    if (piece.ownerId !== playerId || piece.speciesId !== "coati" || !piece.location) {
      continue;
    }

    const key = positionKey(piece.location);
    piecesByLocation.set(key, [...(piecesByLocation.get(key) ?? []), piece]);
  }

  return piecesByLocation;
}

function getCurrentCoatiPairKeys(game: GameState, playerId: string): Set<string> {
  const pairKeys = new Set<string>();
  const piecesByLocation = getCoatiPiecesByLocation(game, playerId);

  for (const [locationKey, pieces] of piecesByLocation.entries()) {
    const sortedPieces = [...pieces].sort((a, b) => a.pieceId.localeCompare(b.pieceId));

    for (let firstIndex = 0; firstIndex < sortedPieces.length - 1; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < sortedPieces.length; secondIndex += 1) {
        pairKeys.add(`${playerId}:${locationKey}:${sortedPieces[firstIndex].pieceId}+${sortedPieces[secondIndex].pieceId}`);
      }
    }
  }

  return pairKeys;
}

export function pruneResolvedCoatiPairBonuses(game: GameState, playerId: string): void {
  const currentPairKeys = getCurrentCoatiPairKeys(game, playerId);
  game.resolvedCoatiPairBonuses = game.resolvedCoatiPairBonuses.filter((pairKey) => {
    if (!pairKey.startsWith(`${playerId}:`)) {
      return true;
    }

    return currentPairKeys.has(pairKey);
  });
}

function findCoatiPairBonusFormedAtLocation(
  game: GameState,
  playerId: string,
  enteredLocation: GridPosition
): GameState["pendingCoatiPairBonus"] {
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "coati" || player.reservePieces.length === 0) {
    return null;
  }

  const piecesByLocation = getCoatiPiecesByLocation(game, playerId);
  const locationKey = positionKey(enteredLocation);
  const pieces = piecesByLocation.get(locationKey) ?? [];
  if (pieces.length !== 2) {
    return null;
  }

  const sortedPieces = [...pieces].sort((a, b) => a.pieceId.localeCompare(b.pieceId));
  const pairKey = `${playerId}:${locationKey}:${sortedPieces[0].pieceId}+${sortedPieces[1].pieceId}`;
  if (game.resolvedCoatiPairBonuses.includes(pairKey)) {
    return null;
  }

  return {
    playerId,
    pairKey,
    origin: toGridPosition(enteredLocation)
  };
}

export function queuePendingCoatiPairBonus(game: GameState, playerId: string, enteredLocation: GridPosition): boolean {
  pruneResolvedCoatiPairBonuses(game, playerId);
  const pending = findCoatiPairBonusFormedAtLocation(game, playerId, enteredLocation);
  game.pendingCoatiPairBonus = pending;

  if (pending) {
    const player = findPlayer(game, playerId);
    game.log = [
      ...game.log,
      {
        id: `coati_pair_pending_${pending.pairKey}_${game.log.length + 1}`,
        message: `${player.name} formou uma dupla de quatis. Escolha um local adjacente para o bonus.`,
        createdAt: Date.now()
      }
    ];
  }

  return Boolean(pending);
}

export function addCoatiForCurrentAction(game: GameState, playerId: string, location: GridPosition): GameState {
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
  if (player.speciesId !== "coati") {
    throw new Error("Adicao de peca implementada apenas para o Quati nesta etapa.");
  }

  if (getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    throw new Error("O Quati adiciona peca durante a acao A depois de expandir a floresta.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Nao ha quatis na reserva para adicionar.");
  }

  const validPositions = getCoatiFruitPlacementPositions(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error("Escolha uma carta com local de fruta para adicionar o quati.");
  }

  const targetCard = game.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  if (!targetCard) {
    throw new Error("Carta alvo nao encontrada na floresta.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  pruneResolvedCoatiPairBonuses(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location, findFirstForestSiteWithResource(game, location, "fruit")?.siteId);
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  applyCaatingaTrigger(next, playerId, location, "add");
  next.log = [
    ...next.log,
    {
      id: `add_coati_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} adicionou 1 quati em local de fruta.`,
      createdAt: Date.now(),
      payload: {
        kind: "add_piece",
        actorPlayerId: playerId,
        cardInstanceId: targetCard.instanceId,
        cardDefinitionId: targetCard.definitionId,
        habitat: getCardDefinitionOrNull(targetCard.definitionId)?.habitat ?? undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId]
      }
    }
  ];

  pushUniqueWarning(next, "Locais de fruta estao transcritos no nivel da carta; subposicoes internas entram em etapa posterior.");
  if (!queuePendingCoatiPairBonus(next, playerId, location)) {
    advanceActiveAction(next);
  }

  return next;
}

export function resolveCoatiPairBonus(game: GameState, playerId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Bonus de dupla so pode ser resolvido durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const pending = game.pendingCoatiPairBonus;
  if (!pending || pending.playerId !== playerId) {
    throw new Error("Nao ha bonus de dupla de quatis pendente.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "coati") {
    throw new Error("Bonus de dupla implementado apenas para o Quati nesta etapa.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Nao ha quatis na reserva para receber o bonus de dupla.");
  }

  const validTargets = getCoatiPairBonusTargets(game, playerId);
  const isValidTarget = validTargets.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidTarget) {
    throw new Error("Escolha um local adjacente ao par de quatis.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  pruneResolvedCoatiPairBonuses(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location);
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  applyCaatingaTrigger(next, playerId, location, "add");
  nextPlayer.score += 1;
  next.resolvedCoatiPairBonuses = [...new Set([...next.resolvedCoatiPairBonuses, pending.pairKey])];
  next.pendingCoatiPairBonus = null;
  const bonusTargetCard = next.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  next.log = [
    ...next.log,
    {
      id: `coati_pair_bonus_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} formou uma dupla de quatis, adicionou 1 quati adjacente e marcou 1 ponto.`,
      createdAt: Date.now(),
      payload: {
        kind: "pair_bonus",
        actorPlayerId: playerId,
        cardInstanceId: bonusTargetCard?.instanceId,
        cardDefinitionId: bonusTargetCard?.definitionId,
        habitat: bonusTargetCard ? getCardDefinitionOrNull(bonusTargetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        points: 1
      }
    }
  ];

  if (!queuePendingCoatiPairBonus(next, playerId, location)) {
    advanceActiveAction(next);
  }

  return next;
}
