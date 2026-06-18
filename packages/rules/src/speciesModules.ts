import type { ActionId, GameState, SpeciesId } from "@oikos/shared";
import { speciesRules, type SpeciesRuleDefinition } from "./speciesRules";
import {
  moveBestPiece,
  playArmadillo,
  playCapuchin,
  playCoati,
  playGalo,
  playJaguar,
  playMacaw,
  playWolf
} from "./botSmart";
import {
  moveRandomAmong,
  randomArmadillo,
  randomCapuchin,
  randomCoati,
  randomGalo,
  randomJaguar,
  randomMacaw,
  randomWolf
} from "./botRandom";

export type BotActionPlayer = (game: GameState, playerId: string, action: ActionId) => GameState;
export type PendingMovementPlayer = (game: GameState, playerId: string, speciesId: SpeciesId, pieceIds: string[]) => GameState;

export interface SpeciesActionDefinition {
  actionId: ActionId;
  requiresForestCardBeforeAction: boolean;
}

export interface SpeciesBotHooks {
  playSmartAction: BotActionPlayer;
  playRandomAction: BotActionPlayer;
  playSmartPendingMovement?: PendingMovementPlayer;
  playRandomPendingMovement?: PendingMovementPlayer;
}

export interface SpeciesModule {
  speciesId: SpeciesId;
  rules: SpeciesRuleDefinition;
  actions: Partial<Record<ActionId, SpeciesActionDefinition>>;
  bots: SpeciesBotHooks;
}

function action(actionId: ActionId, options?: Partial<Omit<SpeciesActionDefinition, "actionId">>): SpeciesActionDefinition {
  return {
    actionId,
    requiresForestCardBeforeAction: false,
    ...options
  };
}

function standardCardSpeciesActions(actionIds: ActionId[]): Partial<Record<ActionId, SpeciesActionDefinition>> {
  return Object.fromEntries(
    actionIds.map((actionId) => [actionId, action(actionId, { requiresForestCardBeforeAction: actionId === "A" })])
  ) as Partial<Record<ActionId, SpeciesActionDefinition>>;
}

export const speciesModules = {
  jaguar: {
    speciesId: "jaguar",
    rules: speciesRules.jaguar,
    actions: {
      A: action("A"),
      B: action("B"),
      C: action("C")
    },
    bots: {
      playSmartAction: playJaguar,
      playRandomAction: randomJaguar
    }
  },
  maned_wolf: {
    speciesId: "maned_wolf",
    rules: speciesRules.maned_wolf,
    actions: standardCardSpeciesActions(["A", "B", "C", "D"]),
    bots: {
      playSmartAction: playWolf,
      playRandomAction: randomWolf,
      playSmartPendingMovement: moveBestPiece,
      playRandomPendingMovement: moveRandomAmong
    }
  },
  armadillo: {
    speciesId: "armadillo",
    rules: speciesRules.armadillo,
    actions: standardCardSpeciesActions(["A", "B", "C", "D"]),
    bots: {
      playSmartAction: playArmadillo,
      playRandomAction: randomArmadillo
    }
  },
  macaw: {
    speciesId: "macaw",
    rules: speciesRules.macaw,
    actions: standardCardSpeciesActions(["A", "B", "C", "D"]),
    bots: {
      playSmartAction: playMacaw,
      playRandomAction: randomMacaw
    }
  },
  galo_de_campina: {
    speciesId: "galo_de_campina",
    rules: speciesRules.galo_de_campina,
    actions: standardCardSpeciesActions(["A", "B", "C", "D"]),
    bots: {
      playSmartAction: playGalo,
      playRandomAction: randomGalo
    }
  },
  capuchin: {
    speciesId: "capuchin",
    rules: speciesRules.capuchin,
    actions: standardCardSpeciesActions(["A", "B", "C", "D"]),
    bots: {
      playSmartAction: playCapuchin,
      playRandomAction: randomCapuchin
    }
  },
  coati: {
    speciesId: "coati",
    rules: speciesRules.coati,
    actions: standardCardSpeciesActions(["A", "B", "C"]),
    bots: {
      playSmartAction: playCoati,
      playRandomAction: randomCoati
    }
  }
} satisfies Record<SpeciesId, SpeciesModule>;

export function getSpeciesModule(speciesId: SpeciesId): SpeciesModule {
  return speciesModules[speciesId];
}

export function getSpeciesActionDefinition(speciesId: SpeciesId, actionId: ActionId): SpeciesActionDefinition | null {
  return getSpeciesModule(speciesId).actions[actionId] ?? null;
}

export function speciesActionRequiresForestCard(speciesId: SpeciesId, actionId: ActionId): boolean {
  return Boolean(getSpeciesActionDefinition(speciesId, actionId)?.requiresForestCardBeforeAction);
}
