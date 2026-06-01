import { speciesDefinitions } from "@oikos/content";
import type { Resource, SpeciesId } from "@oikos/shared";

export const speciesList = Object.values(speciesDefinitions);

export const defaultBotTurnDelayMs = 2500;
export const botTurnDelayStepMs = 500;
export const minBotTurnDelayMs = 250;
export const maxBotTurnDelayMs = 8000;

export const SPECIES_HEX: Record<SpeciesId, string> = {
  jaguar: "#e8a33d",
  maned_wolf: "#c8553d",
  armadillo: "#b98a4b",
  macaw: "#3a7fc4",
  capuchin: "#6b8a76",
  coati: "#b6815f"
};

export const HABITAT_SCORE_COLORS = {
  forest: 0x5fd08a,
  field: 0xf2c14e,
  river: 0x3a7fc4
} as const;

export const habitatShortLabel: Record<"forest" | "field" | "river", string> = {
  forest: "Bosque",
  field: "Campo",
  river: "Rio"
};

export const categoryLabels = {
  predator: "Predador",
  subpredator: "Subpredador",
  middle: "Meio",
  base: "Base"
} as const;

export const localRoomId = "LOCAL";
export const resourceOrder: Resource[] = ["meat", "egg", "fruit", "seed"];
export const maxTurnHistory = 20;
