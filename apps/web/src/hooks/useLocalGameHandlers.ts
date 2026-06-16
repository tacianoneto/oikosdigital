import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  completeCurrentAction,
  createInitialGameState,
  forceEndPlayerTurn,
  playBotStep
} from "@oikos/rules";
import { speciesDefinitions } from "@oikos/content";
import {
  MAX_PLAYERS,
  type MiniExpansionId,
  type PublicRoomState,
  type Resource,
  type RoomPlayer,
  type ScenarioCardId,
  type ScenarioCount,
  type SpeciesId
} from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";
import type { LandingMode } from "../screens/MainMenuScreen";
import { localRoomId } from "../ui/gameConstants";
import { clearOnlineSession } from "../ui/session";
import { markTutorialDone, type TutorialId } from "../ui/tutorials";
import { TUTORIAL_ROOM_FACTORIES } from "../screens/OikosApp.helpers";
import type { PendingPlacement } from "./useActionSelection";

interface LocalGameHandlersParams {
  room: PublicRoomState | null;
  isLocalRoom: boolean;
  localSpeciesIds: SpeciesId[];
  localBotSpeciesIds: SpeciesId[];
  localEnabledMiniExpansions: MiniExpansionId[];
  localSelectedScenarioIds: ScenarioCardId[];
  localScenarioCount: ScenarioCount;
  localBotTurnDelayMs: number;
  tutorialId: TutorialId | null;
  socket: OikosSocket | null;
  lastOnlineRoomSnapshotRef: MutableRefObject<string>;
  autoScoredRef: MutableRefObject<string | null>;
  ignoredOnlineRoomIdsRef: MutableRefObject<Set<string>>;
  clearRoomState: () => void;
  beginTutorial: (id: TutorialId) => void;
  clearTutorial: () => void;
  setError: (error: string | null) => void;
  setNotice: (notice: string | null) => void;
  setLocalSpeciesIds: Dispatch<SetStateAction<SpeciesId[]>>;
  setLocalBotSpeciesIds: Dispatch<SetStateAction<SpeciesId[]>>;
  setRoom: Dispatch<SetStateAction<PublicRoomState | null>>;
  setSelectedHandCardId: Dispatch<SetStateAction<string | null>>;
  setSelectedCardRotation: Dispatch<SetStateAction<0 | 90 | 180 | 270>>;
  setSelectedPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedJaguarDestination: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setSelectedJaguarTargetPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedWolfTargetPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedWolfResources: Dispatch<SetStateAction<Resource[]>>;
  setSelectedRemovalPieceIds: Dispatch<SetStateAction<string[]>>;
  setPendingPlacement: Dispatch<SetStateAction<PendingPlacement | null>>;
  setBoardSpecies: Dispatch<SetStateAction<SpeciesId | null>>;
  setLandingMode: Dispatch<SetStateAction<LandingMode>>;
}

