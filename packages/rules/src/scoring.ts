import {
  commonForestCards,
  initialForestCardCandidates,
  objectiveCardsById,
  speciesDefinitions
} from "@oikos/content";
import type {
  FinalScoreBreakdown,
  FinalScoreEntry,
  ForestCardDefinition,
  ForestCardState,
  GameState,
  GridPosition,
  ObjectiveCardDefinition,
  PlayerState,
  Resource,
  SpeciesId
} from "@oikos/shared";
import { gridPositionKey } from "@oikos/shared";

export interface FinalScoringDeps {
  findPlayer: (game: GameState, playerId: string) => PlayerState;
  getCardDefinitionOrNull: (definitionId: string) => ForestCardDefinition | null;
  positionKey: (position: GridPosition) => string;
}

const RESOURCE_MAJORITY_POINTS = 1;
const SEEDS_PER_POINT = 2;
const MAJORITY_RESOURCES: Resource[] = ["meat", "egg", "fruit"];
const ALL_RESOURCES: Resource[] = ["meat", "egg", "fruit", "seed"];
type ResourceSnapshot = Map<string, Record<Resource, number>>;

export function canSpeciesReceiveObjective(speciesId: SpeciesId, card: ObjectiveCardDefinition): boolean {
  const category = speciesDefinitions[speciesId].category;
  if (category === "subpredator") {
    return card.eligibleCategories.includes("predator") || card.eligibleCategories.includes("middle");
  }

  return card.eligibleCategories.includes(category);
}

function applyPantanalScenario(game: GameState, deps: FinalScoringDeps): void {
  for (const player of game.players) {
    if (player.hand.length === 0) {
      player.resources = {
        ...player.resources,
        seed: (player.resources.seed ?? 0) + 1
      };
      game.log = [
        ...game.log,
        {
          id: `pantanal_no_card_${player.playerId}_${game.log.length + 1}`,
          message: `${player.name} sem cartas na mão (Pantanal): +1 semente.`,
          createdAt: Date.now()
        }
      ];
      continue;
    }
    const cardId = player.hand[0];
    player.hand = player.hand.slice(1);
    const definition = deps.getCardDefinitionOrNull(cardId);
    const resource = definition?.resource ?? null;
    if (!resource) {
      game.log = [
        ...game.log,
        {
          id: `pantanal_reveal_${player.playerId}_${game.log.length + 1}`,
          message: `${player.name} revelou ${definition?.label ?? "carta"} (Pantanal): sem recurso para adicionar.`,
          createdAt: Date.now()
        }
      ];
      continue;
    }
    player.resources[resource] = (player.resources[resource] ?? 0) + 2;
    game.log = [
      ...game.log,
      {
        id: `pantanal_reveal_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} revelou ${definition?.label ?? "carta"} (Pantanal): +2 ${resource}.`,
        createdAt: Date.now()
      }
    ];
  }
}

