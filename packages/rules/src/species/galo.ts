import type { GameState, GridPosition } from "@oikos/shared";
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

/**
 * Side-effect-free queries for the Galo-de-campina: where it may add pieces on
 * field cards, which adjacent positions accept a follow-up add, and its action D
 * presence scoring over field/seed cards.
 *
 * These only read game state (via the shared state/forest/movement helpers), so
 * they live here independently of setup.ts. The mutating action functions
 * (addGalo*, scoreGaloSeedCards) stay in setup.ts for now because they drive the
 * turn loop.
 */

const GALO_PRESENCE_THRESHOLD = 3;

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

  return getForestPositionsWithHabitat(game, "field");
}

export function getGaloAdjacentTargetsForLocation(game: GameState, location: GridPosition): GridPosition[] {
  const forestPositions = new Set(game.forest.cards.map((card) => positionKey(card)));
  return getPotentialDestinations(location, "adjacent")
    .filter((position) => forestPositions.has(positionKey(position)))
    .filter((position) => getForestSitesAtPosition(game, position).some((site) => !site.isAtCapacity))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function getGaloAdjacentAddPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const pending = game.pendingGaloAdjacentAdd;
  if (!pending || pending.playerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "galo_de_campina" || player.reservePieces.length === 0) {
    return [];
  }

  return getGaloAdjacentTargetsForLocation(game, pending.location);
}

export function getGaloSeedCardScore(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "galo_de_campina" || getCurrentAction(game) !== "D") {
    return 0;
  }

  return getGaloScorePoints(game, playerId);
}

// Action D score: +1 if the galo is present in at least 3 campinas (field cards)
// and +1 if present in at least 3 seed (semente) locations. Presence counts each
// distinct card once, so max 2 points.
export function getGaloScorePoints(game: GameState, playerId: string): number {
  const fieldBonus = getGaloFieldCardPositions(game, playerId).length >= GALO_PRESENCE_THRESHOLD ? 1 : 0;
  const seedBonus = getGaloSeedCardPositions(game, playerId).length >= GALO_PRESENCE_THRESHOLD ? 1 : 0;
  return fieldBonus + seedBonus;
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

export function getGaloSeedCardPositions(game: GameState, playerId: string): GridPosition[] {
  return getGaloPresencePositions(game, playerId, (definition) => definition?.resource === "seed");
}

export function getGaloFieldCardPositions(game: GameState, playerId: string): GridPosition[] {
  return getGaloPresencePositions(game, playerId, (definition) => definition?.habitat === "field");
}

export function addGaloForCurrentAction(game: GameState, playerId: string, location: GridPosition): GameState {
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
    throw new Error("Escolha uma carta de campo para adicionar o Galo-de-campina.");
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

  nextPiece.location = createPieceLocation(game, location, findFirstForestSiteWithHabitat(game, location, "field")?.siteId);
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

// Adjacent forest cards (orthogonal) around a location that still have a free
// site to host a new galo. Used by action C's "add adjacent galo" step.
export function addGaloAdjacentForCurrentAction(game: GameState, playerId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Pecas so podem ser adicionadas durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "galo_de_campina") {
    throw new Error("Adicao adjacente implementada apenas para o Galo-de-campina.");
  }

  const pending = game.pendingGaloAdjacentAdd;
  if (!pending || pending.playerId !== playerId) {
    throw new Error("Nao ha adicao adjacente pendente para o Galo-de-campina.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Nao ha galos-de-campina na reserva para adicionar.");
  }

  const validPositions = getGaloAdjacentAddPositions(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error("Escolha um local adjacente ao galo-de-campina movido.");
  }

  const freeSite = getForestSitesAtPosition(game, location).find((site) => !site.isAtCapacity);
  if (!freeSite) {
    throw new Error("Local adjacente sem espaco livre.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location, freeSite.site.siteId);
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  next.pendingGaloAdjacentAdd = null;
  applyCaatingaTrigger(next, playerId, location, "add");
  const targetCard = next.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  next.log = [
    ...next.log,
    {
      id: `add_galo_adjacent_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} adicionou 1 galo-de-campina em um local adjacente ao galo movido.`,
      createdAt: Date.now(),
      payload: {
        kind: "add_piece",
        actorPlayerId: playerId,
        cardInstanceId: targetCard?.instanceId,
        cardDefinitionId: targetCard?.definitionId,
        habitat: targetCard ? getCardDefinitionOrNull(targetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        actionId: "C"
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function scoreGaloSeedCards(game: GameState, playerId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Pontuacao so pode acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "galo_de_campina") {
    throw new Error("Pontuacao por cartas de semente implementada apenas para o Galo-de-campina nesta etapa.");
  }

  if (getCurrentAction(game) !== "D") {
    throw new Error("O Galo-de-campina pontua cartas de semente durante a acao D.");
  }

  const points = getGaloScorePoints(game, playerId);
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.score += points;
  next.log = [
    ...next.log,
    {
      id: `galo_score_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} marcou ${points} ponto(s): +1 presente em 3+ campinas, +1 presente em 3+ locais de semente.`,
      createdAt: Date.now(),
      payload: { kind: "score", actorPlayerId: playerId, points, actionId: "D" }
    }
  ];

  advanceActiveAction(next);
  return next;
}
