import {
  commonForestCards,
  initialForestCardCandidates,
  speciesDefinitions,
  speciesOrderBySetup,
  speciesOrderByTurn,
  threatCards
} from "@oikos/content";
import { MAX_PLAYERS } from "@oikos/shared";
import type {
  ActionId,
  ForestCardSiteDefinition,
  ForestCardState,
  GameState,
  GridPosition,
  Habitat,
  MiniExpansionId,
  PieceLocation,
  PieceState,
  PlayerState,
  Resource,
  RoomPlayer,
  ScenarioCardId,
  SpeciesId
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
  getForestCardAtPosition,
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
import { pickInitialForest } from "./initialForest";
export { createPreviewInitialForest, pickInitialForest } from "./initialForest";
import {
  advanceActiveAction,
  finishPlayerTurn,
  floodThreatId,
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
  getRequiredCoatiRemovalCount,
  pruneResolvedCoatiPairBonuses,
  queuePendingCoatiPairBonus,
  resolveCoatiPairBonus
} from "./species/coati";
export {
  addCoatiForCurrentAction,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getRequiredCoatiRemovalCount,
  resolveCoatiPairBonus
};
import {
  addGaloAdjacentForCurrentAction,
  addGaloForCurrentAction,
  getGaloAdjacentAddPositions,
  getGaloAdjacentTargetsForLocation,
  getGaloFieldCardPositions,
  getGaloFieldPlacementPositions,
  getGaloScorePoints,
  getGaloSeedCardPositions,
  getGaloSeedCardScore,
  scoreGaloSeedCards
} from "./species/galo";
export {
  addGaloAdjacentForCurrentAction,
  addGaloForCurrentAction,
  getGaloAdjacentAddPositions,
  getGaloFieldCardPositions,
  getGaloFieldPlacementPositions,
  getGaloScorePoints,
  getGaloSeedCardPositions,
  getGaloSeedCardScore,
  scoreGaloSeedCards
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
  getJaguarPieceInForest,
  getValidJaguarMovementDestinations,
  spendJaguarMeatForPoints
} from "./species/jaguar";
export {
  getAvailableJaguarPointSpendCount,
  getValidJaguarMovementDestinations,
  spendJaguarMeatForPoints
};
import { getMovementKindForSpecies, getPotentialDestinations } from "./movement";
import { applyEndTurnRuleEffects, getCollectionBlockReason, getMovementKindOverride } from "./effects";
import {
  getSpeciesPieceLogName,
  hasSpeciesMovementRule,
  isImplementedSpecies
} from "./speciesRules";
import { finalizeGameState } from "./endgame";
import { applyFinalScoring } from "./scoring";
import { dealObjectiveChoices } from "./objectives";
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

export function getSetupOrder(speciesIds: SpeciesId[]): SpeciesId[] {
  return speciesOrderBySetup.filter((speciesId) => speciesIds.includes(speciesId));
}

export function getTurnOrder(speciesIds: SpeciesId[]): SpeciesId[] {
  return speciesOrderByTurn.filter((speciesId) => speciesIds.includes(speciesId));
}

export function createPlayerState(player: RoomPlayer): PlayerState {
  if (!player.speciesId) {
    throw new Error(`Player ${player.playerId} must select a species before game setup.`);
  }

  const species = speciesDefinitions[player.speciesId];
  const reservePieces = Array.from({ length: species.totalPieces }, (_, index) => `${player.playerId}_piece_${index + 1}`);

  return {
    playerId: player.playerId,
    name: player.name,
    speciesId: player.speciesId,
    score: 0,
    resources: {
      meat: 0,
      egg: 0,
      fruit: 0,
      seed: 0
    },
    hand: [],
    objectiveChoices: [],
    selectedObjectiveCardId: null,
    discardedObjectiveCardId: null,
    reservePieces,
    piecesInForest: [],
    turnsTaken: 0
  };
}

export function createPieceStates(players: RoomPlayer[]): PieceState[] {
  return players.flatMap((player) => {
    if (!player.speciesId) {
      return [];
    }

    const speciesId = player.speciesId;
    const species = speciesDefinitions[speciesId];

    return Array.from({ length: species.totalPieces }, (_, index) => ({
      pieceId: `${player.playerId}_piece_${index + 1}`,
      ownerId: player.playerId,
      speciesId,
      location: null,
      state: {
        hidden: false
      }
    }));
  });
}

export function requiredCommonCardsForPlayers(players: RoomPlayer[]): number {
  return players.reduce((total, player) => {
    if (!player.speciesId) {
      return total;
    }

    return total + (speciesDefinitions[player.speciesId].usesForestCards ? 6 : 0);
  }, 0);
}


export function createInitialGameState(
  gameId: string,
  roomPlayers: RoomPlayer[],
  random: () => number = Math.random,
  initialForest?: ForestCardState[],
  options?: { enabledMiniExpansions?: MiniExpansionId[]; activeScenarioIds?: ScenarioCardId[] }
): GameState {
  if (roomPlayers.length > MAX_PLAYERS) {
    throw new Error(`O máximo é ${MAX_PLAYERS} jogadores por partida.`);
  }

  const enabledMiniExpansions = options?.enabledMiniExpansions ?? [];
  const activeScenarioIds = options?.activeScenarioIds ?? [];
  const threatCardIds = activeScenarioIds.includes("pampa")
    ? threatCards.map((card) => card.id).filter((id) => id !== floodThreatId)
    : threatCards.map((card) => card.id);
  const threatDeckIds = enabledMiniExpansions.includes("threats")
    ? shuffle(
        threatCardIds,
        random
      )
    : [];
  const selectedSpecies = roomPlayers.map((player) => player.speciesId).filter((speciesId): speciesId is SpeciesId => Boolean(speciesId));
  const setupSpeciesOrder = getSetupOrder(selectedSpecies);
  const turnSpeciesOrder = getTurnOrder(selectedSpecies);
  const requiredCommonCards = requiredCommonCardsForPlayers(roomPlayers);
  const contentWarnings: string[] = [];

  if (requiredCommonCards > commonForestCards.length) {
    contentWarnings.push(
      `Distribuição de mãos pendente: ${requiredCommonCards} cartas comuns seriam necessárias, mas há ${commonForestCards.length} assets comuns.`
    );
  }

  const { players, remainingCommonCardIds } = createPlayersWithInitialHands(roomPlayers, turnSpeciesOrder, contentWarnings, random);
  if (enabledMiniExpansions.includes("objectives")) {
    dealObjectiveChoices(players, roomPlayers, random);
  }

  // Mata Atlântica: drop personal starting hands and create 3 shared piles of
  // 6 cards. Piles live on game state, not on player.hand, so future species
  // that put cards into player.hand don't collide with pile cards. Players
  // play/discard the top card of any pile via dedicated flows.
  let mataAtlanticaPiles: string[][] | null = null;
  let remainingForDeck = remainingCommonCardIds;
  if (activeScenarioIds.includes("mata_atlantica")) {
    // Return all dealt cards back to the deck, then split off 18 for piles.
    const returned: string[] = [];
    for (const player of players) {
      returned.push(...player.hand);
      player.hand = [];
    }
    const fullDeck = shuffle([...returned, ...remainingCommonCardIds], random);
    const totalForPiles = Math.min(18, fullDeck.length);
    const pileSize = Math.floor(totalForPiles / 3);
    mataAtlanticaPiles = [
      fullDeck.splice(0, pileSize),
      fullDeck.splice(0, pileSize),
      fullDeck.splice(0, pileSize)
    ];
    remainingForDeck = fullDeck;
  }

  return {
    gameId,
    status: "setup",
    enabledMiniExpansions: [...enabledMiniExpansions],
    round: 1,
    maxRounds: 5,
    activePlayerId: null,
    activeActionIndex: 0,
    activePlayedForestCardId: null,
    pendingCoatiPairBonus: null,
    pendingMacawMovedPiece: null,
    pendingGaloMovedPiece: null,
    pendingGaloAdjacentAdd: null,
    pendingWolfMoves: null,
    pendingExtraTurnPlayerId: null,
    extraTurnPlayerId: null,
    resolvedExtraTurnPlayerIds: [],
    pendingSeedSpendObjectivePlayerId: null,
    acceptedSeedSpendObjectivePlayerIds: [],
    resolvedSeedSpendObjectivePlayerIds: [],
    resolvedCoatiPairBonuses: [],
    setupActivePlayerId: setupSpeciesOrder.length > 0 ? findPlayerBySpecies(roomPlayers, setupSpeciesOrder[0]).playerId : null,
    setupOrder: setupSpeciesOrder.map((speciesId) => findPlayerBySpecies(roomPlayers, speciesId).playerId),
    turnOrder: turnSpeciesOrder.map((speciesId) => findPlayerBySpecies(roomPlayers, speciesId).playerId),
    players,
    pieces: createPieceStates(roomPlayers),
    forest: {
      cards: initialForest ?? pickInitialForest(random)
    },
    deck: {
      commonCardIds: remainingForDeck,
      initialCandidateIds: initialForestCardCandidates.map((card) => card.id)
    },
    log: [
      {
        id: "game_created",
        message: "Partida criada em modo setup.",
        createdAt: Date.now()
      }
    ],
    contentWarnings,
    finalScoreBreakdown: null,
    winnerPlayerIds: [],
    activeScenarioIds: [...activeScenarioIds],
    activeThreatCardId: null,
    threatDeckIds,
    threatDiscardIds: [],
    cerradoTriggeredByPlayer: {},
    cerradoPending: null,
    caatingaUsedByPlayer: {},
    caatingaPending: null,
    mataAtlanticaPiles,
    mataAtlanticaDiscardByPlayer: {},
    cacaIlegalPending: null
  };
}

function createPlayersWithInitialHands(
  roomPlayers: RoomPlayer[],
  turnSpeciesOrder: SpeciesId[],
  contentWarnings: string[],
  random: () => number
): { players: PlayerState[]; remainingCommonCardIds: string[] } {
  const players = roomPlayers.map(createPlayerState);
  const playersById = new Map(players.map((player) => [player.playerId, player]));
  const remainingCommonCardIds = shuffle(commonForestCards.map((card) => card.id), random);
  const eligiblePlayerIds = turnSpeciesOrder
    .map((speciesId) => findPlayerBySpecies(roomPlayers, speciesId).playerId)
    .filter((playerId) => {
      const player = playersById.get(playerId);
      return Boolean(player?.speciesId && speciesDefinitions[player.speciesId].usesForestCards);
    });

  let missingCards = 0;

  for (let cardIndex = 0; cardIndex < 6; cardIndex += 1) {
    for (const playerId of eligiblePlayerIds) {
      const cardId = remainingCommonCardIds.shift();
      if (!cardId) {
        missingCards += 1;
        continue;
      }

      const player = playersById.get(playerId);
      if (player) {
        player.hand = [...player.hand, cardId];
      }
    }
  }

  if (missingCards > 0) {
    contentWarnings.push(
      `Distribuicao provisoria de teste: faltaram ${missingCards} cartas para completar 6 cartas por especie que usa cartas.`
    );
  }

  return { players, remainingCommonCardIds };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [shuffled[targetIndex], shuffled[index]];
  }

  return shuffled;
}

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
    next.pendingGaloMovedPiece = null;
    next.pendingGaloAdjacentAdd = null;
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
        // adjacente opcional.
        const skippedAdjacentAdd = next.pendingGaloAdjacentAdd?.playerId === playerId;
        next.pendingGaloMovedPiece = null;
        next.pendingGaloAdjacentAdd = null;
        next.log = [
          ...next.log,
          {
            id: `complete_galo_C_${playerId}_${next.log.length + 1}`,
            message: skippedAdjacentAdd
              ? `${nextPlayer.name} concluiu a acao C sem adicionar galo adjacente.`
              : `${nextPlayer.name} concluiu a acao C sem gastar semente.`,
            createdAt: Date.now(),
            payload: { kind: "skip", actorPlayerId: playerId, actionId: "C" }
          }
        ];
        advanceActiveAction(next);
        next.pendingGaloMovedPiece = null;
        next.pendingGaloAdjacentAdd = null;
        return next;
      }

      if (action === "D") {
        return scoreGaloSeedCards(game, playerId);
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

export function removePiecesForCurrentAction(game: GameState, playerId: string, pieceIds: string[]): GameState {
  if (game.status !== "active") {
    throw new Error("Remocoes so podem acontecer durante a fase ativa.");
  }

  if (game.pendingCoatiPairBonus) {
    throw new Error("Resolva o bonus da dupla de quatis antes de continuar a acao.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "coati") {
    throw new Error("Remocao de acao implementada apenas para o Quati nesta etapa.");
  }

  if (getCurrentAction(game) !== "C") {
    throw new Error("O Quati so remove pecas durante a acao C.");
  }

  const requiredRemovalCount = getRequiredCoatiRemovalCount(game, playerId);
  if (requiredRemovalCount === 0) {
    throw new Error("A acao C do Quati nao exige remocao porque ha 2 ou mais quatis na reserva.");
  }

  const uniquePieceIds = [...new Set(pieceIds)];
  if (uniquePieceIds.length !== requiredRemovalCount) {
    throw new Error(`Selecione exatamente ${requiredRemovalCount} quatis para remover da floresta.`);
  }

  for (const pieceId of uniquePieceIds) {
    const piece = game.pieces.find((candidate) => candidate.pieceId === pieceId);
    if (!piece?.location || piece.ownerId !== playerId || piece.speciesId !== "coati") {
      throw new Error("So e permitido remover quatis deste jogador que estejam na floresta.");
    }
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);

  for (const pieceId of uniquePieceIds) {
    const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
    if (!nextPiece) {
      throw new Error("Peca nao encontrada.");
    }

    nextPiece.location = null;
  }

  nextPlayer.piecesInForest = nextPlayer.piecesInForest.filter((pieceId) => !uniquePieceIds.includes(pieceId));
  nextPlayer.reservePieces = [...nextPlayer.reservePieces, ...uniquePieceIds];
  // Caatinga trigger: use location of first removed piece.
  {
    const firstRemoved = game.pieces.find((p) => uniquePieceIds.includes(p.pieceId))?.location;
    if (firstRemoved) applyCaatingaTrigger(next, playerId, firstRemoved, "remove");
  }
  pruneResolvedCoatiPairBonuses(next, playerId);
  next.log = [
    ...next.log,
    {
      id: `remove_pieces_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} removeu ${requiredRemovalCount} quatis da floresta.`,
      createdAt: Date.now(),
      payload: {
        kind: "remove_piece",
        actorPlayerId: playerId,
        pieceIds: [...uniquePieceIds],
        actionId: "C",
        count: requiredRemovalCount
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

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

function getWolfMovablePieceIdsForCurrentAction(game: GameState, playerId: string): string[] {
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

function getRemovablePiecesAtPosition(game: GameState, playerId: string, location: GridPosition): PieceState[] {
  return game.pieces
    .filter((piece) => piece.ownerId !== playerId && !piece.state.hidden && piece.location?.x === location.x && piece.location.y === location.y)
    .sort((a, b) => a.pieceId.localeCompare(b.pieceId));
}

function findPlayerBySpecies(players: RoomPlayer[], speciesId: SpeciesId): RoomPlayer {
  const player = players.find((candidate) => candidate.speciesId === speciesId);
  if (!player) {
    throw new Error(`No player selected species ${speciesId}`);
  }

  return player;
}
