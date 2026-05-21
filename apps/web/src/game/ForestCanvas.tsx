import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import Phaser from "phaser";
import type { ForestCardState, GridPosition, PieceState } from "@oikos/shared";
import { ForestPhaserScene } from "./ForestPhaserScene";

interface ForestCanvasProps {
  cards: ForestCardState[];
  pieces: PieceState[];
  canPlaceSetupPiece: boolean;
  expansionTargets?: GridPosition[];
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
  onCardClick?: (position: GridPosition) => void;
  onExpansionTargetClick?: (position: GridPosition) => void;
  onAddPieceTargetClick?: (position: GridPosition) => void;
  onBonusTargetClick?: (position: GridPosition) => void;
  onPieceClick?: (pieceId: string) => void;
  onMovementTargetClick?: (position: GridPosition) => void;
}

export interface ForestCanvasHandle {
  getCardCenter: (position: GridPosition) => { x: number; y: number } | null;
  getCardLocal: (position: GridPosition) => { x: number; y: number } | null;
  getCardScreenSize: () => number;
  getHostElement: () => HTMLDivElement | null;
}

const ForestCanvasComponent = forwardRef<ForestCanvasHandle, ForestCanvasProps>(function ForestCanvas(props, ref) {
  const {
    cards,
    pieces,
    canPlaceSetupPiece,
    expansionTargets = [],
    movementTargets = [],
    addPieceTargets = [],
    addPieceHint = "Clique em uma carta destacada para adicionar uma peça",
    bonusTargets = [],
    spotlightInstanceIds = [],
    selectedHandCardId,
    selectedPieceId = null,
    selectedPieceIds = [],
    selectablePieceIds = []
  } = props;
  const viewModel = useMemo(
    () => ({
      cards,
      pieces,
      canPlaceSetupPiece,
      expansionTargets,
      movementTargets,
      addPieceTargets,
      bonusTargets,
      spotlightInstanceIds,
      selectedPieceId,
      selectedPieceIds,
      selectablePieceIds
    }),
    [
      addPieceTargets,
      bonusTargets,
      canPlaceSetupPiece,
      cards,
      expansionTargets,
      movementTargets,
      pieces,
      selectablePieceIds,
      selectedPieceId,
      selectedPieceIds,
      spotlightInstanceIds
    ]
  );

  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<ForestPhaserScene | null>(null);

  useImperativeHandle(ref, () => ({
    getCardCenter(position: GridPosition) {
      const host = hostRef.current;
      const local = sceneRef.current?.gridToScreenPoint(position);
      if (!host || !local) {
        return null;
      }

      // Prefer canvas element rect (matches actual rendered surface) over host wrapper.
      const canvas = host.querySelector("canvas") as HTMLCanvasElement | null;
      const rect = (canvas ?? host).getBoundingClientRect();
      return {
        x: rect.left + local.x,
        y: rect.top + local.y
      };
    },
    getCardLocal(position: GridPosition) {
      const local = sceneRef.current?.gridToScreenPoint(position);
      if (!local) return null;
      return { x: local.x, y: local.y };
    },
    getCardScreenSize() {
      return sceneRef.current?.getCardScreenSize() ?? 0;
    },
    getHostElement() {
      return hostRef.current;
    }
  }), []);

  useEffect(() => {
    if (!hostRef.current) return;

    const scene = new ForestPhaserScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      transparent: true,
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
      render: { antialias: true },
      scene
    });
    gameRef.current = game;

    const host = hostRef.current;
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w > 0 && h > 0) game.scale.resize(w, h);
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setCallbacks({
      onCardClick: props.onCardClick,
      onExpansionTargetClick: props.onExpansionTargetClick,
      onAddPieceTargetClick: props.onAddPieceTargetClick,
      onBonusTargetClick: props.onBonusTargetClick,
      onPieceClick: props.onPieceClick,
      onMovementTargetClick: props.onMovementTargetClick
    });
  }, [
    props.onAddPieceTargetClick,
    props.onBonusTargetClick,
    props.onCardClick,
    props.onExpansionTargetClick,
    props.onMovementTargetClick,
    props.onPieceClick
  ]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setState({
      ...viewModel
    });
  }, [viewModel]);

  const statusText = canPlaceSetupPiece
    ? "Clique em uma carta para posicionar seu meeple inicial"
    : bonusTargets.length > 0
      ? "Dupla de quatis formada — clique em uma carta adjacente para o bônus"
      : selectedHandCardId
        ? "Clique em um espaço destacado para colocar a carta"
        : addPieceTargets.length > 0
          ? addPieceHint
          : selectablePieceIds.length > 0
            ? "Selecione uma peça, depois clique no destino destacado"
            : "Selecione uma carta da mão para expandir a floresta";

  return (
    <div className="forest-canvas">
      <div ref={hostRef} className="forest-phaser-host" />
      <div className="forest-status-chip">{statusText}</div>
      <button
        type="button"
        className="forest-recenter"
        title="Recentralizar"
        onClick={() => sceneRef.current?.resetView()}
      >
        Recentralizar
      </button>
    </div>
  );
});

export const ForestCanvas = memo(ForestCanvasComponent);
