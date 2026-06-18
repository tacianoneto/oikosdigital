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

  if (game.pendingGaloInterrupt) {
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

  const destinations = getDestinationsByPlayedCard(game, player.speciesId, piece.location);
  if (player.speciesId === "galo_de_campina" && action === "C") {
    return destinations.filter((position) =>
      game.pieces.some(
        (candidate) =>
          candidate.ownerId === playerId &&
          candidate.speciesId === "galo_de_campina" &&
          candidate.pieceId !== pieceId &&
          candidate.location?.x === position.x &&
          candidate.location.y === position.y
      )
    );
  }

  return destinations;
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

  if (game.pendingGaloInterrupt) {
    throw new Error("Resolva o movimento entre turnos do Galo-de-campina antes de continuar.");
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

  const next = cloneGameState(game);
  pruneResolvedCoatiPairBonuses(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  const nextPlayer = findPlayer(next, playerId);

  nextPiece.location = createPieceLocation(game, destination);
  nextPiece.state.hidden = false;
  const collectedResource = collectMovementDestinationResource(next, playerId, destination, pieceId);
  const moveDestDefinition = getCardDefinitionOrNull(getForestCardAtPosition(next, destination)?.definitionId ?? "");
  if (player.speciesId === "galo_de_campina" && action === "B" && moveDestDefinition?.habitat === "field") {
    nextPlayer.resources = {
      ...nextPlayer.resources,
      seed: (nextPlayer.resources.seed ?? 0) + 1
    };
    next.log = [
      ...next.log,
      {
        id: `galo_field_seed_${playerId}_${next.log.length + 1}`,
        message: `${nextPlayer.name} coletou +1 semente extra por terminar em campo.`,
        createdAt: Date.now(),
        payload: { kind: "move_piece", actorPlayerId: playerId, resources: ["seed"], count: 1, actionId: "B" }
      }
    ];
  }
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

  if (game.pendingJaguarRemoval) {
    return resolvePendingJaguarRemoval(game, playerId, destination, targetPieceId);
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
  const shouldPauseRemoval = shouldPauseJaguarRemovalForGaloInterrupt(game, playerId, destination, jaguarPiece.pieceId);
  const targetPiece = targetPieceId
    ? removablePieces.find((piece) => piece.pieceId === targetPieceId)
    : removablePieces.length === 1
      ? removablePieces[0]
      : null;

  if (removablePieces.length > 0 && !targetPiece && !shouldPauseRemoval) {
    throw new Error("Escolha qual peca a Onca deve remover no local de entrada.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextJaguarPiece = next.pieces.find((piece) => piece.pieceId === jaguarPiece.pieceId);
  let nextTargetPiece = targetPiece ? next.pieces.find((piece) => piece.pieceId === targetPiece.pieceId) : null;
  if (!nextJaguarPiece || (targetPiece && (!nextTargetPiece || !nextTargetPiece.location))) {
    throw new Error("Peca nao encontrada.");
  }

  nextJaguarPiece.location = createPieceLocation(game, destination);
  collectMovementDestinationResource(next, playerId, destination, jaguarPiece.pieceId);
  const pausedByGaloInterrupt =
    removablePieces.length > 0 &&
    next.pendingGaloInterrupt?.interruptedPlayerId === playerId &&
    next.pendingGaloInterrupt.location.x === destination.x &&
    next.pendingGaloInterrupt.location.y === destination.y;
  if (pausedByGaloInterrupt) {
    nextTargetPiece = null;
    next.pendingJaguarRemoval = {
      playerId,
      location: { x: destination.x, y: destination.y }
    };
  }

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

  if (pausedByGaloInterrupt) {
    return next;
  }

  advanceActiveAction(next);
  return next;
}

function resolvePendingJaguarRemoval(
  game: GameState,
  playerId: string,
  _destination: GridPosition,
  targetPieceId?: string
): GameState {
  const pending = game.pendingJaguarRemoval;
  if (!pending || pending.playerId !== playerId) {
    throw new Error("Nao ha remocao pendente da Onca para este jogador.");
  }

  const removablePieces = getRemovablePiecesAtPosition(game, playerId, pending.location);
  const targetPiece = targetPieceId
    ? removablePieces.find((piece) => piece.pieceId === targetPieceId)
    : removablePieces.length === 1
      ? removablePieces[0]
      : null;
  if (!targetPiece) {
    throw new Error("Escolha qual peca a Onca deve remover no local de entrada.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextTargetPiece = next.pieces.find((piece) => piece.pieceId === targetPiece.pieceId);
  if (!nextTargetPiece?.location) {
    throw new Error("Peca nao encontrada.");
  }

  const removedPlayer = findPlayer(next, nextTargetPiece.ownerId);
  nextTargetPiece.location = null;
  removedPlayer.piecesInForest = removedPlayer.piecesInForest.filter((pieceId) => pieceId !== nextTargetPiece.pieceId);
  removedPlayer.reservePieces = [...removedPlayer.reservePieces, nextTargetPiece.pieceId];
  nextPlayer.resources.meat += 1;
  next.pendingJaguarRemoval = null;

  if (nextTargetPiece.speciesId === "coati") {
    pruneResolvedCoatiPairBonuses(next, nextTargetPiece.ownerId);
  }

  applyCaatingaTrigger(next, playerId, pending.location, "remove");

  const jaguarDestCard = next.forest.cards.find((card) => card.x === pending.location.x && card.y === pending.location.y);
  next.log = [
    ...next.log,
    {
      id: `jaguar_pending_remove_${nextTargetPiece.pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} removeu 1 peca com a Onca, depois do movimento entre turnos do Galo-de-campina.`,
      createdAt: Date.now(),
      payload: {
        kind: "remove_piece",
        actorPlayerId: playerId,
        cardInstanceId: jaguarDestCard?.instanceId,
        cardDefinitionId: jaguarDestCard?.definitionId,
        habitat: jaguarDestCard ? getCardDefinitionOrNull(jaguarDestCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: pending.location.x, y: pending.location.y },
        pieceIds: [nextTargetPiece.pieceId],
        actionId: (getCurrentAction(game) as "A" | "B" | "C" | "D" | null) ?? undefined,
        resources: ["meat"]
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

function collectMovementDestinationResource(
  game: GameState,
  playerId: string,
  destination: GridPosition,
  movedPieceId?: string
): Resource | null {
  const targetCard = getForestCardAtPosition(game, destination);
  const targetDefinition = targetCard ? getCardDefinitionOrNull(targetCard.definitionId) : null;
  const cardResource = targetDefinition?.resource ?? null;
  if (!cardResource) {
    return null;
  }

  const galoOwnerInField = targetDefinition?.habitat === "field"
    ? findExistingGaloOwnerAtPosition(game, destination, movedPieceId)
    : null;
  const resource: Resource = galoOwnerInField ? "seed" : cardResource;
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
  queueGaloInterruptIfNeeded(game, {
    collectorPlayerId: playerId,
    collectorSpeciesId: player.speciesId,
    destination,
    galoOwnerId: galoOwnerInField
  });

  const cerradoActive = (game.activeScenarioIds ?? []).includes("cerrado");
  const cerradoTriggered =
    cerradoActive &&
    (game.cerradoTriggeredByPlayer ?? {})[playerId] !== game.round &&
    (player.resources[resource] ?? 0) === 0;
  if (cerradoTriggered) {
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
    [resource]: (player.resources[resource] ?? 0) + 1
  };

  return resource;
}

function findExistingGaloOwnerAtPosition(game: GameState, destination: GridPosition, movedPieceId?: string): string | null {
  return (
    game.pieces
      .filter(
        (piece) =>
          piece.pieceId !== movedPieceId &&
          piece.speciesId === "galo_de_campina" &&
          piece.location?.x === destination.x &&
          piece.location.y === destination.y
      )
      .sort((a, b) => a.pieceId.localeCompare(b.pieceId))[0]?.ownerId ?? null
  );
}

function queueGaloInterruptIfNeeded(
  game: GameState,
  options: {
    collectorPlayerId: string;
    collectorSpeciesId: SpeciesId | null;
    destination: GridPosition;
    galoOwnerId: string | null;
  }
): void {
  if (!options.galoOwnerId || options.collectorSpeciesId === "galo_de_campina") {
    return;
  }

  const targets = getGaloAdjacentTargetsForLocation(game, options.destination);
  const owner = game.players.find((player) => player.playerId === options.galoOwnerId);
  if (targets.length === 0) {
    game.log = [
      ...game.log,
      {
        id: `galo_interrupt_skip_${options.galoOwnerId}_${game.log.length + 1}`,
        message: `${owner?.name ?? "Galo-de-campina"} nao tinha local adjacente valido para mover entre turnos.`,
        createdAt: Date.now(),
        payload: { kind: "skip", actorPlayerId: options.galoOwnerId }
      }
    ];
    return;
  }

  game.pendingGaloInterrupt = {
    ownerId: options.galoOwnerId,
    location: { x: options.destination.x, y: options.destination.y },
    interruptedPlayerId: options.collectorPlayerId
  };
  game.log = [
    ...game.log,
    {
      id: `galo_interrupt_pending_${options.galoOwnerId}_${game.log.length + 1}`,
      message: `${owner?.name ?? "Galo-de-campina"} pode mover 1 galo-de-campina entre turnos.`,
      createdAt: Date.now(),
      payload: { kind: "move_piece", actorPlayerId: options.galoOwnerId }
    }
  ];
}

function shouldPauseJaguarRemovalForGaloInterrupt(
  game: GameState,
  playerId: string,
  destination: GridPosition,
  movedPieceId: string
): boolean {
  const targetCard = getForestCardAtPosition(game, destination);
  const targetDefinition = targetCard ? getCardDefinitionOrNull(targetCard.definitionId) : null;
  if (targetDefinition?.habitat !== "field") {
    return false;
  }

  const galoOwnerId = findExistingGaloOwnerAtPosition(game, destination, movedPieceId);
  if (!galoOwnerId) {
    return false;
  }

  const resource: Resource = "seed";
  const threatBlockReason = getCollectionBlockReason(game, {
    playerId,
    resource,
    habitat: targetDefinition.habitat
  });
  if (threatBlockReason) {
    return false;
  }

  return getGaloAdjacentTargetsForLocation(game, destination).length > 0;
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
