import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { PublicRoomState } from "@oikos/shared";
import type { PendingPlacement } from "./useActionSelection";
import type { ExecuteGameIntent } from "./useGameIntentExecutor";
import type { TutorialBoardAction } from "./useTutorialController";
import type { TutorialStepDef } from "../ui/tutorials";

const keepSelection = () => undefined;

interface BoardCardHandlersParams {
  room: PublicRoomState | null;
  canPlaceSetupPiece: boolean;
  canPlaceSelectedForestCard: boolean;
  selectedHandCardId: string | null;
  pendingPlacement: PendingPlacement | null;
  tutorialActive: boolean;
  tutorialStep: number | null;
  tutorialSteps: TutorialStepDef[];
  tutorialMarkedSlot: { x: number; y: number } | null;
  tutorialBlocks: (action: TutorialBoardAction) => boolean;
  executeGameIntent: ExecuteGameIntent;
  setSelectedHandCardId: Dispatch<SetStateAction<string | null>>;
  setSelectedCardRotation: Dispatch<SetStateAction<0 | 90 | 180 | 270>>;
  setSelectedPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedRemovalPieceIds: Dispatch<SetStateAction<string[]>>;
  setPendingPlacement: Dispatch<SetStateAction<PendingPlacement | null>>;
  clearPendingPlacement: () => void;
}

// Card-placement interaction cluster: rotating the selected forest card, placing
// a setup piece, staging/confirming/cancelling a forest-card placement, plus the
// keyboard shortcuts (Q/E/R + right-click rotate, Enter/Escape confirm/cancel)
// and the effect dropping a staged placement once the card is no longer playable.
// Local/online parity and tutorial gates are preserved via injected dependencies.
export function useBoardCardHandlers({
  room,
  canPlaceSetupPiece,
  canPlaceSelectedForestCard,
  selectedHandCardId,
  pendingPlacement,
  tutorialActive,
  tutorialStep,
  tutorialSteps,
  tutorialMarkedSlot,
  tutorialBlocks,
  executeGameIntent,
  setSelectedHandCardId,
  setSelectedCardRotation,
  setSelectedPieceId,
  setSelectedRemovalPieceIds,
  setPendingPlacement,
  clearPendingPlacement
}: BoardCardHandlersParams) {
  const rotateSelectedCard = useCallback((dir: 1 | -1) => {
    setSelectedCardRotation((r) => (((r + (dir === 1 ? 90 : 270)) % 360) as 0 | 90 | 180 | 270));
  }, [setSelectedCardRotation]);

  useEffect(() => {
    // No rotation while a placement is awaiting confirmation: the preview is at a
    // fixed orientation; the player confirms or cancels first.
    if (!selectedHandCardId || !canPlaceSelectedForestCard || pendingPlacement) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "q") {
        event.preventDefault();
        rotateSelectedCard(-1);
      } else if (key === "e" || key === "r") {
        event.preventDefault();
        rotateSelectedCard(1);
      }
    };

    // Right-click rotates while a placeable card is selected (e.g. mid-drag).
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      rotateSelectedCard(1);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [canPlaceSelectedForestCard, rotateSelectedCard, selectedHandCardId, pendingPlacement]);

  // Drop the staged placement if the card can no longer be played (turn change,
  // card left the hand, etc.).
  useEffect(() => {
    if (pendingPlacement && !canPlaceSelectedForestCard) {
      setPendingPlacement(null);
    }
  }, [canPlaceSelectedForestCard, pendingPlacement]);

  const handleCardClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room || !canPlaceSetupPiece) {
        return;
      }
      if (tutorialBlocks("setupPlace")) return;

      if (room.game?.setupActivePlayerId) {
        executeGameIntent(
          room.game.setupActivePlayerId,
          {
            type: "setup.place-piece",
            x: position.x,
            y: position.y
          },
          "Peca inicial colocada.",
          keepSelection
        );
        return;
      }

      if (room.game?.activePlayerId) {
        executeGameIntent(
          room.game.activePlayerId,
          {
          type: "setup.place-piece",
          x: position.x,
          y: position.y
          },
          "Peca inicial colocada.",
          keepSelection
        );
        return;
      }
    },
    [canPlaceSetupPiece, executeGameIntent, room, tutorialBlocks]
  );

  const placeCard = useCallback(
    (position: { x: number; y: number }, rotation: 0 | 90 | 180 | 270) => {
      if (!room?.game || !selectedHandCardId || !canPlaceSelectedForestCard || !room.game.activePlayerId) {
        return;
      }
      if (tutorialBlocks("placeCard")) return;
      // Tutorial: enforce the marked card and the marked slot.
      if (tutorialActive) {
        const def = tutorialStep !== null ? tutorialSteps[tutorialStep] : null;
        if (def?.requiredCardId && selectedHandCardId !== def.requiredCardId) return;
        if (tutorialMarkedSlot && (position.x !== tutorialMarkedSlot.x || position.y !== tutorialMarkedSlot.y)) return;
      }

      const activePlayerId = room.game.activePlayerId;
      if (!activePlayerId) {
        return;
      }
      const cardId = selectedHandCardId;
      executeGameIntent(
        activePlayerId,
        {
          type: "forest.place-card",
          cardId,
          x: position.x,
          y: position.y,
          rotation
        },
        "Carta colocada na floresta.",
        () => {
          setSelectedHandCardId(null);
          setSelectedCardRotation(0);
          setSelectedPieceId(null);
          setSelectedRemovalPieceIds([]);
          setPendingPlacement(null);
        }
      );
    },
    [
      canPlaceSelectedForestCard,
      executeGameIntent,
      room,
      selectedHandCardId,
      tutorialBlocks,
      tutorialActive,
      tutorialStep,
      tutorialSteps,
      tutorialMarkedSlot
    ]
  );

  const handleConfirmPlacement = useCallback(() => {
    if (!pendingPlacement) return;
    placeCard(pendingPlacement.position, pendingPlacement.rotation);
    clearPendingPlacement();
  }, [clearPendingPlacement, pendingPlacement, placeCard]);

  // Cancel returns the card to the hand (still selected) so the player can place
  // the same or another card anywhere valid.
  const handleCancelPlacement = clearPendingPlacement;

  // Enter confirms / Escape cancels the staged placement.
  useEffect(() => {
    if (!pendingPlacement) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleConfirmPlacement();
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleCancelPlacement();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingPlacement, handleConfirmPlacement, handleCancelPlacement]);

  return {
    rotateSelectedCard,
    handleCardClick,
    placeCard,
    handleConfirmPlacement,
    handleCancelPlacement
  };
}
