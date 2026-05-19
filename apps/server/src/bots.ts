import { getForestCardDefinition, speciesDefinitions } from "@oikos/content";
import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  completeCurrentAction,
  forceEndPlayerTurn,
  getArmadilloHidePieceIds,
  getArmadilloSeedPlacementPositions,
  getAvailableForestExpansionPositionsForCard,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getCapuchinPlacementPositions,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getMacawActionCTargets,
  getMacawEggPlacementPositions,
  getMacawRelocatablePieceIds,
  getRequiredCoatiRemovalCount,
  getValidPieceMovementDestinations,
  getWolfMeatPlacementPositions,
  getWolfRemovableBasePieceIds,
  getWolfSpendableResourceTypes,
  hideArmadilloForCurrentAction,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece,
  removeBasePieceForWolfAction,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus,
  scoreArmadilloSharing,
  scoreCapuchinHabitatPresence,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints
} from "@oikos/rules";
import type { GameState, GridPosition, Habitat, Resource, SpeciesId } from "@oikos/shared";

const resourcePreference: Record<SpeciesId, Resource[]> = {
  jaguar: ["meat", "meat", "egg", "fruit", "seed"],
  maned_wolf: ["meat", "fruit", "egg", "seed"],
  armadillo: ["seed", "fruit", "egg", "meat"],
  macaw: ["egg", "fruit", "seed", "meat"],
  capuchin: ["fruit", "egg", "seed", "meat"],
  coati: ["fruit", "seed", "egg", "meat"]
};

const rotations = [0, 90, 180, 270] as const;

export function playBotStep(game: GameState, playerId: string): GameState {
  if (game.status === "setup") {
    return playSetupStep(game, playerId);
  }

  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return game;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player?.speciesId) {
    return game;
  }

  if (game.pendingCoatiPairBonus?.playerId === playerId) {
    return resolveCoatiPairBonus(game, playerId, pickPosition(game, player.speciesId, getCoatiPairBonusTargets(game, playerId)));
  }

  const action = getCurrentAction(game, player.speciesId);
  if (!action) {
    return game;
  }

  if (player.speciesId !== "jaguar" && action === "A" && !game.activePlayedForestCardId) {
    return playForestCard(game, playerId, player.speciesId);
  }

  if (player.speciesId === "maned_wolf" && game.pendingWolfMoves?.playerId === playerId) {
    return moveBestPiece(game, playerId, player.speciesId, game.pendingWolfMoves.pieceIds);
  }

  switch (player.speciesId) {
    case "jaguar":
      return playJaguar(game, playerId, action);
    case "coati":
      return playCoati(game, playerId, action);
    case "capuchin":
      return playCapuchin(game, playerId, action);
    case "macaw":
      return playMacaw(game, playerId, action);
    case "armadillo":
      return playArmadillo(game, playerId, action);
    case "maned_wolf":
      return playWolf(game, playerId, action);
  }
}

function playSetupStep(game: GameState, playerId: string): GameState {
  if (game.setupActivePlayerId !== playerId) {
    return game;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player?.speciesId) {
    return game;
  }

  const positions = game.forest.cards.map((card) => ({ x: card.x, y: card.y }));
  for (const position of rankSetupPositions(game, playerId, player.speciesId, positions)) {
    try {
      return placeInitialPiece(game, playerId, position);
    } catch {
      // Try the next legal-looking setup position.
    }
  }

  throw new Error("Bot nao encontrou posicao valida no setup.");
}

function playForestCard(game: GameState, playerId: string, speciesId: SpeciesId): GameState {
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player) {
    return game;
  }

  const options = player.hand.flatMap((cardId) =>
    rotations.flatMap((rotation) =>
      getAvailableForestExpansionPositionsForCard(game, cardId, rotation).map((position) => ({ cardId, rotation, position }))
    )
  );

  const ranked = options
    .map((option) => ({
      ...option,
      score: scoreCardPlacement(game, speciesId, option.cardId, option.position)
    }))
    .sort((a, b) => b.score - a.score);

  for (const option of chooseCandidatePool(ranked)) {
    try {
      return placeForestCard(game, playerId, option.cardId, option.position, option.rotation);
    } catch {
      // Try another card/slot if river matching or hand state changed.
    }
  }

  throw new Error("Bot nao encontrou carta valida para expandir.");
}

