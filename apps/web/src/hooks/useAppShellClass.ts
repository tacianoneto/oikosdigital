import { useMemo } from "react";
import type { SpeciesId } from "@oikos/shared";

const SPECIES_SHELL_CLASS: Partial<Record<SpeciesId, string>> = {
  jaguar: "is-jaguar-active",
  maned_wolf: "is-wolf-active",
  armadillo: "is-armadillo-active",
  macaw: "is-macaw-active",
  capuchin: "is-capuchin-active",
  coati: "is-coati-active",
  galo_de_campina: "is-galo-active"
};

interface AppShellInput {
  hasStartedGame: boolean;
  isMobile: boolean;
  cleanBoardMode: boolean;
  isBasicTutorial: boolean;
  currentSpeciesId: SpeciesId | null;
  visualAccessibility: boolean;
  mobileSheet: string | null;
}

interface AppShellAttrs {
  className: string;
  dataVisualAccessibility: "true" | "false";
  dataSheet: string | undefined;
}

// Derives the root `<main>` shell className and data-attributes from the current
// game/UI state. Keeps the large class expression (per-species themes, mobile
// HUD, accessibility) out of the OikosApp JSX.
export function useAppShellClass({
  hasStartedGame,
  isMobile,
  cleanBoardMode,
  isBasicTutorial,
  currentSpeciesId,
  visualAccessibility,
  mobileSheet
}: AppShellInput): AppShellAttrs {
  return useMemo(() => {
    const mobileHud = isMobile && hasStartedGame && !cleanBoardMode;
    const speciesClass =
      !isBasicTutorial && currentSpeciesId ? SPECIES_SHELL_CLASS[currentSpeciesId] ?? "" : "";

    const className = [
      "app-shell",
      hasStartedGame ? "game-active" : "menu-active",
      mobileHud ? "mobile-hud" : "",
      speciesClass,
      visualAccessibility ? "accessibility-visual-mode" : ""
    ]
      .filter(Boolean)
      .join(" ");

    return {
      className,
      dataVisualAccessibility: visualAccessibility ? "true" : "false",
      dataSheet: mobileHud ? mobileSheet ?? "none" : undefined
    };
  }, [
    cleanBoardMode,
    currentSpeciesId,
    hasStartedGame,
    isBasicTutorial,
    isMobile,
    mobileSheet,
    visualAccessibility
  ]);
}