function getObjectivePointsForTurn(
  game: GameState,
  player: PlayerState,
  deps: FinalScoringDeps,
  resourceSnapshot: ResourceSnapshot = createResourceSnapshot(game),
  spendResources = false
): number {
  if (!player.speciesId || !player.selectedObjectiveCardId) {
    return 0;
  }

  const card = objectiveCardsById.get(player.selectedObjectiveCardId);
  if (!card || !canSpeciesReceiveObjective(player.speciesId, card)) {
    return 0;
  }

  switch (card.scoring.kind) {
    case "removed_species": {
      const removedSpeciesCount = getRemovedSpeciesCount(game, player.playerId);
      return removedSpeciesCount >= 3 ? 2 : removedSpeciesCount >= 2 ? 1 : 0;
    }

    case "resource_majority": {
      return card.scoring.resource
        ? getResourceMajorityObjectivePoints(game, resourceSnapshot, player.playerId, card.scoring.resource)
        : 0;
    }

    case "seed_spend": {
      if (!(game.acceptedSeedSpendObjectivePlayerIds ?? []).includes(player.playerId)) {
        return 0;
      }
      return getSeedSpendObjectivePoints(
        player,
        resourceSnapshot,
        spendResources,
        card.scoring.spendSeedCount ?? 3,
        card.scoring.points ?? 3
      );
    }

    case "resource_majority_count": {
      return getResourceMajorityCount(game, resourceSnapshot, player.playerId);
    }

    case "habitat_line": {
      if (!card.scoring.habitat) {
        return 0;
      }

      return Math.min(
        card.scoring.maxPoints ?? 2,
        countLines(
          game,
          (forestCard) => deps.getCardDefinitionOrNull(forestCard.definitionId)?.habitat === card.scoring.habitat,
          Boolean(card.scoring.diagonalsOnly),
          card.scoring.minLength ?? 3,
          deps
        )
      );
    }

    case "resource_line": {
      if (!card.scoring.resource) {
        return 0;
      }

      return Math.min(
        card.scoring.maxPoints ?? 2,
        countLines(
          game,
          (forestCard) => deps.getCardDefinitionOrNull(forestCard.definitionId)?.resource === card.scoring.resource,
          false,
          card.scoring.minLength ?? 3,
          deps
        )
      );
    }

    case "missing_resources": {
      return Math.min(
        card.scoring.maxPoints ?? 2,
        ALL_RESOURCES.filter((resource) => getResourceCount(resourceSnapshot, player.playerId, resource) === 0).length
      );
    }

    case "resource_square": {
      return Math.min(card.scoring.maxPoints ?? 2, countResourceSquares(game, deps));
    }

    case "connected_river": {
      return Math.min(card.scoring.maxPoints ?? 2, countConnectedRivers(game, card.scoring.minLength ?? 4, deps));
    }

    case "pieces_in_forest": {
      const totalPieces = speciesDefinitions[player.speciesId].totalPieces;
      const inForest = player.piecesInForest.length;
      return (inForest > totalPieces / 2 ? 1 : 0) + (inForest === totalPieces ? 1 : 0);
    }

    case "discard_for_resources":
    case "extra_turn":
      return 0;
  }
}

const CONNECTION_DIRECTIONS = ["north", "east", "south", "west"] as const;
type ConnectionSide = (typeof CONNECTION_DIRECTIONS)[number];
const CONNECTION_OFFSETS: Record<ConnectionSide, GridPosition> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 }
};
const OPPOSITE_SIDE: Record<ConnectionSide, ConnectionSide> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east"
};

function getRotatedConnectionSides(
  definition: ForestCardDefinition,
  rotation: ForestCardState["rotation"]
): Record<ConnectionSide, boolean> {
  const connections = definition.connections;
  const steps = (rotation / 90) % CONNECTION_DIRECTIONS.length;
  const rotated: Record<ConnectionSide, boolean> = { north: false, east: false, south: false, west: false };
  if (!connections) {
    return rotated;
  }
  for (let i = 0; i < CONNECTION_DIRECTIONS.length; i += 1) {
    const from = CONNECTION_DIRECTIONS[i];
    const to = CONNECTION_DIRECTIONS[(i + steps) % CONNECTION_DIRECTIONS.length];
    rotated[to] = connections[from] === "river";
  }
  return rotated;
}

