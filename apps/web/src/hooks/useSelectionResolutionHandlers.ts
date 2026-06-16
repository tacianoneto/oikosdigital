import { useCallback } from "react";
import {
  hideArmadilloForCurrentAction,
  removeBasePieceForWolfAction,
  removePiecesForCurrentAction,
  spendWolfResourcesForPoints
} from "@oikos/rules";
import type { PublicRoomState, Resource } from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";
import type { TutorialStepDef } from "../ui/tutorials";
import type { ExecuteGameAction } from "./useSimpleActionHandlers";

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
  executeGameAction: ExecuteGameAction;
  requireSocket: () => OikosSocket;
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
  executeGameAction,
  requireSocket,
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

    executeGameAction(
      () => removePiecesForCurrentAction(room.game!, room.game!.activePlayerId!, selectedRemovalPieceIds),
      () => roomApi.removePieces(requireSocket(), room.roomId, selectedRemovalPieceIds),
      "Quatis removidos da floresta.",
      clearWolfActionSelection
    );
  }, [
    canControlActivePlayer,
    clearWolfActionSelection,
    executeGameAction,
    requiredCoatiRemovalCount,
    requireSocket,
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

    executeGameAction(
      () => hideArmadilloForCurrentAction(room.game!, room.game!.activePlayerId!, selectedPieceId),
      () => roomApi.hideArmadillo(requireSocket(), room.roomId, selectedPieceId),
      "Tatu-bola escondido."
    );
  }, [canControlActivePlayer, executeGameAction, requireSocket, room, selectedPieceId, tutorialActive, tutorialDef?.markedPieceId]);

  const handleRemoveWolfBasePiece = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || !selectedWolfTargetPieceId) {
      return;
    }
    if (tutorialActive && tutorialDef?.markedPieceId && selectedWolfTargetPieceId !== tutorialDef.markedPieceId) {
      return;
    }

    executeGameAction(
      () => removeBasePieceForWolfAction(room.game!, room.game!.activePlayerId!, selectedWolfTargetPieceId),
      () => roomApi.removeWolfBasePiece(requireSocket(), room.roomId, selectedWolfTargetPieceId),
      "Lobo-guará removeu peça de base.",
      clearWolfActionSelection
    );
  }, [
    canControlActivePlayer,
    clearWolfActionSelection,
    executeGameAction,
    requireSocket,
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
      setNotice(`Neste tutorial, gaste ${tutorialDef.requiredSpendCount} recursos diferentes para ver a pontuação completa.`);
      return;
    }

    executeGameAction(
      () => spendWolfResourcesForPoints(room.game!, room.game!.activePlayerId!, selectedWolfResources),
      () => roomApi.spendWolfResources(requireSocket(), room.roomId, selectedWolfResources),
      "Lobo-guará gastou recursos e marcou pontos.",
      clearWolfActionSelection
    );
  }, [
    canControlActivePlayer,
    clearWolfActionSelection,
    executeGameAction,
    requireSocket,
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