function playJaguar(game: GameState, playerId: string, action: string): GameState {
  if (action === "C") {
    const spendable = getAvailableJaguarPointSpendCount(game, playerId);
    if (spendable > 0 && Math.random() < 0.78) {
      return spendJaguarMeatForPoints(game, playerId, Math.max(1, Math.min(spendable, randomInt(1, 3))));
    }

    return completeOrSkip(game, playerId);
  }

  const piece = game.pieces.find((candidate) => candidate.ownerId === playerId && candidate.speciesId === "jaguar" && candidate.location);
  if (!piece) {
    return completeOrSkip(game, playerId);
  }

  return moveBestPiece(game, playerId, "jaguar", [piece.pieceId]);
}

function playCoati(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    if (hasReserve(game, playerId)) {
      return addCoatiForCurrentAction(game, playerId, pickPosition(game, "coati", getCoatiFruitPlacementPositions(game, playerId)));
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveBestOwnedSpeciesPiece(game, playerId, "coati");
  }

  const required = getRequiredCoatiRemovalCount(game, playerId);
  if (required > 0) {
    const pieceIds = game.pieces
      .filter((piece) => piece.ownerId === playerId && piece.speciesId === "coati" && piece.location)
      .slice(0, required)
      .map((piece) => piece.pieceId);
    return removePiecesForCurrentAction(game, playerId, pieceIds);
  }

  return completeOrSkip(game, playerId);
}

