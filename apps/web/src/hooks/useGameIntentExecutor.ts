import { useCallback } from "react";
import { applyGameIntent } from "@oikos/rules";
import type { Dispatch, SetStateAction } from "react";
import type { GameIntent, GameState, PublicRoomState, RoomStatus } from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";

export type ExecuteGameIntent = (
  playerId: string,
  intent: GameIntent,
  notice: string,
  reset?: () => void
) => void;

interface GameIntentExecutorParams {
  clearActionSelection: () => void;
  isLocalRoom: boolean;
  requireSocket: () => OikosSocket;
  room: PublicRoomState | null;
  run: (action: () => Promise<PublicRoomState>, success?: string) => Promise<void>;
  setNotice: (notice: string | null) => void;
  setRoom: Dispatch<SetStateAction<PublicRoomState | null>>;
}

export function getRoomStatusForGameState(currentStatus: RoomStatus, game: GameState): RoomStatus {
  if (game.status === "setup" || game.status === "active" || game.status === "finished") {
    return game.status;
  }

  return currentStatus;
}

export function applyLocalGameIntentToRoom(
  room: PublicRoomState,
  playerId: string,
  intent: GameIntent
): PublicRoomState {
  if (!room.game) {
    return room;
  }

  const nextGame = applyGameIntent(room.game, playerId, intent);
  return {
    ...room,
    status: getRoomStatusForGameState(room.status, nextGame),
    game: nextGame,
    warnings: nextGame.contentWarnings
  };
}

export function useGameIntentExecutor({
  clearActionSelection,
  isLocalRoom,
  requireSocket,
  room,
  run,
  setNotice,
  setRoom
}: GameIntentExecutorParams): ExecuteGameIntent {
  return useCallback(
    (
      playerId: string,
      intent: GameIntent,
      notice: string,
      reset: () => void = clearActionSelection
    ) => {
      if (!room?.game) {
        return;
      }

      if (isLocalRoom) {
        setRoom((current) => (current ? applyLocalGameIntentToRoom(current, playerId, intent) : current));
        setNotice(notice);
        reset();
        return;
      }

      void run(() => roomApi.gameIntent(requireSocket(), room.roomId, intent)).then(reset);
    },
    [clearActionSelection, isLocalRoom, requireSocket, room, run, setNotice, setRoom]
  );
}
