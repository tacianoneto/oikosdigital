import type { GridPosition, Habitat, MovementKind, SpeciesId } from "@oikos/shared";
import { speciesDefinitions } from "@oikos/content";

export function getMovementKindForSpecies(speciesId: SpeciesId, habitat: Habitat): MovementKind {
  return speciesDefinitions[speciesId].movementPatternsByHabitat[habitat];
}

export function getMovementOffsets(kind: MovementKind): GridPosition[] {
  switch (kind) {
    case "adjacent":
      return [
        { x: 0, y: -1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ];
    case "diagonal":
      return [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: -1, y: 1 },
        { x: 1, y: 1 }
      ];
    case "straight_jump":
      return [
        { x: 0, y: -2 },
        { x: 2, y: 0 },
        { x: 0, y: 2 },
        { x: -2, y: 0 }
      ];
    case "knight_jump":
      return [
        { x: -1, y: -2 },
        { x: 1, y: -2 },
        { x: 2, y: -1 },
        { x: 2, y: 1 },
        { x: 1, y: 2 },
        { x: -1, y: 2 },
        { x: -2, y: 1 },
        { x: -2, y: -1 }
      ];
  }
}

export function getPotentialDestinations(origin: GridPosition, movementKind: MovementKind): GridPosition[] {
  return getMovementOffsets(movementKind).map((offset) => ({
    x: origin.x + offset.x,
    y: origin.y + offset.y
  }));
}
