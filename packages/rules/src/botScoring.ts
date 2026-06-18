import { getForestCardDefinition, speciesDefinitions } from "@oikos/content";
import { gridPositionKey, parseGridPositionKey } from "@oikos/shared";
import type { ActionId, GameState, GridPosition, Habitat, Resource, SpeciesId } from "@oikos/shared";
import { getSpeciesBotScoringProfile } from "./speciesBotProfiles";

export function hasReserve(game: GameState, playerId: string): boolean {
  return Boolean(game.players.find((player) => player.playerId === playerId)?.reservePieces.length);
}

export function pickPosition(game: GameState, speciesId: SpeciesId, positions: GridPosition[]): GridPosition {
  const ranked = rankPositions(game, speciesId, positions);
  if (ranked.length === 0) {
    throw new Error("Bot nao encontrou alvo valido.");
  }

  return chooseCandidatePool(ranked.map((position) => ({ ...position, score: scorePosition(game, speciesId, position) })))[0];
}

function rankPositions(game: GameState, speciesId: SpeciesId, positions: GridPosition[]): GridPosition[] {
  return positions
    .map((position) => ({ ...position, score: scorePosition(game, speciesId, position) }))
    .sort((a, b) => b.score - a.score)
    .map(({ x, y }) => ({ x, y }));
}

export function rankSetupPositions(game: GameState, playerId: string, speciesId: SpeciesId, positions: GridPosition[]): GridPosition[] {
  return positions
    .map((position) => ({ ...position, score: scoreSetupPosition(game, playerId, speciesId, position) }))
    .sort((a, b) => b.score - a.score)
    .map(({ x, y }) => ({ x, y }));
}

