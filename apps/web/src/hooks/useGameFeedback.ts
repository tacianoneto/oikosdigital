import { useState, type Dispatch, type SetStateAction } from "react";
import type { GridPosition, SpeciesId, ThreatCardId } from "@oikos/shared";
import type { CapuchinHabitatGroup } from "@oikos/rules";
import type { FloatingGain, TravelEffect } from "../ui/gameEffects";
import type { TurnRecapState } from "../ui/turnSummary";

export interface MacawScoreAnim {
  lines: Array<{ positions: [GridPosition, GridPosition, GridPosition] }>;
  points: number;
  playerName: string;
}

export interface CapuchinScoreAnim {
  groups: CapuchinHabitatGroup[];
  points: number;
  playerName: string;
}

export interface TurnBanner {
  key: number;
  label: string;
  speciesId: SpeciesId | null;
}

export interface GameFeedback {
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  notice: string | null;
  setNotice: Dispatch<SetStateAction<string | null>>;
  threatReveal: ThreatCardId | null;
  setThreatReveal: Dispatch<SetStateAction<ThreatCardId | null>>;
  macawScoreAnim: MacawScoreAnim | null;
  setMacawScoreAnim: Dispatch<SetStateAction<MacawScoreAnim | null>>;
  capuchinScoreAnim: CapuchinScoreAnim | null;
  setCapuchinScoreAnim: Dispatch<SetStateAction<CapuchinScoreAnim | null>>;
  turnBanner: TurnBanner | null;
  setTurnBanner: Dispatch<SetStateAction<TurnBanner | null>>;
  floatingGains: FloatingGain[];
  setFloatingGains: Dispatch<SetStateAction<FloatingGain[]>>;
  travelEffects: TravelEffect[];
  setTravelEffects: Dispatch<SetStateAction<TravelEffect[]>>;
  turnRecap: TurnRecapState;
  setTurnRecap: Dispatch<SetStateAction<TurnRecapState>>;
  hoveredSummaryCardIds: string[];
  setHoveredSummaryCardIds: Dispatch<SetStateAction<string[]>>;
  showJaguarScoreModal: boolean;
  setShowJaguarScoreModal: Dispatch<SetStateAction<boolean>>;
  expandedObjectiveCardId: string | null;
  setExpandedObjectiveCardId: Dispatch<SetStateAction<string | null>>;
  pendingObjectiveCardId: string | null;
  setPendingObjectiveCardId: Dispatch<SetStateAction<string | null>>;
}

// Groups the transient feedback/animation state of the in-game screen: the
// error/notice toasts, the full-screen threat reveal, the macaw/capuchin score
// animations, the turn banner, floating resource gains, travel effects, the
// turn-recap carousel (+ its hovered cards), the jaguar score modal flag and the
// objective preview/pending selection. Pure state container — every effect,
// auto-dismiss timer, ref (e.g. lastThreatRef) and derived value (turnSummary)
// that drives these stays in OikosApp, which reads/writes through these setters.
export function useGameFeedback(): GameFeedback {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [threatReveal, setThreatReveal] = useState<ThreatCardId | null>(null);
  const [macawScoreAnim, setMacawScoreAnim] = useState<MacawScoreAnim | null>(null);
  const [capuchinScoreAnim, setCapuchinScoreAnim] = useState<CapuchinScoreAnim | null>(null);
  const [turnBanner, setTurnBanner] = useState<TurnBanner | null>(null);
  const [floatingGains, setFloatingGains] = useState<FloatingGain[]>([]);
  const [travelEffects, setTravelEffects] = useState<TravelEffect[]>([]);
  const [turnRecap, setTurnRecap] = useState<TurnRecapState>({ history: [], index: -1, visible: false });
  const [hoveredSummaryCardIds, setHoveredSummaryCardIds] = useState<string[]>([]);
  const [showJaguarScoreModal, setShowJaguarScoreModal] = useState(false);
  const [expandedObjectiveCardId, setExpandedObjectiveCardId] = useState<string | null>(null);
  const [pendingObjectiveCardId, setPendingObjectiveCardId] = useState<string | null>(null);

  return {
    error,
    setError,
    notice,
    setNotice,
    threatReveal,
    setThreatReveal,
    macawScoreAnim,
    setMacawScoreAnim,
    capuchinScoreAnim,
    setCapuchinScoreAnim,
    turnBanner,
    setTurnBanner,
    floatingGains,
    setFloatingGains,
    travelEffects,
    setTravelEffects,
    turnRecap,
    setTurnRecap,
    hoveredSummaryCardIds,
    setHoveredSummaryCardIds,
    showJaguarScoreModal,
    setShowJaguarScoreModal,
    expandedObjectiveCardId,
    setExpandedObjectiveCardId,
    pendingObjectiveCardId,
    setPendingObjectiveCardId
  };
}