// Counts "rivers" (connected components of river-habitat cards whose water
// mouths actually meet) with at least `minLength` cards. Two orthogonally
// adjacent river cards belong to the same river only when both expose a river
// mouth on the shared border — adjacency through land sides does not connect.
function countConnectedRivers(game: GameState, minLength: number, deps: FinalScoringDeps): number {
  const riverCards = game.forest.cards.filter(
    (card) => deps.getCardDefinitionOrNull(card.definitionId)?.habitat === "river"
  );
  const byPos = new Map(riverCards.map((card) => [deps.positionKey(card), card]));
  const sidesByPos = new Map(
    riverCards.map((card) => {
      const definition = deps.getCardDefinitionOrNull(card.definitionId)!;
      return [deps.positionKey(card), getRotatedConnectionSides(definition, card.rotation)];
    })
  );

  const visited = new Set<string>();
  let count = 0;

  for (const start of riverCards) {
    const startKey = deps.positionKey(start);
    if (visited.has(startKey)) {
      continue;
    }

    let size = 0;
    const stack = [startKey];
    visited.add(startKey);
    while (stack.length > 0) {
      const key = stack.pop()!;
      const card = byPos.get(key)!;
      const sides = sidesByPos.get(key)!;
      size += 1;

      for (const side of CONNECTION_DIRECTIONS) {
        if (!sides[side]) {
          continue;
        }
        const offset = CONNECTION_OFFSETS[side];
        const neighborKey = deps.positionKey({ x: card.x + offset.x, y: card.y + offset.y });
        if (visited.has(neighborKey)) {
          continue;
        }
        const neighborSides = sidesByPos.get(neighborKey);
        if (neighborSides?.[OPPOSITE_SIDE[side]]) {
          visited.add(neighborKey);
          stack.push(neighborKey);
        }
      }
    }

    if (size >= minLength) {
      count += 1;
    }
  }

  return count;
}

// Self-contained scoring deps so callers (e.g. the web HUD) can probe objective
// progress without wiring the rules engine's internal helpers.
function createDefaultScoringDeps(): FinalScoringDeps {
  return {
    findPlayer: (game, playerId) => {
      const found = game.players.find((player) => player.playerId === playerId);
      if (!found) {
        throw new Error(`Player ${playerId} not found`);
      }
      return found;
    },
    getCardDefinitionOrNull: (definitionId) =>
      commonForestCards.find((card) => card.id === definitionId) ??
      initialForestCardCandidates.find((card) => card.id === definitionId) ??
      null,
    positionKey: gridPositionKey
  };
}

/**
 * Points the player's selected objective would currently award if the turn
 * ended now. Non-mutating (never spends resources). 0 = not yet fulfilled.
 */
export function getObjectiveProgressPoints(game: GameState, playerId: string): number {
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player) {
    return 0;
  }
  return getObjectivePointsForTurn(game, player, createDefaultScoringDeps(), createResourceSnapshot(game), false);
}

/** True when the selected objective is currently satisfied (would score > 0). */
export function isObjectiveCompleted(game: GameState, playerId: string): boolean {
  return getObjectiveProgressPoints(game, playerId) > 0;
}

function createResourceSnapshot(game: GameState): ResourceSnapshot {
  return new Map(
    game.players.map((player) => [
      player.playerId,
      {
        meat: player.resources.meat ?? 0,
        egg: player.resources.egg ?? 0,
        fruit: player.resources.fruit ?? 0,
        seed: player.resources.seed ?? 0
      }
    ])
  );
}

function getResourceCount(resourceSnapshot: ResourceSnapshot, playerId: string, resource: Resource): number {
  return resourceSnapshot.get(playerId)?.[resource] ?? 0;
}

function getSeedSpendObjectivePoints(
  player: PlayerState,
  resourceSnapshot: ResourceSnapshot,
  spendResources: boolean,
  spendSeedCount: number,
  points: number
): number {
  if (getResourceCount(resourceSnapshot, player.playerId, "seed") < spendSeedCount) {
    return 0;
  }

  if (spendResources) {
    const snapshotResources = resourceSnapshot.get(player.playerId);
    if (snapshotResources) {
      resourceSnapshot.set(player.playerId, {
        ...snapshotResources,
        seed: Math.max(0, snapshotResources.seed - spendSeedCount)
      });
    }
    player.resources = {
      ...player.resources,
      seed: Math.max(0, (player.resources.seed ?? 0) - spendSeedCount)
    };
  }

  return points;
}