export function pickCapuchinStackTarget(game: GameState, playerId: string, positions: GridPosition[]): GridPosition {
  const ranked = positions
    .map((position) => ({ ...position, score: scoreCapuchinStackTarget(game, playerId, position) }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    throw new Error("Bot nao encontrou alvo valido.");
  }

  return ranked[0];
}

export function scoreCardPlacement(game: GameState, playerId: string, speciesId: SpeciesId, cardId: string, position: GridPosition): number {
  const definition = getForestCardDefinition(cardId);
  const resourceScore = scoreResource(speciesId, definition.resource);
  const boardGrowthScore = adjacencyScore(game, position) * 1.5 - expansionCrowdingScore(game, position);
  const speciesPlanScore = scoreCardPlacementPlan(game, playerId, speciesId, cardId, position, definition.habitat);

  return resourceScore + boardGrowthScore + speciesPlanScore + Math.random() * 0.75;
}

function scoreCardPlacementPlan(
  game: GameState,
  playerId: string,
  speciesId: SpeciesId,
  cardId: string,
  position: GridPosition,
  habitat: Habitat | null
): number {
  return getSpeciesBotScoringProfile(speciesId).cardPlacementScoring.reduce((score, scoringKind) => {
    switch (scoringKind) {
      case "macaw_line":
        return score + scoreMacawLinePotential(game, playerId, position, cardId);
      case "capuchin_habitat":
        return score + scoreCapuchinHabitatPotential(game, playerId, position, habitat);
      case "armadillo_sharing":
      case "coati_pair":
      case "galo_field":
      case "jaguar_capture":
      case "wolf_pack":
        return score;
    }
  }, 0);
}

export function scorePosition(game: GameState, speciesId: SpeciesId, position: GridPosition): number {
  const card = game.forest.cards.find((candidate) => candidate.x === position.x && candidate.y === position.y);
  const definition = card ? getForestCardDefinition(card.definitionId) : null;
  const playerId = game.activePlayerId ?? game.setupActivePlayerId ?? "";
  return (
    scoreResource(speciesId, definition?.resource ?? null) +
    adjacencyScore(game, position) * 1.25 +
    scoreSpeciesPlan(game, playerId, speciesId, position, definition?.habitat ?? null) -
    crowdingPenalty(game, playerId, speciesId, position) +
    Math.random() * 0.75
  );
}

function scoreSetupPosition(game: GameState, playerId: string, speciesId: SpeciesId, position: GridPosition): number {
  const card = game.forest.cards.find((candidate) => candidate.x === position.x && candidate.y === position.y);
  const definition = card ? getForestCardDefinition(card.definitionId) : null;
  const ownCount = ownSpeciesPiecesAt(game, playerId, speciesId, position);
  const totalCount = piecesAt(game, position).length;
  const ownAdjacent = adjacentOwnSpeciesCount(game, playerId, speciesId, position);
  const base =
    scoreResource(speciesId, definition?.resource ?? null) +
    scoreSpeciesPlan(game, playerId, speciesId, position, definition?.habitat ?? null) +
    ownAdjacent * getSpeciesBotScoringProfile(speciesId).setupAdjacencyWeight;

  return base - ownCount * 18 - Math.max(0, totalCount - ownCount) * 2.5 + Math.random() * 0.5;
}

function scoreSpeciesPlan(
  game: GameState,
  playerId: string,
  speciesId: SpeciesId,
  position: GridPosition,
  habitat: Habitat | null
): number {
  switch (getSpeciesBotScoringProfile(speciesId).planScoring) {
    case "macaw_line":
      return scoreMacawLinePotential(game, playerId, position);
    case "galo_field":
      return habitat === "field" ? 42 : 0;
    case "capuchin_habitat":
      return scoreCapuchinHabitatPotential(game, playerId, position, habitat);
    case "coati_pair":
      return scoreCoatiPairPotential(game, playerId, position);
    case "armadillo_sharing":
      return scoreArmadilloSharingPotential(game, playerId, position);
    case "jaguar_capture":
      return piecesAt(game, position).some((piece) => piece.ownerId !== playerId && !piece.state.hidden) ? 10 : 0;
    case "wolf_pack":
      return adjacentOwnSpeciesCount(game, playerId, speciesId, position) * 2;
    case null:
      return 0;
  }
}

export function scoreMove(game: GameState, playerId: string, speciesId: SpeciesId, pieceId: string, position: GridPosition): number {
  const card = game.forest.cards.find((candidate) => candidate.x === position.x && candidate.y === position.y);
  const habitat = card ? getForestCardDefinition(card.definitionId).habitat : null;
  const base = scorePosition(game, speciesId, position);

  const moveScoring = getSpeciesBotScoringProfile(speciesId).moveScoring;

  if (moveScoring.includes("macaw")) {
    return base + scoreMacawMove(game, playerId, pieceId, position);
  }

  if (moveScoring.includes("capuchin")) {
    return base + scoreCapuchinMove(game, playerId, pieceId, position, habitat);
  }

  if (moveScoring.includes("armadillo")) {
    return base + scoreArmadilloMove(game, playerId, pieceId, position);
  }

  if (moveScoring.includes("jaguar")) {
    return base + scoreJaguarMove(game, playerId, position, habitat);
  }

  if (moveScoring.includes("wolf")) {
    return base + scoreWolfMove(game, playerId, position);
  }

  return base;
}

function scoreWolfMove(game: GameState, playerId: string, position: GridPosition): number {
  const resource = getResourceAt(game, position);
  if (!resource) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const have = player?.resources[resource] ?? 0;
  // Lobo pontua gastando tipos de recurso DIFERENTES; prioriza coletar o
  // recurso que ele tem em menor quantidade (0 = prioridade maxima).
  return Math.max(0, 60 - have * 22);
}

function scoreJaguarMove(game: GameState, playerId: string, position: GridPosition, habitat: Habitat | null): number {
  void habitat;
  const card = game.forest.cards.find((candidate) => candidate.x === position.x && candidate.y === position.y);
  const definition = card ? getForestCardDefinition(card.definitionId) : null;
  const canCapture = game.pieces.some(
    (piece) => piece.ownerId !== playerId && !piece.state.hidden && piece.location?.x === position.x && piece.location.y === position.y
  );
  const isMeatCard = definition?.resource === "meat";
  // Prioridade da Onca: 1) remover peca (captura), 2) ir para carta de carne.
  return (canCapture ? 120 : 0) + (isMeatCard ? 70 : 0);
}

function scoreMacawLinePotential(game: GameState, playerId: string, position: GridPosition, placedCardId?: string): number {
  const card = placedCardId
    ? { definitionId: placedCardId }
    : game.forest.cards.find((candidate) => candidate.x === position.x && candidate.y === position.y);
  const definition = card ? getForestCardDefinition(card.definitionId) : null;
  const ownKeys = new Set(
    game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "macaw" && piece.location)
      .map((piece) => gridPositionKey(piece.location!))
  );
  const beforeTriples = countLineTriples(ownKeys);
  ownKeys.add(gridPositionKey(position));
  const afterTriples = countLineTriples(ownKeys);
  const completedTriples = Math.max(0, afterTriples - beforeTriples);

  return completedTriples * 130 + countNearLineWindows(ownKeys, position) * 28 + (definition?.resource === "egg" ? 4 : 0);
}

