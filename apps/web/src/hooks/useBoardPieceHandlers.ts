import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  getCapuchinScoringHabitats,
  getMacawScoringLines,
  type MacawScoringLine
} from "@oikos/rules";
import type { GameState, PublicRoomState, SpeciesId } from "@oikos/shared";
import { getAddPieceIntentFactory } from "../screens/OikosApp.helpers";
import { sameGridPosition } from "../ui/geometry";
import type { CapuchinScoreAnim, MacawScoreAnim } from "./useGameFeedback";
import type { ExecuteGameIntent } from "./useGameIntentExecutor";
import type { TutorialBoardAction } from "./useTutorialController";
import type { TutorialStepDef } from "../ui/tutorials";

type PendingCacaIlegal = NonNullable<GameState["cacaIlegalPending"]>;
type GridTarget = { x: number; y: number };

export function shouldPromptJaguarRemovalTargetBeforeMove(
  game: GameState,
  activeSpeciesId: SpeciesId | null,
  selectedPieceId: string | null,
  position: GridTarget
): boolean {
  if (activeSpeciesId !== "jaguar" || !selectedPieceId) {
    return false;
  }

  const removablePieces = game.pieces.filter(
    (piece) =>
      piece.ownerId !== game.activePlayerId &&
      !piece.state.hidden &&
      piece.location?.x === position.x &&
      piece.location.y === position.y
  );

  return removablePieces.length > 1;
}

interface BoardPieceHandlersParams {
  room: PublicRoomState | null;
  activeActionId: string | null;
  activeSpeciesId: SpeciesId | null;
  selectedPieceId: string | null;
  selectedJaguarDestination: GridTarget | null;
  boardSelectablePieceIds: string[];
  jaguarTargetPieceIds: string[];
  movementTargets: GridTarget[];
  addPieceTargets: GridTarget[];
  coatiPairBonusTargets: GridTarget[];
  cacaIlegalRemovalMode: boolean;
  cacaIlegalPending: PendingCacaIlegal | null;
  controlledPlayerId: string | null;
  requiredCoatiRemovalCount: number;
  canControlActivePlayer: boolean;
  canSkipExtraTurnNoCardAction: boolean;
  needsEndgameOverflowRepair: boolean;
  hasPendingCoatiPairBonus: boolean;
  tutorialActive: boolean;
  tutorialGate: string | null;
  tutorialDef: TutorialStepDef | null;
  tutorialBlocks: (action: TutorialBoardAction) => boolean;
  autoScoredRef: MutableRefObject<string | null>;
  executeGameIntent: ExecuteGameIntent;
  handleScoreGalo: () => void;
  handleScoreArmadillo: () => void;
  setSelectedPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedJaguarDestination: Dispatch<SetStateAction<GridTarget | null>>;
  setSelectedJaguarTargetPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedWolfTargetPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedRemovalPieceIds: Dispatch<SetStateAction<string[]>>;
  setNotice: (notice: string | null) => void;
  setCapuchinScoreAnim: Dispatch<SetStateAction<CapuchinScoreAnim | null>>;
  setMacawScoreAnim: Dispatch<SetStateAction<MacawScoreAnim | null>>;
}

