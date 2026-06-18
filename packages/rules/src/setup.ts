import {
  commonForestCards,
  speciesDefinitions
} from "@oikos/content";
import type {
  ActionId,
  ForestCardSiteDefinition,
  ForestCardState,
  GameState,
  GridPosition,
  PieceLocation
} from "@oikos/shared";
import {
  cloneGameState,
  findPlayer,
  getCurrentAction,
  positionKey,
  pushUniqueWarning,
  toGridPosition
} from "./state";
import {
  createPieceLocation,
  defaultCardSiteId,
  findFirstForestSiteWithHabitat,
  findFirstForestSiteWithResource,
  getAvailableForestExpansionPositions,
  getAvailableForestExpansionPositionsForCard,
  getCardDefinitionOrNull,
  getForestPositionsWithHabitat,
  getForestPositionsWithResource,
  getForestSiteOccupancy,
  getForestSitePieces,
  getForestSitesAtPosition,
  hasForestSiteResource,
  isWithinForestLimit
} from "./forest";
export {
  getAvailableForestExpansionPositions,
  getAvailableForestExpansionPositionsForCard,
  getForestPositionsWithHabitat,
  getForestPositionsWithResource,
  getForestSiteOccupancy,
  getForestSitePieces,
  getForestSitesAtPosition,
  hasForestSiteResource
};
export type { ForestSiteOccupancy } from "./forest";
export { createPreviewInitialForest, pickInitialForest } from "./initialForest";
export {
  createInitialGameState,
  createPieceStates,
  createPlayerState,
  getSetupOrder,
  getTurnOrder,
  requiredCommonCardsForPlayers
} from "./createGame";
import { getWolfMovablePieceIdsForCurrentAction } from "./movementActions";
export {
  getValidPieceMovementDestinations,
  moveJaguarForCurrentAction,
  movePieceForCurrentAction
} from "./movementActions";
import {
  advanceActiveAction,
  finishPlayerTurn,
  queueEndgameChoiceOrFinalize,
  revealThreatForRound,
  shouldSkipExtraTurnCardAction,
  shouldSkipJaguarMoveAction,
  skipAutomaticActionIfNeeded
} from "./turn";
import {
  addArmadilloForCurrentAction,
  getArmadilloHidePieceIds,
  getArmadilloSeedPlacementPositions,
  getArmadilloShareScore,
  getArmadilloSharingDetails,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing
} from "./species/armadillo";
export {
  addArmadilloForCurrentAction,
  getArmadilloHidePieceIds,
  getArmadilloSeedPlacementPositions,
  getArmadilloShareScore,
  getArmadilloSharingDetails,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing
};
import {
  addCoatiForCurrentAction,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getCoatiRemovalPieceIds,
  getRequiredCoatiRemovalCount,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus
} from "./species/coati";
export {
  addCoatiForCurrentAction,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getCoatiRemovalPieceIds,
  getRequiredCoatiRemovalCount,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus
};
import {
  addGaloForCurrentAction,
  getGaloActionDScore,
  getGaloFieldCardPositions,
  getGaloFieldPlacementPositions,
  getGaloInterruptMoveTargets,
  getGaloInterruptPieceIds,
  getGaloOutOfFieldPieceCount,
  getGaloOutOfFieldPositions,
  getGaloScorePoints,
  resolveGaloInterruptMove,
  scoreGaloFieldPresence
} from "./species/galo";
export {
  addGaloForCurrentAction,
  getGaloActionDScore,
  getGaloFieldCardPositions,
  getGaloFieldPlacementPositions,
  getGaloInterruptMoveTargets,
  getGaloInterruptPieceIds,
  getGaloOutOfFieldPieceCount,
  getGaloOutOfFieldPositions,
  getGaloScorePoints,
  resolveGaloInterruptMove,
  scoreGaloFieldPresence
};
import {
  addCapuchinForCurrentAction,
  getCapuchinHabitatScore,
  getCapuchinPlacementPositions,
  getCapuchinScoringHabitats,
  scoreCapuchinHabitatPresence
} from "./species/capuchin";
export {
  addCapuchinForCurrentAction,
  getCapuchinHabitatScore,
  getCapuchinPlacementPositions,
  getCapuchinScoringHabitats,
  scoreCapuchinHabitatPresence
};
export type { CapuchinHabitatGroup } from "./species/capuchin";
import {
  addMacawForCurrentAction,
  getMacawActionCTargets,
  getMacawEggPlacementPositions,
  getMacawLineScore,
  getMacawRelocatablePieceIds,
  getMacawScoringLines,
  relocateMacawForCurrentAction,
  scoreMacawLines
} from "./species/macaw";
export {
  addMacawForCurrentAction,
  getMacawActionCTargets,
  getMacawEggPlacementPositions,
  getMacawLineScore,
  getMacawRelocatablePieceIds,
  getMacawScoringLines,
  relocateMacawForCurrentAction,
  scoreMacawLines
};
export type { MacawScoringLine } from "./species/macaw";
import {
  addWolfForCurrentAction,
  getAvailableWolfPointSpendCount,
  getWolfMeatPlacementPositions,
  getWolfRemovableBasePieceIds,
  getWolfSpendableResourceTypes,
  removeBasePieceForWolfAction,
  spendWolfResourcesForPoints
} from "./species/wolf";
export {
  addWolfForCurrentAction,
  getAvailableWolfPointSpendCount,
  getWolfMeatPlacementPositions,
  getWolfRemovableBasePieceIds,
  getWolfSpendableResourceTypes,
  removeBasePieceForWolfAction,
  spendWolfResourcesForPoints
};
import {
  getAvailableJaguarPointSpendCount,
  getValidJaguarMovementDestinations,
  spendJaguarMeatForPoints
} from "./species/jaguar";
export {
  getAvailableJaguarPointSpendCount,
  getValidJaguarMovementDestinations,
  spendJaguarMeatForPoints
};
import { applyEndTurnRuleEffects } from "./effects";
import { finalizeGameState } from "./endgame";
import { applyFinalScoring } from "./scoring";
export {
  discardObjectiveForResources,
  resolveExtraTurnObjective,
  resolveSeedSpendObjective,
  selectObjectiveCard
} from "./objectives";
export {
  collectCaatingaBonus,
  collectCerradoBonus,
  discardMataAtlanticaPileCard,
  resolveCacaIlegal
} from "./scenarioActions";
import {
  applyCaatingaTrigger,
  assertMataAtlanticaDiscarded,
  getCacaIlegalRemovablePieceIds,
  getCacaIlegalTopResources,
  getMataAtlanticaPileTops,
  mataAtlanticaRequiresDiscard,
  removeFromMataAtlanticaPile
} from "./scenarios";

