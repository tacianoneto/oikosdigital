import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Leaf,
  ListFilter,
  Lock,
  LogIn,
  LogOut,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Trophy,
  Users,
  X
} from "lucide-react";
import {
  habitatLabels,
  movementLabels,
  resourceAssets,
  resourceLabels
} from "@oikos/content";
import {
  applyGameIntent,
  getArmadilloHidePieceIds
} from "@oikos/rules";
import type {
  GameIntent,
  GameState,
  PublicRoomState,
  SpeciesId
} from "@oikos/shared";
import type { ForestCanvasComponent, ForestCanvasHandle } from "../game/ForestCanvasTypes";
import { useActionSelection } from "../hooks/useActionSelection";
import { useActiveActionState } from "../hooks/useActiveActionState";
import { useActiveScoringState } from "../hooks/useActiveScoringState";
import { useAudioSettings } from "../hooks/useAudioSettings";
import { useBoardCardHandlers } from "../hooks/useBoardCardHandlers";
import { useBoardInteractionTargets } from "../hooks/useBoardInteractionTargets";
import { useBoardOverlays } from "../hooks/useBoardOverlays";
import { useBoardPieceHandlers } from "../hooks/useBoardPieceHandlers";
import { useBoardUiOrchestration } from "../hooks/useBoardUiOrchestration";
import { useCacaIlegalHandlers } from "../hooks/useCacaIlegalHandlers";
import { useGameFeedback } from "../hooks/useGameFeedback";
import { useGamePreloader } from "../hooks/useGamePreloader";
import { usePlayerCardState } from "../hooks/usePlayerCardState";
import { usePlayerHudState } from "../hooks/usePlayerHudState";
import { useLocalGameConfig } from "../hooks/useLocalGameConfig";
import { useLocalGameHandlers } from "../hooks/useLocalGameHandlers";
import { useLobbyForm } from "../hooks/useLobbyForm";
import { useOikosSocket } from "../hooks/useOikosSocket";
import { useOnlineRoom } from "../hooks/useOnlineRoom";
import { useOpenRoomsPolling } from "../hooks/useOpenRoomsPolling";
import { useObjectiveExpansionHandlers } from "../hooks/useObjectiveExpansionHandlers";
import { usePanelState } from "../hooks/usePanelState";
import { usePendingRuleState } from "../hooks/usePendingRuleState";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { useRoomTableState } from "../hooks/useRoomTableState";
import { useRoomSettingsHandlers } from "../hooks/useRoomSettingsHandlers";
import { useScoringPreview } from "../hooks/useScoringPreview";
import { useScenarioThreatOrchestration } from "../hooks/useScenarioThreatOrchestration";
import { useSelectionGuards } from "../hooks/useSelectionGuards";
import { useTurnTransitionEffects } from "../hooks/useTurnTransitionEffects";
import { useSelectionResolutionHandlers } from "../hooks/useSelectionResolutionHandlers";
import { useSimpleActionHandlers } from "../hooks/useSimpleActionHandlers";
import { useTutorialController } from "../hooks/useTutorialController";
import { useTurnTimer } from "../hooks/useTurnTimer";
import { roomApi, type OikosSocket } from "../socket";
import { CreateRoomScreen } from "./CreateRoomScreen";
import { JoinRoomScreen } from "./JoinRoomScreen";
import { LobbyScreen } from "./LobbyScreen";
import { LocalSetupScreen } from "./LocalSetupScreen";
import { MainMenuScreen } from "./MainMenuScreen";
import { ObjectiveChoiceDialogs } from "./ObjectiveChoiceDialogs";
import { OpponentInspector } from "./OpponentInspector";
import { PendingInterruptDialogs } from "./PendingInterruptDialogs";
import { SpeciesScoreModals } from "./SpeciesScoreModals";
import { TableHand } from "./TableHand";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { playLogEvent } from "../ui/audio";
import { ActiveRulesDock } from "../ui/ActiveRulesDock";
import { EndgameCeremony } from "../ui/EndgameCeremony";
import { ExpansionPreviewOverlay, ThreatRevealOverlay } from "../ui/GameOverlays";
import { MovementGlyph } from "../ui/MovementGlyph";
import { ResourceText } from "../ui/ResourceText";
import { ScenarioVotingOverlay } from "../ui/ScenarioVotingOverlay";
import { MovementGuideFloating, SpeciesBoardModal } from "../ui/BoardModals";
import { ScoreAnimationPanels } from "../ui/ScoreAnimationPanels";
import { SettingsModal } from "../ui/SettingsModal";
import { SpeciesActionHud } from "../ui/SpeciesActionHud";
import { SpeciesStatusHud } from "../ui/SpeciesStatusHud";
import { LeftActionDock } from "../ui/LeftActionDock";
import { MobileTabbar } from "../ui/MobileTabbar";
import { ScenarioDescription } from "../ui/ScenarioDescription";
import { useAppShellClass } from "../hooks/useAppShellClass";
import { HudControls } from "../ui/HudControls";
import { SpectatorBanner } from "../ui/SpectatorBanner";
import { StageBanners } from "../ui/StageBanners";
import { TravelEffectLayer } from "../ui/TravelEffectLayer";
import { TurnCountdown } from "../ui/TurnCountdown";
import { TurnRecapPanel } from "../ui/TurnRecapPanel";
import { TutorialChapterSelect } from "../ui/TutorialChapterSelect";
import { TutorialCoach } from "../ui/TutorialCoach";
import { movementArtPath } from "../ui/movementArt";
import { setVisualAccessibilityPreference } from "../ui/visualAccessibility";
import {
  SPECIES_HEX,
  botTurnDelayStepMs,
  categoryLabels,
  localRoomId,
  resourceOrder,
  speciesList
} from "../ui/gameConstants";
import {
  clearOnlineSession,
  isMissingRoomError,
  saveOnlineSession
} from "../ui/session";
import { speciesVar } from "../ui/speciesStyle";
import {
  createArmadilloTutorialRoom,
  createCapuchinTutorialRoom,
  createCoatiTutorialRoom,
  createInitialTutorialRoom,
  createJaguarTutorialRoom,
  createMacawTutorialRoom,
  createWolfTutorialRoom,
  isTutorialArmadilloDone,
  isTutorialCapuchinDone,
  isTutorialCoatiDone,
  isTutorialInitialDone,
  isTutorialJaguarDone,
  isTutorialMacawDone,
  isTutorialWolfDone,
  TUTORIAL_NONRIVER_CARD,
  type TutorialId,
  type TutorialStepDef
} from "../ui/tutorials";
import {
  getAuthDisplayName,
  getOpenPortraitAsset,
  movementKindLabels,
  SkipExtraTurnNoCardAction,
  SERVER_UNAVAILABLE_MESSAGE
} from "./OikosApp.helpers";

const ForestCanvas = lazy(() =>
  import("../game/ForestCanvas").then((module) => ({ default: module.ForestCanvas }))
) as ForestCanvasComponent;

interface OikosAppProps {
  authSession: Session;
  authUser: User;
  onSignOut: () => void;
}

