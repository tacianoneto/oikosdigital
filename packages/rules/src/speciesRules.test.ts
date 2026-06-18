import { describe, expect, it } from "vitest";
import { speciesDefinitions } from "@oikos/content";
import type { SpeciesId } from "@oikos/shared";
import {
  canSpeciesRemovePieceForCacaIlegal,
  getSpeciesPieceLogName,
  hasSpeciesMovementRule,
  speciesRules
} from "./speciesRules";
import { getSpeciesActionRuntime, speciesActionRuntimes } from "./speciesActions";
import { getSpeciesBotScoringProfile, speciesBotScoringProfiles } from "./speciesBotProfiles";
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
      expect(module.botScoring).toBe(speciesBotScoringProfiles[speciesId]);
      expect(typeof module.bots.playSmartAction).toBe("function");
      expect(typeof module.bots.playRandomAction).toBe("function");

      for (const actionId of speciesDefinitions[speciesId].actions) {
        expect(module.actions[actionId]?.actionId).toBe(actionId);
        expect(module.actions[actionId]?.runtime).toBe(getSpeciesActionRuntime(speciesId, actionId));
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

  it("centralizes bot scoring preferences by species", () => {
    expect(Object.keys(speciesBotScoringProfiles).sort()).toEqual(Object.keys(speciesDefinitions).sort());
    expect(getSpeciesBotScoringProfile("jaguar").resourcePreference[0]).toBe("meat");
    expect(getSpeciesBotScoringProfile("macaw").planScoring).toBe("macaw_line");
    expect(getSpeciesBotScoringProfile("capuchin").preserveRankedCandidateOrder).toBe(true);
    expect(getSpeciesBotScoringProfile("coati").setupAdjacencyWeight).toBe(5);
    expect(getSpeciesBotScoringProfile("maned_wolf").moveScoring).toContain("wolf");
  });

  it("centralizes action target selectors and appliers for migrated species actions", () => {
    expect(Object.keys(speciesActionRuntimes).sort()).toEqual(Object.keys(speciesDefinitions).sort());
    expect(getSpeciesActionRuntime("coati", "A")?.getPlacementTargets).toBeTypeOf("function");
    expect(getSpeciesActionRuntime("coati", "A")?.applyPlacementTarget).toBeTypeOf("function");
    expect(getSpeciesActionRuntime("armadillo", "C")?.getPieceTargets).toBeTypeOf("function");
    expect(getSpeciesActionRuntime("armadillo", "C")?.applyPieceTarget).toBeTypeOf("function");
    expect(getSpeciesActionRuntime("macaw", "D")?.applyScore).toBeTypeOf("function");
    expect(getSpeciesActionRuntime("capuchin", "D")?.applyScore).toBeTypeOf("function");
    expect(getSpeciesActionRuntime("jaguar", "A")).toBe(null);
  });
});