export { getCacaIlegalRemovablePieceIds, getCacaIlegalTopResources } from "./scenarios";

export function placeInitialPiece(game: GameState, playerId: string, location: GridPosition): GameState {
  if (game.status !== "setup") {
    throw new Error("O posicionamento inicial só acontece durante o setup.");
  }

  if (game.setupActivePlayerId !== playerId) {
    throw new Error("Ainda não é a vez deste jogador posicionar peças.");
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player?.speciesId) {
    throw new Error("Jogador sem espécie selecionada.");
  }

  if ((player.objectiveChoices ?? []).length > 0 && !player.selectedObjectiveCardId) {
    throw new Error("Escolha uma carta de objetivo antes de posicionar pecas iniciais.");
  }

  const targetCard = game.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  if (!targetCard) {
    throw new Error("Escolha uma carta válida da floresta inicial.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Jogador sem peças na reserva para o setup.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peça não encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location);
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  applyCaatingaTrigger(next, playerId, location, "add");

  const cardDefinition = getCardDefinitionOrNull(targetCard.definitionId);
  if (cardDefinition?.resource) {
    nextPlayer.resources = {
      ...nextPlayer.resources,
      [cardDefinition.resource]: nextPlayer.resources[cardDefinition.resource] + 1
    };
  } else {
    pushUniqueWarning(
      next,
      "Recursos das cartas iniciais ainda precisam ser transcritos; o posicionamento foi registrado sem conceder recurso."
    );
  }

  next.log = [
    ...next.log,
    {
      id: `setup_place_${pieceId}`,
      message: `${nextPlayer.name} posicionou uma peça inicial.`,
      createdAt: Date.now(),
      payload: {
        kind: "setup_place",
        actorPlayerId: playerId,
        cardInstanceId: targetCard.instanceId,
        cardDefinitionId: targetCard.definitionId,
        habitat: getCardDefinitionOrNull(targetCard.definitionId)?.habitat ?? undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId]
      }
    }
  ];

  advanceSetupTurn(next);
  return next;
}

export function placeForestCard(
  game: GameState,
  playerId: string,
  cardId: string,
  location: GridPosition,
  rotation: ForestCardState["rotation"] = 0
): GameState {
  if (game.status !== "active") {
    throw new Error("Cartas de floresta so podem ser colocadas durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (
    (player.speciesId === "coati" ||
      player.speciesId === "capuchin" ||
      player.speciesId === "macaw" ||
      player.speciesId === "galo_de_campina" ||
      player.speciesId === "armadillo" ||
      player.speciesId === "maned_wolf") &&
    getCurrentAction(game) !== "A"
  ) {
    throw new Error("Esta especie so expande a floresta durante a acao A.");
  }

  if (
    (player.speciesId === "coati" ||
      player.speciesId === "capuchin" ||
      player.speciesId === "macaw" ||
      player.speciesId === "galo_de_campina" ||
      player.speciesId === "armadillo" ||
      player.speciesId === "maned_wolf") &&
    game.activePlayedForestCardId
  ) {
    throw new Error("Esta especie ja colocou a carta de floresta desta acao.");
  }

  if (
    player.speciesId !== "coati" &&
    player.speciesId !== "capuchin" &&
    player.speciesId !== "macaw" &&
    player.speciesId !== "galo_de_campina" &&
    player.speciesId !== "armadillo" &&
    player.speciesId !== "maned_wolf"
  ) {
    throw new Error("A expansao de floresta esta implementada apenas para especies que usam cartas nesta etapa.");
  }

  const pileTops = getMataAtlanticaPileTops(game);
  const fromPile = pileTops.includes(cardId);
  if (!player.hand.includes(cardId) && !fromPile) {
    if (game.mataAtlanticaPiles) {
      throw new Error("Escolha o topo de uma das pilhas (Mata Atlantica).");
    }
    throw new Error("A carta escolhida nao esta na mao deste jogador.");
  }

  const cardDefinition = commonForestCards.find((card) => card.id === cardId);
  if (!cardDefinition) {
    throw new Error("Apenas cartas comuns da mao podem ser colocadas na floresta.");
  }

  const existingCardAtLocation = game.forest.cards.find((card) => card.x === location.x && card.y === location.y) ?? null;
  const replacesExistingCard = game.activeThreatCardId === "threat_2";

  if (!replacesExistingCard && existingCardAtLocation) {
    throw new Error("Ja existe uma carta nesta posicao da floresta.");
  }

  if (replacesExistingCard && !existingCardAtLocation) {
    throw new Error("Desmatamento: escolha uma carta ja na floresta para substituir.");
  }

  if (!isWithinForestLimit(location)) {
    throw new Error("A floresta tem limite maximo de 7x7 cartas.");
  }

  const availablePositions = replacesExistingCard
    ? game.forest.cards.map((card) => ({ x: card.x, y: card.y }))
    : getAvailableForestExpansionPositions(game.forest.cards);
  const isAvailable = availablePositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isAvailable) {
    throw new Error(
      replacesExistingCard
        ? "Desmatamento: escolha uma carta ja na floresta para substituir."
        : "Escolha uma posicao vazia adjacente a floresta."
    );
  }

  const validRiverPositions = getAvailableForestExpansionPositionsForCard(game, cardId, rotation);
  const hasValidRiverConnection = validRiverPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!hasValidRiverConnection) {
    throw new Error("Encaixe de rio invalido: pontas de rio devem conectar apenas com outras pontas de rio.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  if (fromPile) {
    removeFromMataAtlanticaPile(next, cardId);
  } else {
    const cardIndex = nextPlayer.hand.indexOf(cardId);
    nextPlayer.hand = nextPlayer.hand.filter((candidate, index) => candidate !== cardId || index !== cardIndex);
  }
  const newCardInstanceId = `${replacesExistingCard ? "replaced" : "played"}_${cardId}_${next.forest.cards.length + 1}_${next.log.length + 1}`;
  const nextCard: ForestCardState = {
      instanceId: newCardInstanceId,
      definitionId: cardId,
      x: location.x,
      y: location.y,
      rotation,
      isInitial: false
    };
  next.forest.cards = replacesExistingCard
    ? next.forest.cards.map((card) =>
        card.x === location.x && card.y === location.y ? nextCard : card
      )
    : [...next.forest.cards, nextCard];
  next.activePlayedForestCardId = cardId;
  next.log = [
    ...next.log,
    {
      id: `place_card_${cardId}_${next.log.length + 1}`,
      message: replacesExistingCard
        ? `${nextPlayer.name} substituiu uma carta por ${cardDefinition.label} (Desmatamento).`
        : `${nextPlayer.name} colocou ${cardDefinition.label} na floresta.`,
      createdAt: Date.now(),
      payload: {
        kind: "place_card",
        actorPlayerId: playerId,
        cardInstanceId: newCardInstanceId,
        cardDefinitionId: cardId,
        habitat: cardDefinition.habitat ?? undefined,
        location: { x: location.x, y: location.y }
      }
    }
  ];

  if (nextPlayer.speciesId === "coati") {
    pushUniqueWarning(next, "Acao A do Quati: apos expandir a floresta, escolha uma carta com fruta para adicionar 1 quati.");
  }

  if (nextPlayer.speciesId === "maned_wolf") {
    const pendingPieceIds = getWolfMovablePieceIdsForCurrentAction(next, playerId);
    next.pendingWolfMoves = pendingPieceIds.length > 0 ? { playerId, pieceIds: pendingPieceIds } : null;

    if (pendingPieceIds.length === 0) {
      next.log = [
        ...next.log,
        {
          id: `wolf_no_moves_${playerId}_${next.log.length + 1}`,
          message: `${nextPlayer.name} nao tinha lobos com movimento legal apos jogar a carta.`,
          createdAt: Date.now()
        }
      ];
      advanceActiveAction(next);
    }
  }

  return next;
}

export function completeCurrentAction(game: GameState, playerId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Acoes so podem ser concluidas durante a fase ativa.");
  }

  if (
    game.round > game.maxRounds &&
    !game.extraTurnPlayerId &&
    !game.pendingExtraTurnPlayerId &&
    !game.pendingSeedSpendObjectivePlayerId
  ) {
    const next = cloneGameState(game);
    next.activePlayerId = null;
    next.activeActionIndex = 0;
    next.activePlayedForestCardId = null;
    next.pendingCoatiPairBonus = null;
    next.pendingMacawMovedPiece = null;
    next.pendingJaguarRemoval = null;
    next.pendingGaloInterrupt = null;
    next.pendingWolfMoves = null;
    queueEndgameChoiceOrFinalize(next);
    return next;
  }

  if (game.caatingaPending) {
    throw new Error("Resolva o efeito da Caatinga antes de continuar.");
  }

  if (game.cerradoPending) {
    throw new Error("Resolva o efeito do Cerrado antes de continuar.");
  }

  if (game.cacaIlegalPending) {
    throw new Error("Resolva o efeito de Caca ilegal antes de continuar.");
  }

  if (game.pendingGaloInterrupt) {
    throw new Error("Resolva o movimento entre turnos do Galo-de-campina antes de continuar.");
  }

  if (game.pendingJaguarRemoval) {
    throw new Error("Escolha qual peca a Onca deve remover no local de entrada.");
  }

  if (game.pendingCoatiPairBonus) {
    throw new Error("Resolva o bonus da dupla de quatis antes de concluir a acao.");
  }

  if (game.pendingWolfMoves?.playerId === playerId && game.pendingWolfMoves.pieceIds.length > 0) {
    throw new Error("Mova todos os lobos com movimento legal antes de concluir a acao.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  assertMataAtlanticaDiscarded(game, playerId);

  const player = findPlayer(game, playerId);
  if (shouldSkipExtraTurnCardAction(game, playerId)) {
    const next = cloneGameState(game);
    const nextPlayer = findPlayer(next, playerId);
    const action = getCurrentAction(game);
    next.log = [
      ...next.log,
      {
        id: `extra_turn_skip_no_card_${playerId}_${next.log.length + 1}`,
        message: `${nextPlayer.name} concluiu a acao ${action} do turno extra sem carta de floresta jogavel.`,
        createdAt: Date.now(),
        payload: { kind: "skip", actorPlayerId: playerId, actionId: action ?? undefined }
      }
    ];
    advanceActiveAction(next);
    return next;
  }

  if (player.speciesId !== "coati") {
    if (player.speciesId === "jaguar") {
      const action = getCurrentAction(game);
      if (action === "A" || action === "B") {
        if (!shouldSkipJaguarMoveAction(game, playerId)) {
          throw new Error("A acao da Onca e concluida ao mover.");
        }

        const next = cloneGameState(game);
        const nextPlayer = findPlayer(next, playerId);
        next.log = [
          ...next.log,
          {
            id: `jaguar_skip_${action}_${playerId}_${next.log.length + 1}`,
            message: `${nextPlayer.name} pulou a acao ${action} da Onca porque nao havia destino valido para mover.`,
            createdAt: Date.now()
          }
        ];

        advanceActiveAction(next);
        return next;
      }

      if (action === "C") {
        const next = cloneGameState(game);
        const nextPlayer = findPlayer(next, playerId);
        next.log = [
          ...next.log,
          {
            id: `complete_action_${playerId}_${action}_${next.log.length + 1}`,
            message: `${nextPlayer.name} concluiu a acao ${action} sem gastar carne.`,
            createdAt: Date.now()
          }
        ];

        advanceActiveAction(next);
        return next;
      }
    }

    if (player.speciesId === "capuchin") {
      const action = getCurrentAction(game);
      if (action === "A") {
        if (game.activePlayedForestCardId) {
          return completeActionWithoutOptionalAddition(game, playerId, action, "Macaco-prego");
        }

        throw new Error("A acao A do Macaco-prego e concluida ao adicionar 1 macaco na carta jogada.");
      }

      if (action === "B") {
        throw new Error("A acao B do Macaco-prego e concluida ao mover 1 macaco.");
      }

      if (action === "C") {
        return completeActionWithoutOptionalAddition(game, playerId, action, "Macaco-prego");
      }

      if (action === "D") {
        return scoreCapuchinHabitatPresence(game, playerId);
      }
    }

    if (player.speciesId === "galo_de_campina") {
      const action = getCurrentAction(game);
      if (action === "A") {
        if (game.activePlayedForestCardId) {
          return completeActionWithoutOptionalAddition(game, playerId, action, "Galo-de-campina");
        }

        throw new Error("A acao A do Galo-de-campina e concluida ao adicionar 1 galo em local de campo.");
      }

      if (action === "B") {
        throw new Error("A acao B do Galo-de-campina e concluida ao mover 1 galo.");
      }

      if (action === "C") {
        const next = cloneGameState(game);
        const nextPlayer = findPlayer(next, playerId);
        // Concluir a ação C pode acontecer em dois momentos: antes de gastar a
        // semente (não move ninguém) ou após mover o outro galo, pulando a adição
        next.log = [
          ...next.log,
          {
            id: `complete_galo_C_${playerId}_${next.log.length + 1}`,
            message: `${nextPlayer.name} concluiu a acao C sem atrair outra peca.`,
            createdAt: Date.now(),
            payload: { kind: "skip", actorPlayerId: playerId, actionId: "C" }
          }
        ];
        advanceActiveAction(next);
        return next;
      }

      if (action === "D") {
        return scoreGaloFieldPresence(game, playerId);
      }
    }

    if (player.speciesId === "macaw") {
      const action = getCurrentAction(game);
      if (action === "A") {
        if (game.activePlayedForestCardId) {
          return completeActionWithoutOptionalAddition(game, playerId, action, "Arara-azul");
        }

        throw new Error("A acao A da Arara-azul e concluida ao adicionar 1 arara em local de ovo.");
      }

      if (action === "B") {
        throw new Error("A acao B da Arara-azul e concluida ao mover 1 arara.");
      }

      if (action === "C") {
        const next = completeActionWithoutOptionalAddition(game, playerId, action, "Arara-azul");
        next.pendingMacawMovedPiece = null;
        return next;
      }

      if (action === "D") {
        return scoreMacawLines(game, playerId);
      }
    }

    if (player.speciesId === "armadillo") {
      const action = getCurrentAction(game);
      if (action === "A") {
        if (game.activePlayedForestCardId) {
          return completeActionWithoutOptionalAddition(game, playerId, action, "Tatu-bola");
        }

        throw new Error("A acao A do Tatu-bola e concluida ao adicionar 1 tatu em local de semente.");
      }

      if (action === "B") {
        throw new Error("A acao B do Tatu-bola e concluida ao mover 1 tatu.");
      }

      if (action === "C" && getArmadilloHidePieceIds(game, playerId).length > 0) {
        throw new Error("A acao C do Tatu-bola e concluida ao esconder 1 tatu proprio.");
      }

      if (action === "D") {
        return scoreArmadilloSharing(game, playerId);
      }
    }

    if (player.speciesId === "maned_wolf") {
      const action = getCurrentAction(game);
      if (action === "A") {
        throw new Error("A acao A do Lobo-guara e concluida ao colocar carta e mover todos os lobos possiveis.");
      }

      const next = cloneGameState(game);
      const nextPlayer = findPlayer(next, playerId);
      next.log = [
        ...next.log,
        {
          id: `complete_action_${playerId}_${action}_${next.log.length + 1}`,
          message: getWolfCompletionLogMessage(nextPlayer.name, action),
          createdAt: Date.now()
        }
      ];

      advanceActiveAction(next);
      return next;
    }

    throw new Error("Acoes desta especie ainda nao foram implementadas.");
  }

  const action = getCurrentAction(game);
  if (action === "A") {
    if (game.activePlayedForestCardId) {
      return completeActionWithoutOptionalAddition(game, playerId, action, "Quati");
    }

    throw new Error("A acao A do Quati e concluida ao colocar uma carta de floresta.");
  }

  if (action === "B") {
    throw new Error("A acao B do Quati e concluida ao mover 1 quati.");
  }

  if (action === "C" && player.reservePieces.length < 2) {
    throw new Error("A acao C do Quati exige remover 2 quatis da floresta quando ha menos de 2 na reserva.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  next.log = [
    ...next.log,
    {
      id: `complete_action_${playerId}_${action}_${next.log.length + 1}`,
      message: `${nextPlayer.name} concluiu a acao ${action}.`,
      createdAt: Date.now()
    }
  ];

  advanceActiveAction(next);
  return next;
}

function advanceSetupTurn(game: GameState): void {
  for (const playerId of game.setupOrder) {
    const player = findPlayer(game, playerId);
    if (!player.speciesId) {
      continue;
    }

    const species = speciesDefinitions[player.speciesId];
    if (player.piecesInForest.length < species.initialPieces) {
      game.setupActivePlayerId = player.playerId;
      return;
    }
  }

  game.setupActivePlayerId = null;
  game.status = "active";
  game.activePlayerId = game.turnOrder[0] ?? null;
  game.activeActionIndex = 0;
  game.log = [
    ...game.log,
    {
      id: "setup_complete",
      message: "Setup concluído. A partida entrou na fase ativa.",
      createdAt: Date.now()
    }
  ];
  revealThreatForRound(game);
  skipAutomaticActionIfNeeded(game);
}

export function finalizeGame(game: GameState): GameState {
  return finalizeGameState(game, cloneGameState, {
    findPlayer,
    getCardDefinitionOrNull,
    positionKey
  });
}

export function forceEndPlayerTurn(game: GameState, playerId: string, reason: string): GameState {
  if (game.status !== "active") {
    throw new Error("So e possivel pular turno durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("So o jogador ativo pode ter o turno pulado.");
  }

  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);
  next.log = [
    ...next.log,
    {
      id: `force_skip_turn_${playerId}_${next.log.length + 1}`,
      message: `${player.name} teve o turno pulado: ${reason}.`,
      createdAt: Date.now()
    }
  ];

  finishPlayerTurn(next, player);
  return next;
}

function getWolfCompletionLogMessage(playerName: string, action: string | null): string {
  if (action === "B") {
    return `${playerName} concluiu a acao B sem remover peca de base.`;
  }

  if (action === "C") {
    return `${playerName} concluiu a acao C sem gastar recurso.`;
  }

  if (action === "D") {
    return `${playerName} concluiu a acao D sem adicionar lobo.`;
  }

  return `${playerName} concluiu a acao ${action}.`;
}

function completeActionWithoutOptionalAddition(
  game: GameState,
  playerId: string,
  action: string | null,
  speciesName: string
): GameState {
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  next.log = [
    ...next.log,
    {
      id: `skip_optional_add_${playerId}_${action}_${next.log.length + 1}`,
      message: `${nextPlayer.name} concluiu a acao ${action} sem adicionar ${speciesName}.`,
      createdAt: Date.now(),
      payload: { kind: "skip", actorPlayerId: playerId, actionId: (action as ActionId | null) ?? undefined }
    }
  ];

  advanceActiveAction(next);
  return next;
}

function pieceLocationKey(location: PieceLocation): string {
  return `${location.x}:${location.y}:${location.siteId}`;
}
