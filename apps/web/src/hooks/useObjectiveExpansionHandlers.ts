import { useCallback, type Dispatch, type SetStateAction } from "react";
import {
  collectCaatingaBonus,
  collectCerradoBonus,
  discardMataAtlanticaPileCard,
  discardObjectiveForResources,
  resolveExtraTurnObjective,
  resolveSeedSpendObjective,
  selectObjectiveCard
} from "@oikos/rules";
import type { GameState, PlayerState, PublicRoomState } from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";
import type { ExpansionPreviewKind } from "../ui/GameOverlays";

type PendingCaatinga = NonNullable<GameState["caatingaPending"]>;
type PendingCerrado = NonNullable<GameState["cerradoPending"]>;

interface ObjectiveExpansionHandlersParams {
  room: PublicRoomState | null;
  setRoom: Dispatch<SetStateAction<PublicRoomState | null>>;
  currentGamePlayer: PlayerState | null;
  canDiscardSelectedObjective: boolean;
  pendingObjectiveCardId: string | null;
  setPendingObjectiveCardId: Dispatch<SetStateAction<string | null>>;
  setExpandedObjectiveCardId: Dispatch<SetStateAction<string | null>>;
  setExpansionPreview: Dispatch<SetStateAction<ExpansionPreviewKind | null>>;
  caatingaPending: PendingCaatinga | null;
  cerradoPending: PendingCerrado | null;
  canResolveCaatinga: boolean;
  canResolveCerrado: boolean;
  canResolveExtraTurn: boolean;
  canResolveSeedSpend: boolean;
  pendingSeedSpendCount: number;
  pendingSeedSpendPoints: number;
  isLocalRoom: boolean;
  name: string;
  applyOnlineRoomState: (room: PublicRoomState, options?: { direct?: boolean }) => void;
  saveOnlineSession: (room: PublicRoomState, name: string, spectating?: boolean) => void;
  run: (action: () => Promise<PublicRoomState>, success?: string) => Promise<void>;
  requireSocket: () => OikosSocket;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
}

