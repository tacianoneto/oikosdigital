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