function scoreMacawMove(game: GameState, playerId: string, pieceId: string, position: GridPosition): number {
  const beforeKeys = getOwnSpeciesPositionKeys(game, playerId, "macaw");
  const afterKeys = getOwnSpeciesPositionKeys(game, playerId, "macaw", pieceId);
  afterKeys.add(gridPositionKey(position));

  const completedTriples = Math.max(0, countLineTriples(afterKeys) - countLineTriples(beforeKeys));
  const brokenTriples = Math.max(0, countLineTriples(beforeKeys) - countLineTriples(afterKeys));
  // Arara pontua 1 ponto por linha reta de 3; prioridade maxima e completar
  // e nunca quebrar linhas, alem de preparar janelas com 2 araras.
  return completedTriples * 150 - brokenTriples * 110 + countNearLineWindows(afterKeys, position) * 30;
}

function scoreCapuchinHabitatPotential(game: GameState, playerId: string, position: GridPosition, habitat: Habitat | null): number {
  if (!habitat) {
    return 0;
  }

  const beforeStats = getCapuchinHabitatStats(game, playerId);
  const afterStats = getCapuchinHabitatStats(game, playerId, undefined, position);
  const beforePairCount = countScoringCapuchinHabitats(beforeStats);
  const afterPairCount = countScoringCapuchinHabitats(afterStats);
  const beforeSize = beforeStats.get(habitat)?.size ?? 0;
  const afterSize = afterStats.get(habitat)?.size ?? 0;
  const completedPair = beforeSize < 2 && afterSize >= 2;
  const scoreGain = Math.max(0, afterPairCount - beforePairCount);
  const newHabitatSeed = beforeSize === 0 && afterPairCount < 3 ? 12 : 0;

  return scoreGain * 90 + afterPairCount * 24 + (completedPair ? 48 : 0) + (beforeSize === 1 && afterSize === 2 ? 18 : 0) + newHabitatSeed + (afterSize >= 2 ? 10 : 0);
}

function scoreCapuchinMove(
  game: GameState,
  playerId: string,
  pieceId: string,
  position: GridPosition,
  habitat: Habitat | null
): number {
  if (!habitat) {
    return 0;
  }

  const before = getCapuchinHabitatPairCount(game, playerId);
  const after = getCapuchinHabitatPairCount(game, playerId, pieceId, position);
  const movedPiece = game.pieces.find((piece) => piece.pieceId === pieceId);
  const movedFromStack = Boolean(movedPiece?.location && ownSpeciesPiecesAt(game, playerId, "capuchin", movedPiece.location) > 1);
  const scoreDelta = after - before;
  const breakPenalty = scoreDelta < 0 ? 180 : 0;

  return scoreDelta * 150 + after * 36 + (movedFromStack ? 36 : 0) - breakPenalty + scoreCapuchinHabitatPotential(game, playerId, position, habitat);
}

