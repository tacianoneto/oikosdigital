import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import type { MouseEvent } from "react";
import type { SpeciesId } from "@oikos/shared";
import type { ExpansionPreviewKind } from "../ui/GameOverlays";
import type { MovementPreview } from "./useActionSelection";

interface BoardOverlaysParams {
  setMovementPreview: Dispatch<SetStateAction<MovementPreview | null>>;
  setExpansionOrigin: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setExpansionPreview: Dispatch<SetStateAction<ExpansionPreviewKind | null>>;
}

// Small board-overlay utilities grouped out of OikosApp: positioning the
// movement-pattern preview popover, registering DOM nodes as travel-effect
// targets (the map is owned here and returned for the turn-transition hook), and
// toggling the centered expansion preview (objective/scenarios/threat) from the
// clicked icon's center. Pure UI helpers — no game state, socket or rules.
export function useBoardOverlays({
  setMovementPreview,
  setExpansionOrigin,
  setExpansionPreview
}: BoardOverlaysParams) {
  const effectTargetRefs = useRef(new Map<string, HTMLElement>());

  const showMovementPreview = useCallback((speciesId: SpeciesId, rect: DOMRect) => {
    const previewWidth = 220;
    const previewHeight = 300;
    const gap = 12;
    const safeMargin = 12;
    const left = Math.max(
      safeMargin,
      Math.min(window.innerWidth - previewWidth - safeMargin, rect.left - previewWidth - gap)
    );
    const top = Math.max(
      safeMargin,
      Math.min(window.innerHeight - previewHeight - safeMargin, rect.top - 8)
    );
    setMovementPreview({ speciesId, left, top });
  }, []);

  const setEffectTarget = useCallback((key: string, element: HTMLElement | null) => {
    if (element) {
      effectTargetRefs.current.set(key, element);
    } else {
      effectTargetRefs.current.delete(key);
    }
  }, []);

  const toggleExpansionPreview = useCallback(
    (kind: "objective" | "scenarios" | "threat", event: MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setExpansionOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      setExpansionPreview((current) => (current === kind ? null : kind));
    },
    []
  );

  return {
    effectTargetRefs,
    showMovementPreview,
    setEffectTarget,
    toggleExpansionPreview
  };
}
