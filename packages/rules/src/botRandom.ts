import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addGaloForCurrentAction,
  addGaloAdjacentForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  getArmadilloHidePieceIds,
  getArmadilloSeedPlacementPositions,
  getAvailableForestExpansionPositionsForCard,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getCapuchinPlacementPositions,
  getCoatiFruitPlacementPositions,
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
  scoreArmadilloSharing,
  scoreCapuchinHabitatPresence,
  scoreGaloSeedCards,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints
} from "./setup";
import { hasReserve, pickOne, shuffle } from "./botScoring";
import { completeOrSkip, rotations } from "./botShared";
import type { GameState, GridPosition, SpeciesId } from "@oikos/shared";

export function playRandomSetupStep(game: GameState, playerId: string): GameState {
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

export function playRandomForestCard(game: GameState, playerId: string): GameState {
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

export function moveRandomAmong(game: GameState, playerId: string, speciesId: SpeciesId, pieceIds: string[]): GameState {
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

export function randomJaguar(game: GameState, playerId: string, action: string): GameState {
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

export function randomCoati(game: GameState, playerId: string, action: string): GameState {
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

export function randomCapuchin(game: GameState, playerId: string, action: string): GameState {
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

export function randomMacaw(game: GameState, playerId: string, action: string): GameState {
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

export function randomGalo(game: GameState, playerId: string, action: string): GameState {
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

export function randomArmadillo(game: GameState, playerId: string, action: string): GameState {
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

export function randomWolf(game: GameState, playerId: string, action: string): GameState {
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
