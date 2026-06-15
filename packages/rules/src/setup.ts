import {
  commonForestCards,
  initialForestCardCandidates,
  objectiveCards,
  objectiveCardsById,
  speciesDefinitions,
  speciesOrderBySetup,
  speciesOrderByTurn,
  threatCards
} from "@oikos/content";
import { MAX_PLAYERS } from "@oikos/shared";
import type {
  ActionId,
  CardConnections,
  ForestCardDefinition,
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
  defaultCardSiteId,
  getCardDefinitionOrNull,
  getForestCardAtPosition,
  getForestPositionsWithHabitat,
  getForestPositionsWithResource,
  getForestSiteOccupancy,
  getForestSitePieces,
  getForestSitesAtPosition,
  hasForestSiteResource
} from "./forest";
export {
  getForestPositionsWithHabitat,
  getForestPositionsWithResource,
  getForestSiteOccupancy,
  getForestSitePieces,
  getForestSitesAtPosition,
  hasForestSiteResource
};
export type { ForestSiteOccupancy } from "./forest";
import { getMovementKindForSpecies, getPotentialDestinations } from "./movement";
import { applyEndTurnRuleEffects, getCollectionBlockReason, getMovementKindOverride } from "./effects";
import {
  canSpeciesRemovePieceForCacaIlegal,
  getSpeciesPieceLogName,
  hasSpeciesMovementRule,
  isImplementedSpecies
} from "./speciesRules";
import { finalizeGameState } from "./endgame";
import { applyFinalScoring, canSpeciesReceiveObjective } from "./scoring";
import {
  getCacaIlegalRemovablePieceIds,
  getCacaIlegalTopResources,
  getMataAtlanticaPileTops,
  mataAtlanticaRequiresDiscard
} from "./scenarios";

export { getCacaIlegalRemovablePieceIds, getCacaIlegalTopResources } from "./scenarios";

const floodThreatId = "threat_6";

const cardinalDirections = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 }
];

const FOREST_LIMIT_MIN = -3;
const FOREST_LIMIT_MAX = 3;

const surroundingDirections = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 }
];

type ConnectionDirection = keyof CardConnections;

const connectionDirections: ConnectionDirection[] = ["north", "east", "south", "west"];
const directionOffsets: Record<ConnectionDirection, GridPosition> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 }
};

const oppositeDirection: Record<ConnectionDirection, ConnectionDirection> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east"
};

// Mesas iniciais 3x3 pre-definidas e validadas. Em vez de gerar o grid por
// algoritmo (que podia produzir rios mal encaixados), cada mesa e uma linha
// de rio reta (canais que entram e saem pela borda do grid) com floresta/campo
// no resto. Toda mesa e checada na carga do modulo; uma mesa fora das regras
// quebra o build em vez de chegar ao jogador. No inicio da partida uma e
// sorteada.
interface RiverCardSpec {
  definitionId: string;
  x: number;
  y: number;
  rotation: ForestCardState["rotation"];
}

interface ForestTemplate {
  name: string;
  river: RiverCardSpec[];
}

// Regra das mesas iniciais:
//  - Sempre exatamente 3 cartas de rio: 1 de ovo, 1 de semente (seed) e 1 de
//    carne. Cada rio e de face dupla; a mesa usa a frente OU o verso, nunca os
//    dois (ver RIVER_FACE_PAIRS).
//  - Toda saida de rio (borda com agua) conecta com outra saida de rio OU
//    aponta para fora da mesa (borda externa do grid). Nunca encosta em mata.
//  - O lado fechado (mata) das cartas de rio pode encostar em floresta/campo.
//
// Bocas de rio (rotacao 0; girar gira as bocas no sentido horario). Boca so
// conecta com boca ou sai pela borda do grid; boca nunca encosta em mata.
//   Canal {N,S} (rio reto), Curva {N,E} (vira em L), Ponta {N} (fim/lago).
const RIVER_EGG_CHANNEL = "initial_1"; // frente: canal N/S
const RIVER_EGG_BEND = "initial_1_v"; // verso: curva N/E
const RIVER_SEED_BEND = "initial_8"; // frente: curva N/E
const RIVER_SEED_END = "initial_8_v"; // verso: ponta N
const RIVER_MEAT_CHANNEL = "initial_9"; // frente: canal N/S
const RIVER_MEAT_END = "initial_9_v"; // verso: ponta N

// Frente/verso de cada rio. Uma mesa nunca pode conter as duas faces do mesmo
// rio, e nunca dois rios do mesmo recurso.
const RIVER_FACE_PAIRS: Array<[string, string]> = [
  [RIVER_EGG_CHANNEL, RIVER_EGG_BEND],
  [RIVER_SEED_BEND, RIVER_SEED_END],
  [RIVER_MEAT_CHANNEL, RIVER_MEAT_END]
];

const RIVER_CARD_IDS = new Set(RIVER_FACE_PAIRS.flat());

const LAND_CARD_IDS = ["initial_2", "initial_3", "initial_4", "initial_5", "initial_6", "initial_7"];

const GRID_RANGE = [-1, 0, 1];

// Cada mesa coloca os 3 rios (1 face cada) no grid 3x3; as 6 cartas de terra
// preenchem o resto. Canais precisam encadear (nao isolam num 3x3), entao
// canais sempre conectam com outra boca ou seguem ate a borda; pontas/curvas
// fecham o rio (lago) ou ficam isoladas com a boca para fora do grid.
const FOREST_TEMPLATES: ForestTemplate[] = [
  // Rio reto descendo a coluna central, terminando em lago na base.
  {
    name: "rio-coluna-central-lago",
    river: [
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_MEAT_CHANNEL, x: 0, y: 0, rotation: 0 },
      { definitionId: RIVER_SEED_END, x: 0, y: 1, rotation: 0 }
    ]
  },
  // Mesma coluna, encostada a esquerda.
  {
    name: "rio-coluna-esq-lago",
    river: [
      { definitionId: RIVER_EGG_CHANNEL, x: -1, y: -1, rotation: 0 },
      { definitionId: RIVER_MEAT_CHANNEL, x: -1, y: 0, rotation: 0 },
      { definitionId: RIVER_SEED_END, x: -1, y: 1, rotation: 0 }
    ]
  },
  // Mesma coluna, encostada a direita.
  {
    name: "rio-coluna-dir-lago",
    river: [
      { definitionId: RIVER_EGG_CHANNEL, x: 1, y: -1, rotation: 0 },
      { definitionId: RIVER_MEAT_CHANNEL, x: 1, y: 0, rotation: 0 },
      { definitionId: RIVER_SEED_END, x: 1, y: 1, rotation: 0 }
    ]
  },
  // Rio reto atravessando a linha do topo, terminando em lago a direita.
  {
    name: "rio-linha-topo-lago",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: -1, y: -1, rotation: 90 },
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: -1, rotation: 90 },
      { definitionId: RIVER_SEED_END, x: 1, y: -1, rotation: 270 }
    ]
  },
  // Rio reto atravessando a linha central, terminando em lago a direita.
  {
    name: "rio-linha-central-lago",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: -1, y: 0, rotation: 90 },
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: 0, rotation: 90 },
      { definitionId: RIVER_SEED_END, x: 1, y: 0, rotation: 270 }
    ]
  },
  // Rio reto atravessando a linha da base, terminando em lago a direita.
  {
    name: "rio-linha-base-lago",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: -1, y: 1, rotation: 90 },
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: 1, rotation: 90 },
      { definitionId: RIVER_SEED_END, x: 1, y: 1, rotation: 270 }
    ]
  },
  // L no centro: carne entra pelo topo, ovo vira em L, semente fecha a leste.
  {
    name: "rio-L-centro-leste",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: 0, rotation: 0 },
      { definitionId: RIVER_SEED_END, x: 1, y: 0, rotation: 270 }
    ]
  },
  // Espelho do L: ovo vira a oeste e semente fecha em lago a esquerda.
  {
    name: "rio-L-centro-oeste",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: 0, rotation: 270 },
      { definitionId: RIVER_SEED_END, x: -1, y: 0, rotation: 90 }
    ]
  },
  // Tres nascentes isoladas: cada rio aponta as bocas para fora do grid.
  {
    name: "rio-tres-nascentes",
    river: [
      { definitionId: RIVER_EGG_BEND, x: -1, y: -1, rotation: 270 },
      { definitionId: RIVER_SEED_BEND, x: 1, y: -1, rotation: 0 },
      { definitionId: RIVER_MEAT_END, x: 0, y: 1, rotation: 180 }
    ]
  },
  // Outras tres nascentes isoladas, em cantos/bordas diferentes.
  {
    name: "rio-tres-nascentes-2",
    river: [
      { definitionId: RIVER_EGG_BEND, x: -1, y: 1, rotation: 180 },
      { definitionId: RIVER_SEED_END, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_MEAT_END, x: 1, y: 0, rotation: 90 }
    ]
  },
  // L pela base: carne sobe pela base, ovo vira a leste, semente fecha a direita.
  {
    name: "rio-L-base-leste",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: 0, y: 1, rotation: 0 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: 0, rotation: 90 },
      { definitionId: RIVER_SEED_END, x: 1, y: 0, rotation: 270 }
    ]
  },
  // Espelho: carne sobe pela base, ovo vira a oeste, semente fecha a esquerda.
  {
    name: "rio-L-base-oeste",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: 0, y: 1, rotation: 0 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: 0, rotation: 180 },
      { definitionId: RIVER_SEED_END, x: -1, y: 0, rotation: 90 }
    ]
  },
  // Curva entrando pelo topo-esquerda e descendo ate o centro.
  {
    name: "rio-curva-topo-esq",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: -1, y: -1, rotation: 90 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: -1, rotation: 180 },
      { definitionId: RIVER_SEED_END, x: 0, y: 0, rotation: 0 }
    ]
  },
  // Espelho: curva entrando pelo topo-direita e descendo ate o centro.
  {
    name: "rio-curva-topo-dir",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: 1, y: -1, rotation: 90 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: -1, rotation: 90 },
      { definitionId: RIVER_SEED_END, x: 0, y: 0, rotation: 0 }
    ]
  },
  // Zigue-zague: ovo desce pelo topo, semente vira a leste, carne fecha.
  {
    name: "rio-zigue-leste",
    river: [
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_SEED_BEND, x: 0, y: 0, rotation: 0 },
      { definitionId: RIVER_MEAT_END, x: 1, y: 0, rotation: 270 }
    ]
  },
  // Espelho do zigue-zague para o oeste.
  {
    name: "rio-zigue-oeste",
    river: [
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_SEED_BEND, x: 0, y: 0, rotation: 270 },
      { definitionId: RIVER_MEAT_END, x: -1, y: 0, rotation: 90 }
    ]
  },
  // Tres nascentes: cantos opostos com curvas + ponta no topo.
  {
    name: "rio-tres-nascentes-3",
    river: [
      { definitionId: RIVER_EGG_BEND, x: 1, y: 1, rotation: 90 },
      { definitionId: RIVER_SEED_BEND, x: -1, y: -1, rotation: 270 },
      { definitionId: RIVER_MEAT_END, x: 0, y: -1, rotation: 0 }
    ]
  },
  // Tres nascentes: curva no canto e duas pontas em bordas opostas.
  {
    name: "rio-tres-nascentes-4",
    river: [
      { definitionId: RIVER_EGG_BEND, x: 1, y: -1, rotation: 0 },
      { definitionId: RIVER_SEED_END, x: -1, y: 0, rotation: 270 },
      { definitionId: RIVER_MEAT_END, x: 0, y: 1, rotation: 180 }
    ]
  }
];

