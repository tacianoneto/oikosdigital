import { useMemo } from "react";
import type { ActionId, GameState, SpeciesId } from "@oikos/shared";
import { getScoringPreview } from "./scoringPreview";

export function useScoringPreview(
  game: GameState | null | undefined,
  activeActionId: ActionId | null,
  activeSpeciesId: SpeciesId | null
) {
  return useMemo(
    () => getScoringPreview(game, activeActionId, activeSpeciesId),
    [activeActionId, activeSpeciesId, game]
  );
}
