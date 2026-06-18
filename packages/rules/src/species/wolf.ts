import { speciesDefinitions } from "@oikos/content";
import type { GameState, GridPosition, Resource } from "@oikos/shared";
import { cloneGameState, findPlayer, getCurrentAction, positionKey } from "../state";
import {
  createPieceLocation,
  findFirstForestSiteWithResource,
  getCardDefinitionOrNull,
  getForestCardAtPosition,
  getForestPositionsWithResource
} from "../forest";
import { applyCaatingaTrigger } from "../scenarios";
import { advanceActiveAction } from "../turn";
import { pruneResolvedCoatiPairBonuses } from "./coati";

/**
 * Side-effect-free queries for the Maned Wolf (lobo-guará): which opponent base
 * pieces it may remove (action B), which resources it may spend for points and
 * how many (action C), and where it may add a piece on meat sites (action D).
 *
 * Query helpers stay side-effect free. The action appliers in this module own
 * the Lobo-specific mutations and are still re-exported by setup.ts for
 * compatibility with older consumers.
 */

export function getWolfRemovableBasePieceIds(game: GameState, playerId: string): string[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "maned_wolf" || getCurrentAction(game) !== "B") {
    return [];
  }

  const wolfPositions = new Set(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "maned_wolf" && piece.location)
      .map((piece) => positionKey(piece.location!))
  );

  return game.pieces
    .filter((piece) => {
      if (piece.ownerId === playerId || piece.state.hidden || !piece.location || !wolfPositions.has(positionKey(piece.location))) {
        return false;
      }

      return speciesDefinitions[piece.speciesId].category === "base";
    })
    .sort((a, b) => a.pieceId.localeCompare(b.pieceId))
    .map((piece) => piece.pieceId);
}

export function getWolfSpendableResourceTypes(game: GameState, playerId: string): Resource[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "maned_wolf" || getCurrentAction(game) !== "C") {
    return [];
  }

  const maxCount = getAvailableWolfPointSpendCount(game, playerId);
  if (maxCount === 0) {
    return [];
  }

  return (["meat", "egg", "fruit", "seed"] as Resource[]).filter((resource) => player.resources[resource] > 0);
}

export function getAvailableWolfPointSpendCount(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "maned_wolf" || getCurrentAction(game) !== "C") {
    return 0;
  }

  const wolvesInForest = game.pieces.filter((piece) => piece.ownerId === playerId && piece.speciesId === "maned_wolf" && piece.location).length;
  const resourceTypesInStock = (["meat", "egg", "fruit", "seed"] as Resource[]).filter((resource) => player.resources[resource] > 0).length;

  return Math.min(wolvesInForest, resourceTypesInStock);
}

export function getWolfMeatPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "maned_wolf" || getCurrentAction(game) !== "D" || player.reservePieces.length === 0) {
    return [];
  }

  return getForestPositionsWithResource(game, "meat");
}