function getRemovedSpeciesCount(game: GameState, playerId: string): number {
  const species = new Set<SpeciesId>();
  for (const entry of game.log) {
    if (entry.payload?.kind !== "remove_piece" || entry.payload.actorPlayerId !== playerId) {
      continue;
    }

    for (const pieceId of entry.payload.pieceIds ?? []) {
      const piece = game.pieces.find((candidate) => candidate.pieceId === pieceId);
      if (piece?.speciesId) {
        species.add(piece.speciesId);
      }
    }
  }

  return species.size;
}

function getResourceMajorityCount(game: GameState, resourceSnapshot: ResourceSnapshot, playerId: string): number {
  return MAJORITY_RESOURCES.filter((resource) => getResourceMajorityObjectivePoints(game, resourceSnapshot, playerId, resource) > 0).length;
}

function getResourceMajorityObjectivePoints(
  game: GameState,
  resourceSnapshot: ResourceSnapshot,
  playerId: string,
  resource: Resource
): number {
  const count = getResourceCount(resourceSnapshot, playerId, resource);
  if (count <= 0) {
    return 0;
  }

  const top = game.players.reduce((max, candidate) => Math.max(max, getResourceCount(resourceSnapshot, candidate.playerId, resource)), 0);
  if (count < top) {
    return 0;
  }

  const tied = game.players.filter((candidate) => getResourceCount(resourceSnapshot, candidate.playerId, resource) === top).length;
  return tied === 1 ? 2 : 1;
}

function countLines(
  game: GameState,
  matches: (card: ForestCardState) => boolean,
  diagonalsOnly: boolean,
  minLength: number,
  deps: FinalScoringDeps
): number {
  const positions = new Set(game.forest.cards.filter(matches).map((card) => deps.positionKey(card)));
  const directions = diagonalsOnly
    ? [
        { x: 1, y: 1 },
        { x: 1, y: -1 }
      ]
    : [
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ];
  let count = 0;

  for (const card of game.forest.cards) {
    if (!positions.has(deps.positionKey(card))) {
      continue;
    }

    for (const direction of directions) {
      const before = { x: card.x - direction.x, y: card.y - direction.y };
      if (positions.has(deps.positionKey(before))) {
        continue;
      }

      let length = 0;
      let cursor = { x: card.x, y: card.y };
      while (positions.has(deps.positionKey(cursor))) {
        length += 1;
        cursor = { x: cursor.x + direction.x, y: cursor.y + direction.y };
      }

      if (length >= minLength) {
        count += 1;
      }
    }
  }

  return count;
}

function countResourceSquares(game: GameState, deps: FinalScoringDeps): number {
  const cardsByPosition = new Map(game.forest.cards.map((card) => [deps.positionKey(card), card]));
  let count = 0;

  for (const card of game.forest.cards) {
    const square = [
      card,
      cardsByPosition.get(deps.positionKey({ x: card.x + 1, y: card.y })),
      cardsByPosition.get(deps.positionKey({ x: card.x, y: card.y + 1 })),
      cardsByPosition.get(deps.positionKey({ x: card.x + 1, y: card.y + 1 }))
    ];
    if (square.some((candidate) => !candidate)) {
      continue;
    }

    const resources = square.map((candidate) => deps.getCardDefinitionOrNull(candidate!.definitionId)?.resource);
    if (new Set(resources).size === 4 && resources.every(Boolean)) {
      count += 1;
    }
  }

  return count;
}

function getPopulationValue(speciesId: SpeciesId | null): number {
  return speciesId ? speciesDefinitions[speciesId].totalPieces : 0;
}

