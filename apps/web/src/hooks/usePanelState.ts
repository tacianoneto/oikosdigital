import { useState, type Dispatch, type SetStateAction } from "react";
import type { SpeciesId } from "@oikos/shared";
import { isSmallScreen } from "../ui/responsive";
import { getVisualAccessibilityPreference } from "../ui/visualAccessibility";
import type { HandSortMode } from "./playerCardState";
import type { MobileSheet } from "../screens/OikosApp.helpers";

export interface PanelState {
  handCollapsed: boolean;
  setHandCollapsed: Dispatch<SetStateAction<boolean>>;
  handSortMode: HandSortMode;
  setHandSortMode: Dispatch<SetStateAction<HandSortMode>>;
  cleanBoardMode: boolean;
  setCleanBoardMode: Dispatch<SetStateAction<boolean>>;
  boardSpecies: SpeciesId | null;
  setBoardSpecies: Dispatch<SetStateAction<SpeciesId | null>>;
  configOpen: boolean;
  setConfigOpen: Dispatch<SetStateAction<boolean>>;
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  scenarioDockOpen: boolean;
  setScenarioDockOpen: Dispatch<SetStateAction<boolean>>;
  mobileSheet: MobileSheet;
  setMobileSheet: Dispatch<SetStateAction<MobileSheet>>;
  visualAccessibility: boolean;
  setVisualAccessibility: Dispatch<SetStateAction<boolean>>;
  hudLeftCollapsed: boolean;
  setHudLeftCollapsed: Dispatch<SetStateAction<boolean>>;
  hudSpeciesCollapsed: boolean;
  setHudSpeciesCollapsed: Dispatch<SetStateAction<boolean>>;
  recapCollapsed: boolean;
  setRecapCollapsed: Dispatch<SetStateAction<boolean>>;
}

// Groups the ephemeral panel/layout toggles of the in-game screen: hand dock
// collapse + sort, clean-board mode, the species board modal target, the
// config/settings/scenario panels, the mobile bottom sheet, the visual
// accessibility flag, the HUD dock collapses and the turn-recap collapse. Pure
// state container — the effects and handlers that drive these stay in OikosApp.
// Collapse flags seed from the breakpoint and accessibility from its stored
// preference, exactly as before.
export function usePanelState(): PanelState {
  const [handCollapsed, setHandCollapsed] = useState(isSmallScreen);
  const [handSortMode, setHandSortMode] = useState<HandSortMode>("habitat");
  const [cleanBoardMode, setCleanBoardMode] = useState(false);
  const [boardSpecies, setBoardSpecies] = useState<SpeciesId | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scenarioDockOpen, setScenarioDockOpen] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [visualAccessibility, setVisualAccessibility] = useState(() => getVisualAccessibilityPreference());
  const [hudLeftCollapsed, setHudLeftCollapsed] = useState(isSmallScreen);
  const [hudSpeciesCollapsed, setHudSpeciesCollapsed] = useState(isSmallScreen);
  const [recapCollapsed, setRecapCollapsed] = useState(true);

  return {
    handCollapsed,
    setHandCollapsed,
    handSortMode,
    setHandSortMode,
    cleanBoardMode,
    setCleanBoardMode,
    boardSpecies,
    setBoardSpecies,
    configOpen,
    setConfigOpen,
    settingsOpen,
    setSettingsOpen,
    scenarioDockOpen,
    setScenarioDockOpen,
    mobileSheet,
    setMobileSheet,
    visualAccessibility,
    setVisualAccessibility,
    hudLeftCollapsed,
    setHudLeftCollapsed,
    hudSpeciesCollapsed,
    setHudSpeciesCollapsed,
    recapCollapsed,
    setRecapCollapsed
  };
}
