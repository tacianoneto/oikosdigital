import type { GameState, GridPosition, PieceState } from "@oikos/shared";
import { cloneGameState, findPlayer, getCurrentAction, positionKey, toGridPosition } from "../state";
import {
  createPieceLocation,
  findFirstForestSiteWithHabitat,
  getCardDefinitionOrNull,
  getForestCardAtPosition,
  getForestPositionsWithHabitat,
  getForestSitesAtPosition
} from "../forest";
import { getPotentialDestinations } from "../movement";
import { applyCaatingaTrigger } from "../scenarios";
import { advanceActiveAction } from "../turn";

export function getGaloFieldPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "galo_de_campina" || getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    return [];
  }

  if (player.reservePieces.length === 0) {
    return [];
  }

  return getForestPositionsWithHabitat(game, "field").filter((position) =>
    getForestSitesAtPosition(game, position).some((site) => site.site.habitat === "field" && !site.isAtCapacity)
  );
}

export function getGaloAdjacentTargetsForLocation(game: GameState, location: GridPosition): GridPosition[] {
  const forestPositions = new Set(game.forest.cards.map((card) => positionKey(card)));
  return getPotentialDestinations(location, "adjacent")
    .filter((position) => forestPositions.has(positionKey(position)))
    .filter((position) => getForestSitesAtPosition(game, position).some((site) => !site.isAtCapacity))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function getGaloInterruptOwnerAtPosition(
  game: GameState,
  location: GridPosition,
  movedPieceId?: string
): string | null {
  return (
    game.pieces
      .filter(
        (piece) =>
          piece.pieceId !== movedPieceId &&
          piece.speciesId === "galo_de_campina" &&
          piece.location?.x === location.x &&
          piece.location.y === location.y
      )
      .sort((a, b) => a.pieceId.localeCompare(b.pieceId))[0]?.ownerId ?? null
  );
}

export function canTriggerGaloInterruptAtPosition(
  game: GameState,
  collectorSpeciesId: PieceState["speciesId"] | null | undefined,
  location: GridPosition,
  movedPieceId?: string
): boolean {
  if (collectorSpeciesId === "galo_de_campina") {
    return false;
  }

  const targetCard = getForestCardAtPosition(game, location);
  const targetDefinition = targetCard ? getCardDefinitionOrNull(targetCard.definitionId) : null;
  if (targetDefinition?.habitat !== "field") {
    return false;
  }

  return Boolean(getGaloInterruptOwnerAtPosition(game, location, movedPieceId)) &&
    getGaloAdjacentTargetsForLocation(game, location).length > 0;
}

export function getGaloInterruptPieceIds(game: GameState, playerId: string): string[] {
  const pending = game.pendingGaloInterrupt;
  if (!pending || pending.ownerId !== playerId) {
    return [];
  }

  return getGaloPiecesAtPosition(game, playerId, pending.location).map((piece) => piece.pieceId);
}

export function getGaloInterruptMoveTargets(game: GameState, playerId: string, pieceId?: string | null): GridPosition[] {
  const pending = game.pendingGaloInterrupt;
  if (!pending || pending.ownerId !== playerId) {
    return [];
  }

  if (pieceId && !getGaloInterruptPieceIds(game, playerId).includes(pieceId)) {
    return [];
  }

  return getGaloAdjacentTargetsForLocation(game, pending.location);
}

export function getGaloFieldCardPositions(game: GameState, playerId: string): GridPosition[] {
  return getGaloPresencePositions(game, playerId, (definition) => definition?.habitat === "field");
}

export function getGaloOutOfFieldPositions(game: GameState, playerId: string): GridPosition[] {
  return getGaloPresencePositions(game, playerId, (definition) => definition?.habitat !== "field");
}

export function getGaloOutOfFieldPieceCount(game: GameState, playerId: string): number {
  return game.pieces.filter((piece) => {
    if (piece.ownerId !== playerId || piece.speciesId !== "galo_de_campina" || !piece.location) {
      return false;
    }

    const card = getForestCardAtPosition(game, piece.location);
    const definition = card ? getCardDefinitionOrNull(card.definitionId) : null;
    return definition?.habitat !== "field";
  }).length;
}

export function getGaloScorePoints(game: GameState, playerId: string): number {
  return Math.max(0, 3 - getGaloOutOfFieldPieceCount(game, playerId));
}

export function getGaloActionDScore(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "galo_de_campina" || getCurrentAction(game) !== "D") {
    return 0;
  }

  return getGaloScorePoints(game, playerId);
}