export function OikosApp({ authSession, authUser, onSignOut }: OikosAppProps) {
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const defaultPlayerName = useMemo(() => getAuthDisplayName(authUser), [authUser]);
  const {
    name,
    setName,
    joinCode,
    setJoinCode,
    joinPassword,
    setJoinPassword,
    createPassword,
    setCreatePassword,
    isSpectator,
    setIsSpectator
  } = useLobbyForm(defaultPlayerName);
  const {
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
    setPendingPlacement,
    clearActionSelection,
    clearWolfActionSelection,
    handleExpansionTargetClick,
    handleRotateFitTargetClick,
    clearPendingPlacement
  } = useActionSelection();
  const {
    localSpeciesIds,
    setLocalSpeciesIds,
    localBotSpeciesIds,
    setLocalBotSpeciesIds,
    localBotTurnDelayMs,
    setLocalBotTurnDelayMs,
    localEnabledMiniExpansions,
    setLocalEnabledMiniExpansions,
    localScenarioCount,
    setLocalScenarioCount,
    localSelectedScenarioIds,
    setLocalSelectedScenarioIds
  } = useLocalGameConfig();
  const {
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
  } = useGameFeedback();
  const {
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
  } = usePanelState();
  // expansionPreview/expansionOrigin (fly-from-origin open animation) live in useActionSelection.
  // Mobile-only HUD: below this width the floating docks become bottom sheets
  // driven by a tab bar. Desktop keeps the original floating layout untouched.
  const { isMobile, isBelowDesktop } = useResponsiveLayout();
  const { audioSettings, updateAudio } = useAudioSettings();
  const seenLogIdRef = useRef<Set<string>>(new Set());
  const logInitializedRef = useRef(false);
  const [visibleGaloInterruptBannerKey, setVisibleGaloInterruptBannerKey] = useState<string | null>(null);
  // movementPreview, landingMode and pendingPlacement (chosen-but-unconfirmed
  // card placement) live in useActionSelection.
  const turnSummary =
    turnRecap.visible && turnRecap.index >= 0 ? turnRecap.history[turnRecap.index] ?? null : null;

  useEffect(() => {
    if (recapCollapsed || !turnSummary) {
      setHoveredSummaryCardIds([]);
    }
  }, [recapCollapsed, turnSummary?.key]);

  // Leaving the phone breakpoint closes any open bottom sheet so the desktop
  // layout is never left in a sheet state.
  useEffect(() => {
    if (!isMobile) setMobileSheet(null);
  }, [isMobile]);

  useEffect(() => {
    if (room?.game?.status === "active") {
      return;
    }

    setHoveredSummaryCardIds([]);
    setRecapCollapsed(true);
    setTurnRecap((current) =>
      current.history.length > 0 || current.visible ? { history: [], index: -1, visible: false } : current
    );
  }, [room?.game?.gameId, room?.game?.status]);
  const forestCanvasRef = useRef<ForestCanvasHandle | null>(null);
  const autoScoredRef = useRef<string | null>(null);

  const { effectTargetRefs, setEffectTarget, toggleExpansionPreview } = useBoardOverlays({
    setMovementPreview,
    setExpansionOrigin,
    setExpansionPreview
  });

  const {
    lastOnlineRoomSnapshotRef,
    onlineActionInFlightRef,
    showServerWarningRef,
    ignoredOnlineRoomIdsRef,
    roomActionEpochRef,
    applyOnlineRoomState,
    clearRoomState,
    run
  } = useOnlineRoom({
    room,
    landingMode,
    name,
    setConfigOpen,
    setBoardSpecies,
    setSelectedHandCardId,
    setSelectedCardRotation,
    setSelectedPieceId,
    setSelectedJaguarDestination,
    setSelectedJaguarTargetPieceId,
    setSelectedWolfTargetPieceId,
    setSelectedWolfResources,
    setSelectedRemovalPieceIds,
    setPendingPlacement,
    setHoveredSummaryCardIds,
    setTurnRecap,
    setRecapCollapsed,
    setIsSpectator,
    setRoom,
    setError,
    setNotice,
    setJoinCode
  });

  const { socket, playerId } = useOikosSocket({
    accessToken: authSession.access_token,
    defaultPlayerName,
    applyOnlineRoomState,
    clearRoomState,
    setError,
    setName,
    setIsSpectator,
    setNotice,
    setLandingMode,
    roomActionEpochRef,
    ignoredOnlineRoomIdsRef,
    autoScoredRef,
    showServerWarningRef
  });

  const { openRooms, roomsLoading, refreshRooms } = useOpenRoomsPolling(socket, landingMode);

  useEffect(() => {
    if ((landingMode === "create" || landingMode === "join") && socket && !socket.connected) {
      setError(SERVER_UNAVAILABLE_MESSAGE);
    }
  }, [landingMode, socket]);

  useEffect(() => {
    if (!socket || !room || room.roomId === localRoomId) {
      return;
    }

    const roomId = room.roomId;
    const ping = () => {
      roomApi.ping(socket, roomId).catch(() => {
        // Connection errors are handled by Socket.IO reconnection and normal action feedback.
      });
    };

    ping();
    const interval = window.setInterval(ping, 30000);
    return () => window.clearInterval(interval);
  }, [room?.roomId, socket]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 4500);
    return () => window.clearTimeout(id);
  }, [error]);

  const isLocalRoom = room?.roomId === localRoomId;
  const controlledPlayerId = isLocalRoom
    ? room?.game?.pendingExtraTurnPlayerId ??
      room?.game?.pendingSeedSpendObjectivePlayerId ??
      room?.game?.caatingaPending?.playerId ??
      room?.game?.cerradoPending?.playerId ??
      room?.game?.pendingGaloInterrupt?.ownerId ??
      room?.game?.setupActivePlayerId ??
      room?.game?.activePlayerId ??
      null
    : isSpectator
      ? null
      : playerId;
  const {
    activeGamePlayer,
    activeSpecies,
    currentGamePlayer,
    currentPlayer,
    currentPlayerResourceMajority,
    hudGamePlayer,
    hudSpecies,
    opponentInspectorEntries,
    resourceLeaders,
    selectedOpponentEntry,
    selectedOpponentRailIndex,
    setupActivePlayer
  } = usePlayerHudState(
    room,
    controlledPlayerId,
    selectedOpponentPlayerId
  );
  const hasPendingCoatiPairBonus = Boolean(room?.game?.pendingCoatiPairBonus);
  const {
    activeActionId,
    canControlActivePlayer,
    canPlaceSelectedForestCard,
    canPlaceSetupPiece,
    canSelectHandCards,
    canSkipExtraTurnNoCardAction,
    handPlayableThisAction,
    needsEndgameOverflowRepair,
    ownActiveActionId
  } = useActiveActionState({
    activeSpecies,
    currentGamePlayer,
    currentPlayer,
    game: room?.game,
    hasPendingCoatiPairBonus,
    isLocalRoom,
    localPlayerId: playerId,
    selectedHandCardId
  });
  const hasStartedGame = Boolean(room?.game);
  const gameLog = room?.game?.log;
  const galoInterrupt = room?.game?.pendingGaloInterrupt ?? null;
  const galoInterruptOwner = galoInterrupt
    ? room?.game?.players.find((player) => player.playerId === galoInterrupt.ownerId) ?? null
    : null;
  const interruptedGaloPlayer = galoInterrupt
    ? room?.game?.players.find((player) => player.playerId === galoInterrupt.interruptedPlayerId) ?? null
    : null;
  const galoInterruptKey = galoInterrupt
    ? `${room?.game?.gameId ?? "game"}:${galoInterrupt.ownerId}:${galoInterrupt.interruptedPlayerId}:${galoInterrupt.location.x}:${galoInterrupt.location.y}`
    : null;
  const isCurrentGaloInterruptOwner = Boolean(galoInterrupt && currentGamePlayer?.playerId === galoInterrupt.ownerId);
  const isCurrentPlayerWaitingForGaloInterrupt = Boolean(
    galoInterrupt && currentGamePlayer?.playerId === galoInterrupt.interruptedPlayerId && !isCurrentGaloInterruptOwner
  );
  const galoInterruptBannerText = `Aguardando ${galoInterruptOwner?.name ?? "Galo-de-campina"} resolver entre turnos`;

  useEffect(() => {
    if (!galoInterruptKey) {
      setVisibleGaloInterruptBannerKey(null);
      return;
    }

    setVisibleGaloInterruptBannerKey(galoInterruptKey);
    const timer = window.setTimeout(() => {
      setVisibleGaloInterruptBannerKey((current) => (current === galoInterruptKey ? null : current));
    }, 4800);
    return () => window.clearTimeout(timer);
  }, [galoInterruptKey]);

  const handleTutorialCardPlaced = useCallback((id: TutorialId, step: TutorialStepDef) => {
    if (id === "initial") {
      const isRiverStep = Boolean(step.requiresRiver);
      setRoom((current) => {
        if (!current?.game) return current;
        const nextGame = { ...current.game };
        if (isRiverStep) {
          // Set up action B (move) with a forest card as the played card so the
          // Tatu has the simplest movement (adjacent).
          nextGame.activeActionIndex = 1;
          nextGame.activePlayedForestCardId = TUTORIAL_NONRIVER_CARD;
        } else {
          // Allow placing the next card in the same action A.
          nextGame.activePlayedForestCardId = null;
        }
        return { ...current, game: nextGame };
      });
    }
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
  }, []);

  const handleTutorialStepActivated = useCallback((step: TutorialStepDef) => {
    // Reset board selection so read-only steps never inherit clickable targets.
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedRemovalPieceIds([]);
    if (step.gate === "placeCard" && step.requiredCardId) {
      setSelectedHandCardId(step.requiredCardId);
    } else {
      setSelectedHandCardId(null);
    }
    setSelectedCardRotation(0);
    setPendingPlacement(null);
    setBoardSpecies(step.openBoard ?? null);
  }, []);

  const {
    advanceTutorial,
    beginTutorial,
    clearTutorial,
    isBasicTutorial,
    tutorialActive,
    tutorialBlocks,
    tutorialDef,
    tutorialGate,
    tutorialId,
    tutorialRequiredCardId,
    tutorialStep,
    tutorialSteps
  } = useTutorialController({
    game: room?.game,
    onCardPlaced: handleTutorialCardPlaced,
    onStepActivated: handleTutorialStepActivated
  });

  // Play sound effects for new game-log entries (covers local, server, and bots).
  useEffect(() => {
    if (!gameLog) {
      seenLogIdRef.current = new Set();
      logInitializedRef.current = false;
      return;
    }
    const seen = seenLogIdRef.current;
    if (!logInitializedRef.current) {
      // First time we see this game: mark everything as already heard so a
      // reconnect or page reload does not replay the whole history.
      for (const entry of gameLog) seen.add(entry.id);
      logInitializedRef.current = true;
      return;
    }
    for (const entry of gameLog) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      playLogEvent(entry.payload?.kind);
    }
  }, [gameLog]);

  const updateVisualAccessibility = useCallback((enabled: boolean) => {
    setVisualAccessibility(setVisualAccessibilityPreference(enabled));
  }, []);

  const {
    isHost,
    roomHasBots,
    readyPlayerCount,
    enabledMiniExpansions,
    scenarioSelectionMode,
    scenarioCount,
    hostSelectedScenarioIds,
    needsHostScenarioSelection,
    activeScenarioDefinitions,
    activeThreatDefinition,
    botTurnDelayMs,
    turnTimerMs,
    showTurnCountdown,
    forestCards,
    pieces,
    roomWarnings
  } = useRoomTableState({
    isLocalRoom,
    localBotTurnDelayMs,
    playerId,
    room
  });

  const gameId = room?.game?.gameId ?? null;
  const activeThreatCardId = room?.game?.activeThreatCardId ?? null;
  const { threatRevealDefinition } = useScenarioThreatOrchestration({
    activeScenarioDefinitions,
    activeThreatCardId,
    gameId,
    setScenarioDockOpen,
    setThreatReveal,
    threatReveal
  });
  const {
    addPieceTargets,
    boardSelectablePieceIds,
    canSkipJaguarMove,
    capuchinPlacementTargets,
    coatiPairBonusTargets,
    displayAddPieceTargets,
    displayCoatiPairBonusTargets,
    displayExpansionTargets,
    displayMovementTargets,
    displayRotateFitTargets,
    expansionTargets,
    highlightedPieceIds,
    jaguarTargetPieceIds,
    macawActionCTargets,
    macawEggTargets,
    movementTargets,
    selectablePieceIds,
    tutorialMarkedSlot,
    wolfMeatTargets
  } = useBoardInteractionTargets({
    activeActionId,
    activeSpeciesId: activeSpecies?.speciesId ?? null,
    cacaIlegalRemovalMode,
    canControlActivePlayer,
    canPlaceSelectedForestCard,
    controlledPlayerId,
    game: room?.game,
    hasPendingCoatiPairBonus,
    hasPendingPlacement: Boolean(pendingPlacement),
    selectedCardRotation,
    selectedHandCardId,
    selectedJaguarDestination,
    selectedJaguarTargetPieceId,
    selectedPieceId,
    selectedRemovalPieceIds,
    selectedWolfTargetPieceId,
    tutorial: {
      active: tutorialActive,
      def: tutorialDef,
      gate: tutorialGate
    }
  });

  // Keep a ref of the current drop targets so async drag handlers always see the
  // set for the latest rotation (the pointermove closure is captured once).
  // Each target carries the rotation to apply when dropped there.
  const spotlightInstanceIds = useMemo(() => {
    if (!room?.game || room.game.status !== "active" || recapCollapsed || !turnSummary || hoveredSummaryCardIds.length === 0) return [];
    const alive = new Set(room.game.forest.cards.map((card) => card.instanceId));
    return hoveredSummaryCardIds.filter((id) => alive.has(id));
  }, [hoveredSummaryCardIds, recapCollapsed, room?.game, turnSummary?.key]);
  const {
    armadilloShareScore,
    availableJaguarPointSpendCount,
    availableWolfPointSpendCount,
    cacaIlegalPending,
    capuchinHabitatScore,
    capuchinReserveCount,
    galoScore,
    macawLineScore,
    requiredCoatiRemovalCount,
    shouldShowJaguarScoreModal,
    wolfRemovableBasePieceIds,
    wolfSpendableResources
  } = useActiveScoringState({
    activeActionId,
    activeSpeciesId: activeSpecies?.speciesId ?? null,
    canControlActivePlayer,
    game: room?.game,
    hasPendingCoatiPairBonus,
    tutorialActive,
    tutorialGate,
    tutorialId
  });
  const scoringPreview = useScoringPreview(
    room?.game,
    activeActionId,
    activeSpecies?.speciesId ?? null
  );
  const {
    canDiscardSelectedObjective,
    handCards,
    handSortLabel,
    mataAtlanticaPileIndexByCardId,
    mataAtlanticaPileTopIds,
    needsObjectiveChoice,
    nextHandSortLabel,
    nextHandSortMode,
    objectiveChoices,
    objectivePreviewCard,
    objectiveWasDiscarded,
    selectedObjectiveCard,
    selectedObjectiveCompleted,
    selectedObjectiveProgress,
    selectedObjectiveScoresPoints,
    sortedHandCards
  } = usePlayerCardState(
    room?.game,
    currentGamePlayer,
    handSortMode,
    isSpectator,
    pendingObjectiveCardId
  );
  useEffect(() => {
    if (
      pendingObjectiveCardId &&
      (currentGamePlayer?.selectedObjectiveCardId ||
        !currentGamePlayer?.objectiveChoices.includes(pendingObjectiveCardId))
    ) {
      setPendingObjectiveCardId(null);
    }
  }, [currentGamePlayer?.objectiveChoices, currentGamePlayer?.selectedObjectiveCardId, pendingObjectiveCardId]);
  const showHandDuringGame = Boolean(
    hasStartedGame &&
      currentGamePlayer &&
      (room?.game?.status === "setup" || room?.game?.status === "active")
  );
  // True while the player must click something on the board (place a card,
  // move/add a piece, pick a bonus, etc). On mobile we auto-close the
  // Jogadores/Mão sheets when this turns on so the board is visible.
  const {
    boardChoiceActive,
    handleMobileTabSelect,
    toggleCleanBoardMode
  } = useBoardUiOrchestration({
    addPieceTargets: displayAddPieceTargets,
    canPlaceSetupPiece,
    coatiPairBonusTargets: displayCoatiPairBonusTargets,
    expansionTargets: displayExpansionTargets,
    isMobile,
    movementTargets: displayMovementTargets,
    opponentInspectorEntries,
    pendingPlacement,
    rotateFitTargets: displayRotateFitTargets,
    setCleanBoardMode,
    setConfigOpen,
    setHandCollapsed,
    setHoveredSummaryCardIds,
    setHudLeftCollapsed,
    setMobileSheet,
    setMovementPreview,
    setRecapCollapsed,
    setSelectedOpponentPlayerId
  });
  function closeTurnRecap(): void {
    setTurnRecap((current) => ({ ...current, visible: false }));
    setHoveredSummaryCardIds([]);
  }

  function moveTurnRecapHistory(delta: -1 | 1): void {
    setTurnRecap((current) => {
      if (current.history.length === 0) {
        return current;
      }

      const nextIndex = Math.max(0, Math.min(current.history.length - 1, current.index + delta));
      return { ...current, index: nextIndex, visible: true };
    });
    setHoveredSummaryCardIds([]);
  }

  useSelectionGuards({
    cacaIlegalPending,
    cleanBoardMode,
    controlledPlayerId,
    game: room?.game,
    handCards,
    hasStartedGame,
    jaguarTargetPieceIds,
    opponentInspectorEntries,
    selectablePieceIds,
    selectedHandCardId,
    selectedJaguarTargetPieceId,
    selectedOpponentPlayerId,
    selectedPieceId,
    selectedRemovalPieceIds,
    selectedWolfResources,
    selectedWolfTargetPieceId,
    setCacaIlegalRemovalMode,
    setSelectedCardRotation,
    setSelectedHandCardId,
    setSelectedJaguarTargetPieceId,
    setSelectedOpponentPlayerId,
    setSelectedPieceId,
    setSelectedRemovalPieceIds,
    setSelectedWolfResources,
    setSelectedWolfTargetPieceId
  });

  useEffect(() => {
    if (!shouldShowJaguarScoreModal) {
      setShowJaguarScoreModal(false);
      return;
    }

    setShowJaguarScoreModal(false);
    const timer = window.setTimeout(() => setShowJaguarScoreModal(true), 900);
    return () => window.clearTimeout(timer);
  }, [room?.game?.activePlayerId, room?.game?.activeActionIndex, shouldShowJaguarScoreModal]);

  useTurnTransitionEffects({
    game: room?.game ?? null,
    hudGamePlayer,
    turnBanner,
    forestCanvasRef,
    effectTargetRefs,
    setTurnBanner,
    setFloatingGains,
    setTravelEffects,
    setTurnRecap,
    setRecapCollapsed,
    setHoveredSummaryCardIds
  });

  const applyLocalAction = useCallback((nextGame: GameState, notice: string) => {
    setRoom((current) =>
      current
        ? {
            ...current,
            status: nextGame.status === "active" ? "active" : current.status,
            game: nextGame,
            warnings: nextGame.contentWarnings
          }
        : current
    );
    setNotice(notice);
  }, []);

  const executeGameAction = useCallback(
    (
      localAction: () => GameState,
      onlineAction: () => Promise<PublicRoomState>,
      notice: string,
      reset: () => void = clearActionSelection
    ) => {
      if (isLocalRoom) {
        applyLocalAction(localAction(), notice);
        reset();
        return;
      }

      void run(onlineAction).then(reset);
    },
    [applyLocalAction, clearActionSelection, isLocalRoom, run]
  );

  const executeGameIntent = useCallback(
    (
      playerId: string,
      intent: GameIntent,
      notice: string,
      reset: () => void = clearActionSelection
    ) => {
      if (!room?.game) {
        return;
      }

      executeGameAction(
        () => applyGameIntent(room.game!, playerId, intent),
        () => roomApi.gameIntent(requireSocket(), room.roomId, intent),
        notice,
        reset
      );
    },
    [clearActionSelection, executeGameAction, room]
  );

  function requireSocket(): OikosSocket {
    if (!socket) {
      throw new Error("Conexão com o servidor ainda não foi aberta.");
    }

    return socket;
  }

  const { handleSpendJaguarMeat, handleScoreGalo, handleScoreArmadillo, handleCompleteAction } =
    useSimpleActionHandlers({
      room,
      canControlActivePlayer,
      tutorialActive,
      tutorialDef,
      executeGameIntent,
      setNotice
    });

  const { handleRemoveSelectedPieces, handleHideArmadillo, handleRemoveWolfBasePiece, handleSpendWolfResources } =
    useSelectionResolutionHandlers({
      room,
      canControlActivePlayer,
      tutorialActive,
      tutorialDef,
      selectedPieceId,
      selectedRemovalPieceIds,
      selectedWolfTargetPieceId,
      selectedWolfResources,
      requiredCoatiRemovalCount,
      clearWolfActionSelection,
      executeGameIntent,
      setNotice
    });

  async function spectate(roomId: string, password?: string | null) {
    if (onlineActionInFlightRef.current) {
      return;
    }

    const actionEpoch = roomActionEpochRef.current;
    onlineActionInFlightRef.current = true;
    setError(null);
    setNotice(null);

    try {
      const nextRoom = await roomApi.spectate(requireSocket(), roomId, password);
      if (roomActionEpochRef.current !== actionEpoch) {
        return;
      }

      setIsSpectator(true);
      applyOnlineRoomState(nextRoom, { direct: true });
      saveOnlineSession(nextRoom, name, true);
      setNotice("Assistindo a sala.");
    } catch (err) {
      if (isMissingRoomError(err)) {
        clearOnlineSession();
        clearRoomState();
        setJoinCode("");
        setNotice("Essa sala não existe. Confira o código com o anfitrião.");
        return;
      }

      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      onlineActionInFlightRef.current = false;
    }
  }

  function requireRoom(): PublicRoomState {
    if (!room) {
      throw new Error("Crie ou entre em uma sala primeiro.");
    }

    return room;
  }

  const {
    formatBotDelay,
    adjustLocalBotSpeed,
    adjustBotSpeed,
    toggleTurnTimer,
    adjustTurnTimer,
    toggleMiniExpansion,
    setScenarioMode,
    toggleLocalMiniExpansion,
    toggleLocalScenario,
    toggleHostScenario
  } = useRoomSettingsHandlers({
    room,
    isHost,
    isLocalRoom,
    botTurnDelayMs,
    turnTimerMs,
    enabledMiniExpansions,
    scenarioSelectionMode,
    scenarioCount,
    hostSelectedScenarioIds,
    localScenarioCount,
    setRoom,
    setLocalBotTurnDelayMs,
    setLocalEnabledMiniExpansions,
    setLocalScenarioCount,
    setLocalSelectedScenarioIds,
    run,
    requireSocket,
    setNotice
  });

  const { rotateSelectedCard, handleCardClick, placeCard, handleConfirmPlacement, handleCancelPlacement } =
    useBoardCardHandlers({
      room,
      isLocalRoom,
      canPlaceSetupPiece,
      canPlaceSelectedForestCard,
      selectedHandCardId,
      pendingPlacement,
      tutorialActive,
      tutorialStep,
      tutorialSteps,
      tutorialMarkedSlot,
      tutorialBlocks,
      socket,
      setRoom,
      setSelectedHandCardId,
      setSelectedCardRotation,
      setSelectedPieceId,
      setSelectedRemovalPieceIds,
      setPendingPlacement,
      setNotice,
      clearPendingPlacement,
      run,
      requireSocket
    });

  const {
    executeSelectedPieceMove,
    handlePieceClick,
    handleMovementTargetClick,
    handleAddPieceTargetClick,
    handleCoatiPairBonusTargetClick,
    handleScoreCapuchin,
    handleScoreMacaw
  } = useBoardPieceHandlers({
    room,
    isLocalRoom,
    activeActionId,
    activeSpeciesId: activeSpecies?.speciesId ?? null,
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
    executeGameIntent,
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
  });

  // Auto-completing the skip/no-card extra turn and endgame overflow repair stays
  // here since it drives the shared completeCurrentAction boundary.
  useEffect(() => {
    if ((!canSkipExtraTurnNoCardAction && !needsEndgameOverflowRepair) || tutorialActive) {
      return;
    }

    const id = window.setTimeout(() => {
      handleCompleteAction();
    }, 250);
    return () => window.clearTimeout(id);
  }, [canSkipExtraTurnNoCardAction, handleCompleteAction, needsEndgameOverflowRepair, tutorialActive]);

  // Toggle the centered card preview, capturing the clicked icon's center so the
  // modal can grow out from it.
  const {
    toggleLocalSpecies,
    toggleLocalBot,
    startLocalTest,
    stopLocalTest,
    playAgainLocal,
    startTutorial,
    exitTutorial,
    leaveTable
  } = useLocalGameHandlers({
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
  });

  function handleKickPlayer(targetPlayerId: string, targetName: string) {
    if (!socket || !room) return;
    if (!window.confirm(`Remover ${targetName || "este jogador"} da sala?`)) return;
    roomApi.kick(socket, room.roomId, targetPlayerId).catch((err: Error) => setError(err.message));
  }

  function handleRenameSelf() {
    if (!socket || !room) return;
    const currentName = room.players.find((p) => p.playerId === playerId)?.name ?? "";
    const next = window.prompt("Novo nome:", currentName);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentName) return;
    roomApi.rename(socket, room.roomId, trimmed).then(() => setName(trimmed)).catch((err: Error) => setError(err.message));
  }

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
    const species = activeSpecies?.speciesId;
    if (species !== "capuchin" && species !== "macaw" && species !== "galo_de_campina" && species !== "armadillo") {
      return;
    }
    const key = `${room.game.activePlayerId}:${room.game.round}:${species}:D`;
    if (autoScoredRef.current === key) {
      return;
    }
    // Armadillo highlights each rival species sharing a tile; give the player
    // longer to read the portraits before the automatic score advances.
    const scoreDelayMs = species === "armadillo" ? 3500 : 1500;
    const timer = window.setTimeout(() => {
      // Mark only when the timer actually fires. Handlers live in this effect's
      // deps and change on every `room` broadcast, so a state update inside the
      // delay window re-runs the effect and its cleanup cancels this timer. If we
      // marked the key before scheduling, the re-run would early-return and never
      // reschedule, leaving the D score stuck forever.
      autoScoredRef.current = key;
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
    activeSpecies?.speciesId,
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

  const {
    setupSpecies,
    setupPlaced,
    setupNeeded,
    caatingaPending,
    caatingaGamePlayer,
    cacaIlegalGamePlayer,
    cacaIlegalTopResources,
    cacaIlegalRemovablePieceIds,
    cacaIlegalRemovablePieces,
    cerradoPending,
    cerradoGamePlayer,
    canResolveCacaIlegal,
    canResolveCaatinga,
    canResolveCerrado,
    pendingExtraTurnPlayer,
    canResolveExtraTurn,
    pendingSeedSpendPlayer,
    pendingSeedSpendCount,
    pendingSeedSpendPoints,
    pendingSeedSpendSeeds,
    canResolveSeedSpend,
    mataAtlanticaForcedDiscard
  } = usePendingRuleState({
    controlledPlayerId,
    currentGamePlayer,
    cacaIlegalPending,
    game: room?.game,
    isLocalRoom,
    mataAtlanticaPileTopIds
  });

  const {
    handleSelectObjective,
    handleDiscardObjective,
    resolveCaatingaChoice,
    resolveCerradoChoice,
    resolveExtraTurnChoice,
    resolveSeedSpendChoice,
    resolveMataAtlanticaDiscard
  } = useObjectiveExpansionHandlers({
    room,
    setRoom,
    currentGamePlayer,
    canDiscardSelectedObjective,
    pendingObjectiveCardId,
    setPendingObjectiveCardId,
    setExpandedObjectiveCardId,
    setExpansionPreview,
    caatingaPending,
    cerradoPending,
    canResolveCaatinga,
    canResolveCerrado,
    canResolveExtraTurn,
    canResolveSeedSpend,
    pendingSeedSpendCount,
    pendingSeedSpendPoints,
    isLocalRoom,
    name,
    applyOnlineRoomState,
    saveOnlineSession,
    run,
    requireSocket,
    setError,
    setNotice
  });

  const {
    clearCacaIlegalRemoval,
    enterCacaIlegalRemovalMode,
    resolveCacaIlegalChoice,
    resolveSelectedCacaIlegalPiece
  } = useCacaIlegalHandlers({
    room,
    setRoom,
    cacaIlegalPending,
    canResolveCacaIlegal,
    cacaIlegalRemovalMode,
    setCacaIlegalRemovalMode,
    selectedRemovalPieceIds,
    setSelectedRemovalPieceIds,
    isLocalRoom,
    run,
    requireSocket,
    setError
  });
  const appShell = useAppShellClass({
    hasStartedGame,
    isMobile,
    cleanBoardMode,
    isBasicTutorial,
    currentSpeciesId: currentGamePlayer?.speciesId ?? null,
    visualAccessibility,
    mobileSheet
  });
  const gamePreloader = useGamePreloader(room?.game);

  if (isBelowDesktop) {
    return (
      <main className="desktop-only-shell">
        <div className="desktop-only-card" role="status" aria-live="polite">
          <img className="desktop-only-logo" src="/oikos-logo.webp" alt="Oikos Digital" />
          <AlertTriangle aria-hidden="true" />
          <h1>Oikos Digital é apenas para desktop</h1>
          <p>
            A HUD atual foi desenhada para telas grandes. Use um computador ou aumente a janela para pelo menos
            1024px de largura.
          </p>
        </div>
      </main>
    );
  }

  if (hasStartedGame && !gamePreloader.ready) {
    return (
      <main className="game-loading-shell" role="status" aria-live="polite">
        <div className="game-loading-card">
          <img className="game-loading-logo" src="/oikos-logo.webp" alt="Oikos Digital" />
          <div className="game-loading-spinner" aria-hidden="true" />
          <h1>{gamePreloader.label}</h1>
          <div className="game-loading-bar" aria-label="Progresso do carregamento">
            <span style={{ width: `${Math.round(gamePreloader.progress * 100)}%` }} />
          </div>
          <p>{Math.round(gamePreloader.progress * 100)}%</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={appShell.className}
      data-visual-accessibility={appShell.dataVisualAccessibility}
      data-sheet={appShell.dataSheet}
    >
      {!hasStartedGame && (
        <div className="account-badge">
          <span>{authUser.email}</span>
          <button type="button" onClick={onSignOut} aria-label="Sair da conta">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      )}
      <PendingInterruptDialogs
        cacaIlegalChoice={
          cacaIlegalPending && canResolveCacaIlegal && !cacaIlegalRemovalMode
            ? {
                playerName: cacaIlegalGamePlayer?.name ?? "Jogador",
                topResources: cacaIlegalTopResources,
                resources: cacaIlegalGamePlayer?.resources ?? {},
                hasRemovablePieces: cacaIlegalRemovablePieces.length > 0
              }
            : null
        }
        cacaIlegalRemoval={
          cacaIlegalPending && canResolveCacaIlegal && cacaIlegalRemovalMode
            ? {
                selectedCount: selectedRemovalPieceIds.length,
                confirmDisabled: selectedRemovalPieceIds.length !== 1
              }
            : null
        }
        caatinga={
          caatingaPending && canResolveCaatinga
            ? {
                playerName: caatingaGamePlayer?.name ?? "Jogador",
                trigger: caatingaPending.trigger,
                resource: caatingaPending.resource,
                currentResourceCount: caatingaGamePlayer?.resources[caatingaPending.resource] ?? 0
              }
            : null
        }
        cerrado={
          cerradoPending && canResolveCerrado
            ? { playerName: cerradoGamePlayer?.name ?? "Jogador", resource: cerradoPending.resource }
            : null
        }
        extraTurn={
          room?.game?.pendingExtraTurnPlayerId && canResolveExtraTurn
            ? {
                playerName: pendingExtraTurnPlayer?.name ?? "Jogador",
                acceptDisabled: (pendingExtraTurnPlayer?.score ?? 0) < 1
              }
            : null
        }
        seedSpend={
          room?.game?.pendingSeedSpendObjectivePlayerId && canResolveSeedSpend
            ? {
                playerName: pendingSeedSpendPlayer?.name ?? "Jogador",
                spendCount: pendingSeedSpendCount,
                points: pendingSeedSpendPoints,
                acceptDisabled: pendingSeedSpendSeeds < pendingSeedSpendCount
              }
            : null
        }
        mataAtlantica={
          mataAtlanticaForcedDiscard
            ? { playerName: currentGamePlayer?.name ?? "Jogador", pileTopIds: mataAtlanticaPileTopIds }
            : null
        }
        onCacaIlegalSpend={(resource) => resolveCacaIlegalChoice({ kind: "spend_resource", resource })}
        onCacaIlegalEnterRemoval={enterCacaIlegalRemovalMode}
        onCacaIlegalConfirmRemoval={resolveSelectedCacaIlegalPiece}
        onCacaIlegalBackRemoval={clearCacaIlegalRemoval}
        onCaatingaChoice={resolveCaatingaChoice}
        onCerradoChoice={resolveCerradoChoice}
        onExtraTurnResolve={resolveExtraTurnChoice}
        onSeedSpendResolve={resolveSeedSpendChoice}
        onMataDiscard={resolveMataAtlanticaDiscard}
      />
      <TravelEffectLayer effects={travelEffects} />
      <ScoreAnimationPanels
        cleanBoardMode={cleanBoardMode}
        macawScoreAnim={macawScoreAnim}
        capuchinScoreAnim={capuchinScoreAnim}
      />
      {!hasStartedGame && !room && landingMode === "idle" && (
        <MainMenuScreen
          name={name}
          onNameChange={setName}
          onNavigate={setLandingMode}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          audio={audioSettings}
          onUpdate={updateAudio}
          visualAccessibility={visualAccessibility}
          onVisualAccessibilityChange={updateVisualAccessibility}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {!hasStartedGame && !room && landingMode === "create" && (
        <CreateRoomScreen
          name={name}
          createPassword={createPassword}
          onNameChange={setName}
          onPasswordChange={setCreatePassword}
          onBack={() => setLandingMode("idle")}
          onSubmit={() => {
            void run(
              () => roomApi.create(requireSocket(), name, createPassword || null),
              "Sala criada."
            );
          }}
        />
      )}

      {!hasStartedGame && !room && landingMode === "join" && (
        <JoinRoomScreen
          name={name}
          joinCode={joinCode}
          joinPassword={joinPassword}
          openRooms={openRooms}
          roomsLoading={roomsLoading}
          onNameChange={setName}
          onJoinCodeChange={setJoinCode}
          onJoinPasswordChange={setJoinPassword}
          onBack={() => setLandingMode("idle")}
          onRefreshRooms={refreshRooms}
          onJoinRoom={(roomId) => {
            void run(() => roomApi.join(requireSocket(), roomId, name), "Entrada confirmada.");
          }}
          onSpectateRoom={(roomId) => {
            void spectate(roomId);
          }}
          onJoinByCode={() => {
            void run(
              () => roomApi.join(requireSocket(), joinCode, name, joinPassword || null),
              "Entrada confirmada."
            );
          }}
          onSpectateByCode={() => {
            void spectate(joinCode, joinPassword || null);
          }}
        />
      )}

      {!hasStartedGame && !room && landingMode === "local" && (
        <LocalSetupScreen
          speciesIds={localSpeciesIds}
          botSpeciesIds={localBotSpeciesIds}
          botTurnDelayMs={localBotTurnDelayMs}
          enabledMiniExpansions={localEnabledMiniExpansions}
          scenarioCount={localScenarioCount}
          selectedScenarioIds={localSelectedScenarioIds}
          formatBotDelay={formatBotDelay}
          onBack={() => setLandingMode("idle")}
          onToggleSpecies={toggleLocalSpecies}
          onToggleBot={toggleLocalBot}
          onToggleMiniExpansion={toggleLocalMiniExpansion}
          onToggleScenario={toggleLocalScenario}
          onAdjustBotSpeed={adjustLocalBotSpeed}
          onStart={startLocalTest}
        />
      )}

      {!hasStartedGame && !room && landingMode === "tutorials" && (
        <TutorialChapterSelect
          completed={{
            initial: isTutorialInitialDone(),
            jaguar: isTutorialJaguarDone(),
            wolf: isTutorialWolfDone(),
            armadillo: isTutorialArmadilloDone(),
            macaw: isTutorialMacawDone(),
            capuchin: isTutorialCapuchinDone(),
            coati: isTutorialCoatiDone()
          }}
          onBack={() => setLandingMode("idle")}
          onStart={startTutorial}
        />
      )}

      {!hasStartedGame && room && (
        <LobbyScreen
          room={room}
          playerId={playerId}
          controlledPlayerId={controlledPlayerId}
          currentPlayer={currentPlayer}
          selectedSpecies={selectedSpecies}
          isLocalRoom={isLocalRoom}
          isSpectator={isSpectator}
          isHost={isHost}
          readyPlayerCount={readyPlayerCount}
          enabledMiniExpansions={enabledMiniExpansions}
          scenarioSelectionMode={scenarioSelectionMode}
          scenarioCount={scenarioCount}
          hostSelectedScenarioIds={hostSelectedScenarioIds}
          turnTimerMs={turnTimerMs}
          botTurnDelayMs={botTurnDelayMs}
          roomHasBots={roomHasBots}
          needsHostScenarioSelection={needsHostScenarioSelection}
          formatBotDelay={formatBotDelay}
          onExit={() => {
            if (isLocalRoom) {
              stopLocalTest();
            } else {
              leaveTable();
            }
            setLandingMode("idle");
          }}
          onCopyCode={() => {
            void navigator.clipboard?.writeText(room.roomId);
            setNotice("Código copiado.");
          }}
          onRenameSelf={handleRenameSelf}
          onKickPlayer={handleKickPlayer}
          onToggleMiniExpansion={toggleMiniExpansion}
          onSetScenarioMode={setScenarioMode}
          onToggleHostScenario={toggleHostScenario}
          onToggleTurnTimer={toggleTurnTimer}
          onAdjustTurnTimer={adjustTurnTimer}
          onRemoveBots={() => {
            void run(() => roomApi.removeBots(requireSocket(), room.roomId), "Bots removidos.");
          }}
          onAdjustBotSpeed={adjustBotSpeed}
          onSelectSpecies={(speciesId) => {
            setSelectedSpecies(speciesId);
            void run(() => roomApi.selectSpecies(requireSocket(), room.roomId, speciesId));
          }}
          onToggleBotSpecies={(speciesId, remove) => {
            if (remove) {
              void run(
                () => roomApi.removeBotSpecies(requireSocket(), room.roomId, speciesId),
                "Bot removido."
              );
            } else {
              void run(
                () => roomApi.addBotSpecies(requireSocket(), room.roomId, speciesId),
                "Bot adicionado."
              );
            }
          }}
          onReady={(ready) => {
            void run(() => roomApi.ready(requireSocket(), requireRoom().roomId, ready));
          }}
          onStart={() => {
            void run(() => roomApi.start(requireSocket(), room.roomId));
          }}
        />
      )}

      {room?.status === "scenario_voting" && room.scenarioVoting && (
        <ScenarioVotingOverlay
          room={room}
          playerId={playerId}
          isSpectator={isSpectator}
          onSubmitVotes={(votes) => {
            run(() => roomApi.voteScenarios(requireSocket(), room.roomId, votes));
          }}
        />
      )}

      <HudControls
        showRoundIndicator={Boolean(hasStartedGame && !cleanBoardMode && room?.game)}
        round={room?.game?.round ?? 0}
        maxRounds={room?.game?.maxRounds ?? 0}
        showCleanToggle={hasStartedGame}
        cleanBoardMode={cleanBoardMode}
        showConfigButton={Boolean(hasStartedGame && !cleanBoardMode)}
        onToggleCleanBoard={toggleCleanBoardMode}
        onOpenConfig={() => setConfigOpen(true)}
      />

      {hasStartedGame && !cleanBoardMode && expansionPreview && (
        <ExpansionPreviewOverlay
          kind={expansionPreview}
          origin={expansionOrigin}
          objective={objectivePreviewCard}
          objectiveDiscarded={objectiveWasDiscarded}
          objectiveScoresPoints={selectedObjectiveScoresPoints}
          objectiveProgress={selectedObjectiveProgress}
          canDiscardObjective={canDiscardSelectedObjective}
          scenarios={activeScenarioDefinitions}
          threat={activeThreatDefinition}
          onClose={() => setExpansionPreview(null)}
          onDiscardObjective={() => void handleDiscardObjective()}
        />
      )}

      {threatRevealDefinition && (
        <ThreatRevealOverlay
          threat={threatRevealDefinition}
          onClose={() => setThreatReveal(null)}
        />
      )}

      {hasStartedGame && !cleanBoardMode && isSpectator && <SpectatorBanner onLeave={leaveTable} />}

      {tutorialActive && hasStartedGame && !cleanBoardMode && tutorialDef && (
        <TutorialCoach
          currentStep={tutorialStep!}
          steps={tutorialSteps}
          onExit={() => exitTutorial(false)}
          onComplete={() => exitTutorial(true)}
          onNext={advanceTutorial}
        />
      )}

      {hasStartedGame && !cleanBoardMode && configOpen && (
        <SettingsModal
          audio={audioSettings}
          onUpdate={updateAudio}
          visualAccessibility={visualAccessibility}
          onVisualAccessibilityChange={updateVisualAccessibility}
          onClose={() => setConfigOpen(false)}
          table={{
            roomLabel: isLocalRoom ? "Teste local" : "Sala online",
            roomId: room?.roomId ?? "Mesa",
            onCopy:
              !isLocalRoom && room
                ? () => {
                    void navigator.clipboard?.writeText(room.roomId);
                    setNotice("Codigo copiado.");
                  }
                : undefined,
            botSpeed:
              (!isLocalRoom && isHost) || (isLocalRoom && roomHasBots)
                ? {
                    label: `Bots ${formatBotDelay(botTurnDelayMs)}`,
                    onFaster: () => adjustBotSpeed(-botTurnDelayStepMs),
                    onSlower: () => adjustBotSpeed(botTurnDelayStepMs)
                  }
                : null,
            scenarios: activeScenarioDefinitions.map((scenario) => ({
              id: scenario.id,
              label: scenario.label,
              description: scenario.description,
              imagePath: scenario.imagePath
            })),
            threat: activeThreatDefinition
              ? {
                  label: activeThreatDefinition.label,
                  description: activeThreatDefinition.description,
                  imagePath: activeThreatDefinition.imagePath
                }
              : null,
            onExit: leaveTable
          }}
        />
      )}

      {hasStartedGame && !cleanBoardMode && hudGamePlayer && hudSpecies && (
        <SpeciesStatusHud
          collapsed={hudSpeciesCollapsed}
          floatingGains={floatingGains}
          isBasicTutorial={isBasicTutorial}
          isControlledPlayer={Boolean(currentGamePlayer)}
          player={hudGamePlayer}
          resourceLeaders={resourceLeaders}
          species={hudSpecies}
          setEffectTarget={setEffectTarget}
          onToggleCollapsed={() => setHudSpeciesCollapsed((value) => !value)}
        />
      )}

        {!cleanBoardMode && (error || notice) && (
          <div className={`status-message hud-toast ${error ? "error" : "notice"}`}>
            {error ? <AlertTriangle aria-hidden="true" /> : <Check aria-hidden="true" />}
            <span><ResourceText text={error ?? notice ?? ""} /></span>
          </div>
        )}

        {hasStartedGame && !cleanBoardMode && room?.game && (
          <LeftActionDock
            activeActionId={activeActionId}
            activeGamePlayer={activeGamePlayer}
            activeSpecies={activeSpecies}
            armadilloHideablePieceCount={getArmadilloHidePieceIds(room.game, room.game.activePlayerId ?? "").length}
            armadilloShareScore={armadilloShareScore}
            canControlActivePlayer={canControlActivePlayer}
            canPlaceSetupPiece={canPlaceSetupPiece}
            canResolveCacaIlegal={canResolveCacaIlegal}
            canSkipJaguarMove={canSkipJaguarMove}
            capuchinHabitatScore={capuchinHabitatScore}
            capuchinPlacementTargetCount={capuchinPlacementTargets.length}
            capuchinReserveCount={capuchinReserveCount}
            cacaIlegalPending={Boolean(cacaIlegalPending)}
            cacaIlegalRemovalMode={cacaIlegalRemovalMode}
            collapsed={hudLeftCollapsed}
            currentGamePlayer={currentGamePlayer}
            game={room.game}
            hasPendingCoatiPairBonus={hasPendingCoatiPairBonus}
            hasSelectedJaguarDestination={Boolean(selectedJaguarDestination)}
            hasTurnRecap={Boolean(turnSummary)}
            isBasicTutorial={isBasicTutorial}
            macawEggTargetCount={macawEggTargets.length}
            macawLineScore={macawLineScore}
            requiredCoatiRemovalCount={requiredCoatiRemovalCount}
            selectedPieceId={selectedPieceId}
            selectedRemovalPieceIds={selectedRemovalPieceIds}
            selectedWolfTargetPieceId={selectedWolfTargetPieceId}
            setupActivePlayer={setupActivePlayer}
            setupNeeded={setupNeeded}
            setupPlaced={setupPlaced}
            tutorialActive={tutorialActive}
            wolfMeatTargetCount={wolfMeatTargets.length}
            wolfRemovableBasePieceCount={wolfRemovableBasePieceIds.length}
            onCancelCacaIlegalRemoval={clearCacaIlegalRemoval}
            onCompleteAction={handleCompleteAction}
            onHideArmadillo={handleHideArmadillo}
            onRemoveSelectedPieces={handleRemoveSelectedPieces}
            onRemoveWolfBasePiece={handleRemoveWolfBasePiece}
            onResolveSelectedCacaIlegalPiece={resolveSelectedCacaIlegalPiece}
          />
        )}

      <section className={`playfield-panel stage-layer ${turnBanner && !cleanBoardMode ? "is-turn-shift" : ""}`}>
        <div className="table-wood" aria-hidden="true" />
        <div className="tabletop-stage">
          <StageBanners
            cleanBoardMode={cleanBoardMode}
            turnBanner={turnBanner}
            galoInterrupt={Boolean(galoInterrupt)}
            isCurrentGaloInterruptOwner={isCurrentGaloInterruptOwner}
            galoInterruptOwnerName={galoInterruptOwner?.name ?? null}
            showGaloWaitingBanner={Boolean(
              galoInterrupt && !isCurrentGaloInterruptOwner && visibleGaloInterruptBannerKey === galoInterruptKey
            )}
            galoInterruptBannerText={galoInterruptBannerText}
            interruptedGaloPlayerName={interruptedGaloPlayer?.name ?? null}
            isCurrentPlayerWaitingForGaloInterrupt={isCurrentPlayerWaitingForGaloInterrupt}
          />
          {!cleanBoardMode && showTurnCountdown && room?.turnTimerMs && room?.activeTurnStartedAt && (
            <TurnCountdown
              key={`${room.game?.activePlayerId ?? ""}:${room.activeTurnStartedAt}`}
              startedAt={room.activeTurnStartedAt}
              durationMs={room.turnTimerMs}
            />
          )}
          <Suspense fallback={<div className="forest-canvas is-loading" aria-busy="true" />}>
            <ForestCanvas
              ref={forestCanvasRef}
              cards={forestCards}
              pieces={pieces}
              canPlaceSetupPiece={canPlaceSetupPiece}
              interactive={!expansionPreview && !threatReveal && !configOpen && !settingsOpen}
              expansionTargets={displayExpansionTargets}
              rotateFitTargets={displayRotateFitTargets}
              rotateFitCardId={canPlaceSelectedForestCard ? selectedHandCardId : null}
              placementPreview={
                pendingPlacement && selectedHandCardId
                  ? {
                      position: pendingPlacement.position,
                      rotation: pendingPlacement.rotation,
                      cardId: selectedHandCardId
                    }
                  : null
              }
              movementTargets={displayMovementTargets}
              addPieceTargets={displayAddPieceTargets}
              addPieceLabel={
                activeSpecies?.speciesId === "capuchin"
                  ? "Adicionar macaco"
                  : activeSpecies?.speciesId === "macaw"
                    ? "Adicionar arara"
                    : activeSpecies?.speciesId === "galo_de_campina"
                      ? "Adicionar galo"
                    : activeSpecies?.speciesId === "armadillo"
                      ? "Adicionar tatu"
                      : activeSpecies?.speciesId === "maned_wolf"
                        ? "Adicionar lobo"
                    : "Adicionar quati"
              }
              addPieceHint={
                activeSpecies?.speciesId === "capuchin"
                  ? "Clique em uma carta destacada para adicionar 1 macaco"
                  : activeSpecies?.speciesId === "macaw"
                    ? "Clique em uma carta destacada para adicionar 1 arara"
                    : activeSpecies?.speciesId === "galo_de_campina"
                      ? "Clique em um local de semente para adicionar 1 galo"
                    : activeSpecies?.speciesId === "armadillo"
                      ? "Clique em uma carta com semente para adicionar 1 tatu"
                      : activeSpecies?.speciesId === "maned_wolf"
                        ? "Clique em uma carta com carne para adicionar 1 lobo"
                    : "Clique em uma carta com fruta para adicionar 1 quati"
              }
              bonusTargets={displayCoatiPairBonusTargets}
              spotlightInstanceIds={spotlightInstanceIds}
              scoringCardHighlights={scoringPreview.cardHighlights}
              scoringLineHighlights={scoringPreview.lineHighlights}
              selectedHandCardId={selectedHandCardId}
              selectedPieceId={selectedPieceId}
              selectedPieceIds={highlightedPieceIds}
              selectablePieceIds={boardSelectablePieceIds}
              onCardClick={handleCardClick}
              onExpansionTargetClick={handleExpansionTargetClick}
              onRotateFitTargetClick={handleRotateFitTargetClick}
              onConfirmPlacement={handleConfirmPlacement}
              onCancelPlacement={handleCancelPlacement}
              onAddPieceTargetClick={handleAddPieceTargetClick}
              onBonusTargetClick={handleCoatiPairBonusTargetClick}
              onPieceClick={handlePieceClick}
              onMovementTargetClick={handleMovementTargetClick}
            />
          </Suspense>
        </div>
      </section>

        {!cleanBoardMode && showHandDuringGame && currentGamePlayer && (
          <TableHand
            player={currentGamePlayer}
            game={room?.game}
            handCards={handCards}
            sortedHandCards={sortedHandCards}
            handCollapsed={handCollapsed}
            handSortLabel={handSortLabel}
            nextHandSortLabel={nextHandSortLabel}
            isBasicTutorial={isBasicTutorial}
            selectedHandCardId={selectedHandCardId}
            selectedCardRotation={selectedCardRotation}
            canPlaceSelectedForestCard={canPlaceSelectedForestCard}
            canSelectHandCards={canSelectHandCards}
            handPlayableThisAction={handPlayableThisAction}
            tutorialRequiredCardId={tutorialRequiredCardId}
            mataAtlanticaPileIndexByCardId={mataAtlanticaPileIndexByCardId}
            onToggleCollapsed={() => setHandCollapsed((value) => !value)}
            onCycleSort={() => setHandSortMode(nextHandSortMode)}
            onToggleCard={(cardId) => {
              setSelectedHandCardId((current) => {
                const next = current === cardId ? null : cardId;
                if (next !== current) {
                  setSelectedCardRotation(0);
                }
                return next;
              });
            }}
            onRotateCard={rotateSelectedCard}
            onMataDiscard={resolveMataAtlanticaDiscard}
          />
        )}

      <ObjectiveChoiceDialogs
        showChoice={!cleanBoardMode && needsObjectiveChoice}
        objectiveChoices={objectiveChoices}
        pendingObjectiveCardId={pendingObjectiveCardId}
        expandedObjectiveCardId={expandedObjectiveCardId}
        canDiscardSelectedObjective={canDiscardSelectedObjective}
        selectedObjectiveCardId={currentGamePlayer?.selectedObjectiveCardId}
        onSelectObjective={(cardId) => void handleSelectObjective(cardId)}
        onExpand={setExpandedObjectiveCardId}
        onDiscardObjective={() => void handleDiscardObjective()}
      />

      {hasStartedGame && !cleanBoardMode && !tutorialActive && opponentInspectorEntries.length > 0 && (
        <OpponentInspector
          entries={opponentInspectorEntries}
          selectedEntry={selectedOpponentEntry}
          selectedPlayerId={selectedOpponentPlayerId}
          selectedRailIndex={selectedOpponentRailIndex}
          resourceLeaders={resourceLeaders}
          setEffectTarget={setEffectTarget}
          onSelectPlayer={setSelectedOpponentPlayerId}
        />
      )}

      {!cleanBoardMode && movementPreview && typeof document !== "undefined" && createPortal(
        <MovementGuideFloating
          speciesId={movementPreview.speciesId}
          left={movementPreview.left}
          top={movementPreview.top}
        />,
        document.body
      )}

      <SpeciesScoreModals
        jaguar={
          !cleanBoardMode && shouldShowJaguarScoreModal && showJaguarScoreModal
            ? { availablePointSpendCount: availableJaguarPointSpendCount, completeDisabled: tutorialActive }
            : null
        }
        wolf={
          !cleanBoardMode &&
          hasStartedGame &&
          !hasPendingCoatiPairBonus &&
          room?.game?.status === "active" &&
          activeGamePlayer &&
          activeSpecies?.speciesId === "maned_wolf" &&
          activeActionId === "C" &&
          canControlActivePlayer &&
          (!tutorialActive || tutorialId !== "wolf" || tutorialGate === "score")
            ? {
                resources: activeGamePlayer.resources,
                selectedResources: selectedWolfResources,
                spendableResources: wolfSpendableResources,
                availablePointSpendCount: availableWolfPointSpendCount,
                completeDisabled: tutorialActive
              }
            : null
        }
        onJaguarSpend={handleSpendJaguarMeat}
        onWolfToggleResource={(resource) =>
          setSelectedWolfResources((current) =>
            current.includes(resource)
              ? current.filter((candidate) => candidate !== resource)
              : current.length < availableWolfPointSpendCount
                ? [...current, resource]
                : current
          )
        }
        onWolfSpend={handleSpendWolfResources}
        onComplete={handleCompleteAction}
      />

      {!cleanBoardMode && room?.game?.status === "finished" && room.game.finalScoreBreakdown && (
        <EndgameCeremony
          breakdown={room.game.finalScoreBreakdown}
          winnerPlayerIds={room.game.winnerPlayerIds}
          isLocalRoom={isLocalRoom}
          onPlayAgain={playAgainLocal}
          onLeave={leaveTable}
        />
      )}


      {!cleanBoardMode && turnSummary && room?.game?.status === "active" && (
        <TurnRecapPanel
          turnSummary={turnSummary}
          turnRecap={turnRecap}
          collapsed={recapCollapsed}
          onToggleCollapsed={() => setRecapCollapsed((value) => !value)}
          onMoveHistory={moveTurnRecapHistory}
          onClose={closeTurnRecap}
          onHoverEntry={setHoveredSummaryCardIds}
        />
      )}

      {!cleanBoardMode && boardSpecies && (
        <SpeciesBoardModal speciesId={boardSpecies} onClose={() => setBoardSpecies(null)} />
      )}

      {isMobile && hasStartedGame && !cleanBoardMode && (
        <MobileTabbar
          activeSheet={mobileSheet}
          canShowHand={showHandDuringGame && Boolean(currentGamePlayer)}
          canShowPlayers={Boolean(room)}
          canShowSummary={Boolean(turnSummary) && room?.game?.status === "active"}
          onSelect={handleMobileTabSelect}
        />
      )}
      {hasStartedGame && !cleanBoardMode && !isBasicTutorial && currentGamePlayer?.speciesId && room?.game && (
        <SpeciesActionHud
          game={room.game}
          player={currentGamePlayer}
          activeActionId={ownActiveActionId}
          resourceMajority={currentPlayerResourceMajority}
          showObjective={Boolean(objectivePreviewCard)}
          objectiveCompleted={selectedObjectiveCompleted}
          objectiveDiscarded={objectiveWasDiscarded}
          showScenarios={activeScenarioDefinitions.length > 0}
          showThreat={Boolean(activeThreatDefinition)}
          setEffectTarget={setEffectTarget}
          onExpansionToggle={toggleExpansionPreview}
          tutorialActive={tutorialActive}
          canSkipJaguarMove={canSkipJaguarMove}
          selectedJaguarDestination={selectedJaguarDestination}
          selectedPieceId={selectedPieceId}
          selectedWolfTargetPieceId={selectedWolfTargetPieceId}
          selectedRemovalPieceIds={selectedRemovalPieceIds}
          wolfRemovableBasePieceCount={wolfRemovableBasePieceIds.length}
          wolfMeatTargetCount={wolfMeatTargets.length}
          armadilloHideablePieceCount={getArmadilloHidePieceIds(room.game, room.game.activePlayerId ?? "").length}
          armadilloSharing={scoringPreview.armadillo}
          macawActionCTargetCount={macawActionCTargets.length}
          macawLineScore={macawLineScore}
          galoScore={galoScore}
          capuchinReserveCount={capuchinReserveCount}
          capuchinPlacementTargetCount={capuchinPlacementTargets.length}
          capuchinHabitatScore={capuchinHabitatScore}
          requiredCoatiRemovalCount={requiredCoatiRemovalCount}
          hasPendingCoatiPairBonus={hasPendingCoatiPairBonus}
          onCompleteAction={handleCompleteAction}
          onHideArmadillo={handleHideArmadillo}
          onRemoveWolfBasePiece={handleRemoveWolfBasePiece}
          onRemoveSelectedPieces={handleRemoveSelectedPieces}
        />
      )}
    </main>
  );
}
