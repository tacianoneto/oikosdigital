import { getForestCardDefinition, speciesDefinitions } from "@oikos/content";
import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  collectCaatingaBonus,
  completeCurrentAction,
  discardMataAtlanticaPileCard,
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
} from "./setup";
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

  // Scenario bots: collect Caatinga bonus the moment it shows up.
  if (game.caatingaPending?.playerId === playerId) {
    try {
      return collectCaatingaBonus(game, playerId);
    } catch {
      // fall through and keep playing
    }
  }

  // Mata Atlântica: non-card species must discard 1 top card from a pile.
  if (
    game.mataAtlanticaPiles &&
    !speciesDefinitions[player.speciesId].usesForestCards &&
    (game.mataAtlanticaDiscardByPlayer ?? {})[playerId] !== player.turnsTaken
  ) {
    const tops = game.mataAtlanticaPiles.map((pile) => pile[0]).filter((id): id is string => Boolean(id));
    if (tops.length > 0) {
      try {
        return discardMataAtlanticaPileCard(game, playerId, pickOne(tops));
      } catch {
        // fall through
      }
    }
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

// Turn-timeout takeover bot: makes only legal moves, but chooses among them at
// random (and sometimes skips optional plays) instead of scoring. Used as the
// "punishment" when an online player runs out of time on their turn.
export function playRandomStep(game: GameState, playerId: string): GameState {
  if (game.status === "setup") {
    return playRandomSetupStep(game, playerId);
  }

  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return game;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player?.speciesId) {
    return game;
  }

  const speciesId = player.speciesId;

  if (game.caatingaPending?.playerId === playerId) {
    try {
      return collectCaatingaBonus(game, playerId);
    } catch {
      // fall through
    }
  }

  if (
    game.mataAtlanticaPiles &&
    !speciesDefinitions[speciesId].usesForestCards &&
    (game.mataAtlanticaDiscardByPlayer ?? {})[playerId] !== player.turnsTaken
  ) {
    const tops = game.mataAtlanticaPiles.map((pile) => pile[0]).filter((id): id is string => Boolean(id));
    if (tops.length > 0) {
      try {
        return discardMataAtlanticaPileCard(game, playerId, pickOne(tops));
      } catch {
        // fall through
      }
    }
  }

  if (game.pendingCoatiPairBonus?.playerId === playerId) {
    const targets = getCoatiPairBonusTargets(game, playerId);
    if (targets.length > 0) {
      return resolveCoatiPairBonus(game, playerId, pickOne(targets));
    }
    return completeOrSkip(game, playerId);
  }

  const action = getCurrentAction(game, speciesId);
  if (!action) {
    return game;
  }

  if (speciesId !== "jaguar" && action === "A" && !game.activePlayedForestCardId) {
    return playRandomForestCard(game, playerId);
  }

  if (speciesId === "maned_wolf" && game.pendingWolfMoves?.playerId === playerId) {
    return moveRandomAmong(game, playerId, speciesId, game.pendingWolfMoves.pieceIds);
  }

  switch (speciesId) {
    case "jaguar":
      return randomJaguar(game, playerId, action);
    case "coati":
      return randomCoati(game, playerId, action);
    case "capuchin":
      return randomCapuchin(game, playerId, action);
    case "macaw":
      return randomMacaw(game, playerId, action);
    case "armadillo":
      return randomArmadillo(game, playerId, action);
    case "maned_wolf":
      return randomWolf(game, playerId, action);
  }
}

function playRandomSetupStep(game: GameState, playerId: string): GameState {
  if (game.setupActivePlayerId !== playerId) {
    return game;
  }

  for (const position of shuffle(game.forest.cards.map((card) => ({ x: card.x, y: card.y })))) {
    try {
      return placeInitialPiece(game, playerId, position);
    } catch {
      // Try the next position.
    }
  }

  throw new Error("Bot aleatorio nao encontrou posicao de setup.");
}

function playRandomForestCard(game: GameState, playerId: string): GameState {
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player) {
    return game;
  }

  const pileTops = game.mataAtlanticaPiles
    ? game.mataAtlanticaPiles.map((pile) => pile[0]).filter((id): id is string => Boolean(id))
    : [];
  const candidateIds = [...player.hand, ...pileTops];
  const options = shuffle(
    candidateIds.flatMap((cardId) =>
      rotations.flatMap((rotation) =>
        getAvailableForestExpansionPositionsForCard(game, cardId, rotation).map((position) => ({ cardId, rotation, position }))
      )
    )
  );

  for (const option of options) {
    try {
      return placeForestCard(game, playerId, option.cardId, option.position, option.rotation);
    } catch {
      // Try another card/slot.
    }
  }

  throw new Error("Bot aleatorio nao encontrou carta para expandir.");
}

