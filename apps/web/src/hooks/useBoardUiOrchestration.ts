import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { MobileTabId } from "../ui/MobileTabbar";
import type { MovementPreview, PendingPlacement } from "./useActionSelection";
import type { PlayerInspectorEntry } from "./playerHudState";

type MobileSheetId = MobileTabId | null;

interface BoardUiOrchestrationParams {
  addPieceTargets: unknown[];
  canPlaceSetupPiece: boolean;
  coatiPairBonusTargets: unknown[];
  expansionTargets: unknown[];
  isMobile: boolean;
  movementTargets: unknown[];
  opponentInspectorEntries: PlayerInspectorEntry[];
  pendingPlacement: PendingPlacement | null;
  rotateFitTargets: unknown[];
  setCleanBoardMode: Dispatch<SetStateAction<boolean>>;
  setConfigOpen: Dispatch<SetStateAction<boolean>>;
  setHandCollapsed: Dispatch<SetStateAction<boolean>>;
  setHoveredSummaryCardIds: Dispatch<SetStateAction<string[]>>;
  setHudLeftCollapsed: Dispatch<SetStateAction<boolean>>;
  setMobileSheet: Dispatch<SetStateAction<MobileSheetId>>;
  setMovementPreview: Dispatch<SetStateAction<MovementPreview | null>>;
  setRecapCollapsed: Dispatch<SetStateAction<boolean>>;
  setSelectedOpponentPlayerId: Dispatch<SetStateAction<string | null>>;
}

export function useBoardUiOrchestration({
  addPieceTargets,
  canPlaceSetupPiece,
  coatiPairBonusTargets,
  expansionTargets,
  isMobile,
  movementTargets,
  opponentInspectorEntries,
  pendingPlacement,
  rotateFitTargets,
  setCleanBoardMode,
  setConfigOpen,
  setHandCollapsed,
  setHoveredSummaryCardIds,
  setHudLeftCollapsed,
  setMobileSheet,
  setMovementPreview,
  setRecapCollapsed,
  setSelectedOpponentPlayerId
}: BoardUiOrchestrationParams) {
  const boardChoiceActive =
    canPlaceSetupPiece ||
    Boolean(pendingPlacement) ||
    expansionTargets.length > 0 ||
    rotateFitTargets.length > 0 ||
    movementTargets.length > 0 ||
    addPieceTargets.length > 0 ||
    coatiPairBonusTargets.length > 0;

  useEffect(() => {
    if (!isMobile || !boardChoiceActive) return;
    setMobileSheet((current) => (current === "jogadores" || current === "mao" ? null : current));
  }, [boardChoiceActive, isMobile, setMobileSheet]);

  const handleMobileTabSelect = useCallback(
    (id: MobileTabId): void => {
      setMobileSheet((current) => {
        const next = current === id ? null : id;
        if (next === "acao") setHudLeftCollapsed(false);
        if (next === "mao") setHandCollapsed(false);
        if (next === "jogadores") {
          setSelectedOpponentPlayerId((currentId) => currentId ?? opponentInspectorEntries[0]?.player.playerId ?? null);
        }
        if (next === "resumo") setRecapCollapsed(false);
        return next;
      });
    },
    [
      opponentInspectorEntries,
      setHandCollapsed,
      setHudLeftCollapsed,
      setMobileSheet,
      setRecapCollapsed,
      setSelectedOpponentPlayerId
    ]
  );

  const toggleCleanBoardMode = useCallback((): void => {
    setCleanBoardMode((value) => {
      const next = !value;
      if (next) {
        setConfigOpen(false);
        setMovementPreview(null);
        setHoveredSummaryCardIds([]);
      }
      return next;
    });
  }, [setCleanBoardMode, setConfigOpen, setHoveredSummaryCardIds, setMovementPreview]);

  return {
    boardChoiceActive,
    handleMobileTabSelect,
    toggleCleanBoardMode
  };
}
