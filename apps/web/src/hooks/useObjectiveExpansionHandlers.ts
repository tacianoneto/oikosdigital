import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { GameState, PlayerState, PublicRoomState } from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";
import type { ExpansionPreviewKind } from "../ui/GameOverlays";
import type { ExecuteGameIntent } from "./useGameIntentExecutor";

type PendingCaatinga = NonNullable<GameState["caatingaPending"]>;
type PendingCerrado = NonNullable<GameState["cerradoPending"]>;

const keepSelection = () => undefined;

interface ObjectiveExpansionHandlersParams {
  room: PublicRoomState | null;
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
  executeGameIntent: ExecuteGameIntent;
  requireSocket: () => OikosSocket;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
}

export function useObjectiveExpansionHandlers({
  room,
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
  executeGameIntent,
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

      try {
        if (isLocalRoom) {
          executeGameIntent(
            currentGamePlayer.playerId,
            { type: "objective.select", objectiveCardId },
            "Objetivo escolhido.",
            keepSelection
          );
          return;
        }

        const nextRoom = await roomApi.gameIntent(
          requireSocket(),
          room.roomId,
          { type: "objective.select", objectiveCardId }
        );
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
      executeGameIntent,
      isLocalRoom,
      name,
      pendingObjectiveCardId,
      requireSocket,
      room,
      saveOnlineSession,
      setError,
      setNotice,
      setPendingObjectiveCardId
    ]
  );

  const handleDiscardObjective = useCallback(async () => {
    if (!room?.game || !currentGamePlayer || !canDiscardSelectedObjective) {
      return;
    }

    setError(null);
    setNotice(null);
    executeGameIntent(
      currentGamePlayer.playerId,
      { type: "objective.discard" },
      "Objetivo descartado: +1 recurso de cada.",
      () => {
        setExpansionPreview(null);
        setExpandedObjectiveCardId(null);
      }
    );
  }, [
    canDiscardSelectedObjective,
    currentGamePlayer,
    executeGameIntent,
    room,
    setError,
    setExpandedObjectiveCardId,
    setExpansionPreview,
    setNotice
  ]);

  const resolveCaatingaChoice = useCallback(
    (mode: "gain" | "lose" | "skip") => {
      if (!room?.game || !caatingaPending || !canResolveCaatinga) return;
      executeGameIntent(
        caatingaPending.playerId,
        { type: "scenario.caatinga-collect", mode },
        "Caatinga resolvida.",
        keepSelection
      );
    },
    [caatingaPending, canResolveCaatinga, executeGameIntent, room]
  );

  const resolveCerradoChoice = useCallback(
    (mode: "collect" | "skip") => {
      if (!room?.game || !cerradoPending || !canResolveCerrado) return;
      executeGameIntent(
        cerradoPending.playerId,
        { type: "scenario.cerrado-collect", mode },
        "Cerrado resolvido.",
        keepSelection
      );
    },
    [canResolveCerrado, cerradoPending, executeGameIntent, room]
  );

  const resolveExtraTurnChoice = useCallback(
    (accept: boolean) => {
      if (!room?.game?.pendingExtraTurnPlayerId || !canResolveExtraTurn) return;

      executeGameIntent(
        room.game.pendingExtraTurnPlayerId,
        { type: "objective.extra-turn", accept },
        accept ? "Turno extra iniciado: -1 ponto." : "Turno extra recusado.",
        keepSelection
      );
    },
    [canResolveExtraTurn, executeGameIntent, room]
  );

  const resolveSeedSpendChoice = useCallback(
    (accept: boolean) => {
      if (!room?.game?.pendingSeedSpendObjectivePlayerId || !canResolveSeedSpend) return;

      executeGameIntent(
        room.game.pendingSeedSpendObjectivePlayerId,
        { type: "objective.seed-spend", accept },
        accept
          ? `Objetivo ativado: -${pendingSeedSpendCount} sementes, +${pendingSeedSpendPoints} pontos.`
          : "Objetivo recusado.",
        keepSelection
      );
    },
    [canResolveSeedSpend, executeGameIntent, pendingSeedSpendCount, pendingSeedSpendPoints, room]
  );

  const resolveMataAtlanticaDiscard = useCallback(
    (cardId: string) => {
      if (!room?.game || !currentGamePlayer) return;
      executeGameIntent(
        currentGamePlayer.playerId,
        { type: "scenario.mata-atlantica-discard", cardId },
        "Carta da Mata Atlantica descartada.",
        keepSelection
      );
    },
    [currentGamePlayer, executeGameIntent, room]
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
