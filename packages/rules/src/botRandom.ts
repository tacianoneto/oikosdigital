import {
  getAvailableForestExpansionPositionsForCard,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getMacawRelocatablePieceIds,
  getRequiredCoatiRemovalCount,
  getValidPieceMovementDestinations,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece
} from "./setup";
import {
  applySpeciesCountSpendAction,
  applySpeciesPieceTargetAction,
  applySpeciesPieceTargetsAction,
  applySpeciesPlacementAction,
  applySpeciesResourceSpendAction,
  applySpeciesScoreAction,
  getSpeciesPieceTargets,
  getSpeciesPlacementTargets,
  getSpeciesResourceTargets
} from "./speciesActions";
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

  return completeOrSkip(game, playerId);
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
      return applySpeciesCountSpendAction(game, playerId, "jaguar", "C", count);
    }
    return completeOrSkip(game, playerId);
  }

  return moveRandomOwned(game, playerId, "jaguar");
}

export function randomCoati(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    const targets = getSpeciesPlacementTargets(game, playerId, "coati", "A");
    if (hasReserve(game, playerId) && targets.length > 0 && maybe(0.6)) {
      try {
        return applySpeciesPlacementAction(game, playerId, "coati", "A", pickOne(targets));
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
    const ids = shuffle(getSpeciesPieceTargets(game, playerId, "coati", "C")).slice(0, required);
    try {
      return applySpeciesPieceTargetsAction(game, playerId, "coati", "C", ids);
    } catch {
      // fall through
    }
  }

  return completeOrSkip(game, playerId);
}

export function randomCapuchin(game: GameState, playerId: string, action: string): GameState {
  if (action === "A" || action === "C") {
    const targets = getSpeciesPlacementTargets(game, playerId, "capuchin", action);
    if (hasReserve(game, playerId) && targets.length > 0 && (action === "A" || maybe(0.6))) {
      try {
        return applySpeciesPlacementAction(game, playerId, "capuchin", action, pickOne(targets));
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveRandomOwned(game, playerId, "capuchin");
  }

  return applySpeciesScoreAction(game, playerId, "capuchin", "D");
}

export function randomMacaw(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    const targets = getSpeciesPlacementTargets(game, playerId, "macaw", "A");
    if (hasReserve(game, playerId) && targets.length > 0 && maybe(0.7)) {
      try {
        return applySpeciesPlacementAction(game, playerId, "macaw", "A", pickOne(targets));
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
    const addTargets = getSpeciesPlacementTargets(game, playerId, "macaw", "C");
    if (hasReserve(game, playerId) && addTargets.length > 0) {
      for (const target of shuffle(addTargets)) {
        try {
          return applySpeciesPlacementAction(game, playerId, "macaw", "C", target);
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

  return applySpeciesScoreAction(game, playerId, "macaw", "D");
}

export function randomGalo(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    const targets = getSpeciesPlacementTargets(game, playerId, "galo_de_campina", "A");
    if (hasReserve(game, playerId) && targets.length > 0 && maybe(0.7)) {
      try {
        return applySpeciesPlacementAction(game, playerId, "galo_de_campina", "A", pickOne(targets));
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
    if (maybe(0.6)) {
      return moveRandomOwned(game, playerId, "galo_de_campina");
    }
    return completeOrSkip(game, playerId);
  }

  return applySpeciesScoreAction(game, playerId, "galo_de_campina", "D");
}

export function randomArmadillo(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    const targets = getSpeciesPlacementTargets(game, playerId, "armadillo", "A");
    if (hasReserve(game, playerId) && targets.length > 0 && maybe(0.7)) {
      try {
        return applySpeciesPlacementAction(game, playerId, "armadillo", "A", pickOne(targets));
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
    const hideable = getSpeciesPieceTargets(game, playerId, "armadillo", "C");
    if (hideable.length > 0 && maybe(0.5)) {
      try {
        return applySpeciesPieceTargetAction(game, playerId, "armadillo", "C", pickOne(hideable));
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  return applySpeciesScoreAction(game, playerId, "armadillo", "D");
}

export function randomWolf(game: GameState, playerId: string, action: string): GameState {
  if (action === "B") {
    const removable = getSpeciesPieceTargets(game, playerId, "maned_wolf", "B");
    if (removable.length > 0 && maybe(0.5)) {
      try {
        return applySpeciesPieceTargetAction(game, playerId, "maned_wolf", "B", pickOne(removable));
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  if (action === "C") {
    const available = getSpeciesResourceTargets(game, playerId, "maned_wolf", "C");
    const max = Math.min(getAvailableWolfPointSpendCount(game, playerId), available.length);
    const count = max > 0 ? randInt(0, max) : 0;
    const types = shuffle(available).slice(0, count);
    if (types.length > 0) {
      try {
        return applySpeciesResourceSpendAction(game, playerId, "maned_wolf", "C", types);
      } catch {
        // fall through
      }
    }
    return completeOrSkip(game, playerId);
  }

  if (action === "D") {
    const targets = getSpeciesPlacementTargets(game, playerId, "maned_wolf", "D");
    if (hasReserve(game, playerId) && targets.length > 0 && maybe(0.7)) {
      try {
        return applySpeciesPlacementAction(game, playerId, "maned_wolf", "D", pickOne(targets));
      } catch {
        // fall through
      }
    }
  }

  return completeOrSkip(game, playerId);
}