export function useObjectiveExpansionHandlers({
  room,
  setRoom,
  currentGamePlayer,
  canDiscardSelectedObjective,
  pendingObjectiveCardId,
  setPendingObjectiveCardId,
  setExpandedObjectiveCardId,
  setExpansionPreview,
  caatingaPending,
  cerradoPending,
  canResolveCaatinga,
  canResolveCerrado,
  canResolveExtraTurn,
  canResolveSeedSpend,
  pendingSeedSpendCount,
  pendingSeedSpendPoints,
  isLocalRoom,
  name,
  applyOnlineRoomState,
  saveOnlineSession,
  run,
  requireSocket,
  setError,
  setNotice
}: ObjectiveExpansionHandlersParams) {
  const handleSelectObjective = useCallback(
    async (objectiveCardId: string) => {
      if (!room?.game || !currentGamePlayer || pendingObjectiveCardId) {
        return;
      }

      setPendingObjectiveCardId(objectiveCardId);
      setError(null);
      setNotice(null);

      if (isLocalRoom) {
        try {
          const nextGame = selectObjectiveCard(room.game, currentGamePlayer.playerId, objectiveCardId);
          setRoom({
            ...room,
            game: nextGame,
            warnings: nextGame.contentWarnings
          });
          setNotice("Objetivo escolhido.");
        } catch (err) {
          setPendingObjectiveCardId(null);
          setError(err instanceof Error ? err.message : "Falha ao escolher objetivo.");
        }
        return;
      }

      try {
        const nextRoom = await roomApi.selectObjective(requireSocket(), room.roomId, objectiveCardId);
        applyOnlineRoomState(nextRoom, { direct: true });
        saveOnlineSession(nextRoom, name);
        setNotice("Objetivo escolhido.");
      } catch (err) {
        setPendingObjectiveCardId(null);
        setError(err instanceof Error ? err.message : "Falha ao escolher objetivo.");
      }
    },
    [
      applyOnlineRoomState,
      currentGamePlayer,
      isLocalRoom,
      name,
      pendingObjectiveCardId,
      requireSocket,
      room,
      saveOnlineSession,
      setError,
      setNotice,
      setPendingObjectiveCardId,
      setRoom
    ]
  );

  const handleDiscardObjective = useCallback(async () => {
    if (!room?.game || !currentGamePlayer || !canDiscardSelectedObjective) {
      return;
    }

    setError(null);
    setNotice(null);

    if (isLocalRoom) {
      try {
        const nextGame = discardObjectiveForResources(room.game, currentGamePlayer.playerId);
        setRoom({
          ...room,
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setExpansionPreview(null);
        setExpandedObjectiveCardId(null);
        setNotice("Objetivo descartado: +1 recurso de cada.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao descartar objetivo.");
      }
      return;
    }

    await run(() => roomApi.discardObjective(requireSocket(), room.roomId), "Objetivo descartado: +1 recurso de cada.");
    setExpansionPreview(null);
    setExpandedObjectiveCardId(null);
  }, [
    canDiscardSelectedObjective,
    currentGamePlayer,
    isLocalRoom,
    requireSocket,
    room,
    run,
    setError,
    setExpandedObjectiveCardId,
    setExpansionPreview,
    setNotice,
    setRoom
  ]);

  const resolveCaatingaChoice = useCallback(
    (mode: "gain" | "lose" | "skip") => {
      if (!room?.game || !caatingaPending || !canResolveCaatinga) return;
      if (isLocalRoom) {
        try {
          const nextGame = collectCaatingaBonus(room.game, caatingaPending.playerId, mode);
          setRoom((current) => (current ? { ...current, game: nextGame } : current));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha ao resolver Caatinga.");
        }
      } else {
        const rid = room.roomId;
        run(() => roomApi.collectCaatinga(requireSocket(), rid, mode));
      }
    },
    [caatingaPending, canResolveCaatinga, isLocalRoom, requireSocket, room, run, setError, setRoom]
  );

  const resolveCerradoChoice = useCallback(
    (mode: "collect" | "skip") => {
      if (!room?.game || !cerradoPending || !canResolveCerrado) return;
      if (isLocalRoom) {
        try {
          const nextGame = collectCerradoBonus(room.game, cerradoPending.playerId, mode);
          setRoom((current) => (current ? { ...current, game: nextGame } : current));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha ao resolver Cerrado.");
        }
      } else {
        const rid = room.roomId;
        run(() => roomApi.collectCerrado(requireSocket(), rid, mode));
      }
    },
    [canResolveCerrado, cerradoPending, isLocalRoom, requireSocket, room, run, setError, setRoom]
  );

  const resolveExtraTurnChoice = useCallback(
    (accept: boolean) => {
      if (!room?.game?.pendingExtraTurnPlayerId || !canResolveExtraTurn) return;

      const pendingPlayerId = room.game.pendingExtraTurnPlayerId;
      if (isLocalRoom) {
        try {
          const nextGame = resolveExtraTurnObjective(room.game, pendingPlayerId, accept);
          setRoom({
            ...room,
            status: nextGame.status === "finished" ? "finished" : "active",
            game: nextGame,
            warnings: nextGame.contentWarnings
          });
          setNotice(accept ? "Turno extra iniciado: -1 ponto." : "Turno extra recusado.");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha ao resolver turno extra.");
        }
        return;
      }

      const rid = room.roomId;
      run(() => roomApi.resolveExtraTurn(requireSocket(), rid, accept));
    },
    [canResolveExtraTurn, isLocalRoom, requireSocket, room, run, setError, setNotice, setRoom]
  );

  const resolveSeedSpendChoice = useCallback(
    (accept: boolean) => {
      if (!room?.game?.pendingSeedSpendObjectivePlayerId || !canResolveSeedSpend) return;

      const pendingPlayerId = room.game.pendingSeedSpendObjectivePlayerId;
      if (isLocalRoom) {
        try {
          const nextGame = resolveSeedSpendObjective(room.game, pendingPlayerId, accept);
          setRoom({
            ...room,
            status: nextGame.status === "finished" ? "finished" : "active",
            game: nextGame,
            warnings: nextGame.contentWarnings
          });
          setNotice(
            accept
              ? `Objetivo ativado: -${pendingSeedSpendCount} sementes, +${pendingSeedSpendPoints} pontos.`
              : "Objetivo recusado."
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha ao resolver objetivo de sementes.");
        }
        return;
      }

      const rid = room.roomId;
      run(() => roomApi.resolveSeedSpend(requireSocket(), rid, accept));
    },
    [
      canResolveSeedSpend,
      isLocalRoom,
      pendingSeedSpendCount,
      pendingSeedSpendPoints,
      requireSocket,
      room,
      run,
      setError,
      setNotice,
      setRoom
    ]
  );

  const resolveMataAtlanticaDiscard = useCallback(
    (cardId: string) => {
      if (!room?.game || !currentGamePlayer) return;
      if (isLocalRoom) {
        try {
          const nextGame = discardMataAtlanticaPileCard(room.game, currentGamePlayer.playerId, cardId);
          setRoom((current) => (current ? { ...current, game: nextGame } : current));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha ao descartar (Mata Atlantica).");
        }
      } else {
        const rid = room.roomId;
        run(() => roomApi.discardMataAtlantica(requireSocket(), rid, cardId));
      }
    },
    [currentGamePlayer, isLocalRoom, requireSocket, room, run, setError, setRoom]
  );

  return {
    handleSelectObjective,
    handleDiscardObjective,
    resolveCaatingaChoice,
    resolveCerradoChoice,
    resolveExtraTurnChoice,
    resolveSeedSpendChoice,
    resolveMataAtlanticaDiscard
  };
}
