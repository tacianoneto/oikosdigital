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
  ForestCardState,
  GameState,
  MiniExpansionId,
  PieceState,
  PlayerState,
  RoomPlayer,
  ScenarioCardId,
  SpeciesId
} from "@oikos/shared";
import { pickInitialForest } from "./initialForest";
import { floodThreatId } from "./turn";
import { dealObjectiveChoices } from "./objectives";

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
    pendingGaloInterrupt: null,
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

function findPlayerBySpecies(players: RoomPlayer[], speciesId: SpeciesId): RoomPlayer {
  const player = players.find((candidate) => candidate.speciesId === speciesId);
  if (!player) {
    throw new Error(`No player selected species ${speciesId}`);
  }

  return player;
}
