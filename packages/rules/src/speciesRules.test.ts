import { describe, expect, it } from "vitest";
import { speciesDefinitions } from "@oikos/content";
import type { SpeciesId } from "@oikos/shared";
import {
  canSpeciesRemovePieceForCacaIlegal,
  getSpeciesPieceLogName,
  hasSpeciesMovementRule,
  speciesRules
} from "./speciesRules";
import { getSpeciesModule, speciesActionRequiresForestCard, speciesModules } from "./speciesModules";

describe("species rules registry", () => {
  it("has one rule entry for every content species", () => {
    expect(Object.keys(speciesRules).sort()).toEqual(Object.keys(speciesDefinitions).sort());
  });

  it("keeps cross-rule capabilities centralized by species", () => {
    const cardMovementSpecies: SpeciesId[] = ["coati", "capuchin", "macaw", "galo_de_campina", "armadillo"];

    expect(canSpeciesRemovePieceForCacaIlegal("jaguar")).toBe(false);
    expect(canSpeciesRemovePieceForCacaIlegal("maned_wolf")).toBe(true);
    expect(getSpeciesPieceLogName("capuchin")).toBe("macaco-prego");
    expect(hasSpeciesMovementRule("jaguar", "jaguar", "B")).toBe(true);
    expect(hasSpeciesMovementRule("maned_wolf", "pending_all_by_played_card", "A")).toBe(true);
    expect(hasSpeciesMovementRule("macaw", "relocate", "C")).toBe(true);

    for (const speciesId of cardMovementSpecies) {
      expect(hasSpeciesMovementRule(speciesId, "played_card", "B")).toBe(true);
    }
  });

  it("has one species module with bot hooks for every content species", () => {
    expect(Object.keys(speciesModules).sort()).toEqual(Object.keys(speciesDefinitions).sort());

    for (const speciesId of Object.keys(speciesDefinitions) as SpeciesId[]) {
      const module = getSpeciesModule(speciesId);
      expect(module.speciesId).toBe(speciesId);
      expect(module.rules).toBe(speciesRules[speciesId]);
      expect(typeof module.bots.playSmartAction).toBe("function");
      expect(typeof module.bots.playRandomAction).toBe("function");

      for (const actionId of speciesDefinitions[speciesId].actions) {
        expect(module.actions[actionId]?.actionId).toBe(actionId);
      }
    }
  });

  it("describes which species actions need a forest card before the action bot runs", () => {
    expect(speciesActionRequiresForestCard("jaguar", "A")).toBe(false);
    expect(speciesActionRequiresForestCard("jaguar", "B")).toBe(false);
    expect(speciesActionRequiresForestCard("maned_wolf", "A")).toBe(true);
    expect(speciesActionRequiresForestCard("coati", "A")).toBe(true);
    expect(speciesActionRequiresForestCard("coati", "B")).toBe(false);
  });
});