// Garante a composicao de cada mesa: exatamente 3 rios (1 ovo, 1 semente, 1
// carne), nunca as duas faces do mesmo rio, e exatamente 6 cartas de terra.
function assertForestRiverComposition(cards: ForestCardState[], templateName: string): void {
  const riverCards = cards.filter((card) => RIVER_CARD_IDS.has(card.definitionId));
  if (riverCards.length !== 3) {
    throw new Error(`Mesa inicial "${templateName}" precisa de exatamente 3 rios, tem ${riverCards.length}.`);
  }

  const riverIds = riverCards.map((card) => card.definitionId);
  for (const [front, back] of RIVER_FACE_PAIRS) {
    const usedFaces = riverIds.filter((id) => id === front || id === back).length;
    if (usedFaces !== 1) {
      throw new Error(
        `Mesa inicial "${templateName}" deve usar exatamente uma face do rio ${front}/${back}, usou ${usedFaces}.`
      );
    }
  }

  const landCards = cards.filter((card) => LAND_CARD_IDS.includes(card.definitionId));
  if (landCards.length !== LAND_CARD_IDS.length) {
    throw new Error(`Mesa inicial "${templateName}" precisa das ${LAND_CARD_IDS.length} cartas de terra.`);
  }
}

function buildForestFromTemplate(
  template: ForestTemplate,
  landOrder: readonly string[] = LAND_CARD_IDS
): ForestCardState[] {
  const riverByPos = new Map(template.river.map((spec) => [`${spec.x}:${spec.y}`, spec]));
  const cards: ForestCardState[] = [];
  let landIndex = 0;

  for (const y of GRID_RANGE) {
    for (const x of GRID_RANGE) {
      const river = riverByPos.get(`${x}:${y}`);
      if (river) {
        cards.push({
          instanceId: `setup_${river.definitionId}`,
          definitionId: river.definitionId,
          x,
          y,
          rotation: river.rotation,
          isInitial: true
        });
        continue;
      }

      const definitionId = landOrder[landIndex];
      landIndex += 1;
      cards.push({
        instanceId: `setup_${definitionId}`,
        definitionId,
        x,
        y,
        rotation: 0,
        isInitial: true
      });
    }
  }

  return cards;
}

function assertForestRiverConsistency(cards: ForestCardState[], templateName: string): void {
  const byPos = new Map(cards.map((card) => [`${card.x}:${card.y}`, card]));

  for (const card of cards) {
    const definition = getCardDefinitionOrNull(card.definitionId);
    if (!definition) {
      throw new Error(`Mesa inicial "${templateName}" usa carta desconhecida: ${card.definitionId}`);
    }

    const connections = getRotatedConnections(definition, card.rotation);
    for (const direction of connectionDirections) {
      const offset = directionOffsets[direction];
      const neighbor = byPos.get(`${card.x + offset.x}:${card.y + offset.y}`);
      if (!neighbor) {
        continue;
      }

      const neighborDefinition = getCardDefinitionOrNull(neighbor.definitionId);
      if (!neighborDefinition) {
        throw new Error(`Mesa inicial "${templateName}" usa carta desconhecida: ${neighbor.definitionId}`);
      }

      const neighborConnections = getRotatedConnections(neighborDefinition, neighbor.rotation);
      const here = connections[direction] === "river";
      const there = neighborConnections[oppositeDirection[direction]] === "river";
      if (here !== there) {
        throw new Error(
          `Mesa inicial "${templateName}" tem rio mal encaixado entre (${card.x},${card.y}) e (${neighbor.x},${neighbor.y}).`
        );
      }
    }
  }
}

// Valida cada mesa na carga do modulo e guarda a spec (rios) para montar a
// floresta sob demanda; a ordem das 6 cartas de terra e sorteada por partida.
const VALIDATED_FOREST_TEMPLATES: ForestTemplate[] = FOREST_TEMPLATES.map((template) => {
  const cards = buildForestFromTemplate(template);
  assertForestRiverConsistency(cards, template.name);
  assertForestRiverComposition(cards, template.name);
  return template;
});

export function pickInitialForest(random: () => number = Math.random): ForestCardState[] {
  const index = Math.min(
    VALIDATED_FOREST_TEMPLATES.length - 1,
    Math.floor(random() * VALIDATED_FOREST_TEMPLATES.length)
  );
  // Sorteia tambem a posicao das 6 cartas de terra: cada mesa de rio ganha
  // muitas combinacoes de terra (6! = 720) sem afetar o encaixe dos rios.
  const landOrder = shuffle([...LAND_CARD_IDS], random);
  return buildForestFromTemplate(VALIDATED_FOREST_TEMPLATES[index], landOrder);
}

export function createPreviewInitialForest(): ForestCardState[] {
  // Determinista (ordem fixa de terra), usado por preview e testes.
  return buildForestFromTemplate(VALIDATED_FOREST_TEMPLATES[0]);
}

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

