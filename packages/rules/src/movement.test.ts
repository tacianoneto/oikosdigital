import { describe, expect, it } from "vitest";
import { getMovementKindForSpecies, getMovementOffsets } from "./movement";

describe("movement definitions", () => {
  it("matches the updated GDD movement table", () => {
    expect(getMovementKindForSpecies("jaguar", "forest")).toBe("knight_jump");
    expect(getMovementKindForSpecies("jaguar", "field")).toBe("diagonal");
    expect(getMovementKindForSpecies("jaguar", "river")).toBe("straight_jump");

    expect(getMovementKindForSpecies("maned_wolf", "forest")).toBe("straight_jump");
    expect(getMovementKindForSpecies("maned_wolf", "field")).toBe("adjacent");
    expect(getMovementKindForSpecies("maned_wolf", "river")).toBe("diagonal");

    expect(getMovementKindForSpecies("armadillo", "forest")).toBe("adjacent");
    expect(getMovementKindForSpecies("armadillo", "field")).toBe("diagonal");
    expect(getMovementKindForSpecies("armadillo", "river")).toBe("straight_jump");

    expect(getMovementKindForSpecies("macaw", "forest")).toBe("knight_jump");
    expect(getMovementKindForSpecies("macaw", "field")).toBe("adjacent");
    expect(getMovementKindForSpecies("macaw", "river")).toBe("straight_jump");

    expect(getMovementKindForSpecies("capuchin", "forest")).toBe("straight_jump");
    expect(getMovementKindForSpecies("capuchin", "field")).toBe("knight_jump");
    expect(getMovementKindForSpecies("capuchin", "river")).toBe("diagonal");

    expect(getMovementKindForSpecies("coati", "forest")).toBe("straight_jump");
    expect(getMovementKindForSpecies("coati", "field")).toBe("diagonal");
    expect(getMovementKindForSpecies("coati", "river")).toBe("adjacent");
  });

  it("keeps movement offset counts explicit", () => {
    expect(getMovementOffsets("adjacent")).toHaveLength(4);
    expect(getMovementOffsets("adjacent")).toEqual(
      expect.arrayContaining([
        { x: 0, y: -1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 }
      ])
    );
    expect(getMovementOffsets("diagonal")).toHaveLength(4);
    expect(getMovementOffsets("straight_jump")).toHaveLength(4);
    expect(getMovementOffsets("knight_jump")).toHaveLength(8);
  });
});
