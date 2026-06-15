import { useMemo } from "react";
import type { PublicRoomState } from "@oikos/shared";
import { getPlayerHudState } from "./playerHudState";

export function usePlayerHudState(
  room: PublicRoomState | null | undefined,
  controlledPlayerId: string | null,
  selectedOpponentPlayerId: string | null
) {
  return useMemo(
    () =>
      getPlayerHudState(
        room,
        controlledPlayerId,
        selectedOpponentPlayerId
      ),
    [controlledPlayerId, room, selectedOpponentPlayerId]
  );
}
