import type { PublicRoomState } from "@oikos/shared";
import { localRoomId } from "./gameConstants";

export const lastOnlineRoomStorageKey = "oikos:last-online-room";
export const lastOnlineNameStorageKey = "oikos:last-online-name";
export const lastOnlineSpectatorStorageKey = "oikos:last-online-spectator";

export function saveOnlineSession(room: PublicRoomState, playerName: string, spectator = false): void {
  if (room.roomId === localRoomId) {
    return;
  }

  window.localStorage.setItem(lastOnlineRoomStorageKey, room.roomId);
  window.localStorage.setItem(lastOnlineNameStorageKey, playerName);
  if (spectator) {
    window.localStorage.setItem(lastOnlineSpectatorStorageKey, "1");
  } else {
    window.localStorage.removeItem(lastOnlineSpectatorStorageKey);
  }
}

export function wasSpectatorSession(): boolean {
  return window.localStorage.getItem(lastOnlineSpectatorStorageKey) === "1";
}

export function clearOnlineSession(): void {
  window.localStorage.removeItem(lastOnlineRoomStorageKey);
  window.localStorage.removeItem(lastOnlineNameStorageKey);
  window.localStorage.removeItem(lastOnlineSpectatorStorageKey);
}

export function isMissingRoomError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("sala") && error.message.toLowerCase().includes("encontrada");
}