function moveRandomAmong(game: GameState, playerId: string, speciesId: SpeciesId, pieceIds: string[]): GameState {
  const options = shuffle(
    pieceIds.flatMap((pieceId) =>
      getValidPieceMovementDestinations(game, playerId, pieceId).map((position) => ({ pieceId, position }))
    )
  );

  for (const option of options) {
    try {
      const targetPieceId = speciesId === "jaguar" ? pickRandomCaptureTarget(game, playerId, option.position) : undefined;
      return movePieceForCurrentAction(game, playerId, option.pieceId, option.position, targetPieceId);
    } catch {
      // Try another piece/destination.
    }
  }

  return completeOrSkip(game, playerId);
}

function moveRandomOwned(game: GameState, playerId: string, speciesId: SpeciesId): GameState {
  const pieceIds = game.pieces
    .filter((piece) => piece.ownerId === playerId && piece.speciesId === speciesId && piece.location)
    .map((piece) => piece.pieceId);
  return moveRandomAmong(game, playerId, speciesId, pieceIds);
}

function pickRandomCaptureTarget(game: GameState, playerId: string, position: GridPosition): string | undefined {
  const targets = game.pieces.filter(
    (piece) => piece.ownerId !== playerId && !piece.state.hidden && piece.location?.x === position.x && piece.location.y === position.y
  );
  return targets.length > 0 ? pickOne(targets).pieceId : undefined;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function maybe(probability = 0.5): boolean {
  return Math.random() < probability;
}

function randomJaguar(game: GameState, playerId: string, action: string): GameState {
  if (action === "C") {
    const max = getAvailableJaguarPointSpendCount(game, playerId);
    const count = max > 0 ? randInt(0, max) : 0;
    if (count > 0) {
      return spendJaguarMeatForPoints(game, playerId, count);
    }
    return completeOrSkip(game, playerId);
  }

  return moveRandomOwned(game, playerId, "jaguar");
}

function randomCoati(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    const targets = getCoatiFruitPlacementPositions(game, playerId);
    if (hasReserve(game, playerId) && targets.length > 0 && maybe(0.6)) {
      try {
        return addCoatiForCurrentAction(game, playerId, pickOne(targets));
      } catch {
        // fall through to skip
      }
    }
    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveRandomOwned(game, playerId, "coati");
  }

  const required = getRequiredCoatiRemovalCount(game, playerId);
  if (required > 0) {
    const ids = shuffle(
      game.pieces.filter((piece) => piece.ownerId === playerId && piece.speciesId === "coati" && piece.location).map((piece) => piece.pieceId)
    ).slice(0, required);
    try {
      return removePiecesForCurrentAction(game, playerId, ids);
    } catch {
      // fall through
    }
  }

  return completeOrSkip(game, playerId);
}

