import type { PublicRoomState } from "@oikos/shared";
import { localRoomId } from "./gameConstants";

export const lastOnlineRoomStorageKey = "oikos:last-online-room";
export const lastOnlineNameStorageKey = "oikos:last-online-name";

export function saveOnlineSession(room: PublicRoomState, playerName: string): void {
  if (room.roomId === localRoomId) {
    return;
  }

  window.localStorage.setItem(lastOnlineRoomStorageKey, room.roomId);
  window.localStorage.setItem(lastOnlineNameStorageKey, playerName);
}

export function clearOnlineSession(): void {
  window.localStorage.removeItem(lastOnlineRoomStorageKey);
  window.localStorage.removeItem(lastOnlineNameStorageKey);
}

export function isMissingRoomError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("sala") && error.message.toLowerCase().includes("encontrada");
}
