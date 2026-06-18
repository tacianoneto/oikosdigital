import type { ActionId, GameState, SpeciesId } from "@oikos/shared";
import { getSpeciesActionRuntime, type SpeciesActionRuntime } from "./speciesActions";
import { speciesBotScoringProfiles, type SpeciesBotScoringProfile } from "./speciesBotProfiles";
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
  runtime: SpeciesActionRuntime | null;
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
  botScoring: SpeciesBotScoringProfile;
  bots: SpeciesBotHooks;
}

function action(
  speciesId: SpeciesId,
  actionId: ActionId,
  options?: Partial<Omit<SpeciesActionDefinition, "actionId" | "runtime">>
): SpeciesActionDefinition {
  return {
    actionId,
    requiresForestCardBeforeAction: false,
    runtime: getSpeciesActionRuntime(speciesId, actionId),
    ...options
  };
}

function standardCardSpeciesActions(speciesId: SpeciesId, actionIds: ActionId[]): Partial<Record<ActionId, SpeciesActionDefinition>> {
  return Object.fromEntries(
    actionIds.map((actionId) => [actionId, action(speciesId, actionId, { requiresForestCardBeforeAction: actionId === "A" })])
  ) as Partial<Record<ActionId, SpeciesActionDefinition>>;
}

export const speciesModules = {
  jaguar: {
    speciesId: "jaguar",
    rules: speciesRules.jaguar,
    botScoring: speciesBotScoringProfiles.jaguar,
    actions: {
      A: action("jaguar", "A"),
      B: action("jaguar", "B"),
      C: action("jaguar", "C")
    },
    bots: {
      playSmartAction: playJaguar,
      playRandomAction: randomJaguar
    }
  },
  maned_wolf: {
    speciesId: "maned_wolf",
    rules: speciesRules.maned_wolf,
    botScoring: speciesBotScoringProfiles.maned_wolf,
    actions: standardCardSpeciesActions("maned_wolf", ["A", "B", "C", "D"]),
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
    botScoring: speciesBotScoringProfiles.armadillo,
    actions: standardCardSpeciesActions("armadillo", ["A", "B", "C", "D"]),
    bots: {
      playSmartAction: playArmadillo,
      playRandomAction: randomArmadillo
    }
  },
  macaw: {
    speciesId: "macaw",
    rules: speciesRules.macaw,
    botScoring: speciesBotScoringProfiles.macaw,
    actions: standardCardSpeciesActions("macaw", ["A", "B", "C", "D"]),
    bots: {
      playSmartAction: playMacaw,
      playRandomAction: randomMacaw
    }
  },
  galo_de_campina: {
    speciesId: "galo_de_campina",
    rules: speciesRules.galo_de_campina,
    botScoring: speciesBotScoringProfiles.galo_de_campina,
    actions: standardCardSpeciesActions("galo_de_campina", ["A", "B", "C", "D"]),
    bots: {
      playSmartAction: playGalo,
      playRandomAction: randomGalo
    }
  },
  capuchin: {
    speciesId: "capuchin",
    rules: speciesRules.capuchin,
    botScoring: speciesBotScoringProfiles.capuchin,
    actions: standardCardSpeciesActions("capuchin", ["A", "B", "C", "D"]),
    bots: {
      playSmartAction: playCapuchin,
      playRandomAction: randomCapuchin
    }
  },
  coati: {
    speciesId: "coati",
    rules: speciesRules.coati,
    botScoring: speciesBotScoringProfiles.coati,
    actions: standardCardSpeciesActions("coati", ["A", "B", "C"]),
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