export function useBoardPieceHandlers({
  room,
  activeActionId,
  activeSpeciesId,
  selectedPieceId,
  selectedJaguarDestination,
  boardSelectablePieceIds,
  jaguarTargetPieceIds,
  movementTargets,
  addPieceTargets,
  coatiPairBonusTargets,
  cacaIlegalRemovalMode,
  cacaIlegalPending,
  controlledPlayerId,
  requiredCoatiRemovalCount,
  canControlActivePlayer,
  hasPendingCoatiPairBonus,
  tutorialActive,
  tutorialGate,
  tutorialDef,
  tutorialBlocks,
  autoScoredRef,
  executeGameIntent,
  handleScoreGalo,
  handleScoreArmadillo,
  setSelectedPieceId,
  setSelectedJaguarDestination,
  setSelectedJaguarTargetPieceId,
  setSelectedWolfTargetPieceId,
  setSelectedRemovalPieceIds,
  setNotice,
  setCapuchinScoreAnim,
  setMacawScoreAnim
}: BoardPieceHandlersParams) {
  const executeSelectedPieceMove = useCallback(
    (position: GridTarget, targetPieceId?: string) => {
      if (!room?.game || !selectedPieceId) {
        return;
      }
      if (tutorialBlocks("move")) return;
      if (tutorialActive && tutorialGate === "move" && tutorialDef?.markedMoveTarget) {
        if (!sameGridPosition(position, tutorialDef.markedMoveTarget)) {
          return;
        }
      }

      const currentGame = room.game;
      const movingPieceId = selectedPieceId;

      if (currentGame.pendingGaloInterrupt?.ownerId === controlledPlayerId) {
        executeGameIntent(
          controlledPlayerId,
          { type: "galo.resolve-interrupt", pieceId: movingPieceId, x: position.x, y: position.y },
          "Galo-de-campina movido entre turnos.",
          () => setSelectedPieceId(null)
        );
        return;
      }

      if (!currentGame.activePlayerId) {
        return;
      }

      executeGameIntent(
        currentGame.activePlayerId,
        { type: "piece.move", pieceId: movingPieceId, x: position.x, y: position.y, targetPieceId },
        getMoveNotice(activeSpeciesId, activeActionId),
        () => {
          setSelectedPieceId(null);
          setSelectedJaguarDestination(null);
          setSelectedJaguarTargetPieceId(null);
          setSelectedRemovalPieceIds([]);
        }
      );
    },
    [
      activeActionId,
      activeSpeciesId,
      controlledPlayerId,
      executeGameIntent,
      room,
      selectedPieceId,
      setSelectedJaguarDestination,
      setSelectedJaguarTargetPieceId,
      setSelectedPieceId,
      setSelectedRemovalPieceIds,
      tutorialActive,
      tutorialBlocks,
      tutorialDef?.markedMoveTarget,
      tutorialGate
    ]
  );

  const handlePieceClick = useCallback(
    (pieceId: string) => {
      if (!boardSelectablePieceIds.includes(pieceId)) {
        return;
      }

      if (cacaIlegalRemovalMode && cacaIlegalPending?.playerId === controlledPlayerId) {
        setSelectedRemovalPieceIds((current) => (current.includes(pieceId) ? [] : [pieceId]));
        return;
      }

      if (jaguarTargetPieceIds.includes(pieceId)) {
        if (room?.game?.pendingGaloInterrupt) {
          setSelectedJaguarDestination(null);
          setSelectedJaguarTargetPieceId(null);
          setNotice(
            room.game.pendingGaloInterrupt.ownerId === controlledPlayerId
              ? "Entre turnos: mova 1 galo."
              : "Aguarde o Galo."
          );
          return;
        }

        const pendingJaguarRemoval = room?.game?.pendingJaguarRemoval;
        if (pendingJaguarRemoval && room?.game?.activePlayerId === pendingJaguarRemoval.playerId) {
          const jaguarPieceId = room.game.pieces.find(
            (piece) => piece.ownerId === pendingJaguarRemoval.playerId && piece.speciesId === "jaguar" && piece.location
          )?.pieceId;
          if (!jaguarPieceId) {
            return;
          }

          executeGameIntent(
            pendingJaguarRemoval.playerId,
            {
              type: "piece.move",
              pieceId: jaguarPieceId,
              x: pendingJaguarRemoval.location.x,
              y: pendingJaguarRemoval.location.y,
              targetPieceId: pieceId
            },
            "Onca removeu 1 peca.",
            () => {
              setSelectedPieceId(null);
              setSelectedJaguarDestination(null);
              setSelectedJaguarTargetPieceId(null);
            }
          );
          return;
        }

        if (selectedJaguarDestination) {
          executeSelectedPieceMove(selectedJaguarDestination, pieceId);
        } else {
          setSelectedJaguarTargetPieceId((current) => (current === pieceId ? null : pieceId));
        }
        return;
      }

      if (activeSpeciesId === "maned_wolf" && activeActionId === "B") {
        setSelectedWolfTargetPieceId((current) => (current === pieceId ? null : pieceId));
        return;
      }

      if (activeSpeciesId === "coati" && activeActionId === "C") {
        setSelectedRemovalPieceIds((current) => {
          if (current.includes(pieceId)) {
            return current.filter((candidate) => candidate !== pieceId);
          }

          if (current.length >= requiredCoatiRemovalCount) {
            return [...current.slice(1), pieceId];
          }

          return [...current, pieceId];
        });
        return;
      }

      setSelectedPieceId((current) => {
        const next = current === pieceId ? null : pieceId;
        setSelectedJaguarDestination(null);
        setSelectedJaguarTargetPieceId(null);
        return next;
      });
    },
    [
      activeActionId,
      activeSpeciesId,
      boardSelectablePieceIds,
      cacaIlegalPending?.playerId,
      cacaIlegalRemovalMode,
      controlledPlayerId,
      executeGameIntent,
      executeSelectedPieceMove,
      jaguarTargetPieceIds,
      requiredCoatiRemovalCount,
      room,
      selectedJaguarDestination,
      setNotice,
      setSelectedJaguarDestination,
      setSelectedJaguarTargetPieceId,
      setSelectedPieceId,
      setSelectedRemovalPieceIds,
      setSelectedWolfTargetPieceId
    ]
  );

  const handleMovementTargetClick = useCallback(
    (position: GridTarget) => {
      if (!room?.game || !room.game.activePlayerId || !selectedPieceId || movementTargets.length === 0) {
        return;
      }

      const currentGame = room.game;

      if (currentGame.pendingGaloInterrupt) {
        if (currentGame.pendingGaloInterrupt.ownerId === controlledPlayerId) {
          executeSelectedPieceMove(position);
        } else {
          setSelectedJaguarDestination(null);
          setSelectedJaguarTargetPieceId(null);
          setSelectedPieceId(null);
          setNotice("Aguarde o Galo.");
        }
        return;
      }

      if (activeSpeciesId === "jaguar") {
        if (currentGame.pendingJaguarRemoval) {
          setSelectedJaguarDestination(null);
          setSelectedJaguarTargetPieceId(null);
          setSelectedPieceId(null);
          setNotice("Clique em uma peca no local de entrada da Onca para remover.");
          return;
        }

        const shouldChooseJaguarTarget = shouldPromptJaguarRemovalTargetBeforeMove(
          currentGame,
          activeSpeciesId,
          selectedPieceId,
          position
        );

        if (shouldChooseJaguarTarget) {
          setSelectedJaguarDestination(position);
          setSelectedJaguarTargetPieceId(null);
          setNotice("Escolha qual meeple a Onca deve remover neste local.");
          return;
        }

        executeSelectedPieceMove(position);
        return;
      }

      executeSelectedPieceMove(position);
    },
    [
      activeSpeciesId,
      controlledPlayerId,
      executeSelectedPieceMove,
      movementTargets.length,
      room,
      selectedPieceId,
      setNotice,
      setSelectedJaguarDestination,
      setSelectedJaguarTargetPieceId,
      setSelectedPieceId
    ]
  );

  const handleAddPieceTargetClick = useCallback(
    (position: GridTarget) => {
      if (!room?.game || !room.game.activePlayerId || addPieceTargets.length === 0) {
        return;
      }
      if (tutorialActive && tutorialGate !== "placeCard" && tutorialGate !== "addPiece") return;
      if (
        tutorialActive &&
        tutorialGate === "addPiece" &&
        tutorialDef?.markedAddPieceTarget &&
        !sameGridPosition(position, tutorialDef.markedAddPieceTarget)
      ) {
        return;
      }

      const addPiece = getAddPieceIntentFactory(activeSpeciesId ?? undefined);
      executeGameIntent(room.game.activePlayerId, addPiece.intent(position), addPiece.notice);
    },
    [
      activeSpeciesId,
      addPieceTargets.length,
      executeGameIntent,
      room,
      tutorialActive,
      tutorialDef?.markedAddPieceTarget,
      tutorialGate
    ]
  );

  const handleCoatiPairBonusTargetClick = useCallback(
    (position: GridTarget) => {
      if (!room?.game || !room.game.activePlayerId || coatiPairBonusTargets.length === 0) {
        return;
      }
      if (tutorialActive && tutorialGate !== "resolvePair") {
        return;
      }
      if (
        tutorialActive &&
        tutorialDef?.markedPairTarget &&
        !sameGridPosition(position, tutorialDef.markedPairTarget)
      ) {
        return;
      }

      executeGameIntent(
        room.game.activePlayerId,
        { type: "coati.resolve-pair", x: position.x, y: position.y },
        "Quati da passiva adicionado e 1 ponto marcado."
      );
    },
    [coatiPairBonusTargets.length, executeGameIntent, room, tutorialActive, tutorialDef?.markedPairTarget, tutorialGate]
  );

  const handleScoreCapuchin = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    const activeId = room.game.activePlayerId;
    const groups = getCapuchinScoringHabitats(room.game, activeId);
    const playerName = room.game.players.find((p) => p.playerId === activeId)?.name ?? "Macaco-prego";

    const finalize = () => {
      executeGameIntent(activeId, { type: "species.score", speciesId: "capuchin" }, "Macaco-prego pontuado.");
    };

    if (groups.length === 0) {
      finalize();
      return;
    }

    setCapuchinScoreAnim({ groups, points: groups.length, playerName });

    window.setTimeout(() => {
      setCapuchinScoreAnim(null);
      finalize();
    }, 2400);
  }, [canControlActivePlayer, executeGameIntent, room, setCapuchinScoreAnim]);

  const handleScoreMacaw = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    const activeId = room.game.activePlayerId;
    const lines: MacawScoringLine[] = getMacawScoringLines(room.game, activeId);
    const playerName = room.game.players.find((p) => p.playerId === activeId)?.name ?? "Arara-azul";

    const finalize = () => {
      executeGameIntent(activeId, { type: "species.score", speciesId: "macaw" }, "Arara-azul pontuada.");
    };

    if (lines.length === 0) {
      finalize();
      return;
    }

    setMacawScoreAnim({
      lines: lines.map((line) => ({ positions: line.positions })),
      points: lines.length,
      playerName
    });

    window.setTimeout(() => {
      setMacawScoreAnim(null);
      finalize();
    }, 2400);
  }, [canControlActivePlayer, executeGameIntent, room, setMacawScoreAnim]);

  useEffect(() => {
    if (
      room?.game?.status !== "active" ||
      hasPendingCoatiPairBonus ||
      !canControlActivePlayer ||
      activeActionId !== "D" ||
      !room.game.activePlayerId ||
      (tutorialActive && tutorialGate !== "score" && typeof tutorialDef?.completeWhenScoreAtLeast !== "number")
    ) {
      return;
    }
    const species = activeSpeciesId;
    if (species !== "capuchin" && species !== "macaw" && species !== "galo_de_campina" && species !== "armadillo") {
      return;
    }
    const key = `${room.game.activePlayerId}:${room.game.round}:${species}:D`;
    if (autoScoredRef.current === key) {
      return;
    }
    autoScoredRef.current = key;
    const scoreDelayMs = species === "armadillo" ? 3500 : 1500;
    const timer = window.setTimeout(() => {
      if (species === "capuchin") {
        handleScoreCapuchin();
      } else if (species === "macaw") {
        handleScoreMacaw();
      } else if (species === "galo_de_campina") {
        handleScoreGalo();
      } else {
        handleScoreArmadillo();
      }
    }, scoreDelayMs);

    return () => window.clearTimeout(timer);
  }, [
    activeActionId,
    activeSpeciesId,
    autoScoredRef,
    canControlActivePlayer,
    handleScoreArmadillo,
    handleScoreCapuchin,
    handleScoreGalo,
    handleScoreMacaw,
    hasPendingCoatiPairBonus,
    room?.game?.activePlayerId,
    room?.game?.round,
    room?.game?.status,
    tutorialActive,
    tutorialDef?.completeWhenScoreAtLeast,
    tutorialGate
  ]);

  return {
    executeSelectedPieceMove,
    handlePieceClick,
    handleMovementTargetClick,
    handleAddPieceTargetClick,
    handleCoatiPairBonusTargetClick,
    handleScoreCapuchin,
    handleScoreMacaw
  };
}

function getMoveNotice(activeSpeciesId: SpeciesId | null, activeActionId: string | null): string {
  if (activeSpeciesId === "jaguar") return "Onca movida.";
  if (activeSpeciesId === "capuchin") return "Macaco-prego movido.";
  if (activeSpeciesId === "macaw") return activeActionId === "C" ? "Arara realocada." : "Arara movida.";
  if (activeSpeciesId === "armadillo") return "Tatu-bola movido.";
  if (activeSpeciesId === "maned_wolf") return "Lobo-guara movido.";
  if (activeSpeciesId === "galo_de_campina") return "Galo-de-campina movido.";
  return "Quati movido.";
}