// Local test + tutorial lifecycle: species/bot selection for the local table,
// starting/stopping/rematching a local game, the bot-stepping effect that drives
// local bot turns, and starting/exiting scripted tutorials plus leaving any
// table. Resets the shared selection state and online refs exactly as before via
// injected dependencies.
export function useLocalGameHandlers({
  room,
  isLocalRoom,
  localSpeciesIds,
  localBotSpeciesIds,
  localEnabledMiniExpansions,
  localSelectedScenarioIds,
  localScenarioCount,
  localBotTurnDelayMs,
  tutorialId,
  socket,
  lastOnlineRoomSnapshotRef,
  autoScoredRef,
  ignoredOnlineRoomIdsRef,
  clearRoomState,
  beginTutorial,
  clearTutorial,
  setError,
  setNotice,
  setLocalSpeciesIds,
  setLocalBotSpeciesIds,
  setRoom,
  setSelectedHandCardId,
  setSelectedCardRotation,
  setSelectedPieceId,
  setSelectedJaguarDestination,
  setSelectedJaguarTargetPieceId,
  setSelectedWolfTargetPieceId,
  setSelectedWolfResources,
  setSelectedRemovalPieceIds,
  setPendingPlacement,
  setBoardSpecies,
  setLandingMode
}: LocalGameHandlersParams) {
  function toggleLocalSpecies(speciesId: SpeciesId) {
    const speciesAlreadySelected = localSpeciesIds.includes(speciesId);
    if (!speciesAlreadySelected && localSpeciesIds.length >= MAX_PLAYERS) {
      setError(`O máximo é ${MAX_PLAYERS} espécies por partida.`);
      return;
    }
    setError(null);
    setLocalSpeciesIds((current) =>
      speciesAlreadySelected ? current.filter((candidate) => candidate !== speciesId) : [...current, speciesId]
    );
    // Dropping a species also clears its bot flag.
    setLocalBotSpeciesIds((current) => current.filter((candidate) => candidate !== speciesId));
  }

  function toggleLocalBot(speciesId: SpeciesId) {
    const speciesAlreadySelected = localSpeciesIds.includes(speciesId);
    if (!speciesAlreadySelected && localSpeciesIds.length >= MAX_PLAYERS) {
      setError(`O máximo é ${MAX_PLAYERS} espécies por partida.`);
      return;
    }
    setError(null);
    setLocalSpeciesIds((current) => (current.includes(speciesId) ? current : [...current, speciesId]));
    setLocalBotSpeciesIds((current) =>
      current.includes(speciesId) ? current.filter((candidate) => candidate !== speciesId) : [...current, speciesId]
    );
  }

  function startLocalTest() {
    setError(null);
    setNotice(null);

    if (localSpeciesIds.length < 2) {
      setError("Escolha pelo menos 2 espécies para o teste local.");
      return;
    }
    if (localSpeciesIds.length > MAX_PLAYERS) {
      setError(`O máximo é ${MAX_PLAYERS} espécies por partida.`);
      return;
    }

    const localScenarioIds = localEnabledMiniExpansions.includes("scenarios") ? localSelectedScenarioIds : [];
    if (localEnabledMiniExpansions.includes("scenarios") && localScenarioIds.length !== localScenarioCount) {
      setError(`Escolha exatamente ${localScenarioCount} cenario(s) para usar a mini-expansao no teste local.`);
      return;
    }

    const localPlayers: RoomPlayer[] = localSpeciesIds.map((speciesId) => ({
      playerId: `local_${speciesId}`,
      name: speciesDefinitions[speciesId].displayName,
      speciesId,
      ready: true,
      connected: true,
      isBot: localBotSpeciesIds.includes(speciesId)
    }));
    const game = createInitialGameState(localRoomId, localPlayers, Math.random, undefined, {
      enabledMiniExpansions: localEnabledMiniExpansions,
      activeScenarioIds: localScenarioIds
    });

    lastOnlineRoomSnapshotRef.current = "";
    setRoom({
      roomId: localRoomId,
      status: "setup",
      hostPlayerId: "local_host",
      players: localPlayers,
      enabledMiniExpansions: game.enabledMiniExpansions,
      game,
      warnings: game.contentWarnings,
      botTurnDelayMs: localBotTurnDelayMs,
      scenarioSelectionMode: "host",
      scenarioCount: localScenarioCount,
      hostSelectedScenarioIds: localScenarioIds
    });
    setNotice("Teste local iniciado.");
  }

  function stopLocalTest() {
    clearRoomState();
    setNotice("Teste local encerrado.");
  }

  // Drives bot-controlled species in local test games. When the active player
  // (setup or active phase) is a local bot, it steps the bot AI after a short
  // delay; each state change re-runs the effect, advancing the bot until the
  // turn passes to a human or the game ends.
  useEffect(() => {
    if (room?.roomId !== localRoomId || !room.game) {
      return;
    }

    const game = room.game;
    const activeId =
      game.status === "setup" ? game.setupActivePlayerId : game.status === "active" ? game.activePlayerId : null;
    if (!activeId) {
      return;
    }

    const activePlayer = room.players.find((player) => player.playerId === activeId);
    if (!activePlayer?.isBot) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRoom((current) => {
        if (!current || current.roomId !== localRoomId || !current.game) {
          return current;
        }

        const liveGame = current.game;
        const liveActiveId =
          liveGame.status === "setup"
            ? liveGame.setupActivePlayerId
            : liveGame.status === "active"
              ? liveGame.activePlayerId
              : null;
        const livePlayer = current.players.find((player) => player.playerId === liveActiveId);
        if (!liveActiveId || !livePlayer?.isBot) {
          return current;
        }

        let nextGame: typeof liveGame;
        try {
          nextGame = playBotStep(liveGame, liveActiveId);
          if (nextGame === liveGame) {
            nextGame = completeCurrentAction(liveGame, liveActiveId);
          }
        } catch {
          try {
            nextGame = completeCurrentAction(liveGame, liveActiveId);
          } catch {
            nextGame = forceEndPlayerTurn(liveGame, liveActiveId, "bot local sem jogada valida");
          }
        }

        return {
          ...current,
          status: nextGame.status === "finished" ? "finished" : current.status,
          game: nextGame,
          warnings: nextGame.contentWarnings
        };
      });
    }, room.botTurnDelayMs ?? localBotTurnDelayMs);

    return () => window.clearTimeout(timer);
  }, [localBotTurnDelayMs, room]);

  // Rematch for a local test: rebuild a fresh game with the same species.
  function playAgainLocal() {
    startLocalTest();
  }

  // Launch a scripted tutorial chapter on a real local game. Resets the same
  // shared interaction state every chapter needs, plus the species-specific
  // selection state used by that chapter, then loads its scripted room.
  function startTutorial(id: TutorialId) {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    if (id === "jaguar") {
      setSelectedJaguarDestination(null);
      setSelectedJaguarTargetPieceId(null);
    } else if (id === "wolf") {
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
    } else if (id !== "initial") {
      setSelectedRemovalPieceIds([]);
    }
    setPendingPlacement(null);
    setRoom(TUTORIAL_ROOM_FACTORIES[id]());
    beginTutorial(id);
  }

  function exitTutorial(completed: boolean) {
    if (completed && tutorialId) markTutorialDone(tutorialId);
    autoScoredRef.current = null;
    clearTutorial();
    setBoardSpecies(null);
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setPendingPlacement(null);
    clearRoomState();
    setLandingMode("tutorials");
    setNotice(completed ? "Tutorial concluído!" : "Tutorial encerrado.");
  }

  function leaveTable() {
    const leavingRoomId = room?.roomId ?? null;
    const inLobby = room?.status === "lobby";

    if (leavingRoomId && leavingRoomId !== localRoomId) {
      ignoredOnlineRoomIdsRef.current.add(leavingRoomId);
      clearOnlineSession();
      if (socket?.connected) {
        const call = inLobby ? roomApi.quit(socket, leavingRoomId) : roomApi.leave(socket, leavingRoomId);
        void call.catch(() => {
          // Local UI already left; stale updates are ignored by room id.
        });
      }
    }

    clearTutorial();
    setLandingMode("idle");
    autoScoredRef.current = null;
    clearRoomState();
    setError(null);
    setNotice(isLocalRoom ? "Teste local encerrado." : "Voce saiu da mesa.");
  }

  return {
    toggleLocalSpecies,
    toggleLocalBot,
    startLocalTest,
    stopLocalTest,
    playAgainLocal,
    startTutorial,
    exitTutorial,
    leaveTable
  };
}