export function removeBasePieceForWolfAction(game: GameState, playerId: string, targetPieceId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Remocoes so podem acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "maned_wolf") {
    throw new Error("Remocao de base implementada apenas para o Lobo-guara nesta etapa.");
  }

  if (getCurrentAction(game) !== "B") {
    throw new Error("O Lobo-guara so remove especie de base durante a acao B.");
  }

  if (!getWolfRemovableBasePieceIds(game, playerId).includes(targetPieceId)) {
    throw new Error("Escolha uma peca de especie de base em local com lobo.");
  }

  const targetPiece = game.pieces.find((piece) => piece.pieceId === targetPieceId);
  if (!targetPiece?.location) {
    throw new Error("Peca alvo nao encontrada.");
  }

  const card = getForestCardAtPosition(game, targetPiece.location);
  const cardDefinition = card ? getCardDefinitionOrNull(card.definitionId) : null;
  const resource = cardDefinition?.resource ?? null;
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextTargetPiece = next.pieces.find((piece) => piece.pieceId === targetPieceId);
  if (!nextTargetPiece?.location) {
    throw new Error("Peca alvo nao encontrada.");
  }

  const removedPlayer = findPlayer(next, nextTargetPiece.ownerId);
  nextTargetPiece.location = null;
  removedPlayer.piecesInForest = removedPlayer.piecesInForest.filter((pieceId) => pieceId !== targetPieceId);
  removedPlayer.reservePieces = [...removedPlayer.reservePieces, targetPieceId];

  if (resource) {
    nextPlayer.resources[resource] += 1;
    removedPlayer.resources[resource] += 1;
  }

  if (targetPiece.location) applyCaatingaTrigger(next, playerId, targetPiece.location, "remove");

  if (nextTargetPiece.speciesId === "coati") {
    pruneResolvedCoatiPairBonuses(next, nextTargetPiece.ownerId);
  }

  next.log = [
    ...next.log,
    {
      id: `wolf_remove_base_${targetPieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} removeu 1 peca de base com o Lobo-guara e coletou recurso junto com o dono removido.`,
      createdAt: Date.now(),
      payload: {
        kind: "remove_piece",
        actorPlayerId: playerId,
        cardInstanceId: card?.instanceId,
        cardDefinitionId: card?.definitionId,
        habitat: cardDefinition?.habitat ?? undefined,
        location: targetPiece.location ? { x: targetPiece.location.x, y: targetPiece.location.y } : undefined,
        pieceIds: [targetPieceId],
        actionId: "B",
        resources: resource ? [resource] : undefined
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function spendWolfResourcesForPoints(game: GameState, playerId: string, resources: Resource[]): GameState {
  if (game.status !== "active") {
    throw new Error("Acoes so podem acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "maned_wolf") {
    throw new Error("Pontuacao por recursos implementada apenas para o Lobo-guara nesta etapa.");
  }

  if (getCurrentAction(game) !== "C") {
    throw new Error("O Lobo-guara so gasta recursos para pontuar durante a acao C.");
  }

  const uniqueResources = [...new Set(resources)];
  if (uniqueResources.length !== resources.length) {
    throw new Error("O Lobo-guara deve gastar recursos de tipos diferentes.");
  }

  const maxCount = getAvailableWolfPointSpendCount(game, playerId);
  if (resources.length < 1 || resources.length > maxCount) {
    throw new Error(`O Lobo-guara pode gastar de 1 a ${maxCount} recurso(s) diferente(s) nesta acao.`);
  }

  for (const resource of resources) {
    if (player.resources[resource] < 1) {
      throw new Error("O Lobo-guara nao tem recurso suficiente deste tipo.");
    }
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  for (const resource of resources) {
    nextPlayer.resources[resource] -= 1;
  }
  nextPlayer.score += resources.length;
  next.log = [
    ...next.log,
    {
      id: `wolf_spend_resources_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} gastou ${resources.length} recurso(s) diferente(s) e marcou ${resources.length} ponto(s).`,
      createdAt: Date.now(),
      payload: {
        kind: "spend",
        actorPlayerId: playerId,
        points: resources.length,
        actionId: "C",
        resources: [...resources],
        count: resources.length
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function addWolfForCurrentAction(game: GameState, playerId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Pecas so podem ser adicionadas durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "maned_wolf") {
    throw new Error("Adicao de peca implementada apenas para o Lobo-guara nesta etapa.");
  }

  if (getCurrentAction(game) !== "D") {
    throw new Error("O Lobo-guara so adiciona peca durante a acao D.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Nao ha lobos na reserva para adicionar.");
  }

  const validPositions = getWolfMeatPlacementPositions(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error("Escolha uma carta com local de carne para adicionar o Lobo-guara.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location, findFirstForestSiteWithResource(game, location, "meat")?.siteId);
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  applyCaatingaTrigger(next, playerId, location, "add");
  const wolfTargetCard = next.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  next.log = [
    ...next.log,
    {
      id: `add_wolf_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} adicionou 1 Lobo-guara em local de carne.`,
      createdAt: Date.now(),
      payload: {
        kind: "add_piece",
        actorPlayerId: playerId,
        cardInstanceId: wolfTargetCard?.instanceId,
        cardDefinitionId: wolfTargetCard?.definitionId,
        habitat: wolfTargetCard ? getCardDefinitionOrNull(wolfTargetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        actionId: "D"
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}
