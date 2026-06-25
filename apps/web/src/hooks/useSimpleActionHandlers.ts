import { useCallback } from "react";
import type { GameIntent, GameState, PublicRoomState } from "@oikos/shared";
import type { TutorialStepDef } from "../ui/tutorials";

export type ExecuteGameAction = (
  localAction: () => GameState,
  onlineAction: () => Promise<PublicRoomState>,
  notice: string,
  reset?: () => void
) => void;

export type ExecuteGameIntent = (
  playerId: string,
  intent: GameIntent,
  notice: string,
  reset?: () => void
) => void;

interface SimpleActionHandlersParams {
  room: PublicRoomState | null;
  canControlActivePlayer: boolean;
  tutorialActive: boolean;
  tutorialDef: TutorialStepDef | null;
  executeGameIntent: ExecuteGameIntent;
  setNotice: (notice: string | null) => void;
}

export function useSimpleActionHandlers({
  room,
  canControlActivePlayer,
  tutorialActive,
  tutorialDef,
  executeGameIntent,
  setNotice
}: SimpleActionHandlersParams) {
  const handleSpendJaguarMeat = useCallback(
    (count: number) => {
      if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
        return;
      }
      if (tutorialActive && tutorialDef?.requiredSpendCount && count !== tutorialDef.requiredSpendCount) {
        setNotice(`Neste tutorial, gaste ${tutorialDef.requiredSpendCount} carnes para ver a pontuacao completa.`);
        return;
      }

      executeGameIntent(
        room.game.activePlayerId,
        { type: "jaguar.spend-meat", count },
        "Carne gasta e pontos marcados."
      );
    },
    [canControlActivePlayer, executeGameIntent, room, setNotice, tutorialActive, tutorialDef?.requiredSpendCount]
  );

  const handleScoreGalo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    executeGameIntent(
      room.game.activePlayerId,
      { type: "species.score", speciesId: "galo_de_campina" },
      "Galo-de-campina pontuado."
    );
  }, [canControlActivePlayer, executeGameIntent, room]);

  const handleScoreArmadillo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    executeGameIntent(
      room.game.activePlayerId,
      { type: "species.score", speciesId: "armadillo" },
      "Tatu-bola pontuado."
    );
  }, [canControlActivePlayer, executeGameIntent, room]);

  const handleCompleteAction = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }
    if (tutorialActive) {
      return;
    }

    executeGameIntent(
      room.game.activePlayerId,
      { type: "action.complete" },
      "Acao concluida."
    );
  }, [canControlActivePlayer, executeGameIntent, room, tutorialActive]);

  return {
    handleSpendJaguarMeat,
    handleScoreGalo,
    handleScoreArmadillo,
    handleCompleteAction
  };
}