export function applyFinalScoring(game: GameState, deps: FinalScoringDeps): void {
  const scenarioIds = new Set(game.activeScenarioIds ?? []);

  if (scenarioIds.has("pantanal")) {
    applyPantanalScenario(game, deps);
  }

  const amazoniaActive = scenarioIds.has("amazonia");
  const resourceSnapshot = createResourceSnapshot(game);

  const resourceMajorities = MAJORITY_RESOURCES.map((resource) => {
    const topCount = game.players.reduce((max, player) => Math.max(max, player.resources[resource] ?? 0), 0);
    const winnerPlayerIds =
      topCount > 0
        ? game.players.filter((player) => (player.resources[resource] ?? 0) === topCount).map((player) => player.playerId)
        : [];

    const pointsEach = amazoniaActive
      ? winnerPlayerIds.length === 1
        ? 2
        : 1
      : RESOURCE_MAJORITY_POINTS;

    return {
      resource,
      topCount,
      winnerPlayerIds,
      pointsEach
    };
  });

  const majorityPointsByPlayer = new Map<string, number>();
  const scenarioPointsByPlayer = new Map<string, number>();
  for (const majority of resourceMajorities) {
    for (const winnerId of majority.winnerPlayerIds) {
      majorityPointsByPlayer.set(winnerId, (majorityPointsByPlayer.get(winnerId) ?? 0) + RESOURCE_MAJORITY_POINTS);
      scenarioPointsByPlayer.set(
        winnerId,
        (scenarioPointsByPlayer.get(winnerId) ?? 0) + Math.max(0, majority.pointsEach - RESOURCE_MAJORITY_POINTS)
      );
      deps.findPlayer(game, winnerId).resources[majority.resource] = 0;
    }
  }

  const pointCap = game.players.length >= 4 ? 20 : 21;

  const entries: FinalScoreEntry[] = game.players.map((player) => {
    const baseScore = player.score;
    const objectivePoints = getObjectivePointsForTurn(game, player, deps, resourceSnapshot, true);
    const scenarioPoints = scenarioPointsByPlayer.get(player.playerId) ?? 0;
    const resourceMajorityPoints = majorityPointsByPlayer.get(player.playerId) ?? 0;

    const seeds = player.resources.seed ?? 0;
    const seedPoints = Math.floor(seeds / SEEDS_PER_POINT);
    player.resources.seed = seeds - seedPoints * SEEDS_PER_POINT;

    const remainingResources = ALL_RESOURCES.reduce((sum, resource) => sum + (player.resources[resource] ?? 0), 0);
    const rawScore = baseScore + objectivePoints + scenarioPoints + resourceMajorityPoints + seedPoints;
    const totalScore = Math.min(rawScore, pointCap);
    player.score = totalScore;

    return {
      playerId: player.playerId,
      name: player.name,
      speciesId: player.speciesId,
      baseScore,
      objectivePoints,
      scenarioPoints,
      resourceMajorityPoints,
      seedPoints,
      totalScore,
      remainingResources,
      populationValue: getPopulationValue(player.speciesId)
    };
  });

  const ranked = [...entries].sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      b.remainingResources - a.remainingResources ||
      b.populationValue - a.populationValue
  );
  const best = ranked[0];
  const winnerPlayerIds = best
    ? ranked
        .filter(
          (entry) =>
            entry.totalScore === best.totalScore &&
            entry.remainingResources === best.remainingResources &&
            entry.populationValue === best.populationValue
        )
        .map((entry) => entry.playerId)
        .sort()
    : [];

  const breakdown: FinalScoreBreakdown = { resourceMajorities, entries, pointCap };
  game.finalScoreBreakdown = breakdown;
  game.winnerPlayerIds = winnerPlayerIds;
  game.activePlayerId = null;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.cerradoPending = null;
  game.pendingExtraTurnPlayerId = null;
  game.pendingSeedSpendObjectivePlayerId = null;
  game.status = "finished";

  const winnerNames = game.players
    .filter((player) => winnerPlayerIds.includes(player.playerId))
    .map((player) => player.name);
  const outcomeMessage =
    winnerNames.length === 0
      ? "Partida encerrada sem vencedor."
      : winnerNames.length === 1
        ? `Partida encerrada. Vencedor: ${winnerNames[0]}.`
        : `Partida encerrada. Empate entre: ${winnerNames.join(", ")}.`;

  game.log = [
    ...game.log,
    {
      id: `game_finished_${game.round}_${game.log.length + 1}`,
      message: `${outcomeMessage} Pontuação final aplicada com maioria de recursos.`,
      createdAt: Date.now()
    }
  ];
}
