import { commonForestCards } from "@oikos/content";
import type {
  GameState,
  GridPosition,
  Habitat,
  PieceState,
  Resource,
  SpeciesId
} from "@oikos/shared";
import { cloneGameState, findPlayer, getCurrentAction, positionKey } from "./state";
import { createPieceLocation, getCardDefinitionOrNull, getForestCardAtPosition } from "./forest";
import { advanceActiveAction } from "./turn";
import { getCollectionBlockReason, getMovementKindOverride } from "./effects";
import { getMovementKindForSpecies, getPotentialDestinations } from "./movement";
import { getSpeciesPieceLogName, hasSpeciesMovementRule, isImplementedSpecies } from "./speciesRules";
import { applyCaatingaTrigger, assertMataAtlanticaDiscarded } from "./scenarios";
import { getJaguarPieceInForest, getValidJaguarMovementDestinations } from "./species/jaguar";
import {
  getMacawActionCTargets,
  getMacawRelocatablePieceIds,
  relocateMacawForCurrentAction
} from "./species/macaw";
import { pruneResolvedCoatiPairBonuses, queuePendingCoatiPairBonus } from "./species/coati";
import { getGaloAdjacentTargetsForLocation } from "./species/galo";

export function getValidPieceMovementDestinations(game: GameState, playerId: string, pieceId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  if (game.pendingCoatiPairBonus) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const action = getCurrentAction(game);
  if (player?.speciesId === "maned_wolf" && action === "A") {
    const piece = game.pieces.find((candidate) => candidate.pieceId === pieceId);
    if (!piece?.location || piece.ownerId !== playerId || piece.speciesId !== "maned_wolf") {
      return [];
    }

    if (!game.pendingWolfMoves || game.pendingWolfMoves.playerId !== playerId || !game.pendingWolfMoves.pieceIds.includes(pieceId)) {
      return [];
    }

    return getDestinationsByPlayedCard(game, "maned_wolf", piece.location);
  }

  if (player?.speciesId === "jaguar") {
    return getValidJaguarMovementDestinations(game, playerId, pieceId);
  }

  if (player?.speciesId === "macaw" && hasSpeciesMovementRule(player.speciesId, "relocate", action)) {
    const piece = game.pieces.find((candidate) => candidate.pieceId === pieceId);
    if (!piece?.location || piece.ownerId !== playerId || piece.speciesId !== "macaw") {
      return [];
    }

    if (!getMacawRelocatablePieceIds(game, playerId).includes(pieceId)) {
      return [];
    }

    return getMacawActionCTargets(game, playerId);
  }

  if (!player?.speciesId || !hasSpeciesMovementRule(player.speciesId, "played_card", action)) {
    return [];
  }

  const piece = game.pieces.find((candidate) => candidate.pieceId === pieceId);
  if (!piece?.location || piece.ownerId !== playerId || piece.speciesId !== player.speciesId) {
    return [];
  }

  if (player.speciesId === "galo_de_campina" && action === "C") {
    if (player.resources.seed <= 0 || game.pendingGaloMovedPiece?.playerId !== playerId || game.pendingGaloMovedPiece.pieceId === pieceId) {
      return [];
    }
  }

  return getDestinationsByPlayedCard(game, player.speciesId, piece.location);
}