function randomCapuchin(game: GameState, playerId: string, action: string): GameState {
  if (action === "A" || action === "C") {
    const targets = getCapuchinPlacementPositions(game, playerId);
    if (hasReserve(game, playerId) && targets.length > 0 && (action === "A" || maybe(0.6))) {
      try {
        return addCapuchinForCurrentAction(game, playerId, pickOne(targets));
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveRandomOwned(game, playerId, "capuchin");
  }

  return scoreCapuchinHabitatPresence(game, playerId);
}

function randomMacaw(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    const targets = getMacawEggPlacementPositions(game, playerId);
    if (hasReserve(game, playerId) && targets.length > 0 && maybe(0.7)) {
      try {
        return addMacawForCurrentAction(game, playerId, pickOne(targets));
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveRandomOwned(game, playerId, "macaw");
  }

  if (action === "C") {
    const addTargets = getMacawActionCTargets(game, playerId);
    if (hasReserve(game, playerId) && addTargets.length > 0) {
      for (const target of shuffle(addTargets)) {
        try {
          return addMacawForCurrentAction(game, playerId, target);
        } catch {
          // try next add target
        }
      }
    }

    const plays: Array<() => GameState> = [];
    for (const pieceId of getMacawRelocatablePieceIds(game, playerId)) {
      for (const target of getValidPieceMovementDestinations(game, playerId, pieceId)) {
        plays.push(() => movePieceForCurrentAction(game, playerId, pieceId, target));
      }
    }
    for (const play of shuffle(plays)) {
      try {
        return play();
      } catch {
        // try next
      }
    }
    return completeOrSkip(game, playerId);
  }

  return scoreMacawLines(game, playerId);
}

function randomArmadillo(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    const targets = getArmadilloSeedPlacementPositions(game, playerId);
    if (hasReserve(game, playerId) && targets.length > 0 && maybe(0.7)) {
      try {
        return addArmadilloForCurrentAction(game, playerId, pickOne(targets));
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveRandomOwned(game, playerId, "armadillo");
  }

  if (action === "C") {
    const hideable = getArmadilloHidePieceIds(game, playerId);
    if (hideable.length > 0 && maybe(0.5)) {
      try {
        return hideArmadilloForCurrentAction(game, playerId, pickOne(hideable));
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  return scoreArmadilloSharing(game, playerId);
}

function randomWolf(game: GameState, playerId: string, action: string): GameState {
  if (action === "B") {
    const removable = getWolfRemovableBasePieceIds(game, playerId);
    if (removable.length > 0 && maybe(0.5)) {
      try {
        return removeBasePieceForWolfAction(game, playerId, pickOne(removable));
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  if (action === "C") {
    const available = getWolfSpendableResourceTypes(game, playerId);
    const max = Math.min(getAvailableWolfPointSpendCount(game, playerId), available.length);
    const count = max > 0 ? randInt(0, max) : 0;
    const types = shuffle(available).slice(0, count);
    if (types.length > 0) {
      try {
        return spendWolfResourcesForPoints(game, playerId, types);
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  if (action === "D") {
    const targets = getWolfMeatPlacementPositions(game, playerId);
    if (hasReserve(game, playerId) && targets.length > 0 && maybe(0.7)) {
      try {
        return addWolfForCurrentAction(game, playerId, pickOne(targets));
      } catch {
        // fall through
      }
    }
  }

  return completeOrSkip(game, playerId);
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

  const pileTops = game.mataAtlanticaPiles
    ? game.mataAtlanticaPiles.map((pile) => pile[0]).filter((id): id is string => Boolean(id))
    : [];
  const candidateIds = [...player.hand, ...pileTops];
  const options = candidateIds.flatMap((cardId) =>
    rotations.flatMap((rotation) =>
      getAvailableForestExpansionPositionsForCard(game, cardId, rotation).map((position) => ({ cardId, rotation, position }))
    )
  );

  const ranked = options
    .map((option) => ({
      ...option,
      score: scoreCardPlacement(game, playerId, speciesId, option.cardId, option.position)
    }))
    .sort((a, b) => b.score - a.score);

  for (const option of chooseCandidatesForSpecies(ranked, speciesId)) {
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
    // Onca sempre gasta o maximo de carne possivel (capado em 3 pela regra).
    const spendable = getAvailableJaguarPointSpendCount(game, playerId);
    if (spendable > 0) {
      return spendJaguarMeatForPoints(game, playerId, spendable);
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
      const targets = getCapuchinPlacementPositions(game, playerId);
      const target = action === "C" ? pickCapuchinStackTarget(game, playerId, targets) : pickPosition(game, "capuchin", targets);
      return addCapuchinForCurrentAction(game, playerId, target);
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

    if (hasReserve(game, playerId) && addTargets.length > 0) {
      const addCandidates = addTargets
        .map((target) => ({
          score: scorePosition(game, "macaw", target) + 4,
          play: () => addMacawForCurrentAction(game, playerId, target)
        }))
        .sort((a, b) => b.score - a.score);

      for (const candidate of chooseCandidatePool(addCandidates)) {
        try {
          return candidate.play();
        } catch {
          // Try the next add candidate before considering relocation.
        }
      }
    }

    const relocatable = getMacawRelocatablePieceIds(game, playerId);
    const relocationCandidates: Array<{ score: number; play: () => GameState }> = [];
    for (const pieceId of relocatable) {
      for (const target of getValidPieceMovementDestinations(game, playerId, pieceId)) {
        relocationCandidates.push({
          score: scoreMove(game, playerId, "macaw", pieceId, target),
          play: () => movePieceForCurrentAction(game, playerId, pieceId, target)
        });
      }
    }

    for (const candidate of chooseCandidatePool(relocationCandidates.sort((a, b) => b.score - a.score))) {
      try {
        return candidate.play();
      } catch {
        // Try the next relocation candidate.
      }
    }

    return completeOrSkip(game, playerId);
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
    if (resources.length > 0) {
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
      score: scoreMove(game, playerId, speciesId, pieceId, position) + scoreCapture(game, playerId, speciesId, position)
    }))
  );

  const ranked = options.sort((a, b) => b.score - a.score);
  for (const option of chooseCandidatesForSpecies(ranked, speciesId)) {
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

function pickCapuchinStackTarget(game: GameState, playerId: string, positions: GridPosition[]): GridPosition {
  const ranked = positions
    .map((position) => ({ ...position, score: scoreCapuchinStackTarget(game, playerId, position) }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    throw new Error("Bot nao encontrou alvo valido.");
  }

  return ranked[0];
}

function scoreCardPlacement(game: GameState, playerId: string, speciesId: SpeciesId, cardId: string, position: GridPosition): number {
  const definition = getForestCardDefinition(cardId);
  const resourceScore = scoreResource(speciesId, definition.resource);
  const boardGrowthScore = adjacencyScore(game, position) * 1.5 - expansionCrowdingScore(game, position);
  const speciesPlanScore =
    speciesId === "macaw" && definition.resource === "egg"
      ? scoreMacawLinePotential(game, playerId, position, cardId)
      : speciesId === "capuchin"
        ? scoreCapuchinHabitatPotential(game, playerId, position, definition.habitat)
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
      return scoreMacawLinePotential(game, playerId, position);
    case "capuchin":
      return scoreCapuchinHabitatPotential(game, playerId, position, habitat);
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

function scoreMove(game: GameState, playerId: string, speciesId: SpeciesId, pieceId: string, position: GridPosition): number {
  const card = game.forest.cards.find((candidate) => candidate.x === position.x && candidate.y === position.y);
  const habitat = card ? getForestCardDefinition(card.definitionId).habitat : null;
  const base = scorePosition(game, speciesId, position);

  if (speciesId === "macaw") {
    return base + scoreMacawMove(game, playerId, pieceId, position);
  }

  if (speciesId === "capuchin") {
    return base + scoreCapuchinMove(game, playerId, pieceId, position, habitat);
  }

  if (speciesId === "armadillo") {
    return base + scoreArmadilloMove(game, playerId, pieceId, position);
  }

  if (speciesId === "jaguar") {
    return base + scoreJaguarMove(game, playerId, position, habitat);
  }

  if (speciesId === "maned_wolf") {
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
      .map((piece) => positionKey(piece.location!))
  );
  const beforeTriples = countLineTriples(ownKeys);
  ownKeys.add(positionKey(position));
  const afterTriples = countLineTriples(ownKeys);
  const completedTriples = Math.max(0, afterTriples - beforeTriples);

  return completedTriples * 130 + countNearLineWindows(ownKeys, position) * 28 + (definition?.resource === "egg" ? 4 : 0);
}

function scoreMacawMove(game: GameState, playerId: string, pieceId: string, position: GridPosition): number {
  const beforeKeys = getOwnSpeciesPositionKeys(game, playerId, "macaw");
  const afterKeys = getOwnSpeciesPositionKeys(game, playerId, "macaw", pieceId);
  afterKeys.add(positionKey(position));

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
      .map((piece) => positionKey(piece.location!))
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
    positions.add(positionKey(piece.location));
    positionsByHabitat.set(habitat, positions);
  }

  if (replacement) {
    const habitat = getHabitatAt(game, replacement);
    if (habitat) {
      const positions = positionsByHabitat.get(habitat) ?? new Set<string>();
      positions.add(positionKey(replacement));
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
    armadilloPositions.add(positionKey(replacement));
  }

  return new Set(
    game.pieces
      .filter((piece) => piece.ownerId !== playerId && piece.location && armadilloPositions.has(positionKey(piece.location)))
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

function chooseCandidatesForSpecies<T extends { score: number }>(items: T[], speciesId: SpeciesId): T[] {
  if (speciesId === "capuchin") {
    return items;
  }

  return chooseCandidatePool(items);
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}
