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
import type { GameState, GridPosition, Resource, SpeciesId } from "@oikos/shared";

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
  for (const position of rankPositions(game, player.speciesId, positions)) {
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

  return pickOne(chooseCandidatePool(ranked.map((position) => ({ ...position, score: scorePosition(game, speciesId, position) }))));
}

function rankPositions(game: GameState, speciesId: SpeciesId, positions: GridPosition[]): GridPosition[] {
  return positions
    .map((position) => ({ ...position, score: scorePosition(game, speciesId, position) }))
    .sort((a, b) => b.score - a.score)
    .map(({ x, y }) => ({ x, y }));
}

function scoreCardPlacement(game: GameState, speciesId: SpeciesId, cardId: string, position: GridPosition): number {
  const definition = getForestCardDefinition(cardId);
  return scoreResource(speciesId, definition.resource) + adjacencyScore(game, position) + Math.random() * 2.5;
}

function scorePosition(game: GameState, speciesId: SpeciesId, position: GridPosition): number {
  const card = game.forest.cards.find((candidate) => candidate.x === position.x && candidate.y === position.y);
  const definition = card ? getForestCardDefinition(card.definitionId) : null;
  return scoreResource(speciesId, definition?.resource ?? null) + adjacencyScore(game, position) + Math.random() * 3;
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

function adjacencyScore(game: GameState, position: GridPosition): number {
  return game.forest.cards.filter((card) => Math.abs(card.x - position.x) + Math.abs(card.y - position.y) === 1).length;
}

function getCurrentAction(game: GameState, speciesId: SpeciesId): string | null {
  return speciesDefinitions[speciesId].actions[game.activeActionIndex] ?? null;
}

function chooseCandidatePool<T extends { score: number }>(items: T[]): T[] {
  if (items.length <= 3) {
    return shuffle(items);
  }

  const topCount = Math.min(items.length, Math.random() < 0.8 ? 3 : 5);
  return shuffle(items.slice(0, topCount));
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
