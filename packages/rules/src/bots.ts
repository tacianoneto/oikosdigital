import { speciesDefinitions } from "@oikos/content";
import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addGaloForCurrentAction,
  addGaloAdjacentForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  collectCaatingaBonus,
  collectCerradoBonus,
  completeCurrentAction,
  discardMataAtlanticaPileCard,
  resolveCacaIlegal,
  getCacaIlegalRemovablePieceIds,
  getCacaIlegalTopResources,
  forceEndPlayerTurn,
  getArmadilloHidePieceIds,
  getArmadilloSeedPlacementPositions,
  getAvailableForestExpansionPositionsForCard,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getCapuchinPlacementPositions,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getGaloFieldPlacementPositions,
  getGaloAdjacentAddPositions,
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
  scoreGaloSeedCards,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints
} from "./setup";
import {
  chooseCandidatePool,
  chooseCandidatesForSpecies,
  getCurrentAction,
  hasReserve,
  pickCaptureTarget,
  pickCapuchinStackTarget,
  pickOne,
  pickPosition,
  rankSetupPositions,
  scoreCapture,
  scoreCardPlacement,
  scoreMove,
  scorePosition,
  shuffle
} from "./botScoring";
import type { GameState, GridPosition, PlayerState, SpeciesId } from "@oikos/shared";

const rotations = [0, 90, 180, 270] as const;

// Shared bot preamble: resolve scenario prompts (Caatinga/Cerrado/Caca ilegal)
// and the Mata Atlantica forced discard before the species acts. Both the smart
// and the random takeover bot run this identically; returns the resulting game
// when it acted, or null to let the caller continue.
function resolvePendingScenarioStep(game: GameState, player: PlayerState): GameState | null {
  const playerId = player.playerId;

  if (game.caatingaPending?.playerId === playerId) {
    try {
      return collectCaatingaBonus(game, playerId);
    } catch {
      // fall through and keep playing
    }
  }

  if (game.cerradoPending?.playerId === playerId) {
    try {
      return collectCerradoBonus(game, playerId);
    } catch {
      // fall through and keep playing
    }
  }

  if (game.cacaIlegalPending?.playerId === playerId) {
    try {
      const top = getCacaIlegalTopResources(game, playerId);
      if (top.length > 0) {
        return resolveCacaIlegal(game, playerId, { kind: "spend_resource", resource: top[0] });
      }
      const removable = getCacaIlegalRemovablePieceIds(game, playerId);
      if (removable.length > 0) {
        return resolveCacaIlegal(game, playerId, { kind: "remove_piece", pieceId: removable[0] });
      }
    } catch {
      // fall through
    }
  }

  // Mata Atlântica: non-card species must discard 1 top card from a pile.
  if (
    game.mataAtlanticaPiles &&
    player.speciesId &&
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

  return null;
}

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

  const scenarioStep = resolvePendingScenarioStep(game, player);
  if (scenarioStep) {
    return scenarioStep;
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
    case "galo_de_campina":
      return playGalo(game, playerId, action);
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

  const scenarioStep = resolvePendingScenarioStep(game, player);
  if (scenarioStep) {
    return scenarioStep;
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
    case "galo_de_campina":
      return randomGalo(game, playerId, action);
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

function randomGalo(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    const targets = getGaloFieldPlacementPositions(game, playerId);
    if (hasReserve(game, playerId) && targets.length > 0 && maybe(0.7)) {
      try {
        return addGaloForCurrentAction(game, playerId, pickOne(targets));
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveRandomOwned(game, playerId, "galo_de_campina");
  }

  if (action === "C") {
    if (game.pendingGaloAdjacentAdd?.playerId === playerId) {
      const targets = getGaloAdjacentAddPositions(game, playerId);
      if (targets.length > 0) {
        try {
          return addGaloAdjacentForCurrentAction(game, playerId, pickOne(targets));
        } catch {
          // fall through to skip
        }
      }
      return completeOrSkip(game, playerId);
    }

    const player = game.players.find((candidate) => candidate.playerId === playerId);
    if ((player?.resources.seed ?? 0) > 0 && maybe(0.6)) {
      return moveRandomOwned(game, playerId, "galo_de_campina");
    }
    return completeOrSkip(game, playerId);
  }

  return scoreGaloSeedCards(game, playerId);
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

function playGalo(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    if (hasReserve(game, playerId)) {
      const targets = getGaloFieldPlacementPositions(game, playerId);
      if (targets.length > 0) {
        return addGaloForCurrentAction(game, playerId, pickPosition(game, "galo_de_campina", targets));
      }
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveBestOwnedSpeciesPiece(game, playerId, "galo_de_campina");
  }

  if (action === "C") {
    if (game.pendingGaloAdjacentAdd?.playerId === playerId) {
      const targets = getGaloAdjacentAddPositions(game, playerId);
      if (targets.length > 0) {
        return addGaloAdjacentForCurrentAction(game, playerId, pickPosition(game, "galo_de_campina", targets));
      }

      return completeOrSkip(game, playerId);
    }

    const player = game.players.find((candidate) => candidate.playerId === playerId);
    if ((player?.resources.seed ?? 0) > 0) {
      return moveBestOwnedSpeciesPiece(game, playerId, "galo_de_campina");
    }

    return completeOrSkip(game, playerId);
  }

  return scoreGaloSeedCards(game, playerId);
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

