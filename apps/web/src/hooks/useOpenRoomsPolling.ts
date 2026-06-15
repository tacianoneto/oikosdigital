import { useCallback, useEffect, useState } from "react";
import type { RoomSummary } from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";
import type { LandingMode } from "../screens/MainMenuScreen";

// Polls the public open-room list every 4s while the "Entrar em Sala" screen is
// open. Owns its own loading/list state; depends only on the socket and the
// current landing mode. `refreshRooms` triggers a one-off fetch (manual button).
export function useOpenRoomsPolling(
  socket: OikosSocket | null,
  landingMode: LandingMode
): { openRooms: RoomSummary[]; roomsLoading: boolean; refreshRooms: () => void } {
  const [openRooms, setOpenRooms] = useState<RoomSummary[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const refreshRooms = useCallback(() => {
    if (!socket) {
      return;
    }

    setRoomsLoading(true);
    roomApi
      .listRooms(socket)
      .then(setOpenRooms)
      .catch(() => setOpenRooms([]))
      .finally(() => setRoomsLoading(false));
  }, [socket]);

  useEffect(() => {
    if (landingMode !== "join" || !socket) {
      return;
    }

    let active = true;
    const fetchRooms = () => {
      setRoomsLoading(true);
      roomApi
        .listRooms(socket)
        .then((rooms) => {
          if (active) {
            setOpenRooms(rooms);
          }
        })
        .catch(() => {
          if (active) {
            setOpenRooms([]);
          }
        })
        .finally(() => {
          if (active) {
            setRoomsLoading(false);
          }
        });
    };

    fetchRooms();
    const interval = window.setInterval(fetchRooms, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [landingMode, socket]);

  return { openRooms, roomsLoading, refreshRooms };
}
