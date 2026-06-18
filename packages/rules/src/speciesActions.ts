import type { ActionId, GameState, GridPosition, SpeciesId } from "@oikos/shared";
import {
  addArmadilloForCurrentAction,
  getArmadilloHidePieceIds,
  getArmadilloSeedPlacementPositions,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing
} from "./species/armadillo";
import {
  addCapuchinForCurrentAction,
  getCapuchinPlacementPositions,
  scoreCapuchinHabitatPresence
} from "./species/capuchin";
import { addCoatiForCurrentAction, getCoatiFruitPlacementPositions } from "./species/coati";
import {
  addGaloForCurrentAction,
  getGaloFieldPlacementPositions,
  scoreGaloFieldPresence
} from "./species/galo";
import {
  addMacawForCurrentAction,
  getMacawActionCTargets,
  getMacawEggPlacementPositions,
  scoreMacawLines
} from "./species/macaw";
import { addWolfForCurrentAction, getWolfMeatPlacementPositions } from "./species/wolf";

export type SpeciesPlacementTargetSelector = (game: GameState, playerId: string) => GridPosition[];
export type SpeciesPieceTargetSelector = (game: GameState, playerId: string) => string[];
export type SpeciesPlacementApplier = (game: GameState, playerId: string, location: GridPosition) => GameState;
export type SpeciesPieceTargetApplier = (game: GameState, playerId: string, pieceId: string) => GameState;
export type SpeciesScoreApplier = (game: GameState, playerId: string) => GameState;

export interface SpeciesActionRuntime {
  getPlacementTargets?: SpeciesPlacementTargetSelector;
  applyPlacementTarget?: SpeciesPlacementApplier;
  getPieceTargets?: SpeciesPieceTargetSelector;
  applyPieceTarget?: SpeciesPieceTargetApplier;
  applyScore?: SpeciesScoreApplier;
}

export const speciesActionRuntimes: Record<SpeciesId, Partial<Record<ActionId, SpeciesActionRuntime>>> = {
  jaguar: {},
  maned_wolf: {
    D: {
      getPlacementTargets: getWolfMeatPlacementPositions,
      applyPlacementTarget: addWolfForCurrentAction
    }
  },
  armadillo: {
    A: {
      getPlacementTargets: getArmadilloSeedPlacementPositions,
      applyPlacementTarget: addArmadilloForCurrentAction
    },
    C: {
      getPieceTargets: getArmadilloHidePieceIds,
      applyPieceTarget: hideArmadilloForCurrentAction
    },
    D: {
      applyScore: scoreArmadilloSharing
    }
  },
  macaw: {
    A: {
      getPlacementTargets: getMacawEggPlacementPositions,
      applyPlacementTarget: addMacawForCurrentAction
    },
    C: {
      getPlacementTargets: getMacawActionCTargets,
      applyPlacementTarget: addMacawForCurrentAction
    },
    D: {
      applyScore: scoreMacawLines
    }
  },
  galo_de_campina: {
    A: {
      getPlacementTargets: getGaloFieldPlacementPositions,
      applyPlacementTarget: addGaloForCurrentAction
    },
    D: {
      applyScore: scoreGaloFieldPresence
    }
  },
  capuchin: {
    A: {
      getPlacementTargets: getCapuchinPlacementPositions,
      applyPlacementTarget: addCapuchinForCurrentAction
    },
    C: {
      getPlacementTargets: getCapuchinPlacementPositions,
      applyPlacementTarget: addCapuchinForCurrentAction
    },
    D: {
      applyScore: scoreCapuchinHabitatPresence
    }
  },
  coati: {
    A: {
      getPlacementTargets: getCoatiFruitPlacementPositions,
      applyPlacementTarget: addCoatiForCurrentAction
    }
  }
};

export function getSpeciesActionRuntime(speciesId: SpeciesId, actionId: ActionId): SpeciesActionRuntime | null {
  return speciesActionRuntimes[speciesId][actionId] ?? null;
}

export function getSpeciesPlacementTargets(game: GameState, playerId: string, speciesId: SpeciesId, actionId: ActionId): GridPosition[] {
  return getSpeciesActionRuntime(speciesId, actionId)?.getPlacementTargets?.(game, playerId) ?? [];
}

export function applySpeciesPlacementAction(
  game: GameState,
  playerId: string,
  speciesId: SpeciesId,
  actionId: ActionId,
  location: GridPosition
): GameState {
  const applyPlacementTarget = getSpeciesActionRuntime(speciesId, actionId)?.applyPlacementTarget;
  if (!applyPlacementTarget) {
    throw new Error(`Acao ${actionId} de ${speciesId} nao possui aplicador de alvo de tabuleiro registrado.`);
  }

  return applyPlacementTarget(game, playerId, location);
}

export function getSpeciesPieceTargets(game: GameState, playerId: string, speciesId: SpeciesId, actionId: ActionId): string[] {
  return getSpeciesActionRuntime(speciesId, actionId)?.getPieceTargets?.(game, playerId) ?? [];
}

export function applySpeciesPieceTargetAction(
  game: GameState,
  playerId: string,
  speciesId: SpeciesId,
  actionId: ActionId,
  pieceId: string
): GameState {
  const applyPieceTarget = getSpeciesActionRuntime(speciesId, actionId)?.applyPieceTarget;
  if (!applyPieceTarget) {
    throw new Error(`Acao ${actionId} de ${speciesId} nao possui aplicador de alvo de peca registrado.`);
  }

  return applyPieceTarget(game, playerId, pieceId);
}

export function applySpeciesScoreAction(game: GameState, playerId: string, speciesId: SpeciesId, actionId: ActionId): GameState {
  const applyScore = getSpeciesActionRuntime(speciesId, actionId)?.applyScore;
  if (!applyScore) {
    throw new Error(`Acao ${actionId} de ${speciesId} nao possui pontuacao registrada.`);
  }

  return applyScore(game, playerId);
}