export function getAvailableForestExpansionPositions(cards: ForestCardState[]): GridPosition[] {
  const occupied = new Set(cards.map((card) => positionKey(card)));
  const targets = new Map<string, GridPosition>();

  for (const card of cards) {
    for (const direction of cardinalDirections) {
      const candidate = { x: card.x + direction.x, y: card.y + direction.y };
      const key = positionKey(candidate);

      if (!occupied.has(key) && isWithinForestLimit(candidate)) {
        targets.set(key, candidate);
      }
    }
  }

  return [...targets.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

function isWithinForestLimit(position: GridPosition): boolean {
  return (
    position.x >= FOREST_LIMIT_MIN &&
    position.x <= FOREST_LIMIT_MAX &&
    position.y >= FOREST_LIMIT_MIN &&
    position.y <= FOREST_LIMIT_MAX
  );
}

export function getAvailableForestExpansionPositionsForCard(
  game: GameState,
  cardId: string,
  rotation: ForestCardState["rotation"] = 0
): GridPosition[] {
  const cardDefinition = commonForestCards.find((card) => card.id === cardId);
  if (!cardDefinition) {
    return [];
  }

  const basePositions =
    game.activeThreatCardId === "threat_2"
      ? game.forest.cards.map((card) => ({ x: card.x, y: card.y }))
      : getAvailableForestExpansionPositions(game.forest.cards);

  return basePositions.filter((position) =>
    isForestCardRiverConnectionValid(game, cardDefinition, position, rotation)
  );
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

function dealObjectiveChoices(players: PlayerState[], roomPlayers: RoomPlayer[], random: () => number): void {
  const objectiveDeck = shuffle(objectiveCards.map((card) => card.id), random);

  for (const player of players) {
    if (!player.speciesId) {
      player.objectiveChoices = [];
      continue;
    }

    const objectiveChoices = objectiveDeck
      .filter((objectiveCardId) => {
        const card = objectiveCardsById.get(objectiveCardId);
        return card ? canSpeciesReceiveObjective(player.speciesId!, card) : false;
      })
      .slice(0, 2);

    for (const objectiveCardId of objectiveChoices) {
      const deckIndex = objectiveDeck.indexOf(objectiveCardId);
      if (deckIndex >= 0) {
        objectiveDeck.splice(deckIndex, 1);
      }
    }

    player.objectiveChoices = objectiveChoices;
    const roomPlayer = roomPlayers.find((candidate) => candidate.playerId === player.playerId);
    player.selectedObjectiveCardId = roomPlayer?.isBot ? (player.objectiveChoices[0] ?? null) : null;
  }
}

export function selectObjectiveCard(game: GameState, playerId: string, objectiveCardId: string): GameState {
  if (game.status !== "setup") {
    throw new Error("Objetivo so pode ser escolhido no inicio da partida.");
  }

  const player = findPlayer(game, playerId);
  if (player.selectedObjectiveCardId) {
    throw new Error("Objetivo ja escolhido.");
  }

  if (!player.objectiveChoices.includes(objectiveCardId)) {
    throw new Error("Escolha uma das 2 cartas de objetivo recebidas.");
  }

  if (player.speciesId) {
    const card = objectiveCardsById.get(objectiveCardId);
    if (!card || !canSpeciesReceiveObjective(player.speciesId, card)) {
      throw new Error("Esta especie nao pode receber este objetivo.");
    }
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.selectedObjectiveCardId = objectiveCardId;
  nextPlayer.discardedObjectiveCardId = null;
  next.log = [
    ...next.log,
    {
      id: `objective_select_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} escolheu uma carta de objetivo.`,
      createdAt: Date.now()
    }
  ];

  return next;
}

export function discardObjectiveForResources(game: GameState, playerId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Objetivo so pode ser descartado durante a partida.");
  }

  const player = findPlayer(game, playerId);
  if (!player.selectedObjectiveCardId) {
    throw new Error("Jogador nao possui objetivo selecionado.");
  }

  const card = objectiveCardsById.get(player.selectedObjectiveCardId);
  if (card?.scoring.kind !== "discard_for_resources") {
    throw new Error("Este objetivo nao pode ser descartado por recursos.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const discardedObjectiveCardId = nextPlayer.selectedObjectiveCardId;
  nextPlayer.resources = {
    meat: (nextPlayer.resources.meat ?? 0) + 1,
    egg: (nextPlayer.resources.egg ?? 0) + 1,
    fruit: (nextPlayer.resources.fruit ?? 0) + 1,
    seed: (nextPlayer.resources.seed ?? 0) + 1
  };
  nextPlayer.selectedObjectiveCardId = null;
  nextPlayer.discardedObjectiveCardId = discardedObjectiveCardId;
  nextPlayer.objectiveChoices = [];
  next.log = [
    ...next.log,
    {
      id: `objective_discard_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} descartou o objetivo para ganhar 1 recurso de cada.`,
      createdAt: Date.now(),
      payload: { kind: "objective", actorPlayerId: playerId, resources: ["meat", "egg", "fruit", "seed"] }
    }
  ];

  return next;
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
function getGaloAdjacentTargetsForLocation(game: GameState, location: GridPosition): GridPosition[] {
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

// Threshold for each galo presence bonus (campinas / seed locations).
const GALO_PRESENCE_THRESHOLD = 3;

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

export function getMacawEggPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "macaw" || getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    return [];
  }

  if (player.reservePieces.length === 0) {
    return [];
  }

  return getForestPositionsWithResource(game, "egg");
}

export function addMacawForCurrentAction(game: GameState, playerId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Pecas so podem ser adicionadas durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "macaw") {
    throw new Error("Adicao de peca implementada apenas para a Arara-azul nesta etapa.");
  }

  const action = getCurrentAction(game);
  if (action !== "A" && action !== "C") {
    throw new Error("A Arara-azul adiciona peca durante as acoes A e C.");
  }

  const validPositions = action === "A" ? getMacawEggPlacementPositions(game, playerId) : getMacawActionCTargets(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error(action === "A" ? "Escolha uma carta com local de ovo." : "Escolha uma carta ao redor da arara movida.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Nao ha araras na reserva para adicionar.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location, action === "A" ? findFirstForestSiteWithResource(game, location, "egg")?.siteId : undefined);
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  applyCaatingaTrigger(next, playerId, location, "add");
  const macawTargetCard = next.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  next.log = [
    ...next.log,
    {
      id: `add_macaw_${pieceId}_${next.log.length + 1}`,
      message: action === "A" ? `${nextPlayer.name} adicionou 1 arara em local de ovo.` : `${nextPlayer.name} adicionou 1 arara ao redor da arara movida.`,
      createdAt: Date.now(),
      payload: {
        kind: "add_piece",
        actorPlayerId: playerId,
        cardInstanceId: macawTargetCard?.instanceId,
        cardDefinitionId: macawTargetCard?.definitionId,
        habitat: macawTargetCard ? getCardDefinitionOrNull(macawTargetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        actionId: action
      }
    }
  ];

  if (action === "C") {
    next.pendingMacawMovedPiece = null;
  }
  advanceActiveAction(next);
  return next;
}

export function getMacawActionCTargets(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const pending = game.pendingMacawMovedPiece;
  if (player?.speciesId !== "macaw" || getCurrentAction(game) !== "C" || pending?.playerId !== playerId) {
    return [];
  }

  return getSurroundingDestinations(game, pending.location);
}

export function getMacawRelocatablePieceIds(game: GameState, playerId: string): string[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const pending = game.pendingMacawMovedPiece;
  if (player?.speciesId !== "macaw" || getCurrentAction(game) !== "C" || pending?.playerId !== playerId) {
    return [];
  }

  return game.pieces
    .filter((piece) => piece.ownerId === playerId && piece.speciesId === "macaw" && piece.location && piece.pieceId !== pending.pieceId)
    .map((piece) => piece.pieceId);
}

export function relocateMacawForCurrentAction(game: GameState, playerId: string, pieceId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Movimentos so podem acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "macaw" || getCurrentAction(game) !== "C") {
    throw new Error("A Arara-azul realoca outra arara durante a acao C.");
  }

  if (!getMacawRelocatablePieceIds(game, playerId).includes(pieceId)) {
    throw new Error("Selecione uma arara diferente da arara movida na acao B.");
  }

  const validPositions = getMacawActionCTargets(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error("Escolha uma carta ao redor da arara movida.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location);
  next.pendingMacawMovedPiece = null;
  const relocateTargetCard = next.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  next.log = [
    ...next.log,
    {
      id: `relocate_macaw_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} realocou 1 arara ao redor da arara movida.`,
      createdAt: Date.now(),
      payload: {
        kind: "move_piece",
        actorPlayerId: playerId,
        cardInstanceId: relocateTargetCard?.instanceId,
        cardDefinitionId: relocateTargetCard?.definitionId,
        habitat: relocateTargetCard ? getCardDefinitionOrNull(relocateTargetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        actionId: "C"
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function getMacawLineScore(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "macaw" || getCurrentAction(game) !== "D") {
    return 0;
  }

  const positionSet = new Set(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "macaw" && piece.location)
      .map((piece) => positionKey(piece.location!))
  );
  const directions = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 }
  ];
  const lineKeys = new Set<string>();

  for (const key of positionSet) {
    const [x, y] = key.split(":").map(Number);
    for (const direction of directions) {
      const before = `${x - direction.x}:${y - direction.y}`;
      const second = `${x + direction.x}:${y + direction.y}`;
      const third = `${x + direction.x * 2}:${y + direction.y * 2}`;
      if (positionSet.has(before) || !positionSet.has(second) || !positionSet.has(third)) {
        continue;
      }

      lineKeys.add(`${x}:${y}|${direction.x}:${direction.y}`);
    }
  }

  return lineKeys.size;
}

export interface MacawScoringLine {
  origin: GridPosition;
  direction: GridPosition;
  positions: [GridPosition, GridPosition, GridPosition];
}

export function getMacawScoringLines(game: GameState, playerId: string): MacawScoringLine[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "macaw" || getCurrentAction(game) !== "D") {
    return [];
  }

  const positionSet = new Set(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "macaw" && piece.location)
      .map((piece) => positionKey(piece.location!))
  );
  const directions: GridPosition[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 }
  ];
  const lines: MacawScoringLine[] = [];

  for (const key of positionSet) {
    const [x, y] = key.split(":").map(Number);
    for (const direction of directions) {
      const before = `${x - direction.x}:${y - direction.y}`;
      const second = `${x + direction.x}:${y + direction.y}`;
      const third = `${x + direction.x * 2}:${y + direction.y * 2}`;
      if (positionSet.has(before) || !positionSet.has(second) || !positionSet.has(third)) {
        continue;
      }

      lines.push({
        origin: { x, y },
        direction,
        positions: [
          { x, y },
          { x: x + direction.x, y: y + direction.y },
          { x: x + direction.x * 2, y: y + direction.y * 2 }
        ]
      });
    }
  }

  return lines;
}

export function scoreMacawLines(game: GameState, playerId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Pontuacao so pode acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "macaw" || getCurrentAction(game) !== "D") {
    throw new Error("A Arara-azul pontua linhas durante a acao D.");
  }

  const points = getMacawLineScore(game, playerId);
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.score += points;
  next.log = [
    ...next.log,
    {
      id: `macaw_score_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} marcou ${points} ponto(s) por linhas retas de 3 araras.`,
      createdAt: Date.now(),
      payload: { kind: "score", actorPlayerId: playerId, points, actionId: "D" }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function getArmadilloSeedPlacementPositions(game: GameState, playerId: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "armadillo" || getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    return [];
  }

  if (player.reservePieces.length === 0) {
    return [];
  }

  return getForestPositionsWithResource(game, "seed");
}

export function addArmadilloForCurrentAction(game: GameState, playerId: string, location: GridPosition): GameState {
  if (game.status !== "active") {
    throw new Error("Pecas so podem ser adicionadas durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "armadillo") {
    throw new Error("Adicao de peca implementada apenas para o Tatu-bola nesta etapa.");
  }

  if (getCurrentAction(game) !== "A" || !game.activePlayedForestCardId) {
    throw new Error("O Tatu-bola adiciona peca durante a acao A depois de expandir a floresta.");
  }

  const pieceId = player.reservePieces[0];
  if (!pieceId) {
    throw new Error("Nao ha tatus na reserva para adicionar.");
  }

  const validPositions = getArmadilloSeedPlacementPositions(game, playerId);
  const isValidPosition = validPositions.some((position) => position.x === location.x && position.y === location.y);
  if (!isValidPosition) {
    throw new Error("Escolha uma carta com local de semente para adicionar o tatu.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.location = createPieceLocation(game, location, findFirstForestSiteWithResource(game, location, "seed")?.siteId);
  nextPiece.state.hidden = false;
  nextPlayer.reservePieces = nextPlayer.reservePieces.filter((candidate) => candidate !== pieceId);
  nextPlayer.piecesInForest = [...nextPlayer.piecesInForest, pieceId];
  applyCaatingaTrigger(next, playerId, location, "add");
  const armadilloTargetCard = next.forest.cards.find((card) => card.x === location.x && card.y === location.y);
  next.log = [
    ...next.log,
    {
      id: `add_armadillo_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} adicionou 1 tatu em local de semente.`,
      createdAt: Date.now(),
      payload: {
        kind: "add_piece",
        actorPlayerId: playerId,
        cardInstanceId: armadilloTargetCard?.instanceId,
        cardDefinitionId: armadilloTargetCard?.definitionId,
        habitat: armadilloTargetCard ? getCardDefinitionOrNull(armadilloTargetCard.definitionId)?.habitat ?? undefined : undefined,
        location: { x: location.x, y: location.y },
        pieceIds: [pieceId],
        actionId: "A"
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function getArmadilloHidePieceIds(game: GameState, playerId: string): string[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "armadillo" || getCurrentAction(game) !== "C") {
    return [];
  }

  return game.pieces
    .filter((piece) => piece.ownerId === playerId && piece.speciesId === "armadillo" && piece.location && !piece.state.hidden)
    .map((piece) => piece.pieceId);
}

export function hideArmadilloForCurrentAction(game: GameState, playerId: string, pieceId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Acoes so podem acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "armadillo" || getCurrentAction(game) !== "C") {
    throw new Error("O Tatu-bola esconde uma peca propria durante a acao C.");
  }

  if (!getArmadilloHidePieceIds(game, playerId).includes(pieceId)) {
    throw new Error("Selecione um Tatu-bola proprio visivel na floresta.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const nextPiece = next.pieces.find((piece) => piece.pieceId === pieceId);
  if (!nextPiece) {
    throw new Error("Peca nao encontrada.");
  }

  nextPiece.state.hidden = true;
  const hideLocation = nextPiece.location ? { x: nextPiece.location.x, y: nextPiece.location.y } : undefined;
  const hideCard = hideLocation ? next.forest.cards.find((card) => card.x === hideLocation.x && card.y === hideLocation.y) : undefined;
  next.log = [
    ...next.log,
    {
      id: `hide_armadillo_${pieceId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} escondeu 1 Tatu-bola.`,
      createdAt: Date.now(),
      payload: {
        kind: "hide_piece",
        actorPlayerId: playerId,
        cardInstanceId: hideCard?.instanceId,
        cardDefinitionId: hideCard?.definitionId,
        habitat: hideCard ? getCardDefinitionOrNull(hideCard.definitionId)?.habitat ?? undefined : undefined,
        location: hideLocation,
        pieceIds: [pieceId],
        actionId: "C"
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}

export function getArmadilloShareScore(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "armadillo" || getCurrentAction(game) !== "D") {
    return 0;
  }

  const armadilloPositions = new Set(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "armadillo" && piece.location)
      .map((piece) => positionKey(piece.location!))
  );

  const opponentSpecies = new Set(
    game.players
      .filter((candidate) => candidate.playerId !== playerId && candidate.speciesId)
      .map((candidate) => candidate.speciesId!)
  );

  let sharingCount = 0;
  let notSharingCount = 0;
  for (const speciesId of opponentSpecies) {
    const sharesLocation = game.pieces.some(
      (piece) => piece.speciesId === speciesId && piece.location && armadilloPositions.has(positionKey(piece.location))
    );
    if (!sharesLocation) {
      notSharingCount += 1;
    } else {
      sharingCount += 1;
    }
  }

  if (sharingCount === 0) {
    return 0;
  }

  return Math.max(1, 3 - notSharingCount);
}

export function getArmadilloSharingDetails(game: GameState, playerId: string): {
  points: number;
  sharedSpecies: SpeciesId[];
  missingSpecies: SpeciesId[];
  sharedPositions: GridPosition[];
} {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return { points: 0, sharedSpecies: [], missingSpecies: [], sharedPositions: [] };
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "armadillo" || getCurrentAction(game) !== "D") {
    return { points: 0, sharedSpecies: [], missingSpecies: [], sharedPositions: [] };
  }

  const armadilloPositions = new Map(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "armadillo" && piece.location)
      .map((piece) => [positionKey(piece.location!), { x: piece.location!.x, y: piece.location!.y }])
  );
  const opponentSpecies = new Set(
    game.players
      .filter((candidate) => candidate.playerId !== playerId && candidate.speciesId)
      .map((candidate) => candidate.speciesId!)
  );
  const sharedSpecies: SpeciesId[] = [];
  const missingSpecies: SpeciesId[] = [];
  const sharedPositionKeys = new Set<string>();

  for (const speciesId of opponentSpecies) {
    const sharedPieces = game.pieces.filter(
      (piece) => piece.speciesId === speciesId && piece.location && armadilloPositions.has(positionKey(piece.location))
    );
    if (sharedPieces.length === 0) {
      missingSpecies.push(speciesId);
      continue;
    }

    sharedSpecies.push(speciesId);
    for (const piece of sharedPieces) {
      if (piece.location) {
        sharedPositionKeys.add(positionKey(piece.location));
      }
    }
  }

  const points = sharedSpecies.length === 0 ? 0 : Math.max(1, 3 - missingSpecies.length);
  return {
    points,
    sharedSpecies,
    missingSpecies,
    sharedPositions: [...sharedPositionKeys].map((key) => armadilloPositions.get(key)).filter((position): position is GridPosition => Boolean(position))
  };
}

export function scoreArmadilloSharing(game: GameState, playerId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Pontuacao so pode acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "armadillo" || getCurrentAction(game) !== "D") {
    throw new Error("O Tatu-bola pontua compartilhamento durante a acao D.");
  }

  const points = getArmadilloShareScore(game, playerId);
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.score += points;
  next.log = [
    ...next.log,
    {
      id: `armadillo_score_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} marcou ${points} ponto(s) por compartilhamento de locais.`,
      createdAt: Date.now(),
      payload: { kind: "score", actorPlayerId: playerId, points, actionId: "D" }
    }
  ];

  advanceActiveAction(next);
  return next;
}

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

export function getAvailableJaguarPointSpendCount(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "jaguar" || getCurrentAction(game) !== "C") {
    return 0;
  }

  return Math.min(3, player.resources.meat);
}

export function spendJaguarMeatForPoints(game: GameState, playerId: string, count: number): GameState {
  if (game.status !== "active") {
    throw new Error("Acoes so podem acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  assertMataAtlanticaDiscarded(game, playerId);

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "jaguar") {
    throw new Error("Pontuacao por carne implementada apenas para a Onca nesta etapa.");
  }

  if (getCurrentAction(game) !== "C") {
    throw new Error("A Onca so gasta carne para pontuar durante a acao C.");
  }

  if (!Number.isInteger(count) || count < 1 || count > 3) {
    throw new Error("A Onca pode gastar de 1 a 3 carnes na acao C.");
  }

  if (player.resources.meat < count) {
    throw new Error("A Onca nao tem carne suficiente para esta pontuacao.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.resources.meat -= count;
  nextPlayer.score += count;
  next.log = [
    ...next.log,
    {
      id: `jaguar_spend_meat_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} gastou ${count} carne(s) e marcou ${count} ponto(s).`,
      createdAt: Date.now(),
      payload: {
        kind: "spend",
        actorPlayerId: playerId,
        points: count,
        actionId: "C",
        resources: Array.from({ length: count }, () => "meat" as Resource),
        count
      }
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

export function getValidJaguarMovementDestinations(game: GameState, playerId: string, pieceId?: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const action = getCurrentAction(game);
  if (player?.speciesId !== "jaguar" || (action !== "A" && action !== "B")) {
    return [];
  }

  const jaguarPiece = getJaguarPieceInForest(game, playerId);
  if (!jaguarPiece?.location || (pieceId && jaguarPiece.pieceId !== pieceId)) {
    return [];
  }

  const forestPositions = new Set(game.forest.cards.map((card) => positionKey(card)));
  const movementOverride = getMovementKindOverride(game, {
    playerId,
    speciesId: "jaguar",
    origin: jaguarPiece.location,
    actionId: (action as ActionId | null) ?? null
  });
  if (movementOverride) {
    return getPotentialDestinations(jaguarPiece.location, movementOverride)
      .filter((position) => forestPositions.has(positionKey(position)))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }

  if (action === "A") {
    return getPotentialDestinations(jaguarPiece.location, "adjacent")
      .filter((position) => forestPositions.has(positionKey(position)))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }

  const currentCard = getForestCardAtPosition(game, jaguarPiece.location);
  const currentDef = currentCard ? getCardDefinitionOrNull(currentCard.definitionId) : null;
  const currentHabitat = currentDef?.habitat ?? null;
  if (!currentHabitat) {
    return [];
  }

  const pampaActive = (game.activeScenarioIds ?? []).includes("pampa");
  const allHabitats: Habitat[] = ["forest", "field", "river"];
  const habitatPool = pampaActive
    ? allHabitats.filter((habitat) => habitat !== currentHabitat)
    : [currentHabitat];

  const collected = new Map<string, GridPosition>();
  for (const habitat of habitatPool) {
    const kind = getMovementKindForSpecies("jaguar", habitat);
    for (const position of getPotentialDestinations(jaguarPiece.location, kind)) {
      const key = positionKey(position);
      if (forestPositions.has(key) && !collected.has(key)) {
        collected.set(key, position);
      }
    }
  }

  return Array.from(collected.values()).sort((a, b) => a.y - b.y || a.x - b.x);
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

function advanceActiveAction(game: GameState): void {
  if (
    game.caatingaPending ||
    game.cerradoPending ||
    game.cacaIlegalPending ||
    game.pendingExtraTurnPlayerId ||
    game.pendingSeedSpendObjectivePlayerId
  ) {
    return;
  }

  if (!game.activePlayerId) {
    return;
  }

  const player = findPlayer(game, game.activePlayerId);
  if (!player.speciesId) {
    throw new Error("Jogador ativo sem especie selecionada.");
  }

  const species = speciesDefinitions[player.speciesId];
  const nextActionIndex = game.activeActionIndex + 1;

  if (nextActionIndex < species.actions.length) {
    game.activeActionIndex = nextActionIndex;
    game.log = [
      ...game.log,
      {
        id: `advance_action_${player.playerId}_${nextActionIndex}`,
        message: `${player.name} avancou para a acao ${species.actions[nextActionIndex]}.`,
        createdAt: Date.now()
      }
    ];
    skipAutomaticActionIfNeeded(game);
    return;
  }

  finishPlayerTurn(game, player);
}

function finishPlayerTurn(game: GameState, player: PlayerState): void {
  player.turnsTaken += 1;
  if (applyEndTurnRuleEffects(game, player).paused) {
    return;
  }
  rotateToNextPlayer(game, player);
}

function rotateToNextPlayer(game: GameState, player: PlayerState): void {
  if (game.extraTurnPlayerId === player.playerId) {
    game.activePlayerId = null;
    game.activeActionIndex = 0;
    game.activePlayedForestCardId = null;
    game.pendingCoatiPairBonus = null;
    game.pendingMacawMovedPiece = null;
    game.pendingGaloMovedPiece = null;
    game.pendingGaloAdjacentAdd = null;
    game.pendingWolfMoves = null;
    game.extraTurnPlayerId = null;
    game.log = [
      ...game.log,
      {
        id: `extra_turn_complete_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} concluiu o turno extra.`,
        createdAt: Date.now(),
        payload: { kind: "advance_turn", actorPlayerId: player.playerId }
      }
    ];
    queueEndgameChoiceOrFinalize(game);
    return;
  }

  const currentTurnIndex = game.turnOrder.indexOf(player.playerId);
  const nextTurnIndex = currentTurnIndex >= 0 ? (currentTurnIndex + 1) % game.turnOrder.length : 0;
  const nextPlayerId = game.turnOrder[nextTurnIndex] ?? null;

  game.activePlayerId = nextPlayerId;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingGaloMovedPiece = null;
  game.pendingWolfMoves = null;
  game.cerradoPending = null;
  const startedNewRound = nextTurnIndex === 0;
  if (startedNewRound) {
    game.round += 1;
  }

  game.log = [
    ...game.log,
    {
      id: `advance_turn_${player.playerId}_${player.turnsTaken}`,
      message: `${player.name} concluiu o turno.`,
      createdAt: Date.now()
    }
  ];

  if (game.round > game.maxRounds) {
    queueEndgameChoiceOrFinalize(game);
    return;
  }

  if (startedNewRound) {
    revealThreatForRound(game);
  }
  skipAutomaticActionIfNeeded(game);
}

function queueEndgameChoiceOrFinalize(game: GameState): void {
  const candidate = findNextExtraTurnCandidate(game);
  if (candidate) {
    game.pendingExtraTurnPlayerId = candidate.playerId;
    game.activePlayerId = null;
    game.activeActionIndex = 0;
    game.activePlayedForestCardId = null;
    game.log = [
      ...game.log,
      {
        id: `extra_turn_pending_${candidate.playerId}_${game.log.length + 1}`,
        message: `${candidate.name} pode perder 1 ponto para jogar 1 turno extra.`,
        createdAt: Date.now(),
        payload: { kind: "objective", actorPlayerId: candidate.playerId }
      }
    ];
    return;
  }

  const seedSpendCandidate = findNextSeedSpendObjectiveCandidate(game);
  if (seedSpendCandidate) {
    game.pendingSeedSpendObjectivePlayerId = seedSpendCandidate.player.playerId;
    game.activePlayerId = null;
    game.activeActionIndex = 0;
    game.activePlayedForestCardId = null;
    game.log = [
      ...game.log,
      {
        id: `seed_spend_pending_${seedSpendCandidate.player.playerId}_${game.log.length + 1}`,
        message: `${seedSpendCandidate.player.name} pode gastar ${seedSpendCandidate.spendSeedCount} sementes para ganhar ${seedSpendCandidate.points} pontos.`,
        createdAt: Date.now(),
        payload: { kind: "objective", actorPlayerId: seedSpendCandidate.player.playerId }
      }
    ];
    return;
  }

  applyFinalScoring(game, {
    findPlayer,
    getCardDefinitionOrNull,
    positionKey
  });
}

function findNextSeedSpendObjectiveCandidate(
  game: GameState
): { player: PlayerState; spendSeedCount: number; points: number } | null {
  const resolved = new Set(game.resolvedSeedSpendObjectivePlayerIds ?? []);
  for (const playerId of game.turnOrder) {
    if (resolved.has(playerId)) {
      continue;
    }

    const player = game.players.find((candidate) => candidate.playerId === playerId);
    if (!player?.selectedObjectiveCardId) {
      continue;
    }

    const card = objectiveCardsById.get(player.selectedObjectiveCardId);
    if (!player.speciesId || !card || !canSpeciesReceiveObjective(player.speciesId, card) || card.scoring.kind !== "seed_spend") {
      continue;
    }

    const spendSeedCount = card.scoring.spendSeedCount ?? 3;
    if ((player.resources.seed ?? 0) < spendSeedCount) {
      continue;
    }

    return { player, spendSeedCount, points: card.scoring.points ?? 3 };
  }

  return null;
}

function findNextExtraTurnCandidate(game: GameState): PlayerState | null {
  const resolved = new Set(game.resolvedExtraTurnPlayerIds ?? []);
  for (const playerId of game.turnOrder) {
    if (resolved.has(playerId)) {
      continue;
    }

    const player = game.players.find((candidate) => candidate.playerId === playerId);
    if (!player?.selectedObjectiveCardId || player.score < 1) {
      continue;
    }

    const card = objectiveCardsById.get(player.selectedObjectiveCardId);
    if (card?.scoring.kind === "extra_turn") {
      return player;
    }
  }

  return null;
}

function revealThreatForRound(game: GameState): void {
  if (!(game.enabledMiniExpansions ?? []).includes("threats") || game.status !== "active" || !game.activePlayerId) {
    return;
  }

  if (game.activeThreatCardId) {
    game.threatDiscardIds = [...(game.threatDiscardIds ?? []), game.activeThreatCardId];
  }

  const availableThreatDeckIds = (game.threatDeckIds ?? []).filter(
    (id) => !(game.activeScenarioIds ?? []).includes("pampa") || id !== floodThreatId
  );
  const [nextThreatId, ...remainingThreatIds] = availableThreatDeckIds;
  game.threatDeckIds = remainingThreatIds;
  game.activeThreatCardId = nextThreatId ?? null;

  if (nextThreatId) {
    const threat = threatCards.find((card) => card.id === nextThreatId);
    game.log = [
      ...game.log,
      {
        id: `threat_reveal_${nextThreatId}_round_${game.round}`,
        message: `${threat?.label ?? "Ameaca"} revelada para a rodada ${game.round}.`,
        createdAt: Date.now()
      }
    ];
    return;
  }

  game.log = [
    ...game.log,
    {
      id: `threat_deck_empty_round_${game.round}`,
      message: "Pilha de ameacas esgotada. Nenhuma ameaca sera repetida nesta partida.",
      createdAt: Date.now()
    }
  ];
}

export function resolveExtraTurnObjective(game: GameState, playerId: string, accept: boolean): GameState {
  if (game.status !== "active") {
    throw new Error("Turno extra so pode ser resolvido durante a partida.");
  }

  if (game.pendingExtraTurnPlayerId !== playerId) {
    throw new Error("Nenhum turno extra pendente para este jogador.");
  }

  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);
  next.pendingExtraTurnPlayerId = null;
  next.resolvedExtraTurnPlayerIds = [...new Set([...(next.resolvedExtraTurnPlayerIds ?? []), playerId])];

  if (!accept) {
    next.log = [
      ...next.log,
      {
        id: `extra_turn_declined_${playerId}_${next.log.length + 1}`,
        message: `${player.name} recusou o turno extra.`,
        createdAt: Date.now(),
        payload: { kind: "objective", actorPlayerId: playerId }
      }
    ];
    queueEndgameChoiceOrFinalize(next);
    return next;
  }

  if (player.score < 1) {
    throw new Error("E preciso ter ao menos 1 ponto para comprar o turno extra.");
  }

  player.score -= 1;
  next.extraTurnPlayerId = playerId;
  next.activePlayerId = playerId;
  next.activeActionIndex = 0;
  next.activePlayedForestCardId = null;
  next.pendingCoatiPairBonus = null;
  next.pendingMacawMovedPiece = null;
  next.pendingGaloMovedPiece = null;
  next.pendingWolfMoves = null;
  next.log = [
    ...next.log,
    {
      id: `extra_turn_accept_${playerId}_${next.log.length + 1}`,
      message: `${player.name} perdeu 1 ponto para jogar 1 turno extra.`,
      createdAt: Date.now(),
      payload: { kind: "objective", actorPlayerId: playerId, points: -1 }
    }
  ];
  skipAutomaticActionIfNeeded(next);
  return next;
}

export function resolveSeedSpendObjective(game: GameState, playerId: string, accept: boolean): GameState {
  if (game.status !== "active") {
    throw new Error("Objetivo de sementes so pode ser resolvido durante a partida.");
  }

  if (game.pendingSeedSpendObjectivePlayerId !== playerId) {
    throw new Error("Nenhum objetivo de sementes pendente para este jogador.");
  }

  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);
  const card = player.selectedObjectiveCardId ? objectiveCardsById.get(player.selectedObjectiveCardId) : null;
  if (card?.scoring.kind !== "seed_spend") {
    throw new Error("Objetivo de sementes invalido para este jogador.");
  }

  const spendSeedCount = card.scoring.spendSeedCount ?? 3;
  if (accept && (player.resources.seed ?? 0) < spendSeedCount) {
    throw new Error("Sementes insuficientes para ativar este objetivo.");
  }

  next.pendingSeedSpendObjectivePlayerId = null;
  next.resolvedSeedSpendObjectivePlayerIds = [
    ...new Set([...(next.resolvedSeedSpendObjectivePlayerIds ?? []), playerId])
  ];
  if (accept) {
    next.acceptedSeedSpendObjectivePlayerIds = [
      ...new Set([...(next.acceptedSeedSpendObjectivePlayerIds ?? []), playerId])
    ];
  }

  next.log = [
    ...next.log,
    {
      id: `seed_spend_${accept ? "accepted" : "declined"}_${playerId}_${next.log.length + 1}`,
      message: accept
        ? `${player.name} escolheu gastar ${spendSeedCount} sementes no objetivo final.`
        : `${player.name} recusou gastar sementes no objetivo final.`,
      createdAt: Date.now(),
      payload: { kind: "objective", actorPlayerId: playerId }
    }
  ];

  queueEndgameChoiceOrFinalize(next);
  return next;
}

export function resolveCacaIlegal(
  game: GameState,
  playerId: string,
  choice: { kind: "remove_piece"; pieceId: string } | { kind: "spend_resource"; resource: Resource }
): GameState {
  if (game.status !== "active") {
    throw new Error("Caca ilegal so pode ser resolvida durante a fase ativa.");
  }
  if (!game.cacaIlegalPending || game.cacaIlegalPending.playerId !== playerId) {
    throw new Error("Nenhum efeito de Caca ilegal pendente.");
  }
  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);

  if (choice.kind === "remove_piece") {
    if (!canSpeciesRemovePieceForCacaIlegal(player.speciesId)) {
      throw new Error("A Onca nao pode remover peca por Caca ilegal; gaste um recurso.");
    }
    const piece = next.pieces.find(
      (candidate) => candidate.pieceId === choice.pieceId && candidate.ownerId === playerId && candidate.location
    );
    if (!piece) {
      throw new Error("Peca invalida para remocao.");
    }
    piece.location = null;
    player.piecesInForest = player.piecesInForest.filter((id) => id !== choice.pieceId);
    player.reservePieces = [...player.reservePieces, choice.pieceId];
    if (piece.speciesId === "coati") {
      pruneResolvedCoatiPairBonuses(next, playerId);
    }
    next.log = [
      ...next.log,
      {
        id: `caca_ilegal_remove_${playerId}_${next.log.length + 1}`,
        message: `${player.name} removeu 1 ${player.speciesId ? getSpeciesPieceLogName(player.speciesId) : "peca"} (Caca ilegal).`,
        createdAt: Date.now()
      }
    ];
  } else {
    const top = getCacaIlegalTopResources(next, playerId);
    if (!top.includes(choice.resource)) {
      throw new Error("Recurso invalido: escolha um dos recursos que voce mais possui.");
    }
    player.resources = {
      ...player.resources,
      [choice.resource]: Math.max(0, (player.resources[choice.resource] ?? 0) - 1)
    };
    next.log = [
      ...next.log,
      {
        id: `caca_ilegal_spend_${playerId}_${next.log.length + 1}`,
        message: `${player.name} gastou 1 ${choice.resource} (Caca ilegal).`,
        createdAt: Date.now()
      }
    ];
  }

  next.cacaIlegalPending = null;
  rotateToNextPlayer(next, player);
  return next;
}

function removeFromMataAtlanticaPile(game: GameState, cardId: string): boolean {
  if (!game.mataAtlanticaPiles) return false;
  let removedPileIndex = -1;
  game.mataAtlanticaPiles = game.mataAtlanticaPiles.map((pile, index) => {
    if (removedPileIndex >= 0) return [...pile];
    const idx = pile.indexOf(cardId);
    if (idx < 0) return [...pile];
    removedPileIndex = index;
    return [...pile.slice(0, idx), ...pile.slice(idx + 1)];
  });
  if (removedPileIndex >= 0 && game.deck.commonCardIds.length > 0) {
    const [refillId, ...rest] = game.deck.commonCardIds;
    game.deck = { ...game.deck, commonCardIds: rest };
    game.mataAtlanticaPiles = game.mataAtlanticaPiles.map((pile, index) =>
      index === removedPileIndex ? [...pile, refillId] : pile
    );
  }
  return removedPileIndex >= 0;
}

export function discardMataAtlanticaPileCard(game: GameState, playerId: string, cardId: string): GameState {
  if (game.status !== "active") {
    throw new Error("Descarte da Mata Atlantica so pode acontecer durante a fase ativa.");
  }
  if (game.activePlayerId !== playerId) {
    throw new Error("Apenas o jogador ativo pode descartar uma carta.");
  }
  if (!game.mataAtlanticaPiles) {
    throw new Error("Mata Atlantica nao esta ativa.");
  }
  const pileTops = getMataAtlanticaPileTops(game);
  if (!pileTops.includes(cardId)) {
    throw new Error("Escolha o topo de uma das pilhas para descartar.");
  }
  const player = findPlayer(game, playerId);
  if (!player.speciesId) {
    throw new Error("Jogador sem especie selecionada.");
  }
  if (speciesDefinitions[player.speciesId].usesForestCards) {
    throw new Error("Especies que usam cartas nao descartam na Mata Atlantica; joguem uma carta.");
  }
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  if ((next.mataAtlanticaDiscardByPlayer ?? {})[playerId] === nextPlayer.turnsTaken) {
    throw new Error("Voce ja descartou uma carta da Mata Atlantica neste turno.");
  }
  removeFromMataAtlanticaPile(next, cardId);
  next.mataAtlanticaDiscardByPlayer = {
    ...next.mataAtlanticaDiscardByPlayer,
    [playerId]: nextPlayer.turnsTaken
  };
  const def = getCardDefinitionOrNull(cardId);
  next.log = [
    ...next.log,
    {
      id: `mata_atlantica_discard_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} descartou ${def?.label ?? "carta"} (Mata Atlantica).`,
      createdAt: Date.now()
    }
  ];
  return next;
}

function assertMataAtlanticaDiscarded(game: GameState, playerId: string): void {
  if (mataAtlanticaRequiresDiscard(game, playerId)) {
    throw new Error("Descarte 1 carta de uma das pilhas (Mata Atlantica) antes de agir.");
  }
}

function applyCaatingaTrigger(
  game: GameState,
  playerId: string,
  location: GridPosition,
  trigger: "add" | "remove"
): void {
  if (!(game.activeScenarioIds ?? []).includes("caatinga")) return;
  if (game.activePlayerId !== playerId) return;
  const player = findPlayer(game, playerId);
  if (!player.speciesId) return;
  if ((game.caatingaUsedByPlayer ?? {})[playerId] === game.round) return;
  const card = getForestCardAtPosition(game, location);
  const def = card ? getCardDefinitionOrNull(card.definitionId) : null;
  const resource = def?.resource ?? null;
  if (!resource) return;
  game.caatingaPending = {
    playerId,
    resource,
    location: { x: location.x, y: location.y },
    trigger,
    round: game.round
  };
}

export function collectCaatingaBonus(
  game: GameState,
  playerId: string,
  mode: "gain" | "lose" | "skip" = "gain"
): GameState {
  if (game.status !== "active") {
    throw new Error("Bonus de Caatinga so pode ser coletado durante a fase ativa.");
  }
  if (!game.caatingaPending || game.caatingaPending.playerId !== playerId) {
    throw new Error("Nenhum efeito de Caatinga disponivel.");
  }

  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);
  const pending = next.caatingaPending!;
  if (mode === "skip") {
    next.caatingaPending = null;
    next.log = [
      ...next.log,
      {
        id: `caatinga_skip_${playerId}_${next.log.length + 1}`,
        message: `${player.name} adiou o efeito da Caatinga.`,
        createdAt: Date.now()
      }
    ];
    if (shouldAdvanceAfterScenarioChoice(next, playerId)) {
      advanceActiveAction(next);
    }
    return next;
  }
  const current = player.resources[pending.resource] ?? 0;
  if (mode === "lose" && current <= 0) {
    throw new Error("Sem recurso suficiente para perder em Caatinga.");
  }
  const delta = mode === "gain" ? 1 : -1;
  player.resources = {
    ...player.resources,
    [pending.resource]: current + delta
  };
  next.caatingaUsedByPlayer = { ...next.caatingaUsedByPlayer, [playerId]: pending.round };
  next.caatingaPending = null;
  next.log = [
    ...next.log,
    {
      id: `caatinga_resolve_${playerId}_${next.log.length + 1}`,
      message:
        mode === "gain"
          ? `${player.name} coletou +1 ${pending.resource} (Caatinga).`
          : `${player.name} perdeu 1 ${pending.resource} (Caatinga).`,
      createdAt: Date.now()
    }
  ];
  if (shouldAdvanceAfterScenarioChoice(next, playerId)) {
    advanceActiveAction(next);
  }
  return next;
}

export function collectCerradoBonus(
  game: GameState,
  playerId: string,
  mode: "collect" | "skip" = "collect"
): GameState {
  if (game.status !== "active") {
    throw new Error("Bonus de Cerrado so pode ser resolvido durante a fase ativa.");
  }
  if (!game.cerradoPending || game.cerradoPending.playerId !== playerId) {
    throw new Error("Nenhum efeito de Cerrado disponivel.");
  }

  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);
  const pending = next.cerradoPending!;
  const gain = mode === "collect" ? 2 : 1;
  player.resources = {
    ...player.resources,
    [pending.resource]: (player.resources[pending.resource] ?? 0) + gain
  };

  if (mode === "collect") {
    next.cerradoTriggeredByPlayer = {
      ...(next.cerradoTriggeredByPlayer ?? {}),
      [playerId]: pending.round
    };
  }

  next.cerradoPending = null;
  next.log = [
    ...next.log,
    {
      id: `cerrado_${mode}_${playerId}_${next.log.length + 1}`,
      message:
        mode === "collect"
          ? `${player.name} coletou +2 ${pending.resource} (Cerrado).`
          : `${player.name} guardou o Cerrado para depois e coletou +1 ${pending.resource}.`,
      createdAt: Date.now()
    }
  ];

  if (shouldAdvanceAfterScenarioChoice(next, playerId)) {
    advanceActiveAction(next);
  }
  return next;
}

function shouldAdvanceAfterScenarioChoice(game: GameState, playerId: string): boolean {
  if (game.caatingaPending || game.cerradoPending || game.pendingCoatiPairBonus) {
    return false;
  }
  return !(game.pendingWolfMoves?.playerId === playerId && game.pendingWolfMoves.pieceIds.length > 0);
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

function skipAutomaticActionIfNeeded(game: GameState): void {
  if (!game.activePlayerId) {
    return;
  }

  const player = findPlayer(game, game.activePlayerId);
  const action = getCurrentAction(game);
  if (game.extraTurnPlayerId === player.playerId && shouldSkipExtraTurnCardAction(game, player.playerId)) {
    game.log = [
      ...game.log,
      {
        id: `auto_skip_extra_turn_card_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} pulou automaticamente a acao ${action} do turno extra porque nao havia carta de floresta para jogar.`,
        createdAt: Date.now(),
        payload: { kind: "skip", actorPlayerId: player.playerId, actionId: action ?? undefined }
      }
    ];
    advanceActiveAction(game);
    return;
  }

  if (player.speciesId === "coati" && action === "C" && getRequiredCoatiRemovalCount(game, player.playerId) === 0) {
    game.log = [
      ...game.log,
      {
        id: `auto_skip_coati_C_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} pulou automaticamente a acao C do Quati porque havia 2 ou mais quatis na reserva.`,
        createdAt: Date.now()
      }
    ];
    advanceActiveAction(game);
    return;
  }

  if (player.speciesId === "jaguar" && shouldSkipJaguarMoveAction(game, player.playerId)) {
    game.log = [
      ...game.log,
      {
        id: `auto_skip_jaguar_${action}_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} pulou automaticamente a acao ${action} da Onca porque nao havia destino valido para mover.`,
        createdAt: Date.now()
      }
    ];
    advanceActiveAction(game);
    return;
  }

  if (player.speciesId === "maned_wolf" && shouldSkipWolfBaseAction(game, player.playerId)) {
    game.log = [
      ...game.log,
      {
        id: `auto_skip_wolf_B_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} pulou automaticamente a acao B do Lobo-guara porque nao havia peca de especie de base em local com lobo.`,
        createdAt: Date.now()
      }
    ];
    advanceActiveAction(game);
    return;
  }

  if (player.speciesId === "maned_wolf" && shouldSkipWolfMeatAction(game, player.playerId)) {
    const hasReserveWolves = player.reservePieces.length > 0;
    game.log = [
      ...game.log,
      {
        id: `auto_skip_wolf_D_${player.playerId}_${game.log.length + 1}`,
        message: hasReserveWolves
          ? `${player.name} pulou automaticamente a acao D do Lobo-guara porque nao havia local de carne disponivel.`
          : `${player.name} pulou automaticamente a acao D do Lobo-guara porque nao havia lobos na reserva.`,
        createdAt: Date.now()
      }
    ];
    advanceActiveAction(game);
  }
}

function shouldSkipExtraTurnCardAction(game: GameState, playerId: string): boolean {
  if (getCurrentAction(game) !== "A" || game.activePlayedForestCardId) {
    return false;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player?.speciesId || !speciesDefinitions[player.speciesId].usesForestCards) {
    return false;
  }

  const playableCards = game.mataAtlanticaPiles ? getMataAtlanticaPileTops(game) : player.hand;
  return !playableCards.some((cardId) => getAvailableForestExpansionPositionsForCard(game, cardId).length > 0);
}

function shouldSkipJaguarMoveAction(game: GameState, playerId: string): boolean {
  const action = getCurrentAction(game);
  return (action === "A" || action === "B") && getValidJaguarMovementDestinations(game, playerId).length === 0;
}

function shouldSkipWolfBaseAction(game: GameState, playerId: string): boolean {
  return getCurrentAction(game) === "B" && getWolfRemovableBasePieceIds(game, playerId).length === 0;
}

function shouldSkipWolfMeatAction(game: GameState, playerId: string): boolean {
  return getCurrentAction(game) === "D" && getWolfMeatPlacementPositions(game, playerId).length === 0;
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

function isForestCardRiverConnectionValid(
  game: GameState,
  cardDefinition: ForestCardDefinition,
  location: GridPosition,
  rotation: ForestCardState["rotation"]
): boolean {
  const candidateConnections = getRotatedConnections(cardDefinition, rotation);

  for (const direction of connectionDirections) {
    const offset = directionOffsets[direction];
    const neighbor = getForestCardAtPosition(game, { x: location.x + offset.x, y: location.y + offset.y });
    if (!neighbor) {
      continue;
    }

    const neighborDefinition = getCardDefinitionOrNull(neighbor.definitionId);
    if (!neighborDefinition) {
      return false;
    }

    const neighborConnections = getRotatedConnections(neighborDefinition, neighbor.rotation);
    const candidateHasRiver = candidateConnections[direction] === "river";
    const neighborHasRiver = neighborConnections[oppositeDirection[direction]] === "river";
    if (candidateHasRiver !== neighborHasRiver) {
      return false;
    }
  }

  return true;
}

function getRotatedConnections(cardDefinition: ForestCardDefinition, rotation: ForestCardState["rotation"]): CardConnections {
  const connections = cardDefinition.connections ?? noConnections();
  const rotated = noConnections();
  const steps = rotation / 90;

  for (const direction of connectionDirections) {
    const nextDirection = connectionDirections[(connectionDirections.indexOf(direction) + steps) % connectionDirections.length];
    rotated[nextDirection] = connections[direction];
  }

  return rotated;
}

function noConnections(): CardConnections {
  return {
    north: null,
    east: null,
    south: null,
    west: null
  };
}

function getSurroundingDestinations(game: GameState, origin: GridPosition): GridPosition[] {
  const forestPositions = new Set(game.forest.cards.map((card) => positionKey(card)));

  return surroundingDirections
    .map((direction) => ({ x: origin.x + direction.x, y: origin.y + direction.y }))
    .filter((position) => forestPositions.has(positionKey(position)))
    .sort((a, b) => a.y - b.y || a.x - b.x);
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

function getPlayedForestCardForCurrentAction(game: GameState): ForestCardState | null {
  if (!game.activePlayedForestCardId) {
    return null;
  }

  return (
    [...game.forest.cards]
      .reverse()
      .find((card) => !card.isInitial && card.definitionId === game.activePlayedForestCardId) ?? null
  );
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

function findFirstForestSiteWithResource(game: GameState, location: GridPosition, resource: Resource): ForestCardSiteDefinition | null {
  return getForestSitesAtPosition(game, location).find((siteState) => siteState.site.resource === resource)?.site ?? null;
}

function findFirstForestSiteWithHabitat(game: GameState, location: GridPosition, habitat: Habitat): ForestCardSiteDefinition | null {
  return getForestSitesAtPosition(game, location).find((siteState) => siteState.site.habitat === habitat)?.site ?? null;
}

function createPieceLocation(game: GameState, location: GridPosition, siteId = defaultCardSiteId): PieceLocation {
  const site = getForestSiteOccupancy(game, location, siteId);
  if (!site) {
    throw new Error("Local interno da carta nao encontrado.");
  }

  if (site.isAtCapacity) {
    throw new Error("Local interno da carta ja esta ocupado no limite permitido.");
  }

  return {
    x: location.x,
    y: location.y,
    siteId
  };
}

function queuePendingCoatiPairBonus(game: GameState, playerId: string, enteredLocation: GridPosition): boolean {
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

function pruneResolvedCoatiPairBonuses(game: GameState, playerId: string): void {
  const currentPairKeys = getCurrentCoatiPairKeys(game, playerId);
  game.resolvedCoatiPairBonuses = game.resolvedCoatiPairBonuses.filter((pairKey) => {
    if (!pairKey.startsWith(`${playerId}:`)) {
      return true;
    }

    return currentPairKeys.has(pairKey);
  });
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

function getJaguarPieceInForest(game: GameState, playerId: string): PieceState | null {
  return game.pieces.find((piece) => piece.ownerId === playerId && piece.speciesId === "jaguar" && piece.location) ?? null;
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
