import { useState, type Dispatch, type SetStateAction } from "react";
import type { Resource, SpeciesId } from "@oikos/shared";
import type { ExpansionPreviewKind } from "../ui/GameOverlays";
import type { LandingMode } from "../screens/MainMenuScreen";

export interface PendingPlacement {
  position: { x: number; y: number };
  rotation: 0 | 90 | 180 | 270;
}

export interface MovementPreview {
  speciesId: SpeciesId;
  left: number;
  top: number;
}

export interface ActionSelection {
  selectedSpecies: SpeciesId | "";
  setSelectedSpecies: Dispatch<SetStateAction<SpeciesId | "">>;
  selectedHandCardId: string | null;
  setSelectedHandCardId: Dispatch<SetStateAction<string | null>>;
  selectedCardRotation: 0 | 90 | 180 | 270;
  setSelectedCardRotation: Dispatch<SetStateAction<0 | 90 | 180 | 270>>;
  selectedPieceId: string | null;
  setSelectedPieceId: Dispatch<SetStateAction<string | null>>;
  selectedJaguarDestination: { x: number; y: number } | null;
  setSelectedJaguarDestination: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  selectedJaguarTargetPieceId: string | null;
  setSelectedJaguarTargetPieceId: Dispatch<SetStateAction<string | null>>;
  selectedWolfTargetPieceId: string | null;
  setSelectedWolfTargetPieceId: Dispatch<SetStateAction<string | null>>;
  selectedWolfResources: Resource[];
  setSelectedWolfResources: Dispatch<SetStateAction<Resource[]>>;
  selectedRemovalPieceIds: string[];
  setSelectedRemovalPieceIds: Dispatch<SetStateAction<string[]>>;
  cacaIlegalRemovalMode: boolean;
  setCacaIlegalRemovalMode: Dispatch<SetStateAction<boolean>>;
  selectedOpponentPlayerId: string | null;
  setSelectedOpponentPlayerId: Dispatch<SetStateAction<string | null>>;
  expansionPreview: ExpansionPreviewKind | null;
  setExpansionPreview: Dispatch<SetStateAction<ExpansionPreviewKind | null>>;
  expansionOrigin: { x: number; y: number } | null;
  setExpansionOrigin: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  movementPreview: MovementPreview | null;
  setMovementPreview: Dispatch<SetStateAction<MovementPreview | null>>;
  landingMode: LandingMode;
  setLandingMode: Dispatch<SetStateAction<LandingMode>>;
  pendingPlacement: PendingPlacement | null;
  setPendingPlacement: Dispatch<SetStateAction<PendingPlacement | null>>;
}

// Groups the current-action selection state of the in-game screen: chosen
// species, selected hand card + its rotation, selected piece, jaguar/wolf
// targets (destination, target piece, resources), removal selection (+ the
// caça-ilegal removal mode), inspected opponent, forest-expansion preview (+ its
// fly-from origin), the movement preview popover, the lobby landing mode and the
// chosen-but-unconfirmed card placement. Pure state container — every effect
// that resets/syncs these on game changes, every handler that dispatches the
// local/online action and all derived values stay in OikosApp, which reads and
// writes through these setters.
export function useActionSelection(): ActionSelection {
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesId | "">("");
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedCardRotation, setSelectedCardRotation] = useState<0 | 90 | 180 | 270>(0);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [selectedJaguarDestination, setSelectedJaguarDestination] = useState<{ x: number; y: number } | null>(null);
  const [selectedJaguarTargetPieceId, setSelectedJaguarTargetPieceId] = useState<string | null>(null);
  const [selectedWolfTargetPieceId, setSelectedWolfTargetPieceId] = useState<string | null>(null);
  const [selectedWolfResources, setSelectedWolfResources] = useState<Resource[]>([]);
  const [selectedRemovalPieceIds, setSelectedRemovalPieceIds] = useState<string[]>([]);
  const [cacaIlegalRemovalMode, setCacaIlegalRemovalMode] = useState(false);
  const [selectedOpponentPlayerId, setSelectedOpponentPlayerId] = useState<string | null>(null);
  const [expansionPreview, setExpansionPreview] = useState<ExpansionPreviewKind | null>(null);
  const [expansionOrigin, setExpansionOrigin] = useState<{ x: number; y: number } | null>(null);
  const [movementPreview, setMovementPreview] = useState<MovementPreview | null>(null);
  const [landingMode, setLandingMode] = useState<LandingMode>("idle");
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement | null>(null);

  return {
    selectedSpecies,
    setSelectedSpecies,
    selectedHandCardId,
    setSelectedHandCardId,
    selectedCardRotation,
    setSelectedCardRotation,
    selectedPieceId,
    setSelectedPieceId,
    selectedJaguarDestination,
    setSelectedJaguarDestination,
    selectedJaguarTargetPieceId,
    setSelectedJaguarTargetPieceId,
    selectedWolfTargetPieceId,
    setSelectedWolfTargetPieceId,
    selectedWolfResources,
    setSelectedWolfResources,
    selectedRemovalPieceIds,
    setSelectedRemovalPieceIds,
    cacaIlegalRemovalMode,
    setCacaIlegalRemovalMode,
    selectedOpponentPlayerId,
    setSelectedOpponentPlayerId,
    expansionPreview,
    setExpansionPreview,
    expansionOrigin,
    setExpansionOrigin,
    movementPreview,
    setMovementPreview,
    landingMode,
    setLandingMode,
    pendingPlacement,
    setPendingPlacement
  };
}
