import type { CSSProperties } from "react";
import type { SpeciesId } from "@oikos/shared";
import { SPECIES_HEX } from "./gameConstants";

export function speciesColor(speciesId: SpeciesId | null | undefined): string {
  return speciesId ? SPECIES_HEX[speciesId] : "var(--amber)";
}

export function speciesVar(speciesId: SpeciesId | null | undefined): CSSProperties {
  return { ["--species" as string]: speciesColor(speciesId) } as CSSProperties;
}