function playCapuchin(game: GameState, playerId: string, action: string): GameState {
  if (action === "A" || action === "C") {
    if (hasReserve(game, playerId)) {
      return addCapuchinForCurrentAction(game, playerId, pickPosition(game, "capuchin", getCapuchinPlacementPositions(game, playerId)));
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveBestOwnedSpeciesPiece(game, playerId, "capuchin");
  }

  return scoreCapuchinHabitatPresence(game, playerId);
}

function playMacaw(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    if (hasReserve(game, playerId)) {
      return addMacawForCurrentAction(game, playerId, pickPosition(game, "macaw", getMacawEggPlacementPositions(game, playerId)));
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveBestOwnedSpeciesPiece(game, playerId, "macaw");
  }

  if (action === "C") {
    const addTargets = getMacawActionCTargets(game, playerId);
    const relocatable = getMacawRelocatablePieceIds(game, playerId);
    if (hasReserve(game, playerId) && addTargets.length > 0 && Math.random() < (relocatable.length > 0 ? 0.62 : 1)) {
      return addMacawForCurrentAction(game, playerId, pickPosition(game, "macaw", addTargets));
    }

    if (relocatable.length > 0) {
      return moveBestPiece(game, playerId, "macaw", shuffle(relocatable));
    }
  }

  return scoreMacawLines(game, playerId);
}

function playArmadillo(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    if (hasReserve(game, playerId)) {
      return addArmadilloForCurrentAction(game, playerId, pickPosition(game, "armadillo", getArmadilloSeedPlacementPositions(game, playerId)));
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveBestOwnedSpeciesPiece(game, playerId, "armadillo");
  }

  if (action === "C") {
    const hideable = getArmadilloHidePieceIds(game, playerId);
    if (hideable.length > 0) {
      return hideArmadilloForCurrentAction(game, playerId, pickOne(hideable));
    }
    return completeOrSkip(game, playerId);
  }

  return scoreArmadilloSharing(game, playerId);
}

function playWolf(game: GameState, playerId: string, action: string): GameState {
  if (action === "B") {
    const removable = getWolfRemovableBasePieceIds(game, playerId);
    if (removable.length > 0 && Math.random() < 0.72) {
      return removeBasePieceForWolfAction(game, playerId, pickOne(removable));
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "C") {
    const spendableCount = getAvailableWolfPointSpendCount(game, playerId);
    const resources = getWolfSpendableResourceTypes(game, playerId).slice(0, spendableCount);
    if (resources.length > 0 && Math.random() < 0.84) {
      return spendWolfResourcesForPoints(game, playerId, resources);
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "D") {
    const targets = getWolfMeatPlacementPositions(game, playerId);
    if (hasReserve(game, playerId) && targets.length > 0) {
      return addWolfForCurrentAction(game, playerId, pickPosition(game, "maned_wolf", targets));
    }
  }

  return completeOrSkip(game, playerId);
}

function hasReserve(game: GameState, playerId: string): boolean {
  return Boolean(game.players.find((player) => player.playerId === playerId)?.reservePieces.length);
}

function completeOrSkip(game: GameState, playerId: string): GameState {
  try {
    return completeCurrentAction(game, playerId);
  } catch {
    return forceEndPlayerTurn(game, playerId, "bot sem jogada valida");
  }
}

function moveBestOwnedSpeciesPiece(game: GameState, playerId: string, speciesId: SpeciesId): GameState {
  const pieceIds = game.pieces
    .filter((piece) => piece.ownerId === playerId && piece.speciesId === speciesId && piece.location)
    .map((piece) => piece.pieceId);

  return moveBestPiece(game, playerId, speciesId, pieceIds);
}

function moveBestPiece(game: GameState, playerId: string, speciesId: SpeciesId, pieceIds: string[]): GameState {
  const options = pieceIds.flatMap((pieceId) =>
    getValidPieceMovementDestinations(game, playerId, pieceId).map((position) => ({
      pieceId,
      position,
      score: scorePosition(game, speciesId, position) + scoreCapture(game, playerId, speciesId, position)
    }))
  );

  const ranked = options.sort((a, b) => b.score - a.score);
  for (const option of chooseCandidatePool(ranked)) {
    try {
      const targetPieceId = pickCaptureTarget(game, playerId, speciesId, option.position);
      return movePieceForCurrentAction(game, playerId, option.pieceId, option.position, targetPieceId);
    } catch {
      // Try another movable piece/destination if the board changed.
    }
  }

  return completeOrSkip(game, playerId);
}

function pickPosition(game: GameState, speciesId: SpeciesId, positions: GridPosition[]): GridPosition {
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

function rankSetupPositions(game: GameState, playerId: string, speciesId: SpeciesId, positions: GridPosition[]): GridPosition[] {
  return positions
    .map((position) => ({ ...position, score: scoreSetupPosition(game, playerId, speciesId, position) }))
    .sort((a, b) => b.score - a.score)
    .map(({ x, y }) => ({ x, y }));
}

function scoreCardPlacement(game: GameState, speciesId: SpeciesId, cardId: string, position: GridPosition): number {
  const definition = getForestCardDefinition(cardId);
  const resourceScore = scoreResource(speciesId, definition.resource);
  const boardGrowthScore = adjacencyScore(game, position) * 1.5 - expansionCrowdingScore(game, position);
  const speciesPlanScore =
    speciesId === "macaw"
      ? scoreMacawLinePotential(game, speciesId, position, cardId)
      : speciesId === "capuchin"
        ? scoreCapuchinHabitatPotential(game, position, definition.habitat)
        : 0;

  return resourceScore + boardGrowthScore + speciesPlanScore + Math.random() * 0.75;
}

function scorePosition(game: GameState, speciesId: SpeciesId, position: GridPosition): number {
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
    ownAdjacent * setupAdjacencyWeight(speciesId);

  return base - ownCount * 18 - Math.max(0, totalCount - ownCount) * 2.5 + Math.random() * 0.5;
}

function scoreSpeciesPlan(
  game: GameState,
  playerId: string,
  speciesId: SpeciesId,
  position: GridPosition,
  habitat: Habitat | null
): number {
  switch (speciesId) {
    case "macaw":
      return scoreMacawLinePotential(game, speciesId, position);
    case "capuchin":
      return scoreCapuchinHabitatPotential(game, position, habitat);
    case "coati":
      return scoreCoatiPairPotential(game, playerId, position);
    case "armadillo":
      return scoreArmadilloSharingPotential(game, playerId, position);
    case "jaguar":
      return piecesAt(game, position).some((piece) => piece.ownerId !== playerId && !piece.state.hidden) ? 10 : 0;
    case "maned_wolf":
      return adjacentOwnSpeciesCount(game, playerId, speciesId, position) * 2;
  }
}

function scoreMacawLinePotential(game: GameState, speciesId: SpeciesId, position: GridPosition, placedCardId?: string): number {
  const card = placedCardId
    ? { definitionId: placedCardId }
    : game.forest.cards.find((candidate) => candidate.x === position.x && candidate.y === position.y);
  const definition = card ? getForestCardDefinition(card.definitionId) : null;
  const ownKeys = new Set(
    game.pieces
      .filter((piece) => piece.speciesId === speciesId && piece.location)
      .map((piece) => positionKey(piece.location!))
  );
  ownKeys.add(positionKey(position));

  return countLineTriples(ownKeys) * 22 + countNearLineWindows(ownKeys, position) * 6 + (definition?.resource === "egg" ? 3 : 0);
}

function scoreCapuchinHabitatPotential(game: GameState, position: GridPosition, habitat: Habitat | null): number {
  if (!habitat) {
    return 0;
  }

  const habitatPositions = new Map<Habitat, Set<string>>();
  for (const piece of game.pieces) {
    if (piece.speciesId !== "capuchin" || !piece.location) {
      continue;
    }

    const pieceHabitat = getHabitatAt(game, piece.location);
    if (!pieceHabitat) {
      continue;
    }

    const positions = habitatPositions.get(pieceHabitat) ?? new Set<string>();
    positions.add(positionKey(piece.location));
    habitatPositions.set(pieceHabitat, positions);
  }

  const nextPositions = habitatPositions.get(habitat) ?? new Set<string>();
  const beforeSize = nextPositions.size;
  nextPositions.add(positionKey(position));
  const afterSize = nextPositions.size;
  const completedPair = beforeSize < 2 && afterSize >= 2;

  return (completedPair ? 18 : 0) + (afterSize >= 2 ? 5 : 0) + (beforeSize === 1 && afterSize === 2 ? 4 : 0);
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
  const sharedSpecies = new Set(
    piecesAt(game, position)
      .filter((piece) => piece.ownerId !== playerId)
      .map((piece) => piece.speciesId)
  );
  return sharedSpecies.size * 6;
}

function crowdingPenalty(game: GameState, playerId: string, speciesId: SpeciesId, position: GridPosition): number {
  const ownCount = ownSpeciesPiecesAt(game, playerId, speciesId, position);
  const totalCount = piecesAt(game, position).length;
  const selfPenalty =
    speciesId === "coati" && game.status === "active" && ownCount === 1 ? 0 : ownCount * (speciesId === "macaw" ? 16 : 8);

  return selfPenalty + Math.max(0, totalCount - ownCount - 1) * 2;
}

function expansionCrowdingScore(game: GameState, position: GridPosition): number {
  return game.pieces.filter((piece) => piece.location && Math.abs(piece.location.x - position.x) + Math.abs(piece.location.y - position.y) <= 1).length;
}

function setupAdjacencyWeight(speciesId: SpeciesId): number {
  if (speciesId === "macaw") {
    return 3;
  }
  if (speciesId === "coati") {
    return 5;
  }
  if (speciesId === "capuchin") {
    return 1;
  }
  return 2;
}

function scoreResource(speciesId: SpeciesId, resource: Resource | null | undefined): number {
  if (!resource) {
    return 0;
  }

  const preference = resourcePreference[speciesId];
  const index = preference.indexOf(resource);
  return index >= 0 ? Math.max(1, preference.length - index) * 3 : 1;
}

function scoreCapture(game: GameState, playerId: string, speciesId: SpeciesId, position: GridPosition): number {
  if (speciesId !== "jaguar") {
    return 0;
  }

  return game.pieces.some(
    (piece) => piece.ownerId !== playerId && !piece.state.hidden && piece.location?.x === position.x && piece.location.y === position.y
  )
    ? 8
    : 0;
}

function pickCaptureTarget(game: GameState, playerId: string, speciesId: SpeciesId, position: GridPosition): string | undefined {
  if (speciesId !== "jaguar") {
    return undefined;
  }

  return game.pieces
    .filter((piece) => piece.ownerId !== playerId && !piece.state.hidden && piece.location?.x === position.x && piece.location.y === position.y)
    .sort((a, b) => speciesDefinitions[b.speciesId].totalPieces - speciesDefinitions[a.speciesId].totalPieces)[0]?.pieceId;
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

function positionKey(position: GridPosition): string {
  return `${position.x}:${position.y}`;
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
    const [x, y] = key.split(":").map(Number);
    for (const direction of directions) {
      const before = `${x - direction.x}:${y - direction.y}`;
      const second = `${x + direction.x}:${y + direction.y}`;
      const third = `${x + direction.x * 2}:${y + direction.y * 2}`;
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
      const occupied = window.filter((position) => positionKeys.has(positionKey(position))).length;
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

function getCurrentAction(game: GameState, speciesId: SpeciesId): string | null {
  return speciesDefinitions[speciesId].actions[game.activeActionIndex] ?? null;
}

function chooseCandidatePool<T extends { score: number }>(items: T[]): T[] {
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

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}
