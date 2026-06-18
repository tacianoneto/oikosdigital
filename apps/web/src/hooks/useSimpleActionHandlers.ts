import { useCallback } from "react";
import { applyGameIntent } from "@oikos/rules";
import type { GameState, PublicRoomState } from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";
import type { TutorialStepDef } from "../ui/tutorials";

export type ExecuteGameAction = (
  localAction: () => GameState,
  onlineAction: () => Promise<PublicRoomState>,
  notice: string,
  reset?: () => void
) => void;

interface SimpleActionHandlersParams {
  room: PublicRoomState | null;
  canControlActivePlayer: boolean;
  tutorialActive: boolean;
  tutorialDef: TutorialStepDef | null;
  executeGameAction: ExecuteGameAction;
  requireSocket: () => OikosSocket;
  setNotice: (notice: string | null) => void;
}

export function useSimpleActionHandlers({
  room,
  canControlActivePlayer,
  tutorialActive,
  tutorialDef,
  executeGameAction,
  requireSocket,
  setNotice
}: SimpleActionHandlersParams) {
  const handleSpendJaguarMeat = useCallback(
    (count: number) => {
      if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
        return;
      }
      if (tutorialActive && tutorialDef?.requiredSpendCount && count !== tutorialDef.requiredSpendCount) {
        setNotice(`Neste tutorial, gaste ${tutorialDef.requiredSpendCount} carnes para ver a pontuação completa.`);
        return;
      }

      executeGameAction(
        () => applyGameIntent(room.game!, room.game!.activePlayerId!, { type: "jaguar.spend-meat", count }),
        () => roomApi.spendJaguarMeat(requireSocket(), room.roomId, count),
        "Carne gasta e pontos marcados."
      );
    },
    [canControlActivePlayer, executeGameAction, requireSocket, room, setNotice, tutorialActive, tutorialDef?.requiredSpendCount]
  );

  const handleScoreGalo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    executeGameAction(
      () => applyGameIntent(room.game!, room.game!.activePlayerId!, { type: "species.score", speciesId: "galo_de_campina" }),
      () => roomApi.scoreGalo(requireSocket(), room.roomId),
      "Galo-de-campina pontuado."
    );
  }, [canControlActivePlayer, executeGameAction, requireSocket, room]);

  const handleScoreArmadillo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    executeGameAction(
      () => applyGameIntent(room.game!, room.game!.activePlayerId!, { type: "species.score", speciesId: "armadillo" }),
      () => roomApi.scoreArmadillo(requireSocket(), room.roomId),
      "Tatu-bola pontuado."
    );
  }, [canControlActivePlayer, executeGameAction, requireSocket, room]);

  const handleCompleteAction = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }
    if (tutorialActive) {
      return;
    }

    executeGameAction(
      () => applyGameIntent(room.game!, room.game!.activePlayerId!, { type: "action.complete" }),
      () => roomApi.completeAction(requireSocket(), room.roomId),
      "Ação concluída."
    );
  }, [canControlActivePlayer, executeGameAction, requireSocket, room, tutorialActive]);

  return {
    handleSpendJaguarMeat,
    handleScoreGalo,
    handleScoreArmadillo,
    handleCompleteAction
  };
}
