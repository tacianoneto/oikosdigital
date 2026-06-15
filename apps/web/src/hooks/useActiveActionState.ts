import { useMemo } from "react";
import {
  getActiveActionState,
  type ActiveActionStateOptions
} from "./activeActionState";

export function useActiveActionState(options: ActiveActionStateOptions) {
  const {
    activeSpecies,
    currentGamePlayer,
    currentPlayer,
    game,
    hasPendingCoatiPairBonus,
    isLocalRoom,
    localPlayerId,
    selectedHandCardId
  } = options;

  return useMemo(
    () => getActiveActionState(options),
    [
      activeSpecies,
      currentGamePlayer,
      currentPlayer,
      game,
      hasPendingCoatiPairBonus,
      isLocalRoom,
      localPlayerId,
      selectedHandCardId
    ]
  );
}
