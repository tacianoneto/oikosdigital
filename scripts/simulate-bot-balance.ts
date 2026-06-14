import { createInitialGameState, forceEndPlayerTurn, playBotStep } from "@oikos/rules";
import { speciesDefinitions } from "@oikos/content";
import type { FinalScoreEntry, RoomPlayer, SpeciesId } from "@oikos/shared";

const speciesIds: SpeciesId[] = [
  "jaguar",
  "maned_wolf",
  "armadillo",
  "macaw",
  "galo_de_campina",
  "capuchin",
  "coati"
];

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

type SpeciesStats = {
  appearances: number;
  outrightWins: number;
  tiedWins: number;
  winShares: number;
  topScoreFinishes: number;
  scores: number[];
  placements: number[];
  baseScores: number[];
  majorityPoints: number[];
  seedPoints: number[];
  populationValues: number[];
};

const stats = new Map<SpeciesId, SpeciesStats>(
  speciesIds.map((speciesId) => [
    speciesId,
    {
      appearances: 0,
      outrightWins: 0,
      tiedWins: 0,
      winShares: 0,
      topScoreFinishes: 0,
      scores: [],
      placements: [],
      baseScores: [],
      majorityPoints: [],
      seedPoints: [],
      populationValues: []
    }
  ])
);

const games: Array<{
  game: number;
  excluded: SpeciesId;
  winners: SpeciesId[];
  scores: Record<string, number>;
  steps: number;
  fallbacks: number;
}> = [];

let totalFallbacks = 0;

for (let gameIndex = 0; gameIndex < 20; gameIndex += 1) {
  const excluded = speciesIds[gameIndex % speciesIds.length];
  const participating = speciesIds.filter((speciesId) => speciesId !== excluded);
  const players: RoomPlayer[] = participating.map((speciesId) => ({
    playerId: speciesId,
    name: speciesDefinitions[speciesId].displayName,
    speciesId,
    ready: true,
    connected: true,
    isBot: true
  }));

  const random = seededRandom(0x0a110000 + gameIndex * 7919);
  const originalRandom = Math.random;
  Math.random = random;

  let game = createInitialGameState(`balance-${gameIndex + 1}`, players, random);
  let steps = 0;
  let fallbacks = 0;

  try {
    while (game.status !== "finished" && steps < 20000) {
      steps += 1;
      const playerId = game.status === "setup" ? game.setupActivePlayerId : game.activePlayerId;
      if (!playerId) {
        throw new Error(`Partida ${gameIndex + 1} sem jogador ativo em ${game.status}.`);
      }

      try {
        game = playBotStep(game, playerId);
      } catch {
        fallbacks += 1;
        game = forceEndPlayerTurn(game, playerId, "timeout");
      }
    }
  } finally {
    Math.random = originalRandom;
  }

  if (game.status !== "finished" || !game.finalScoreBreakdown) {
    throw new Error(`Partida ${gameIndex + 1} travou após ${steps} passos.`);
  }

  totalFallbacks += fallbacks;
  const entries = game.finalScoreBreakdown.entries;
  const topScore = Math.max(...entries.map((entry) => entry.totalScore));
  const orderedScores = [...new Set(entries.map((entry) => entry.totalScore))].sort((a, b) => b - a);
  const winnerSpecies = game.winnerPlayerIds
    .map((playerId) => entries.find((entry) => entry.playerId === playerId)?.speciesId)
    .filter((speciesId): speciesId is SpeciesId => Boolean(speciesId));

  for (const entry of entries) {
    const speciesId = entry.speciesId;
    if (!speciesId) continue;
    const speciesStats = stats.get(speciesId)!;
    speciesStats.appearances += 1;
    speciesStats.scores.push(entry.totalScore);
    speciesStats.placements.push(orderedScores.indexOf(entry.totalScore) + 1);
    speciesStats.baseScores.push(entry.baseScore);
    speciesStats.majorityPoints.push(entry.resourceMajorityPoints);
    speciesStats.seedPoints.push(entry.seedPoints);
    speciesStats.populationValues.push(entry.populationValue);
    if (entry.totalScore === topScore) speciesStats.topScoreFinishes += 1;
  }

  for (const speciesId of winnerSpecies) {
    const speciesStats = stats.get(speciesId)!;
    if (winnerSpecies.length === 1) speciesStats.outrightWins += 1;
    else speciesStats.tiedWins += 1;
    speciesStats.winShares += 1 / winnerSpecies.length;
  }

  games.push({
    game: gameIndex + 1,
    excluded,
    winners: winnerSpecies,
    scores: Object.fromEntries(entries.map((entry) => [entry.speciesId ?? entry.playerId, entry.totalScore])),
    steps,
    fallbacks
  });
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

const summary = speciesIds
  .map((speciesId) => {
    const value = stats.get(speciesId)!;
    return {
      speciesId,
      name: speciesDefinitions[speciesId].displayName,
      appearances: value.appearances,
      outrightWins: value.outrightWins,
      tiedWins: value.tiedWins,
      winShares: Number(value.winShares.toFixed(2)),
      winRate: Number(((value.winShares / value.appearances) * 100).toFixed(1)),
      topScoreFinishes: value.topScoreFinishes,
      topScoreRate: Number(((value.topScoreFinishes / value.appearances) * 100).toFixed(1)),
      averageScore: Number(average(value.scores).toFixed(2)),
      medianScore: Number(median(value.scores).toFixed(2)),
      scoreStdDev: Number(standardDeviation(value.scores).toFixed(2)),
      minScore: Math.min(...value.scores),
      maxScore: Math.max(...value.scores),
      averagePlacement: Number(average(value.placements).toFixed(2)),
      averageBaseScore: Number(average(value.baseScores).toFixed(2)),
      averageMajorityPoints: Number(average(value.majorityPoints).toFixed(2)),
      averageSeedPoints: Number(average(value.seedPoints).toFixed(2)),
      averagePopulationValue: Number(average(value.populationValues).toFixed(2))
    };
  })
  .sort((a, b) => b.winRate - a.winRate || b.averageScore - a.averageScore);

console.log(JSON.stringify({ totalGames: games.length, totalFallbacks, summary, games }, null, 2));
