import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { PublicRoomState, Resource, SpeciesId } from "@oikos/shared";
import type { LandingMode } from "../screens/MainMenuScreen";
import { localRoomId } from "../ui/gameConstants";
import { clearOnlineSession, isMissingRoomError, saveOnlineSession } from "../ui/session";
import type { TurnRecapState } from "../ui/turnSummary";
import type { PendingPlacement } from "./useActionSelection";

interface OnlineRoomParams {
  room: PublicRoomState | null;
  landingMode: LandingMode;
  name: string;
  setConfigOpen: Dispatch<SetStateAction<boolean>>;
  setBoardSpecies: Dispatch<SetStateAction<SpeciesId | null>>;
  setSelectedHandCardId: Dispatch<SetStateAction<string | null>>;
  setSelectedCardRotation: Dispatch<SetStateAction<0 | 90 | 180 | 270>>;
  setSelectedPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedJaguarDestination: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setSelectedJaguarTargetPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedWolfTargetPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedWolfResources: Dispatch<SetStateAction<Resource[]>>;
  setSelectedRemovalPieceIds: Dispatch<SetStateAction<string[]>>;
  setPendingPlacement: Dispatch<SetStateAction<PendingPlacement | null>>;
  setHoveredSummaryCardIds: Dispatch<SetStateAction<string[]>>;
  setTurnRecap: Dispatch<SetStateAction<TurnRecapState>>;
  setRecapCollapsed: Dispatch<SetStateAction<boolean>>;
  setIsSpectator: Dispatch<SetStateAction<boolean>>;
  setRoom: Dispatch<SetStateAction<PublicRoomState | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setJoinCode: Dispatch<SetStateAction<string>>;
}

// Online-room state machine: owns the room sync refs (snapshot dedupe, in-flight
// guard, active/ignored room ids, action epoch, server-warning flag), the
// authoritative `applyOnlineRoomState` gate, the UI/selection reset
// (`resetRoomUiState` + `clearRoomState`) and the `run` local/online action
// boundary. Must be called before `useOikosSocket`, which consumes
// `applyOnlineRoomState`/`clearRoomState` and the returned refs. `spectate` stays
// in OikosApp because it needs the live socket; it reuses these refs/functions.
export function useOnlineRoom({
  room,
  landingMode,
  name,
  setConfigOpen,
  setBoardSpecies,
  setSelectedHandCardId,
  setSelectedCardRotation,
  setSelectedPieceId,
  setSelectedJaguarDestination,
  setSelectedJaguarTargetPieceId,
  setSelectedWolfTargetPieceId,
  setSelectedWolfResources,
  setSelectedRemovalPieceIds,
  setPendingPlacement,
  setHoveredSummaryCardIds,
  setTurnRecap,
  setRecapCollapsed,
  setIsSpectator,
  setRoom,
  setError,
  setNotice,
  setJoinCode
}: OnlineRoomParams) {
  const lastOnlineRoomSnapshotRef = useRef("");
  const onlineActionInFlightRef = useRef(false);
  const activeOnlineRoomIdRef = useRef<string | null>(null);
  const showServerWarningRef = useRef(false);
  const ignoredOnlineRoomIdsRef = useRef<Set<string>>(new Set());
  const roomActionEpochRef = useRef(0);

  const resetRoomUiState = useCallback(() => {
    setConfigOpen(false);
    setBoardSpecies(null);
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setSelectedRemovalPieceIds([]);
    setPendingPlacement(null);
    setHoveredSummaryCardIds([]);
    setTurnRecap({ history: [], index: -1, visible: false });
    setRecapCollapsed(true);
  }, []);

  const applyOnlineRoomState = useCallback((nextRoom: PublicRoomState, options?: { direct?: boolean }) => {
    const direct = options?.direct ?? false;

    if (!direct) {
      if (ignoredOnlineRoomIdsRef.current.has(nextRoom.roomId)) {
        return false;
      }

      const activeRoomId = activeOnlineRoomIdRef.current;
      if (!activeRoomId || activeRoomId !== nextRoom.roomId) {
        return false;
      }
    }

    activeOnlineRoomIdRef.current = nextRoom.roomId;
    ignoredOnlineRoomIdsRef.current.delete(nextRoom.roomId);

    const snapshot = JSON.stringify(nextRoom);
    if (lastOnlineRoomSnapshotRef.current === snapshot) {
      return false;
    }

    lastOnlineRoomSnapshotRef.current = snapshot;
    setRoom(nextRoom);
    return true;
  }, []);

  const clearRoomState = useCallback(() => {
    roomActionEpochRef.current += 1;
    lastOnlineRoomSnapshotRef.current = "";
    activeOnlineRoomIdRef.current = null;
    resetRoomUiState();
    setIsSpectator(false);
    setRoom(null);
  }, [resetRoomUiState]);

  useEffect(() => {
    showServerWarningRef.current =
      landingMode === "create" || landingMode === "join" || Boolean(room && room.roomId !== localRoomId);
  }, [landingMode, room]);

  const run = useCallback(async (action: () => Promise<PublicRoomState>, success?: string) => {
    if (onlineActionInFlightRef.current) {
      return;
    }

    const actionEpoch = roomActionEpochRef.current;
    onlineActionInFlightRef.current = true;
    setError(null);
    setNotice(null);

    try {
      const nextRoom = await action();
      if (roomActionEpochRef.current !== actionEpoch) {
        return;
      }

      applyOnlineRoomState(nextRoom, { direct: true });
      saveOnlineSession(nextRoom, name);
      if (success) {
        setNotice(success);
      }
    } catch (err) {
      if (isMissingRoomError(err)) {
        clearOnlineSession();
        clearRoomState();
        setJoinCode("");
        setNotice("Essa sala não existe mais no servidor gratuito. Crie uma nova sala para continuar.");
        return;
      }

      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      onlineActionInFlightRef.current = false;
    }
  }, [applyOnlineRoomState, clearRoomState, name]);

  return {
    lastOnlineRoomSnapshotRef,
    onlineActionInFlightRef,
    showServerWarningRef,
    ignoredOnlineRoomIdsRef,
    roomActionEpochRef,
    applyOnlineRoomState,
    clearRoomState,
    run
  };
}
