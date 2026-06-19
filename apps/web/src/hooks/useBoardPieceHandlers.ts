import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  applyGameIntent,
  getCapuchinScoringHabitats,
  getMacawScoringLines,
  type MacawScoringLine,
  resolveGaloInterruptMove,
  resolveCoatiPairBonus
} from "@oikos/rules";
import type { GameState, PublicRoomState, SpeciesId } from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";
import { getAddPieceHandler } from "../screens/OikosApp.helpers";
import { sameGridPosition } from "../ui/geometry";
import type { CapuchinScoreAnim, MacawScoreAnim } from "./useGameFeedback";
import type { ExecuteGameAction } from "./useSimpleActionHandlers";
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
  isLocalRoom: boolean;
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
  socket: OikosSocket | null;
  autoScoredRef: MutableRefObject<string | null>;
  executeGameAction: ExecuteGameAction;
  run: (action: () => Promise<PublicRoomState>, success?: string) => Promise<void>;
  requireSocket: () => OikosSocket;
  handleScoreGalo: () => void;
  handleScoreArmadillo: () => void;
  setRoom: Dispatch<SetStateAction<PublicRoomState | null>>;
  setSelectedPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedJaguarDestination: Dispatch<SetStateAction<GridTarget | null>>;
  setSelectedJaguarTargetPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedWolfTargetPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedRemovalPieceIds: Dispatch<SetStateAction<string[]>>;
  setNotice: (notice: string | null) => void;
  setCapuchinScoreAnim: Dispatch<SetStateAction<CapuchinScoreAnim | null>>;
  setMacawScoreAnim: Dispatch<SetStateAction<MacawScoreAnim | null>>;
}

