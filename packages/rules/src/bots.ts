import { speciesDefinitions } from "@oikos/content";
import {
  collectCaatingaBonus,
  collectCerradoBonus,
  discardMataAtlanticaPileCard,
  getCacaIlegalRemovablePieceIds,
  getCacaIlegalTopResources,
  getCoatiPairBonusTargets,
  getGaloInterruptMoveTargets,
  getGaloInterruptPieceIds,
  resolveCacaIlegal,
  resolveCoatiPairBonus,
  resolveGaloInterruptMove
} from "./setup";
import { getCurrentAction, pickOne, pickPosition } from "./botScoring";
import { completeOrSkip } from "./botShared";
import {
  moveBestPiece,
  playArmadillo,
  playCapuchin,
  playCoati,
  playForestCard,
  playGalo,
  playJaguar,
  playMacaw,
  playSetupStep,
  playWolf
} from "./botSmart";
import {
  moveRandomAmong,
  playRandomForestCard,
  playRandomSetupStep,
  randomArmadillo,
  randomCapuchin,
  randomCoati,
  randomGalo,
  randomJaguar,
  randomMacaw,
  randomWolf
} from "./botRandom";
import type { GameState, PlayerState } from "@oikos/shared";

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

  if (game.status === "active" && game.pendingGaloInterrupt?.ownerId === playerId) {
    const pieceId = getGaloInterruptPieceIds(game, playerId)[0];
    const targets = getGaloInterruptMoveTargets(game, playerId, pieceId);
    return pieceId && targets.length > 0 ? resolveGaloInterruptMove(game, playerId, pickPosition(game, "galo_de_campina", targets), pieceId) : game;
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

  if (game.status === "active" && game.pendingGaloInterrupt?.ownerId === playerId) {
    const pieceId = getGaloInterruptPieceIds(game, playerId)[0];
    const targets = getGaloInterruptMoveTargets(game, playerId, pieceId);
    return pieceId && targets.length > 0 ? resolveGaloInterruptMove(game, playerId, pickOne(targets), pieceId) : game;
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
