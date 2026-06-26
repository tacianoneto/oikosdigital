import { useCallback } from "react";
import type { PublicRoomState, Resource } from "@oikos/shared";
import type { TutorialStepDef } from "../ui/tutorials";
import type { ExecuteGameIntent } from "./useGameIntentExecutor";

interface SelectionResolutionHandlersParams {
  room: PublicRoomState | null;
  canControlActivePlayer: boolean;
  tutorialActive: boolean;
  tutorialDef: TutorialStepDef | null;
  selectedPieceId: string | null;
  selectedRemovalPieceIds: string[];
  selectedWolfTargetPieceId: string | null;
  selectedWolfResources: Resource[];
  requiredCoatiRemovalCount: number;
  clearWolfActionSelection: () => void;
  executeGameIntent: ExecuteGameIntent;
  setNotice: (notice: string | null) => void;
}

export function useSelectionResolutionHandlers({
  room,
  canControlActivePlayer,
  tutorialActive,
  tutorialDef,
  selectedPieceId,
  selectedRemovalPieceIds,
  selectedWolfTargetPieceId,
  selectedWolfResources,
  requiredCoatiRemovalCount,
  clearWolfActionSelection,
  executeGameIntent,
  setNotice
}: SelectionResolutionHandlersParams) {
  const handleRemoveSelectedPieces = useCallback(() => {
    if (
      !room?.game ||
      !room.game.activePlayerId ||
      !canControlActivePlayer ||
      selectedRemovalPieceIds.length !== requiredCoatiRemovalCount
    ) {
      return;
    }

    executeGameIntent(
      room.game.activePlayerId,
      { type: "pieces.remove", pieceIds: selectedRemovalPieceIds },
      "Quatis removidos da floresta.",
      clearWolfActionSelection
    );
  }, [
    canControlActivePlayer,
    clearWolfActionSelection,
    executeGameIntent,
    requiredCoatiRemovalCount,
    room,
    selectedRemovalPieceIds
  ]);

  const handleHideArmadillo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || !selectedPieceId) {
      return;
    }
    if (tutorialActive && tutorialDef?.markedPieceId && selectedPieceId !== tutorialDef.markedPieceId) {
      return;
    }

    executeGameIntent(
      room.game.activePlayerId,
      { type: "species.hide-piece", speciesId: "armadillo", pieceId: selectedPieceId },
      "Tatu-bola escondido."
    );
  }, [canControlActivePlayer, executeGameIntent, room, selectedPieceId, tutorialActive, tutorialDef?.markedPieceId]);

  const handleRemoveWolfBasePiece = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || !selectedWolfTargetPieceId) {
      return;
    }
    if (tutorialActive && tutorialDef?.markedPieceId && selectedWolfTargetPieceId !== tutorialDef.markedPieceId) {
      return;
    }

    executeGameIntent(
      room.game.activePlayerId,
      { type: "wolf.remove-base", pieceId: selectedWolfTargetPieceId },
      "Lobo-guara removeu peca de base.",
      clearWolfActionSelection
    );
  }, [
    canControlActivePlayer,
    clearWolfActionSelection,
    executeGameIntent,
    room,
    selectedWolfTargetPieceId,
    tutorialActive,
    tutorialDef?.markedPieceId
  ]);

  const handleSpendWolfResources = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || selectedWolfResources.length === 0) {
      return;
    }
    if (
      tutorialActive &&
      tutorialDef?.requiredSpendCount &&
      selectedWolfResources.length !== tutorialDef.requiredSpendCount
    ) {
      setNotice(`Neste tutorial, gaste ${tutorialDef.requiredSpendCount} recursos diferentes para ver a pontuacao completa.`);
      return;
    }

    executeGameIntent(
      room.game.activePlayerId,
      { type: "wolf.spend-resources", resources: selectedWolfResources },
      "Lobo-guara gastou recursos e marcou pontos.",
      clearWolfActionSelection
    );
  }, [
    canControlActivePlayer,
    clearWolfActionSelection,
    executeGameIntent,
    room,
    selectedWolfResources,
    setNotice,
    tutorialActive,
    tutorialDef?.requiredSpendCount
  ]);

  return {
    handleRemoveSelectedPieces,
    handleHideArmadillo,
    handleRemoveWolfBasePiece,
    handleSpendWolfResources
  };
}