export function addGaloForCurrentAction(game: GameState, playerId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Pecas so podem ser adicionadas durante a fase ativa.");
  }

  if (game.pendingCoatiPairBonus) {
    throw new Error("Resolva o bonus da dupla de quatis antes de continuar a acao.");
  }

  if (game.pendingGaloInterrupt) {
    throw new Error("Resolva o movimento entre turnos do Galo-de-campina antes de continuar.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "galo_de_campina") {
    throw new Error("Adicao de peca implementada apenas para o Galo-de-campina nesta etapa.");
  }

  if (getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    throw new Error("O Galo-de-campina adiciona peca durante a acao A depois de expandir a floresta.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Nao ha galos-de-campina na reserva para adicionar.");
  }

  const validPositions = getGaloFieldPlacementPositions(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error("Escolha uma carta de campo com espaco livre para adicionar o Galo-de-campina.");
  }

  const targetCard = game.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  if (!targetCard) {
    throw new Error("Carta alvo nao encontrada na floresta.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  const fieldSite = findFirstForestSiteWithHabitat(game, location, "field");
  nextPiece.location = createPieceLocation(game, location, fieldSite?.siteId);
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  applyCaatingaTrigger(next, playerId, location, "add");
  next.log = [
    ...next.log,
    {
      id: `add_galo_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} adicionou 1 galo-de-campina em local de campo.`,
      createdAt: Date.now(),
      payload: {
        kind: "add_piece",
        actorPlayerId: playerId,
        cardInstanceId: targetCard.instanceId,
        cardDefinitionId: targetCard.definitionId,
        habitat: getCardDefinitionOrNull(targetCard.definitionId)?.habitat ?? undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        actionId: "A"
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function resolveGaloInterruptMove(
  game: GameState,
  playerId: string,
  destination: GridPosition,
  pieceId?: string | null
): GameState {
  if (game.status !== "active") {
    throw new Error("Movimento entre turnos so pode acontecer durante a fase ativa.");
  }

  const pending = game.pendingGaloInterrupt;
  if (!pending || pending.ownerId !== playerId) {
    throw new Error("Nao ha movimento entre turnos do Galo-de-campina para este jogador.");
  }

  const validTargets = getGaloInterruptMoveTargets(game, playerId, pieceId);
  const isValidTarget = validTargets.some((position) => position.x === destination.x && position.y === destination.y);
  if (!isValidTarget) {
    throw new Error("Escolha um local adjacente valido para mover o Galo-de-campina.");
  }

  const movablePieceIds = getGaloInterruptPieceIds(game, playerId);
  const selectedPieceId = pieceId && movablePieceIds.includes(pieceId) ? pieceId : movablePieceIds[0];
  if (!selectedPieceId) {
    throw new Error("Nenhum galo-de-campina encontrado no local da interrupcao.");
  }

  const freeSite = getForestSitesAtPosition(game, destination).find((site) => !site.isAtCapacity);
  if (!freeSite) {
    throw new Error("Local adjacente sem espaco livre.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === selectedPieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, destination, freeSite.site.siteId);
  next.pendingGaloInterrupt = null;
  const targetCard = next.forest.cards.find((card) => card.x === destination.x && card.y === destination.y);
  next.log = [
    ...next.log,
    {
      id: `galo_interrupt_move_${selectedPieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} moveu 1 galo-de-campina entre turnos, sem coletar recurso.`,
      createdAt: Date.now(),
      payload: {
        kind: "move_piece",
        actorPlayerId: playerId,
        cardInstanceId: targetCard?.instanceId,
        cardDefinitionId: targetCard?.definitionId,
        habitat: targetCard ? getCardDefinitionOrNull(targetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: destination.x, y: destination.y },
        pieceIds: [selectedPieceId]
      }
    }
  ];

  resumeAfterGaloInterrupt(next, pending.interruptedPlayerId);
  return next;
}

export function scoreGaloFieldPresence(game: GameState, playerId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Pontuacao so pode acontecer durante a fase ativa.");
  }

  if (game.pendingGaloInterrupt) {
    throw new Error("Resolva o movimento entre turnos do Galo-de-campina antes de continuar.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "galo_de_campina") {
    throw new Error("Pontuacao de campo implementada apenas para o Galo-de-campina.");
  }

  if (getCurrentAction(game) !== "D") {
    throw new Error("O Galo-de-campina pontua campos durante a acao D.");
  }

  const offFieldCount = getGaloOutOfFieldPieceCount(game, playerId);
  const points = getGaloScorePoints(game, playerId);
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.score += points;
  next.log = [
    ...next.log,
    {
      id: `galo_score_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} marcou ${points} ponto(s): 3 menos ${offFieldCount} galo(s) fora de campo.`,
      createdAt: Date.now(),
      payload: { kind: "score", actorPlayerId: playerId, points, actionId: "D" }
    }
  ];

  advanceActiveAction(next);
  return next;
}

function getGaloPresencePositions(
  game: GameState,
  playerId: string,
  matches: (definition: ReturnType<typeof getCardDefinitionOrNull>) => boolean
): GridPosition[] {
  const positions = new Map<string, GridPosition>();

  for (const piece of game.pieces) {
    if (piece.ownerId !== playerId || piece.speciesId !== "galo_de_campina" || !piece.location) {
      continue;
    }

    const card = getForestCardAtPosition(game, piece.location);
    const definition = card ? getCardDefinitionOrNull(card.definitionId) : null;
    if (matches(definition)) {
      positions.set(positionKey(piece.location), toGridPosition(piece.location));
    }
  }

  return [...positions.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

function getGaloPiecesAtPosition(game: GameState, playerId: string, location: GridPosition): PieceState[] {
  return game.pieces
    .filter(
      (piece) =>
        piece.ownerId === playerId &&
        piece.speciesId === "galo_de_campina" &&
        piece.location?.x === location.x &&
        piece.location.y === location.y
    )
    .sort((a, b) => a.pieceId.localeCompare(b.pieceId));
}

function resumeAfterGaloInterrupt(game: GameState, interruptedPlayerId: string): void {
  if (game.pendingJaguarRemoval && !resolveJaguarRemovalChoiceAfterGalo(game)) {
    return;
  }

  if (game.pendingCoatiPairBonus) {
    return;
  }

  const pendingWolfMoves = game.pendingWolfMoves;
  if (pendingWolfMoves?.playerId === interruptedPlayerId && pendingWolfMoves.pieceIds.length > 0) {
    return;
  }

  advanceActiveAction(game);
}

function resolveJaguarRemovalChoiceAfterGalo(game: GameState): boolean {
  const pending = game.pendingJaguarRemoval;
  if (!pending) {
    return true;
  }

  const removablePieces = game.pieces
    .filter(
      (piece) =>
        piece.ownerId !== pending.playerId &&
        !piece.state.hidden &&
        piece.location?.x === pending.location.x &&
        piece.location.y === pending.location.y
    )
    .sort((a, b) => a.pieceId.localeCompare(b.pieceId));

  if (removablePieces.length > 0) {
    return false;
  }

  game.pendingJaguarRemoval = null;
  return true;
}