// Board-piece interaction cluster: moving the selected piece, clicking pieces and
// movement/add/coati-pair targets, the macaw/capuchin score animations, and the
// effect that auto-scores the trivial action-D species (capuchin/macaw/galo/
// armadillo). Local/online parity, tutorial gates and selection resets are
// preserved via injected dependencies.
export function useBoardPieceHandlers({
  room,
  isLocalRoom,
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
  canSkipExtraTurnNoCardAction,
  needsEndgameOverflowRepair,
  hasPendingCoatiPairBonus,
  tutorialActive,
  tutorialGate,
  tutorialDef,
  tutorialBlocks,
  socket,
  autoScoredRef,
  executeGameAction,
  run,
  requireSocket,
  handleScoreGalo,
  handleScoreArmadillo,
  setRoom,
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
    (position: { x: number; y: number }, targetPieceId?: string) => {
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
      const movingPieceId = selectedPieceId!;

      if (currentGame.pendingGaloInterrupt?.ownerId === controlledPlayerId) {
        if (isLocalRoom) {
          const nextGame = resolveGaloInterruptMove(currentGame, controlledPlayerId, position, movingPieceId);
          setRoom({
            ...room,
            status: nextGame.status === "active" ? "active" : room.status,
            game: nextGame,
            warnings: nextGame.contentWarnings
          });
          setSelectedPieceId(null);
          setNotice("Galo-de-campina movido entre turnos.");
          return;
        }

        void run(() => roomApi.resolveGaloInterrupt(requireSocket(), room.roomId, movingPieceId, position.x, position.y)).then(() => {
          setSelectedPieceId(null);
        });
        return;
      }

      if (!currentGame.activePlayerId) {
        return;
      }

      const activePlayerId = currentGame.activePlayerId!;

      if (isLocalRoom) {
        const nextGame = applyGameIntent(currentGame, activePlayerId, {
          type: "piece.move",
          pieceId: movingPieceId,
          x: position.x,
          y: position.y,
          targetPieceId
        });
        setRoom({
          ...room,
          status: nextGame.status === "active" ? "active" : room.status,
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setSelectedPieceId(null);
        setSelectedJaguarDestination(null);
        setSelectedJaguarTargetPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice(
          activeSpeciesId === "jaguar"
            ? "Onça movida."
            : activeSpeciesId === "capuchin"
              ? "Macaco-prego movido."
              : activeSpeciesId === "macaw"
              ? activeActionId === "C"
                ? "Arara realocada."
                : "Arara movida."
              : activeSpeciesId === "armadillo"
                ? "Tatu-bola movido."
                : activeSpeciesId === "maned_wolf"
                  ? "Lobo-guará movido."
                  : activeSpeciesId === "galo_de_campina"
                    ? "Galo-de-campina movido."
                    : "Quati movido."
        );
        return;
      }

      void run(() => roomApi.movePiece(requireSocket(), room.roomId, movingPieceId, position.x, position.y, targetPieceId)).then(() => {
        setSelectedPieceId(null);
        setSelectedJaguarDestination(null);
        setSelectedJaguarTargetPieceId(null);
      });
    },
    [
      activeActionId,
      activeSpeciesId,
      controlledPlayerId,
      isLocalRoom,
      room,
      selectedPieceId,
      socket,
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
              ? "Entre turnos ativo: mova 1 galo-de-campina."
              : "Aguarde o Galo-de-campina resolver a acao entre turnos."
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

          if (isLocalRoom) {
            const nextGame = applyGameIntent(room.game, pendingJaguarRemoval.playerId, {
              type: "piece.move",
              pieceId: jaguarPieceId,
              x: pendingJaguarRemoval.location.x,
              y: pendingJaguarRemoval.location.y,
              targetPieceId: pieceId
            });
            setRoom({
              ...room,
              status: nextGame.status === "active" ? "active" : room.status,
              game: nextGame,
              warnings: nextGame.contentWarnings
            });
            setSelectedPieceId(null);
            setSelectedJaguarDestination(null);
            setSelectedJaguarTargetPieceId(null);
            setNotice("Onca removeu 1 peca.");
            return;
          }

          void run(() =>
            roomApi.movePiece(
              requireSocket(),
              room.roomId,
              jaguarPieceId,
              pendingJaguarRemoval.location.x,
              pendingJaguarRemoval.location.y,
              pieceId
            )
          ).then(() => {
            setSelectedPieceId(null);
            setSelectedJaguarDestination(null);
            setSelectedJaguarTargetPieceId(null);
          });
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
      executeSelectedPieceMove,
      isLocalRoom,
      jaguarTargetPieceIds,
      requireSocket,
      requiredCoatiRemovalCount,
      room,
      run,
      selectedJaguarDestination
    ]
  );

  const handleMovementTargetClick = useCallback(
    (position: { x: number; y: number }) => {
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
          setNotice("Aguarde o Galo-de-campina resolver a acao entre turnos.");
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
          setNotice("Escolha qual meeple a Onça deve remover neste local.");
          return;
        }

        executeSelectedPieceMove(position);
        return;
      }

      executeSelectedPieceMove(position);
    },
    [activeSpeciesId, executeSelectedPieceMove, movementTargets.length, room, selectedPieceId]
  );

  const handleAddPieceTargetClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room?.game || !room.game.activePlayerId || addPieceTargets.length === 0) {
        return;
      }
      // Some tutorials teach adding as part of action A; Lobo teaches it in D.
      if (tutorialActive && tutorialGate !== "placeCard" && tutorialGate !== "addPiece") return;
      if (
        tutorialActive &&
        tutorialGate === "addPiece" &&
        tutorialDef?.markedAddPieceTarget &&
        !sameGridPosition(position, tutorialDef.markedAddPieceTarget)
      ) {
        return;
      }

      const addHandler = getAddPieceHandler(activeSpeciesId ?? undefined);

      executeGameAction(
        () => addHandler.local(room.game!, room.game!.activePlayerId!, position),
        () => addHandler.api(requireSocket(), room.roomId, position.x, position.y),
        addHandler.notice
      );
    },
    [
      activeSpeciesId,
      addPieceTargets.length,
      executeGameAction,
      room,
      socket,
      tutorialActive,
      tutorialDef?.markedAddPieceTarget,
      tutorialGate
    ]
  );

  const handleCoatiPairBonusTargetClick = useCallback(
    (position: { x: number; y: number }) => {
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

      executeGameAction(
        () => resolveCoatiPairBonus(room.game!, room.game!.activePlayerId!, position),
        () => roomApi.resolveCoatiPair(requireSocket(), room.roomId, position.x, position.y),
        "Quati da passiva adicionado e 1 ponto marcado."
      );
    },
    [coatiPairBonusTargets.length, executeGameAction, room, socket, tutorialActive, tutorialDef?.markedPairTarget, tutorialGate]
  );

  const handleScoreCapuchin = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    const activeId = room.game.activePlayerId;
    const groups = getCapuchinScoringHabitats(room.game, activeId);
    const playerName = room.game.players.find((p) => p.playerId === activeId)?.name ?? "Macaco-prego";

    const finalize = () => {
      executeGameAction(
        () => applyGameIntent(room.game!, activeId, { type: "species.score", speciesId: "capuchin" }),
        () => roomApi.scoreCapuchin(requireSocket(), room.roomId),
        "Macaco-prego pontuado."
      );
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
  }, [canControlActivePlayer, executeGameAction, room, socket]);

  const handleScoreMacaw = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    const activeId = room.game.activePlayerId;
    const lines: MacawScoringLine[] = getMacawScoringLines(room.game, activeId);
    const playerName = room.game.players.find((p) => p.playerId === activeId)?.name ?? "Arara-azul";

    const finalize = () => {
      executeGameAction(
        () => applyGameIntent(room.game!, activeId, { type: "species.score", speciesId: "macaw" }),
        () => roomApi.scoreMacaw(requireSocket(), room.roomId),
        "Arara-azul pontuada."
      );
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
  }, [canControlActivePlayer, executeGameAction, room, socket]);

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
    // Armadillo highlights each rival species sharing a tile; give the player
    // longer to read the portraits before the automatic score advances.
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
