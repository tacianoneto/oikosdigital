import {
  getAvailableForestExpansionPositionsForCard,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getMacawRelocatablePieceIds,
  getRequiredCoatiRemovalCount,
  getValidPieceMovementDestinations,
  getWolfRemovableBasePieceIds,
  getWolfSpendableResourceTypes,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece,
  removeBasePieceForWolfAction,
  removePiecesForCurrentAction,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints
} from "./setup";
import {
  applySpeciesPieceTargetAction,
  applySpeciesPlacementAction,
  applySpeciesScoreAction,
  getSpeciesPieceTargets,
  getSpeciesPlacementTargets
} from "./speciesActions";
import {
  chooseCandidatePool,
  chooseCandidatesForSpecies,
  hasReserve,
  pickCaptureTarget,
  pickCapuchinStackTarget,
  pickOne,
  pickPosition,
  rankSetupPositions,
  scoreCapture,
  scoreCardPlacement,
  scoreMove,
  scorePosition
} from "./botScoring";
import { completeOrSkip, rotations } from "./botShared";
import type { ActionId, GameState, SpeciesId } from "@oikos/shared";

export function playSetupStep(game: GameState, playerId: string): GameState {
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

export function playForestCard(game: GameState, playerId: string, speciesId: SpeciesId): GameState {
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

export function playJaguar(game: GameState, playerId: string, action: string): GameState {
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

export function playCoati(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    if (hasReserve(game, playerId)) {
      return playBestPlacementAction(game, playerId, "coati", "A");
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

export function playCapuchin(game: GameState, playerId: string, action: string): GameState {
  if (action === "A" || action === "C") {
    if (hasReserve(game, playerId)) {
      const targets = getSpeciesPlacementTargets(game, playerId, "capuchin", action);
      const target = action === "C" ? pickCapuchinStackTarget(game, playerId, targets) : pickPosition(game, "capuchin", targets);
      return applySpeciesPlacementAction(game, playerId, "capuchin", action, target);
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveBestOwnedSpeciesPiece(game, playerId, "capuchin");
  }

  return applySpeciesScoreAction(game, playerId, "capuchin", "D");
}

export function playMacaw(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    if (hasReserve(game, playerId)) {
      return playBestPlacementAction(game, playerId, "macaw", "A");
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveBestOwnedSpeciesPiece(game, playerId, "macaw");
  }

  if (action === "C") {
    const addTargets = getSpeciesPlacementTargets(game, playerId, "macaw", "C");

    if (hasReserve(game, playerId) && addTargets.length > 0) {
      const addCandidates = addTargets
        .map((target) => ({
          score: scorePosition(game, "macaw", target) + 4,
          play: () => applySpeciesPlacementAction(game, playerId, "macaw", "C", target)
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

  return applySpeciesScoreAction(game, playerId, "macaw", "D");
}

export function playGalo(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    if (hasReserve(game, playerId)) {
      const targets = getSpeciesPlacementTargets(game, playerId, "galo_de_campina", "A");
      if (targets.length > 0) {
        return applySpeciesPlacementAction(game, playerId, "galo_de_campina", "A", pickPosition(game, "galo_de_campina", targets));
      }
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveBestOwnedSpeciesPiece(game, playerId, "galo_de_campina");
  }

  if (action === "C") {
    return moveBestOwnedSpeciesPiece(game, playerId, "galo_de_campina");
  }

  return applySpeciesScoreAction(game, playerId, "galo_de_campina", "D");
}

export function playArmadillo(game: GameState, playerId: string, action: string): GameState {
  if (action === "A") {
    if (hasReserve(game, playerId)) {
      return playBestPlacementAction(game, playerId, "armadillo", "A");
    }

    return completeOrSkip(game, playerId);
  }

  if (action === "B") {
    return moveBestOwnedSpeciesPiece(game, playerId, "armadillo");
  }

  if (action === "C") {
    const hideable = getSpeciesPieceTargets(game, playerId, "armadillo", "C");
    if (hideable.length > 0) {
      return applySpeciesPieceTargetAction(game, playerId, "armadillo", "C", pickOne(hideable));
    }
    return completeOrSkip(game, playerId);
  }

  return applySpeciesScoreAction(game, playerId, "armadillo", "D");
}

export function playWolf(game: GameState, playerId: string, action: string): GameState {
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
    const targets = getSpeciesPlacementTargets(game, playerId, "maned_wolf", "D");
    if (hasReserve(game, playerId) && targets.length > 0) {
      return applySpeciesPlacementAction(game, playerId, "maned_wolf", "D", pickPosition(game, "maned_wolf", targets));
    }
  }

  return completeOrSkip(game, playerId);
}

function playBestPlacementAction(game: GameState, playerId: string, speciesId: SpeciesId, action: ActionId): GameState {
  const targets = getSpeciesPlacementTargets(game, playerId, speciesId, action);
  return applySpeciesPlacementAction(game, playerId, speciesId, action, pickPosition(game, speciesId, targets));
}

function moveBestOwnedSpeciesPiece(game: GameState, playerId: string, speciesId: SpeciesId): GameState {
  const pieceIds = game.pieces
    .filter((piece) => piece.ownerId === playerId && piece.speciesId === speciesId && piece.location)
    .map((piece) => piece.pieceId);

  return moveBestPiece(game, playerId, speciesId, pieceIds);
}

export function moveBestPiece(game: GameState, playerId: string, speciesId: SpeciesId, pieceIds: string[]): GameState {
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
