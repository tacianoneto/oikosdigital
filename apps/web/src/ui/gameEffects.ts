import type { Resource, SpeciesId } from "@oikos/shared";

export interface FloatingGain {
  id: number;
  resource: Resource | "point";
  amount: number;
}

export interface TravelEffect {
  id: number;
  kind: "resource" | "piece";
  resource?: Resource;
  speciesId?: SpeciesId;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

// Burst played on the board where a piece was removed/captured: the meeple
// shrinks, a quick red flash fires, and a few light particles scatter out.
export interface RemovalBurst {
  id: number;
  speciesId: SpeciesId;
  at: { x: number; y: number };
}