function scoreCapuchinStackTarget(game: GameState, playerId: string, position: GridPosition): number {
  const habitat = getHabitatAt(game, position);
  if (!habitat) {
    return 0;
  }

  const stats = getCapuchinHabitatStats(game, playerId);
  const habitatPositionCount = stats.get(habitat)?.size ?? 0;
  const pairCount = countScoringCapuchinHabitats(stats);
  const ownCount = ownSpeciesPiecesAt(game, playerId, "capuchin", position);
  const resourceScore = scoreResource("capuchin", getResourceAt(game, position));

  if (habitatPositionCount === 1) {
    return 95 + ownCount * 8 + resourceScore;
  }

  if (habitatPositionCount >= 2) {
    return 55 + pairCount * 8 + ownCount * 6 + resourceScore;
  }

  return 20 + resourceScore;
}

function scoreCoatiPairPotential(game: GameState, playerId: string, position: GridPosition): number {
  const ownCount = ownSpeciesPiecesAt(game, playerId, "coati", position);
  const fruitBonus = getResourceAt(game, position) === "fruit" ? 8 : 0;

  if (game.status === "setup") {
    return fruitBonus + adjacentOwnSpeciesCount(game, playerId, "coati", position) * 5 - ownCount * 12;
  }

  if (ownCount === 1 && hasReserve(game, playerId)) {
    return fruitBonus + 18;
  }

  return fruitBonus + adjacentOwnSpeciesCount(game, playerId, "coati", position) * 3 - Math.max(0, ownCount - 1) * 12;
}

function scoreArmadilloSharingPotential(game: GameState, playerId: string, position: GridPosition): number {
  const coveredSpecies = getArmadilloCoveredSpecies(game, playerId);
  const speciesAtTarget = new Set(
    piecesAt(game, position)
      .filter((piece) => piece.ownerId !== playerId)
      .map((piece) => piece.speciesId)
  );
  let score = 0;
  for (const speciesId of speciesAtTarget) {
    // Especie ainda sem tatu junto vale muito mais que uma ja coberta.
    score += coveredSpecies.has(speciesId) ? 6 : 50;
  }

  return score + speciesAtTarget.size * 14;
}

function scoreArmadilloMove(game: GameState, playerId: string, pieceId: string, position: GridPosition): number {
  const before = getArmadilloCoveredSpecies(game, playerId);
  const after = getArmadilloCoveredSpecies(game, playerId, pieceId, position);
  const targetSpecies = new Set(
    piecesAt(game, position)
      .filter((piece) => piece.ownerId !== playerId)
      .map((piece) => piece.speciesId)
  );

  let newlyCoveredAtTarget = 0;
  for (const speciesId of targetSpecies) {
    if (!before.has(speciesId)) {
      newlyCoveredAtTarget += 1;
    }
  }

  // Mover para carta com especie sem tatu junto (cobertura nova) e prioridade.
  return (after.size - before.size) * 130 + after.size * 16 + newlyCoveredAtTarget * 90 + targetSpecies.size * 12;
}

function crowdingPenalty(game: GameState, playerId: string, speciesId: SpeciesId, position: GridPosition): number {
  const ownCount = ownSpeciesPiecesAt(game, playerId, speciesId, position);
  const totalCount = piecesAt(game, position).length;
  const { crowding } = getSpeciesBotScoringProfile(speciesId);
  const selfPenalty =
    crowding.ignoreSingleOwnPieceDuringActive && game.status === "active" && ownCount === 1 ? 0 : ownCount * crowding.ownPiecePenalty;

  return selfPenalty + Math.max(0, totalCount - ownCount - 1) * 2;
}

function expansionCrowdingScore(game: GameState, position: GridPosition): number {
  return game.pieces.filter((piece) => piece.location && Math.abs(piece.location.x - position.x) + Math.abs(piece.location.y - position.y) <= 1).length;
}

