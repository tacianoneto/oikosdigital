import { useMemo } from "react";
import {
  getActiveScoringState,
  type ActiveScoringStateOptions
} from "./activeScoringState";

export function useActiveScoringState(options: ActiveScoringStateOptions) {
  const {
    activeActionId,
    activeSpeciesId,
    canControlActivePlayer,
    game,
    hasPendingCoatiPairBonus,
    tutorialActive,
    tutorialGate,
    tutorialId
  } = options;

  return useMemo(
    () => getActiveScoringState(options),
    [
      activeActionId,
      activeSpeciesId,
      canControlActivePlayer,
      game,
      hasPendingCoatiPairBonus,
      tutorialActive,
      tutorialGate,
      tutorialId
    ]
  );
}