export function movePieceForCurrentAction(
  game: GameState,
  playerId: string,
  pieceId: string,
  destination: GridPosition,
  targetPieceId?: string
): GameState {
  if (game.status !== "active") {
    throw new Error("Movimentos so podem acontecer durante a fase ativa.");
  }

  if (game.pendingCoatiPairBonus) {
    throw new Error("Resolva o bonus da dupla de quatis antes de continuar a acao.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId === "jaguar") {
    const jaguarPiece = getJaguarPieceInForest(game, playerId);
    if (jaguarPiece?.pieceId !== pieceId) {
      throw new Error("Selecione a peca da Onca para mover.");
    }

    return moveJaguarForCurrentAction(game, playerId, destination, targetPieceId);
  }

  if (!player.speciesId) {
    throw new Error("Jogador sem especie nao pode mover peca.");
  }

  if (!isImplementedSpecies(player.speciesId)) {
    throw new Error("Movimento de acao implementado apenas para especies ja implementadas nesta etapa.");
  }

  const action = getCurrentAction(game);
  if (hasSpeciesMovementRule(player.speciesId, "relocate", action)) {
    return relocateMacawForCurrentAction(game, playerId, pieceId, destination);
  }

  if (player.speciesId === "maned_wolf") {
    if (!hasSpeciesMovementRule(player.speciesId, "pending_all_by_played_card", action)) {
      throw new Error("O Lobo-guara so move durante a acao A apos jogar uma carta.");
    }

    if (!game.pendingWolfMoves || game.pendingWolfMoves.playerId !== playerId || !game.pendingWolfMoves.pieceIds.includes(pieceId)) {
      throw new Error("Este lobo nao tem movimento pendente nesta acao.");
    }
  } else if (!hasSpeciesMovementRule(player.speciesId, "played_card", action)) {
    throw new Error("Esta especie so move durante a acao B.");
  }

  const validDestinations = getValidPieceMovementDestinations(game, playerId, pieceId);
  const isValidDestination = validDestinations.some((position) => position.x === destination.x && position.y === destination.y);
  if (!isValidDestination) {
    throw new Error("Destino invalido para o movimento conforme a carta jogada.");
  }

  if (player.speciesId === "galo_de_campina" && action === "C") {
    if (player.resources.seed <= 0) {
      throw new Error("A acao C do Galo-de-campina exige gastar 1 semente.");
    }

    if (game.pendingGaloMovedPiece?.playerId !== playerId) {
      throw new Error("Mova 1 galo-de-campina na acao B antes de usar a acao C.");
    }

    if (game.pendingGaloMovedPiece.pieceId === pieceId) {
      throw new Error("A acao C deve mover outro galo-de-campina.");
    }
  }

  const next = cloneGameState(game);
  pruneResolvedCoatiPairBonuses(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  const nextPlayer = findPlayer(next, playerId);
  if (player.speciesId === "galo_de_campina" && action === "C") {
    nextPlayer.resources = {
      ...nextPlayer.resources,
      seed: nextPlayer.resources.seed - 1
    };
    next.pendingGaloMovedPiece = null;
  }

  nextPiece.location = createPieceLocation(game, destination);
  nextPiece.state.hidden = false;
  const collectedResource = collectMovementDestinationResource(next, playerId, destination);
  const moveDestCard = next.forest.cards.find((card) => card.x === destination.x && card.y === destination.y);
  next.log = [
    ...next.log,
    {
      id: `move_piece_${pieceId}_${next.log.length + 1}`,
      message: `${player.name} moveu 1 ${getSpeciesPieceLogName(player.speciesId)}${collectedResource ? " e coletou recurso do destino" : ""}.`,
      createdAt: Date.now(),
      payload: {
        kind: "move_piece",
        actorPlayerId: playerId,
        cardInstanceId: moveDestCard?.instanceId,
        cardDefinitionId: moveDestCard?.definitionId,
        habitat: moveDestCard ? getCardDefinitionOrNull(moveDestCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: destination.x, y: destination.y },
        pieceIds: [pieceId],
        actionId: (getCurrentAction(game) as "A" | "B" | "C" | "D" | null) ?? undefined,
        resources: collectedResource ? [collectedResource] : undefined
      }
    }
  ];

  if (player.speciesId === "macaw") {
    next.pendingMacawMovedPiece = {
      playerId,
      pieceId,
      location: destination
    };
  }

  if (player.speciesId === "galo_de_campina" && action === "B") {
    next.pendingGaloMovedPiece = { playerId, pieceId };
  }

  // Galo action C: after moving the other galo, the player adds 1 galo from
  // reserve adjacent to it. Stay in action C until the add (or skip) resolves;
  // skip automatically when there is no reserve piece or no adjacent space.
  if (player.speciesId === "galo_de_campina" && action === "C") {
    const canAddAdjacent =
      nextPlayer.reservePieces.length > 0 && getGaloAdjacentTargetsForLocation(next, destination).length > 0;
    if (canAddAdjacent) {
      next.pendingGaloAdjacentAdd = { playerId, pieceId, location: { x: destination.x, y: destination.y } };
      next.log = [
        ...next.log,
        {
          id: `galo_adjacent_pending_${pieceId}_${next.log.length + 1}`,
          message: `${nextPlayer.name} pode adicionar 1 galo-de-campina em um local adjacente ao galo movido.`,
          createdAt: Date.now(),
          payload: { kind: "skip", actorPlayerId: playerId, actionId: "C" }
        }
      ];
      return next;
    }
  }

  if (player.speciesId === "coati" && queuePendingCoatiPairBonus(next, playerId, destination)) {
    return next;
  }

  if (player.speciesId === "maned_wolf") {
    const pending = next.pendingWolfMoves;
    if (pending?.playerId === playerId) {
      const remainingPieceIds = pending.pieceIds.filter((candidate) => candidate !== pieceId);
      next.pendingWolfMoves = remainingPieceIds.length > 0 ? { playerId, pieceIds: remainingPieceIds } : null;

      if (remainingPieceIds.length > 0) {
        return next;
      }
    }
  }

  advanceActiveAction(next);

  return next;
}

export function moveJaguarForCurrentAction(
  game: GameState,
  playerId: string,
  destination: GridPosition,
  targetPieceId?: string
): GameState {
  if (game.status !== "active") {
    throw new Error("Movimentos so podem acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  assertMataAtlanticaDiscarded(game, playerId);

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "jaguar") {
    throw new Error("Movimento de acao implementado apenas para a Onca nesta etapa.");
  }

  const action = getCurrentAction(game);
  if (action !== "A" && action !== "B") {
    throw new Error("A Onca so move e remove pecas nas acoes A e B.");
  }

  const jaguarPiece = getJaguarPieceInForest(game, playerId);
  if (!jaguarPiece?.location) {
    throw new Error("A Onca precisa estar na floresta para se mover.");
  }

  const validDestinations = getValidJaguarMovementDestinations(game, playerId, jaguarPiece.pieceId);
  const isValidDestination = validDestinations.some((position) => position.x === destination.x && position.y === destination.y);
  if (!isValidDestination) {
    throw new Error("Destino invalido para a Onca.");
  }

  const removablePieces = getRemovablePiecesAtPosition(game, playerId, destination);
  const targetPiece = targetPieceId
    ? removablePieces.find((piece) => piece.pieceId === targetPieceId)
    : removablePieces.length === 1
      ? removablePieces[0]
      : null;

  if (removablePieces.length > 0 && !targetPiece) {
    throw new Error("Escolha qual peca a Onca deve remover no local de entrada.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextJaguarPiece = next.pieces.find((piece) => piece.pieceId === jaguarPiece.pieceId);
  const nextTargetPiece = targetPiece ? next.pieces.find((piece) => piece.pieceId === targetPiece.pieceId) : null;
  if (!nextJaguarPiece || (targetPiece && (!nextTargetPiece || !nextTargetPiece.location))) {
    throw new Error("Peca nao encontrada.");
  }

  nextJaguarPiece.location = createPieceLocation(game, destination);
  collectMovementDestinationResource(next, playerId, destination);

  if (nextTargetPiece) {
    const removedPlayer = findPlayer(next, nextTargetPiece.ownerId);
    nextTargetPiece.location = null;
    removedPlayer.piecesInForest = removedPlayer.piecesInForest.filter((pieceId) => pieceId !== nextTargetPiece.pieceId);
    removedPlayer.reservePieces = [...removedPlayer.reservePieces, nextTargetPiece.pieceId];
    nextPlayer.resources.meat += 1;

    if (nextTargetPiece.speciesId === "coati") {
      pruneResolvedCoatiPairBonuses(next, nextTargetPiece.ownerId);
    }

    applyCaatingaTrigger(next, playerId, destination, "remove");
  }

  const jaguarDestCard = next.forest.cards.find((card) => card.x === destination.x && card.y === destination.y);
  next.log = [
    ...next.log,
    {
      id: `jaguar_move_${nextJaguarPiece.pieceId}_${next.log.length + 1}`,
      message: nextTargetPiece
        ? `${nextPlayer.name} moveu a Onca, removeu 1 peca, coletou 1 carne e o recurso do destino.`
        : `${nextPlayer.name} moveu a Onca e coletou o recurso do destino.`,
      createdAt: Date.now(),
      payload: {
        kind: nextTargetPiece ? "remove_piece" : "move_piece",
        actorPlayerId: playerId,
        cardInstanceId: jaguarDestCard?.instanceId,
        cardDefinitionId: jaguarDestCard?.definitionId,
        habitat: jaguarDestCard ? getCardDefinitionOrNull(jaguarDestCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: destination.x, y: destination.y },
        pieceIds: nextTargetPiece ? [nextTargetPiece.pieceId] : [nextJaguarPiece.pieceId],
        actionId: (getCurrentAction(game) as "A" | "B" | "C" | "D" | null) ?? undefined,
        resources: nextTargetPiece ? ["meat"] : undefined
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function getWolfMovablePieceIdsForCurrentAction(game: GameState, playerId: string): string[] {
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "maned_wolf" || getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    return [];
  }

  return game.pieces
    .filter((piece) => piece.ownerId === playerId && piece.speciesId === "maned_wolf" && piece.location)
    .filter((piece) => getDestinationsByPlayedCard(game, "maned_wolf", piece.location!).length > 0)
    .sort((a, b) => a.pieceId.localeCompare(b.pieceId))
    .map((piece) => piece.pieceId);
}

function collectMovementDestinationResource(game: GameState, playerId: string, destination: GridPosition): Resource | null {
  const targetCard = getForestCardAtPosition(game, destination);
  const targetDefinition = targetCard ? getCardDefinitionOrNull(targetCard.definitionId) : null;
  const resource = targetDefinition?.resource ?? null;
  if (!resource) {
    return null;
  }

  const threatBlockReason = getCollectionBlockReason(game, {
    playerId,
    resource,
    habitat: targetDefinition?.habitat ?? null
  });
  if (threatBlockReason) {
    const player = findPlayer(game, playerId);
    game.log = [
      ...game.log,
      {
        id: `threat_collect_block_${playerId}_${game.log.length + 1}`,
        message: `${player.name} nao coletou ${resource}: ${threatBlockReason}.`,
        createdAt: Date.now()
      }
    ];
    return null;
  }

  const player = findPlayer(game, playerId);
  const galoSeedBonus = player.speciesId === "galo_de_campina" && resource === "seed";
  const cerradoActive = (game.activeScenarioIds ?? []).includes("cerrado");
  const cerradoTriggered =
    cerradoActive &&
    (game.cerradoTriggeredByPlayer ?? {})[playerId] !== game.round &&
    (player.resources[resource] ?? 0) === 0;
  if (cerradoTriggered) {
    if (galoSeedBonus) {
      player.resources = {
        ...player.resources,
        seed: (player.resources.seed ?? 0) + 1
      };
      game.log = [
        ...game.log,
        {
          id: `galo_seed_bonus_${playerId}_${game.log.length + 1}`,
          message: `${player.name} coletou +1 semente extra pela passiva do Galo-de-campina.`,
          createdAt: Date.now(),
          payload: { kind: "move_piece", actorPlayerId: playerId, resources: ["seed"], count: 1 }
        }
      ];
    }
    game.cerradoPending = {
      playerId,
      resource,
      location: { x: destination.x, y: destination.y },
      round: game.round
    };
    return resource;
  }

  player.resources = {
    ...player.resources,
    [resource]: (player.resources[resource] ?? 0) + (galoSeedBonus ? 2 : 1)
  };

  if (galoSeedBonus) {
    game.log = [
      ...game.log,
      {
        id: `galo_seed_bonus_${playerId}_${game.log.length + 1}`,
        message: `${player.name} coletou +1 semente extra pela passiva do Galo-de-campina.`,
        createdAt: Date.now(),
        payload: { kind: "move_piece", actorPlayerId: playerId, resources: ["seed"], count: 1 }
      }
    ];
  }

  return resource;
}

function getDestinationsByPlayedCard(game: GameState, speciesId: SpeciesId, origin: GridPosition): GridPosition[] {
  if (!game.activePlayedForestCardId) {
    return [];
  }

  const playedCard = commonForestCards.find((card) => card.id === game.activePlayedForestCardId);
  if (!playedCard?.habitat) {
    return [];
  }

  const forestPositions = new Set(game.forest.cards.map((card) => positionKey(card)));
  const movementOverride = getMovementKindOverride(game, {
    playerId: game.activePlayerId ?? "",
    speciesId,
    origin,
    habitat: playedCard.habitat
  });
  if (movementOverride) {
    return getPotentialDestinations(origin, movementOverride)
      .filter((position) => forestPositions.has(positionKey(position)))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }

  const pampaActive = (game.activeScenarioIds ?? []).includes("pampa");
  const allHabitats: Habitat[] = ["forest", "field", "river"];
  const habitatPool = pampaActive
    ? allHabitats.filter((habitat) => habitat !== playedCard.habitat)
    : [playedCard.habitat];

  const collected = new Map<string, GridPosition>();
  for (const habitat of habitatPool) {
    const kind = getMovementKindForSpecies(speciesId, habitat);
    for (const position of getPotentialDestinations(origin, kind)) {
      const key = positionKey(position);
      if (forestPositions.has(key) && !collected.has(key)) {
        collected.set(key, position);
      }
    }
  }

  return Array.from(collected.values()).sort((a, b) => a.y - b.y || a.x - b.x);
}

function getRemovablePiecesAtPosition(game: GameState, playerId: string, location: GridPosition): PieceState[] {
  return game.pieces
    .filter((piece) => piece.ownerId !== playerId && !piece.state.hidden && piece.location?.x === location.x && piece.location.y === location.y)
    .sort((a, b) => a.pieceId.localeCompare(b.pieceId));
}
