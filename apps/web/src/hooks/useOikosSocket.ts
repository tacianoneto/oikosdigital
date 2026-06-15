import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { PublicRoomState } from "@oikos/shared";
import { createSocket, roomApi, type OikosSocket } from "../socket";
import type { LandingMode } from "../screens/MainMenuScreen";
import {
  clearOnlineSession,
  isMissingRoomError,
  lastOnlineNameStorageKey,
  lastOnlineRoomStorageKey,
  wasSpectatorSession
} from "../ui/session";
import { SERVER_UNAVAILABLE_MESSAGE } from "../screens/OikosApp.helpers";

interface UseOikosSocketParams {
  accessToken: string;
  defaultPlayerName: string;
  applyOnlineRoomState: (room: PublicRoomState, options?: { direct?: boolean }) => boolean;
  clearRoomState: () => void;
  setError: Dispatch<SetStateAction<string | null>>;
  setName: Dispatch<SetStateAction<string>>;
  setIsSpectator: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setLandingMode: Dispatch<SetStateAction<LandingMode>>;
  roomActionEpochRef: MutableRefObject<number>;
  ignoredOnlineRoomIdsRef: MutableRefObject<Set<string>>;
  autoScoredRef: MutableRefObject<string | null>;
  showServerWarningRef: MutableRefObject<boolean>;
}

// Owns the authoritative Socket.IO connection and the local `playerId`. Creates
// the socket from the auth token, wires the connection lifecycle (connect,
// connected/reconnect, room updates, kicks, connect errors) and tears it down on
// unmount. Behavior is identical to the inline effect it replaced; the refs and
// callbacks it needs are passed in because they are shared with the rest of the
// screen.
export function useOikosSocket({
  accessToken,
  defaultPlayerName,
  applyOnlineRoomState,
  clearRoomState,
  setError,
  setName,
  setIsSpectator,
  setNotice,
  setLandingMode,
  roomActionEpochRef,
  ignoredOnlineRoomIdsRef,
  autoScoredRef,
  showServerWarningRef
}: UseOikosSocketParams): { socket: OikosSocket | null; playerId: string | null } {
  const [socket, setSocket] = useState<OikosSocket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const nextSocket = createSocket(accessToken);
    setSocket(nextSocket);

    nextSocket.on("connect", () => {
      setError((current) => (current === SERVER_UNAVAILABLE_MESSAGE ? null : current));
    });

    nextSocket.on("connected", (payload: { playerId: string }) => {
      setPlayerId(payload.playerId);
      const savedRoomId = window.localStorage.getItem(lastOnlineRoomStorageKey);
      const savedName = window.localStorage.getItem(lastOnlineNameStorageKey) ?? defaultPlayerName;

      if (savedRoomId) {
        const reconnectEpoch = roomActionEpochRef.current;
        const reconnectAsSpectator = wasSpectatorSession();
        setName(savedName);
        const reconnectPromise = reconnectAsSpectator
          ? roomApi.spectate(nextSocket, savedRoomId)
          : roomApi.join(nextSocket, savedRoomId, savedName);
        void reconnectPromise
          .then((nextRoom) => {
            if (roomActionEpochRef.current !== reconnectEpoch) {
              return;
            }

            setIsSpectator(reconnectAsSpectator);
            applyOnlineRoomState(nextRoom, { direct: true });
            setNotice(reconnectAsSpectator ? "Reconectado como espectador." : "Reconectado a sala.");
          })
          .catch((err) => {
            if (roomActionEpochRef.current !== reconnectEpoch) {
              return;
            }

            clearOnlineSession();
            clearRoomState();
            setNotice(
              isMissingRoomError(err)
                ? "A sala anterior expirou no servidor gratuito. Crie uma nova sala para continuar."
                : "Não foi possível reconectar a sala anterior."
            );
          });
      }
    });

    nextSocket.on("room:update", (nextRoom: PublicRoomState) => {
      applyOnlineRoomState(nextRoom);
    });

    nextSocket.on("room:kicked", (payload: { roomId: string }) => {
      ignoredOnlineRoomIdsRef.current.add(payload.roomId);
      clearOnlineSession();
      setLandingMode("idle");
      autoScoredRef.current = null;
      clearRoomState();
      setError("Você foi removido da sala pelo anfitrião.");
    });

    nextSocket.on("connect_error", () => {
      if (showServerWarningRef.current) {
        setError(SERVER_UNAVAILABLE_MESSAGE);
      }
    });

    return () => {
      nextSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyOnlineRoomState, accessToken, clearRoomState, defaultPlayerName]);

  return { socket, playerId };
}