function scoreResource(speciesId: SpeciesId, resource: Resource | null | undefined): number {
  if (!resource) {
    return 0;
  }

  const preference = getSpeciesBotScoringProfile(speciesId).resourcePreference;
  const index = preference.indexOf(resource);
  return index >= 0 ? Math.max(1, preference.length - index) * 3 : 1;
}

export function scoreCapture(game: GameState, playerId: string, speciesId: SpeciesId, position: GridPosition): number {
  if (speciesId !== "jaguar") {
    return 0;
  }

  return game.pieces.some(
    (piece) => piece.ownerId !== playerId && !piece.state.hidden && piece.location?.x === position.x && piece.location.y === position.y
  )
    ? 8
    : 0;
}

export function pickCaptureTarget(game: GameState, playerId: string, speciesId: SpeciesId, position: GridPosition): string | undefined {
  if (speciesId !== "jaguar") {
    return undefined;
  }

  return game.pieces
    .filter((piece) => piece.ownerId !== playerId && !piece.state.hidden && piece.location?.x === position.x && piece.location.y === position.y)
    .sort((a, b) => speciesDefinitions[b.speciesId].totalPieces - speciesDefinitions[a.speciesId].totalPieces)[0]?.pieceId;
}

function getOwnSpeciesPositionKeys(game: GameState, playerId: string, speciesId: SpeciesId, excludedPieceId?: string): Set<string> {
  return new Set(
    game.pieces
      .filter(
        (piece) =>
          piece.ownerId === playerId &&
          piece.speciesId === speciesId &&
          piece.pieceId !== excludedPieceId &&
          piece.location
      )
      .map((piece) => gridPositionKey(piece.location!))
  );
}

function getCapuchinHabitatPairCount(
  game: GameState,
  playerId: string,
  excludedPieceId?: string,
  replacement?: GridPosition
): number {
  return countScoringCapuchinHabitats(getCapuchinHabitatStats(game, playerId, excludedPieceId, replacement));
}

function getCapuchinHabitatStats(
  game: GameState,
  playerId: string,
  excludedPieceId?: string,
  replacement?: GridPosition
): Map<Habitat, Set<string>> {
  const positionsByHabitat = new Map<Habitat, Set<string>>();

  for (const piece of game.pieces) {
    if (piece.ownerId !== playerId || piece.speciesId !== "capuchin" || piece.pieceId === excludedPieceId || !piece.location) {
      continue;
    }

    const habitat = getHabitatAt(game, piece.location);
    if (!habitat) {
      continue;
    }

    const positions = positionsByHabitat.get(habitat) ?? new Set<string>();
    positions.add(gridPositionKey(piece.location));
    positionsByHabitat.set(habitat, positions);
  }

  if (replacement) {
    const habitat = getHabitatAt(game, replacement);
    if (habitat) {
      const positions = positionsByHabitat.get(habitat) ?? new Set<string>();
      positions.add(gridPositionKey(replacement));
      positionsByHabitat.set(habitat, positions);
    }
  }

  return positionsByHabitat;
}

function countScoringCapuchinHabitats(stats: Map<Habitat, Set<string>>): number {
  return [...stats.values()].filter((positions) => positions.size >= 2).length;
}

function getArmadilloCoveredSpecies(
  game: GameState,
  playerId: string,
  excludedPieceId?: string,
  replacement?: GridPosition
): Set<SpeciesId> {
  const armadilloPositions = getOwnSpeciesPositionKeys(game, playerId, "armadillo", excludedPieceId);
  if (replacement) {
    armadilloPositions.add(gridPositionKey(replacement));
  }

  return new Set(
    game.pieces
      .filter((piece) => piece.ownerId !== playerId && piece.location && armadilloPositions.has(gridPositionKey(piece.location)))
      .map((piece) => piece.speciesId)
  );
}

