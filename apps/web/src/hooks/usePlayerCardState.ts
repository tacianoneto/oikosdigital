import { useMemo } from "react";
import type { GameState, PlayerState } from "@oikos/shared";
import {
  getPlayerCardState,
  type HandSortMode
} from "./playerCardState";

export function usePlayerCardState(
  game: GameState | null | undefined,
  player: PlayerState | null | undefined,
  handSortMode: HandSortMode,
  isSpectator: boolean,
  pendingObjectiveCardId: string | null
) {
  return useMemo(
    () =>
      getPlayerCardState(
        game,
        player,
        handSortMode,
        isSpectator,
        pendingObjectiveCardId
      ),
    [game, handSortMode, isSpectator, pendingObjectiveCardId, player]
  );
}
