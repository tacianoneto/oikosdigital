import type { ComponentType, RefAttributes } from "react";
import type { ForestCardState, GridPosition, PieceState } from "@oikos/shared";
import type {
  PlacementPreview,
  RotateFitTarget,
  ScoringCardHighlight,
  ScoringLineHighlight
} from "./ForestPhaserScene";

export interface ForestCanvasProps {
  cards: ForestCardState[];
  pieces: PieceState[];
  canPlaceSetupPiece: boolean;
  interactive?: boolean;
  expansionTargets?: GridPosition[];
  rotateFitTargets?: RotateFitTarget[];
  rotateFitCardId?: string | null;
  placementPreview?: PlacementPreview | null;
  movementTargets?: GridPosition[];
  addPieceTargets?: GridPosition[];
  addPieceLabel?: string;
  addPieceHint?: string;
  bonusTargets?: GridPosition[];
  spotlightInstanceIds?: string[];
  selectedHandCardId?: string | null;
  selectedPieceId?: string | null;
  selectedPieceIds?: string[];
  selectablePieceIds?: string[];
  scoringCardHighlights?: ScoringCardHighlight[];
  scoringLineHighlights?: ScoringLineHighlight[];
  onCardClick?: (position: GridPosition) => void;
  onExpansionTargetClick?: (position: GridPosition) => void;
  onRotateFitTargetClick?: (position: GridPosition, rotation: number) => void;
  onConfirmPlacement?: () => void;
  onCancelPlacement?: () => void;
  onAddPieceTargetClick?: (position: GridPosition) => void;
  onBonusTargetClick?: (position: GridPosition) => void;
  onPieceClick?: (pieceId: string) => void;
  onMovementTargetClick?: (position: GridPosition) => void;
}

export interface ForestCanvasHandle {
  getCardCenter: (position: GridPosition) => { x: number; y: number } | null;
  getPieceCenter: (pieceId: string) => { x: number; y: number } | null;
  getCardLocal: (position: GridPosition) => { x: number; y: number } | null;
  getCardScreenSize: () => number;
  getHostElement: () => HTMLDivElement | null;
}

export type ForestCanvasComponent = ComponentType<ForestCanvasProps & RefAttributes<ForestCanvasHandle>>;