function piecesAt(game: GameState, position: GridPosition) {
  return game.pieces.filter((piece) => piece.location?.x === position.x && piece.location.y === position.y);
}

function ownSpeciesPiecesAt(game: GameState, playerId: string, speciesId: SpeciesId, position: GridPosition): number {
  return piecesAt(game, position).filter((piece) => piece.ownerId === playerId && piece.speciesId === speciesId).length;
}

function adjacentOwnSpeciesCount(game: GameState, playerId: string, speciesId: SpeciesId, position: GridPosition): number {
  return game.pieces.filter(
    (piece) =>
      piece.ownerId === playerId &&
      piece.speciesId === speciesId &&
      piece.location &&
      Math.abs(piece.location.x - position.x) + Math.abs(piece.location.y - position.y) === 1
  ).length;
}

function getHabitatAt(game: GameState, position: GridPosition): Habitat | null {
  const card = game.forest.cards.find((candidate) => candidate.x === position.x && candidate.y === position.y);
  return card ? getForestCardDefinition(card.definitionId).habitat : null;
}

function getResourceAt(game: GameState, position: GridPosition): Resource | null {
  const card = game.forest.cards.find((candidate) => candidate.x === position.x && candidate.y === position.y);
  return card ? getForestCardDefinition(card.definitionId).resource : null;
}

function countLineTriples(positionKeys: Set<string>): number {
  const directions = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 }
  ];
  const lineKeys = new Set<string>();

  for (const key of positionKeys) {
    const { x, y } = parseGridPositionKey(key);
    for (const direction of directions) {
      const before = gridPositionKey({ x: x - direction.x, y: y - direction.y });
      const second = gridPositionKey({ x: x + direction.x, y: y + direction.y });
      const third = gridPositionKey({
        x: x + direction.x * 2,
        y: y + direction.y * 2
      });
      if (positionKeys.has(before) || !positionKeys.has(second) || !positionKeys.has(third)) {
        continue;
      }

      lineKeys.add(`${x}:${y}|${direction.x}:${direction.y}`);
    }
  }

  return lineKeys.size;
}

function countNearLineWindows(positionKeys: Set<string>, focus: GridPosition): number {
  const directions = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 }
  ];
  let count = 0;

  for (const direction of directions) {
    for (let offset = -2; offset <= 0; offset += 1) {
      const window = [0, 1, 2].map((step) => ({
        x: focus.x + direction.x * (offset + step),
        y: focus.y + direction.y * (offset + step)
      }));
      const occupied = window.filter((position) => positionKeys.has(gridPositionKey(position))).length;
      if (occupied === 2) {
        count += 1;
      }
    }
  }

  return count;
}

function adjacencyScore(game: GameState, position: GridPosition): number {
  return game.forest.cards.filter((card) => Math.abs(card.x - position.x) + Math.abs(card.y - position.y) === 1).length;
}

export function getCurrentAction(game: GameState, speciesId: SpeciesId): ActionId | null {
  return speciesDefinitions[speciesId].actions[game.activeActionIndex] ?? null;
}

export function chooseCandidatePool<T extends { score: number }>(items: T[]): T[] {
  if (items.length >= 2 && items[0].score - items[1].score >= 10) {
    return [items[0], ...shuffle(items.slice(1))];
  }

  if (items.length <= 3) {
    return Math.random() < 0.82 ? items : shuffle(items);
  }

  const topCount = Math.min(items.length, Math.random() < 0.9 ? 4 : 6);
  const top = items.slice(0, topCount);
  if (Math.random() < 0.7) {
    return top;
  }

  const [best, ...rest] = top;
  return [pickOne(rest), best, ...shuffle(rest.filter((item) => item !== rest[0]))];
}

export function chooseCandidatesForSpecies<T extends { score: number }>(items: T[], speciesId: SpeciesId): T[] {
  if (getSpeciesBotScoringProfile(speciesId).preserveRankedCandidateOrder) {
    return items;
  }

  return chooseCandidatePool(items);
}

export function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}
