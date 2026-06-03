import { describe, expect, it } from "vitest";
import { speciesDefinitions } from "@oikos/content";
import type { SpeciesId } from "@oikos/shared";
import {
  canSpeciesRemovePieceForCacaIlegal,
  getSpeciesPieceLogName,
  hasSpeciesMovementRule,
  speciesRules
} from "./speciesRules";

describe("species rules registry", () => {
  it("has one rule entry for every content species", () => {
    expect(Object.keys(speciesRules).sort()).toEqual(Object.keys(speciesDefinitions).sort());
  });

  it("keeps cross-rule capabilities centralized by species", () => {
    const cardMovementSpecies: SpeciesId[] = ["coati", "capuchin", "macaw", "armadillo"];

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
});
