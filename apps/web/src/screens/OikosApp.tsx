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
  getObjectiveCardDefinition,
  habitatLabels,
  movementLabels,
  scenarioCardsById,
  threatCardsById,
  resourceAssets,
  resourceLabels,
  speciesDefinitions
} from "@oikos/content";
import {
  createPreviewInitialForest,
  getArmadilloHidePieceIds,
  getWolfSpendableResourceTypes,
  getCacaIlegalRemovablePieceIds,
  getCacaIlegalTopResources,
} from "@oikos/rules";
import type {
  GameState,
  PublicRoomState,
  ScenarioCardDefinition,
  SpeciesId,
  ThreatCardId
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
import { useCacaIlegalHandlers } from "../hooks/useCacaIlegalHandlers";
import { useGameFeedback } from "../hooks/useGameFeedback";
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
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { useRoomSettingsHandlers } from "../hooks/useRoomSettingsHandlers";
import { useScoringPreview } from "../hooks/useScoringPreview";
import { useTurnTransitionEffects } from "../hooks/useTurnTransitionEffects";
import { useSelectionResolutionHandlers } from "../hooks/useSelectionResolutionHandlers";
import { useSimpleActionHandlers } from "../hooks/useSimpleActionHandlers";
import { useTutorialController } from "../hooks/useTutorialController";
import { useTurnTimer } from "../hooks/useTurnTimer";
import { roomApi, type OikosSocket } from "../socket";
import { LobbyScreen } from "./LobbyScreen";
import { LocalSetupScreen } from "./LocalSetupScreen";
import { MainMenuScreen } from "./MainMenuScreen";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { playLogEvent } from "../ui/audio";
import { ActiveRulesDock } from "../ui/ActiveRulesDock";
import { EndgameCeremony } from "../ui/EndgameCeremony";
import { ExpansionPreviewOverlay, ThreatRevealOverlay } from "../ui/GameOverlays";
import { MovementGlyph } from "../ui/MovementGlyph";
import { ResourceText } from "../ui/ResourceText";
import { ScenarioVotingOverlay } from "../ui/ScenarioVotingOverlay";
import { MovementGuideFloating, SpeciesBoardModal } from "../ui/BoardModals";
import { ExtraTurnObjectiveModal, SeedSpendObjectiveModal } from "../ui/EndgameObjectiveDialogs";
import {
  CaatingaChoiceModal,
  CacaIlegalChoiceModal,
  CacaIlegalRemovalBanner,
  CerradoChoiceModal,
  MataAtlanticaDiscardModal
} from "../ui/ScenarioPendingDialogs";
import { JaguarScoreModal, WolfScoreModal } from "../ui/ScoreSpendModals";
import { SettingsModal } from "../ui/SettingsModal";
import { SpeciesActionHud } from "../ui/SpeciesActionHud";
import { SpeciesStatusHud } from "../ui/SpeciesStatusHud";
import { LeftActionDock } from "../ui/LeftActionDock";
import { MobileTabbar, type MobileTabId } from "../ui/MobileTabbar";
import { ScenarioDescription } from "../ui/ScenarioDescription";
import { TurnCountdown } from "../ui/TurnCountdown";
import { TutorialChapterSelect } from "../ui/TutorialChapterSelect";
import { TutorialCoach } from "../ui/TutorialCoach";
import { movementArtPath } from "../ui/movementArt";
import { setVisualAccessibilityPreference } from "../ui/visualAccessibility";
import {
  SPECIES_HEX,
  botTurnDelayStepMs,
  categoryLabels,
  defaultBotTurnDelayMs,
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
  // expansionPreview/expansionOrigin (fly-from-origin open animation) live in
  // useActionSelection. threatReveal (full-screen threat announcement) lives in useGameFeedback; its
  // auto-dismiss timer and the reveal effect stay below. Tracks the last threat
  // seen per game so the announcement fires only on an actual change, not on the
  // initial load / reconnect into an ongoing game.
  const lastThreatRef = useRef<{ gameId: string | null; threatId: ThreatCardId | null }>({
    gameId: null,
    threatId: null
  });
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
  const galoInterruptBannerText = isCurrentGaloInterruptOwner
    ? "Entre turnos ativo: mova 1 galo-de-campina"
    : `Aguardando ${galoInterruptOwner?.name ?? "Galo-de-campina"} resolver entre turnos`;

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

  const isHost = Boolean(room && !isLocalRoom && playerId === room.hostPlayerId);
  const roomHasBots = Boolean(room?.players.some((player) => player.isBot));
  const readyPlayerCount = room?.players.filter((player) => player.ready).length ?? 0;
  const enabledMiniExpansions = room?.enabledMiniExpansions ?? room?.game?.enabledMiniExpansions ?? [];
  const scenarioSelectionMode = room?.scenarioSelectionMode ?? "vote";
  const scenarioCount = room?.scenarioCount ?? 1;
  const hostSelectedScenarioIds = room?.hostSelectedScenarioIds ?? [];
  const needsHostScenarioSelection =
    !isLocalRoom &&
    enabledMiniExpansions.includes("scenarios") &&
    scenarioSelectionMode === "host" &&
    hostSelectedScenarioIds.length !== scenarioCount;
  const activeScenarioDefinitions = useMemo(
    () => (room?.game?.activeScenarioIds ?? []).map((id) => scenarioCardsById.get(id)).filter(Boolean) as ScenarioCardDefinition[],
    [room?.game?.activeScenarioIds]
  );
  const activeThreatDefinition = room?.game?.activeThreatCardId
    ? threatCardsById.get(room.game.activeThreatCardId) ?? null
    : null;

  // Announce a newly revealed threat to everyone. Fires only when the active
  // threat changes within the same game session (a new round), never on the
  // first load or on reconnect into an ongoing game.
  const gameId = room?.game?.gameId ?? null;
  const activeThreatCardId = room?.game?.activeThreatCardId ?? null;
  useEffect(() => {
    if (!gameId) {
      lastThreatRef.current = { gameId: null, threatId: null };
      return;
    }
    const prev = lastThreatRef.current;
    if (prev.gameId !== gameId) {
      // New game or first sight of this game: adopt current threat silently.
      lastThreatRef.current = { gameId, threatId: activeThreatCardId };
      return;
    }
    if (activeThreatCardId && activeThreatCardId !== prev.threatId) {
      setThreatReveal(activeThreatCardId);
    }
    lastThreatRef.current = { gameId, threatId: activeThreatCardId };
  }, [gameId, activeThreatCardId]);

  // Auto-dismiss the threat announcement after 5s.
  useEffect(() => {
    if (!threatReveal) return;
    const timer = setTimeout(() => setThreatReveal(null), 5000);
    return () => clearTimeout(timer);
  }, [threatReveal]);

  const threatRevealDefinition = threatReveal ? threatCardsById.get(threatReveal) ?? null : null;

  const activeScenarioKey = activeScenarioDefinitions.map((scenario) => scenario.id).join("|");
  useEffect(() => {
    if (activeScenarioKey) {
      setScenarioDockOpen(true);
    } else {
      setScenarioDockOpen(false);
    }
  }, [activeScenarioKey]);
  useEffect(() => {
    if (!selectedOpponentPlayerId) {
      return;
    }
    if (!hasStartedGame || cleanBoardMode || !opponentInspectorEntries.some((entry) => entry.player.playerId === selectedOpponentPlayerId)) {
      setSelectedOpponentPlayerId(null);
    }
  }, [cleanBoardMode, hasStartedGame, opponentInspectorEntries, selectedOpponentPlayerId]);
  const botTurnDelayMs = isLocalRoom
    ? room?.botTurnDelayMs ?? localBotTurnDelayMs
    : room?.botTurnDelayMs ?? defaultBotTurnDelayMs;
  const turnTimerMs = room?.turnTimerMs ?? null;
  const showTurnCountdown = Boolean(
    !isLocalRoom && room?.game?.status === "active" && turnTimerMs && room?.activeTurnStartedAt
  );
  const forestCards = room?.game?.forest.cards ?? createPreviewInitialForest();
  const pieces = room?.game?.pieces ?? [];

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
  const boardChoiceActive =
    canPlaceSetupPiece ||
    Boolean(pendingPlacement) ||
    displayExpansionTargets.length > 0 ||
    displayRotateFitTargets.length > 0 ||
    displayMovementTargets.length > 0 ||
    displayAddPieceTargets.length > 0 ||
    displayCoatiPairBonusTargets.length > 0;
  useEffect(() => {
    if (!isMobile || !boardChoiceActive) return;
    setMobileSheet((current) => (current === "jogadores" || current === "mao" ? null : current));
  }, [isMobile, boardChoiceActive]);
  const roomWarnings = useMemo(() => {
    const warnings = [...(room?.warnings ?? []), ...(room?.game?.contentWarnings ?? [])];
    return [...new Set(warnings)];
  }, [room]);

  function closeTurnRecap(): void {
    setTurnRecap((current) => ({ ...current, visible: false }));
    setHoveredSummaryCardIds([]);
  }

  function handleMobileTabSelect(id: MobileTabId): void {
    setMobileSheet((current) => {
      const next = current === id ? null : id;
      if (next === "acao") setHudLeftCollapsed(false);
      if (next === "mao") setHandCollapsed(false);
      if (next === "jogadores") {
        setSelectedOpponentPlayerId((currentId) => currentId ?? opponentInspectorEntries[0]?.player.playerId ?? null);
      }
      if (next === "resumo") setRecapCollapsed(false);
      return next;
    });
  }

  function toggleCleanBoardMode(): void {
    setCleanBoardMode((value) => {
      const next = !value;
      if (next) {
        setConfigOpen(false);
        setMovementPreview(null);
        setHoveredSummaryCardIds([]);
      }
      return next;
    });
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

  useEffect(() => {
    if (selectedHandCardId && !handCards.some((card) => card.id === selectedHandCardId)) {
      setSelectedHandCardId(null);
      setSelectedCardRotation(0);
    }
  }, [handCards, selectedHandCardId]);

  useEffect(() => {
    if (selectedPieceId && !selectablePieceIds.includes(selectedPieceId)) {
      setSelectedPieceId(null);
    }
  }, [selectablePieceIds, selectedPieceId]);

  useEffect(() => {
    if (selectedJaguarTargetPieceId && !jaguarTargetPieceIds.includes(selectedJaguarTargetPieceId)) {
      setSelectedJaguarTargetPieceId(null);
    }
  }, [jaguarTargetPieceIds, selectedJaguarTargetPieceId]);

  useEffect(() => {
    if (selectedWolfTargetPieceId && !selectablePieceIds.includes(selectedWolfTargetPieceId)) {
      setSelectedWolfTargetPieceId(null);
    }
  }, [selectablePieceIds, selectedWolfTargetPieceId]);

  useEffect(() => {
    const nextSelected = selectedWolfResources.filter((resource) =>
      room?.game?.activePlayerId ? getWolfSpendableResourceTypes(room.game, room.game.activePlayerId).includes(resource) : false
    );
    if (nextSelected.length !== selectedWolfResources.length) {
      setSelectedWolfResources(nextSelected);
    }
  }, [room?.game, selectedWolfResources]);

  useEffect(() => {
    const nextSelected = selectedRemovalPieceIds.filter((pieceId) => selectablePieceIds.includes(pieceId));
    if (nextSelected.length !== selectedRemovalPieceIds.length) {
      setSelectedRemovalPieceIds(nextSelected);
    }
  }, [selectablePieceIds, selectedRemovalPieceIds]);
  useEffect(() => {
    if (!cacaIlegalPending || cacaIlegalPending.playerId !== controlledPlayerId) {
      setCacaIlegalRemovalMode(false);
    }
  }, [cacaIlegalPending, controlledPlayerId]);

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
      executeGameAction,
      requireSocket,
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
      executeGameAction,
      requireSocket,
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

  const setupSpecies = currentGamePlayer?.speciesId ? speciesDefinitions[currentGamePlayer.speciesId] : null;
  const setupPlaced = currentGamePlayer?.piecesInForest.length ?? 0;
  const setupNeeded = setupSpecies?.initialPieces ?? 0;
  const caatingaPending = room?.game?.caatingaPending ?? null;
  const caatingaGamePlayer = caatingaPending
    ? room?.game?.players.find((candidate) => candidate.playerId === caatingaPending.playerId) ?? null
    : null;
  const cacaIlegalGamePlayer = cacaIlegalPending
    ? room?.game?.players.find((candidate) => candidate.playerId === cacaIlegalPending.playerId) ?? null
    : null;
  const cacaIlegalTopResources = useMemo(
    () => (room?.game && cacaIlegalPending ? getCacaIlegalTopResources(room.game, cacaIlegalPending.playerId) : []),
    [cacaIlegalPending, room?.game]
  );
  const cacaIlegalRemovablePieceIds = useMemo(
    () => (room?.game && cacaIlegalPending ? getCacaIlegalRemovablePieceIds(room.game, cacaIlegalPending.playerId) : []),
    [cacaIlegalPending, room?.game]
  );
  const cacaIlegalRemovablePieces = useMemo(
    () =>
      room?.game
        ? cacaIlegalRemovablePieceIds
            .map((pieceId) => room.game!.pieces.find((piece) => piece.pieceId === pieceId) ?? null)
            .filter((piece): piece is NonNullable<typeof piece> => Boolean(piece))
        : [],
    [cacaIlegalRemovablePieceIds, room?.game]
  );
  const cerradoPending = room?.game?.cerradoPending ?? null;
  const cerradoGamePlayer = cerradoPending
    ? room?.game?.players.find((candidate) => candidate.playerId === cerradoPending.playerId) ?? null
    : null;
  const canResolveCacaIlegal = Boolean(cacaIlegalPending && controlledPlayerId === cacaIlegalPending.playerId);
  const canResolveCaatinga = Boolean(caatingaPending && controlledPlayerId === caatingaPending.playerId);
  const canResolveCerrado = Boolean(!caatingaPending && !cacaIlegalPending && cerradoPending && controlledPlayerId === cerradoPending.playerId);
  const pendingExtraTurnPlayer = room?.game?.pendingExtraTurnPlayerId
    ? room.game.players.find((player) => player.playerId === room.game?.pendingExtraTurnPlayerId) ?? null
    : null;
  const canResolveExtraTurn = Boolean(
    room?.game?.pendingExtraTurnPlayerId && (isLocalRoom || controlledPlayerId === room.game.pendingExtraTurnPlayerId)
  );
  const pendingSeedSpendPlayer = room?.game?.pendingSeedSpendObjectivePlayerId
    ? room.game.players.find((player) => player.playerId === room.game?.pendingSeedSpendObjectivePlayerId) ?? null
    : null;
  const pendingSeedSpendCard = pendingSeedSpendPlayer?.selectedObjectiveCardId
    ? getObjectiveCardDefinition(pendingSeedSpendPlayer.selectedObjectiveCardId)
    : null;
  const pendingSeedSpendCount = pendingSeedSpendCard?.scoring.spendSeedCount ?? 3;
  const pendingSeedSpendPoints = pendingSeedSpendCard?.scoring.points ?? 3;
  const pendingSeedSpendSeeds = pendingSeedSpendPlayer?.resources.seed ?? 0;
  const canResolveSeedSpend = Boolean(
    room?.game?.pendingSeedSpendObjectivePlayerId &&
      !room.game.pendingExtraTurnPlayerId &&
      (isLocalRoom || controlledPlayerId === room.game.pendingSeedSpendObjectivePlayerId)
  );

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
  const mataAtlanticaForcedDiscard = Boolean(
    room?.game &&
      room.game.status === "active" &&
      room.game.mataAtlanticaPiles &&
      currentGamePlayer?.speciesId &&
      !speciesDefinitions[currentGamePlayer.speciesId].usesForestCards &&
      room.game.activePlayerId === currentGamePlayer.playerId &&
      controlledPlayerId === currentGamePlayer.playerId &&
      (room.game.mataAtlanticaDiscardByPlayer ?? {})[currentGamePlayer.playerId] !== currentGamePlayer.turnsTaken &&
      mataAtlanticaPileTopIds.length > 0 &&
      !caatingaPending &&
      !cerradoPending &&
      !cacaIlegalPending
  );

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

  return (
    <main
      className={`app-shell ${hasStartedGame ? "game-active" : "menu-active"} ${
        isMobile && hasStartedGame && !cleanBoardMode ? "mobile-hud" : ""
      } ${!isBasicTutorial && currentGamePlayer?.speciesId === "jaguar" ? "is-jaguar-active" : ""} ${
        !isBasicTutorial && currentGamePlayer?.speciesId === "maned_wolf" ? "is-wolf-active" : ""
      } ${!isBasicTutorial && currentGamePlayer?.speciesId === "armadillo" ? "is-armadillo-active" : ""} ${
        !isBasicTutorial && currentGamePlayer?.speciesId === "macaw" ? "is-macaw-active" : ""
      } ${!isBasicTutorial && currentGamePlayer?.speciesId === "capuchin" ? "is-capuchin-active" : ""} ${
        !isBasicTutorial && currentGamePlayer?.speciesId === "coati" ? "is-coati-active" : ""
      } ${!isBasicTutorial && currentGamePlayer?.speciesId === "galo_de_campina" ? "is-galo-active" : ""} ${
        visualAccessibility ? "accessibility-visual-mode" : ""
      }`}
      data-visual-accessibility={visualAccessibility ? "true" : "false"}
      data-sheet={isMobile && hasStartedGame && !cleanBoardMode ? mobileSheet ?? "none" : undefined}
    >
      {!hasStartedGame && (
        <div className="account-badge">
          <span>{authUser.email}</span>
          <button type="button" onClick={onSignOut} aria-label="Sair da conta">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      )}
      {cacaIlegalPending && canResolveCacaIlegal && !cacaIlegalRemovalMode && (
        <CacaIlegalChoiceModal
          playerName={cacaIlegalGamePlayer?.name ?? "Jogador"}
          topResources={cacaIlegalTopResources}
          resources={cacaIlegalGamePlayer?.resources ?? {}}
          hasRemovablePieces={cacaIlegalRemovablePieces.length > 0}
          onSpendResource={(resource) => resolveCacaIlegalChoice({ kind: "spend_resource", resource })}
          onEnterRemovalMode={enterCacaIlegalRemovalMode}
        />
      )}
      {cacaIlegalPending && canResolveCacaIlegal && cacaIlegalRemovalMode && (
        <CacaIlegalRemovalBanner
          selectedCount={selectedRemovalPieceIds.length}
          confirmDisabled={selectedRemovalPieceIds.length !== 1}
          onConfirm={resolveSelectedCacaIlegalPiece}
          onBack={clearCacaIlegalRemoval}
        />
      )}
      {caatingaPending && canResolveCaatinga && (
        <CaatingaChoiceModal
          playerName={caatingaGamePlayer?.name ?? "Jogador"}
          trigger={caatingaPending.trigger}
          resource={caatingaPending.resource}
          currentResourceCount={caatingaGamePlayer?.resources[caatingaPending.resource] ?? 0}
          onChoice={resolveCaatingaChoice}
        />
      )}
      {cerradoPending && canResolveCerrado && (
        <CerradoChoiceModal
          playerName={cerradoGamePlayer?.name ?? "Jogador"}
          resource={cerradoPending.resource}
          onChoice={resolveCerradoChoice}
        />
      )}
      {room?.game?.pendingExtraTurnPlayerId && canResolveExtraTurn && (
        <ExtraTurnObjectiveModal
          playerName={pendingExtraTurnPlayer?.name ?? "Jogador"}
          acceptDisabled={(pendingExtraTurnPlayer?.score ?? 0) < 1}
          onResolve={resolveExtraTurnChoice}
        />
      )}
      {room?.game?.pendingSeedSpendObjectivePlayerId && canResolveSeedSpend && (
        <SeedSpendObjectiveModal
          playerName={pendingSeedSpendPlayer?.name ?? "Jogador"}
          spendCount={pendingSeedSpendCount}
          points={pendingSeedSpendPoints}
          acceptDisabled={pendingSeedSpendSeeds < pendingSeedSpendCount}
          onResolve={resolveSeedSpendChoice}
        />
      )}
      {mataAtlanticaForcedDiscard && (
        <MataAtlanticaDiscardModal
          playerName={currentGamePlayer?.name ?? "Jogador"}
          pileTopIds={mataAtlanticaPileTopIds}
          onDiscard={resolveMataAtlanticaDiscard}
        />
      )}
      {travelEffects.length > 0 && (
        <div className="travel-effect-layer" aria-hidden="true">
          {travelEffects.map((effect) => {
            const src =
              effect.kind === "resource" && effect.resource
                ? resourceAssets[effect.resource]
                : effect.speciesId
                  ? speciesDefinitions[effect.speciesId].meepleAsset
                  : resourceAssets.point;

            return (
              <span
                className={`travel-effect ${effect.kind}`}
                key={effect.id}
                style={
                  {
                    "--from-x": `${effect.from.x}px`,
                    "--from-y": `${effect.from.y}px`,
                    "--to-x": `${effect.to.x}px`,
                    "--to-y": `${effect.to.y}px`
                  } as CSSProperties
                }
              >
                <img src={encodeURI(src)} alt="" />
              </span>
            );
          })}
        </div>
      )}
      {!cleanBoardMode && macawScoreAnim && (
        // The scoring lines themselves are drawn on the board by the Phaser scene
        // (scoringLineHighlights); this panel just narrates the result.
        <div className="macaw-score-panel" role="status">
          <div className="macaw-score-panel-icon">
            <img src={encodeURI(speciesDefinitions.macaw.meepleAsset)} alt="" />
          </div>
          <div className="macaw-score-panel-text">
            <small>{macawScoreAnim.playerName}</small>
            <strong>
              {macawScoreAnim.points} linha{macawScoreAnim.points > 1 ? "s" : ""} de 3 araras
            </strong>
            <span className="macaw-score-panel-total">
              = <em>+{macawScoreAnim.points}</em> ponto{macawScoreAnim.points > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
      {!cleanBoardMode && capuchinScoreAnim && (
        // The scored habitat cards are highlighted on the board by the Phaser
        // scene (scoringCardHighlights); this panel narrates the result.
        <div className="capuchin-score-panel" role="status">
          <div className="capuchin-score-panel-icon">
            <img src={encodeURI(speciesDefinitions.capuchin.meepleAsset)} alt="" />
          </div>
          <div className="capuchin-score-panel-text">
            <small>{capuchinScoreAnim.playerName}</small>
            <strong>
              {capuchinScoreAnim.points} habitat{capuchinScoreAnim.points > 1 ? "s" : ""} com 2+ macacos
            </strong>
            <span className="capuchin-score-panel-total">
              = <em>+{capuchinScoreAnim.points}</em> ponto{capuchinScoreAnim.points > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
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
        <div className="flow-screen flow-screen-join" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-2" />
          </div>

          <header className="flow-header">
            <button
              type="button"
              className="flow-back"
              onClick={() => setLandingMode("idle")}
              aria-label="Voltar"
            >
              <ChevronLeft aria-hidden="true" />
              <span>Voltar</span>
            </button>
            <div className="landing-logo flow-logo">
              <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.webp" alt="Oikos" />
            </div>
            <span className="flow-spacer" aria-hidden="true" />
          </header>

          <div className="flow-body">
            <div className="flow-icon-large">
              <Play aria-hidden="true" />
            </div>
            <h2 className="flow-title">Criar Sala</h2>
            <p className="flow-subtitle">
              Hospede uma partida online. Deixe a senha em branco para uma sala pública.
            </p>

            <form
              className="flow-card flow-card-join"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () => roomApi.create(requireSocket(), name, createPassword || null),
                  "Sala criada."
                );
              }}
            >
              <label className="landing-name-field flow-name">
                <Users aria-hidden="true" />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={24}
                  placeholder="Seu nome"
                />
              </label>

              <label className="landing-name-field flow-name">
                <Lock aria-hidden="true" />
                <input
                  type="password"
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                  maxLength={32}
                  placeholder="Senha (opcional)"
                  autoComplete="new-password"
                />
              </label>

              <button type="submit" className="flow-submit">
                <Play aria-hidden="true" />
                Criar Sala
              </button>
              <small className="flow-spectate-hint">
                {createPassword
                  ? "Sala privada: só entra quem tiver o código e a senha."
                  : "Sala pública: aparece na lista de salas abertas."}
              </small>
            </form>
          </div>
        </div>
      )}

      {!hasStartedGame && !room && landingMode === "join" && (
        <div className="flow-screen flow-screen-join" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-2" />
          </div>

          <header className="flow-header">
            <button
              type="button"
              className="flow-back"
              onClick={() => setLandingMode("idle")}
              aria-label="Voltar"
            >
              <ChevronLeft aria-hidden="true" />
              <span>Voltar</span>
            </button>
            <div className="landing-logo flow-logo">
              <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.webp" alt="Oikos" />
            </div>
            <span className="flow-spacer" aria-hidden="true" />
          </header>

          <div className="flow-body">
            <div className="flow-icon-large">
              <LogIn aria-hidden="true" />
            </div>
            <h2 className="flow-title">Entrar em Sala</h2>
            <p className="flow-subtitle">
              Escolha uma sala aberta na lista ou digite o código compartilhado pelo anfitrião.
            </p>

            <div className="flow-card flow-rooms-card">
              <div className="flow-rooms-header">
                <span className="flow-code-label">Salas abertas</span>
                <button
                  type="button"
                  className="icon-button compact"
                  title="Atualizar lista"
                  aria-label="Atualizar lista"
                  onClick={refreshRooms}
                >
                  <RotateCw aria-hidden="true" />
                </button>
              </div>

              {openRooms.length === 0 ? (
                <p className="flow-rooms-empty">
                  {roomsLoading ? "Procurando salas…" : "Nenhuma sala aberta no momento. Crie uma ou use um código."}
                </p>
              ) : (
                <ul className="flow-rooms-list">
                  {openRooms.map((summary) => {
                    const full = summary.playerCount >= summary.maxPlayers;
                    const joinable = summary.status === "lobby" && !full;
                    return (
                      <li key={summary.roomId}>
                        <button
                          type="button"
                          className="flow-room-row"
                          onClick={() => {
                            if (joinable) {
                              void run(
                                () => roomApi.join(requireSocket(), summary.roomId, name),
                                "Entrada confirmada."
                              );
                            } else {
                              void spectate(summary.roomId);
                            }
                          }}
                        >
                          <span className="flow-room-main">
                            <strong>{summary.roomId}</strong>
                            <small>{summary.hostName}</small>
                          </span>
                          <span className="flow-room-meta">
                            <span className="flow-room-players">
                              <Users aria-hidden="true" />
                              {summary.playerCount}/{summary.maxPlayers}
                            </span>
                            {summary.spectatorCount > 0 && (
                              <span className="flow-room-spectators">
                                <Eye aria-hidden="true" />
                                {summary.spectatorCount}
                              </span>
                            )}
                            <span className={`flow-room-status ${summary.status}`}>
                              {summary.status === "lobby"
                                ? full
                                  ? "Cheia · assistir"
                                  : "Aguardando"
                                : "Em jogo · assistir"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <form
              className="flow-card flow-card-join"
              onSubmit={(event) => {
                event.preventDefault();
                if (joinCode.length >= 4) {
                  void run(
                    () => roomApi.join(requireSocket(), joinCode, name, joinPassword || null),
                    "Entrada confirmada."
                  );
                }
              }}
            >
              <label className="landing-name-field flow-name">
                <Users aria-hidden="true" />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={24}
                  placeholder="Seu nome"
                />
              </label>

              <div className="flow-code-field">
                <span className="flow-code-label">Código da sala</span>
                <input
                  className="landing-code-input flow-code-input"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ABCDE"
                  maxLength={5}
                />
              </div>

              <label className="landing-name-field flow-name">
                <Lock aria-hidden="true" />
                <input
                  type="password"
                  value={joinPassword}
                  onChange={(event) => setJoinPassword(event.target.value)}
                  maxLength={32}
                  placeholder="Senha (se a sala for privada)"
                  autoComplete="off"
                />
              </label>

              <button type="submit" className="flow-submit" disabled={joinCode.length < 4}>
                <LogIn aria-hidden="true" />
                Entrar para Jogar
              </button>

              <button
                type="button"
                className="flow-submit flow-submit-ghost"
                disabled={joinCode.length < 4}
                onClick={() => {
                  if (joinCode.length >= 4) {
                    void spectate(joinCode, joinPassword || null);
                  }
                }}
              >
                <Eye aria-hidden="true" />
                Entrar como Espectador
              </button>
              <small className="flow-spectate-hint">
                Espectador assiste à partida sem ocupar uma vaga de jogador.
              </small>
            </form>
          </div>
        </div>
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

      {hasStartedGame && !cleanBoardMode && room?.game && (
        <div className="hud-round-indicator" aria-label={`Rodada ${room.game.round} de ${room.game.maxRounds}`}>
          Rodada {room.game.round}/{room.game.maxRounds}
        </div>
      )}

      {hasStartedGame && (
        <button
          type="button"
          className={`clean-board-toggle ${cleanBoardMode ? "is-clean" : ""}`}
          title={cleanBoardMode ? "Mostrar HUD" : "Ocultar HUD"}
          aria-label={cleanBoardMode ? "Mostrar HUD" : "Ocultar HUD"}
          aria-pressed={cleanBoardMode}
          onClick={toggleCleanBoardMode}
        >
          {cleanBoardMode ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      )}

      {hasStartedGame && !cleanBoardMode && (
        <button
          type="button"
          className="hud-config-btn"
          title="Mesa e configurações"
          aria-label="Mesa e configurações"
          onClick={() => setConfigOpen(true)}
        >
          <Settings aria-hidden="true" />
        </button>
      )}

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

      {hasStartedGame && !cleanBoardMode && isSpectator && (
        <div className="spectator-banner" role="status">
          <Eye aria-hidden="true" />
          <span>Modo espectador</span>
          <button type="button" className="spectator-leave" onClick={leaveTable} title="Sair">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      )}

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
          {!cleanBoardMode && turnBanner && (
            <div
              className="turn-banner"
              key={turnBanner.key}
              style={speciesVar(turnBanner.speciesId)}
              role="status"
            >
              {turnBanner.speciesId && (
                <img src={encodeURI(speciesDefinitions[turnBanner.speciesId].portraitAsset)} alt="" />
              )}
              <span className="turn-banner-label">Vez:</span>
              <strong>{turnBanner.label}</strong>
            </div>
          )}
          {galoInterrupt && (
            <div
              className={`galo-interrupt-badge ${isCurrentGaloInterruptOwner ? "is-owner" : "is-waiting"}`}
              style={speciesVar("galo_de_campina")}
              role="status"
            >
              <span>{isCurrentGaloInterruptOwner ? "Sua reacao" : "Turno pausado"}</span>
              <strong>
                {isCurrentGaloInterruptOwner
                  ? "Mova 1 galo"
                  : `Aguardando ${galoInterruptOwner?.name ?? "Galo"}`}
              </strong>
            </div>
          )}
          {galoInterrupt && (isCurrentGaloInterruptOwner || visibleGaloInterruptBannerKey === galoInterruptKey) && (
            <div
              className={`galo-interrupt-banner ${isCurrentGaloInterruptOwner ? "is-owner" : "is-waiting"}`}
              style={speciesVar("galo_de_campina")}
              role="status"
            >
              <span>{isCurrentGaloInterruptOwner ? "Entre turnos" : "Turno pausado"}</span>
              <strong>{galoInterruptBannerText}</strong>
              <small>
                {isCurrentGaloInterruptOwner
                  ? "Selecione o galo no local de campo e clique em um destino adjacente."
                  : `${interruptedGaloPlayer?.name ?? "Jogador ativo"} continua depois desta reacao.`}
              </small>
            </div>
          )}
          {isCurrentPlayerWaitingForGaloInterrupt && (
            <div className="galo-interrupt-wait-overlay" aria-hidden="true" />
          )}
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
                      ? "Clique em uma carta de campo para adicionar 1 galo"
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
          <section className={`table-hand ${handCollapsed ? "collapsed" : ""}`} aria-label="Mão de cartas">
            {handCards.length > 0 && (
              <button
                type="button"
                className="hand-sort-toggle"
                title={`Organizar por ${nextHandSortLabel}`}
                aria-label={`Mão organizada por ${handSortLabel}. Clique para organizar por ${nextHandSortLabel}.`}
                onClick={() => setHandSortMode(nextHandSortMode)}
              >
                <ListFilter aria-hidden="true" />
                <span>Organizar</span>
                <strong>{handSortLabel}</strong>
              </button>
            )}
            <div className="hand-header">
              <div>
                <span>Mão · {handCards.length} cartas</span>
                <strong>
                  {isBasicTutorial
                    ? "Cartas do tutorial"
                    : currentGamePlayer.speciesId
                      ? speciesDefinitions[currentGamePlayer.speciesId].displayName
                      : "Espécie"}
                </strong>
              </div>
              <div className="hand-header-side">
                <button
                  type="button"
                  className="hand-toggle"
                  title={handCollapsed ? "Expandir" : "Recolher"}
                  aria-label={handCollapsed ? "Expandir mão de cartas" : "Recolher mão de cartas"}
                  onClick={() => setHandCollapsed((value) => !value)}
                >
                  {handCollapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                </button>
              </div>
            </div>
            {(!handCollapsed ||
              (!isBasicTutorial &&
                (currentGamePlayer?.speciesId === "maned_wolf" || currentGamePlayer?.speciesId === "armadillo"))) &&
              (handCards.length > 0 ? (
                <div
                  className={`hand-rail ${selectedHandCardId ? "has-selection" : ""} ${
                    handPlayableThisAction ? "hand-playable" : "hand-idle"
                  }`}
                  style={{ ["--hand-count" as string]: sortedHandCards.length }}
                >
                  {sortedHandCards.map(({ card }, handIndex) => {
                    const isSelected = selectedHandCardId === card.id;
                    const showRotate = isSelected && canPlaceSelectedForestCard;

                    return (
                      <div
                        key={card.id}
                        role="button"
                        tabIndex={canSelectHandCards ? 0 : -1}
                        data-card-id={card.id}
                        className={`hand-card ${isSelected ? "selected" : ""} ${
                          handPlayableThisAction ? "playable" : "not-playable"
                        } ${
                          tutorialRequiredCardId === card.id ? "tutorial-marked" : ""
                        }`}
                        style={{ ["--hand-index" as string]: handIndex }}
                        onClick={() => {
                          if (!canSelectHandCards) {
                            return;
                          }
                          setSelectedHandCardId((current) => {
                            const next = current === card.id ? null : card.id;
                            if (next !== current) {
                              setSelectedCardRotation(0);
                            }
                            return next;
                          });
                        }}
                        onKeyDown={(event) => {
                          if (!canSelectHandCards) {
                            return;
                          }
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedHandCardId((current) => {
                              const next = current === card.id ? null : card.id;
                              if (next !== current) {
                                setSelectedCardRotation(0);
                              }
                              return next;
                            });
                          }
                        }}
                      >
                        <img
                          src={encodeURI(card.imagePath)}
                          alt={card.label}
                          style={isSelected ? { transform: `rotate(${selectedCardRotation}deg)` } : undefined}
                        />
                        {mataAtlanticaPileIndexByCardId.has(card.id) && (
                          <span className="pile-badge" aria-label={`Topo da pilha ${(mataAtlanticaPileIndexByCardId.get(card.id) ?? 0) + 1}`}>
                            P{(mataAtlanticaPileIndexByCardId.get(card.id) ?? 0) + 1}
                          </span>
                        )}
                        {showRotate && (
                          <div className="card-rotate" onClick={(event) => event.stopPropagation()}>
                            <button
                              type="button"
                              title="Girar à esquerda (Q)"
                              aria-label="Girar à esquerda"
                              onClick={() => rotateSelectedCard(-1)}
                            >
                              <RotateCcw aria-hidden="true" />
                              <kbd>Q</kbd>
                            </button>
                            <span>{selectedCardRotation}°</span>
                            <button
                              type="button"
                              title="Girar à direita (E)"
                              aria-label="Girar à direita"
                              onClick={() => rotateSelectedCard(1)}
                            >
                              <RotateCw aria-hidden="true" />
                              <kbd>E</kbd>
                            </button>
                          </div>
                        )}
                        {(() => {
                          if (!room?.game?.mataAtlanticaPiles) return null;
                          if (!currentGamePlayer?.speciesId) return null;
                          if (speciesDefinitions[currentGamePlayer.speciesId].usesForestCards) return null;
                          if (room.game.activePlayerId !== currentGamePlayer.playerId) return null;
                          if (!mataAtlanticaPileIndexByCardId.has(card.id)) return null;
                          if (
                            (room.game.mataAtlanticaDiscardByPlayer ?? {})[currentGamePlayer.playerId] ===
                            currentGamePlayer.turnsTaken
                          )
                            return null;
                          return (
                            <button
                              type="button"
                              className="mata-discard-btn"
                              title="Descartar (Mata Atlântica)"
                              onClick={(event) => {
                                event.stopPropagation();
                                resolveMataAtlanticaDiscard(card.id);
                              }}
                            >
                              <X aria-hidden="true" />
                              <span>Descartar</span>
                            </button>
                          );
                        })()}
                      </div>
                    );
                  })}

                </div>
              ) : (
                <p className="empty-state">
                  {currentGamePlayer.speciesId === "jaguar"
                    ? "Esta espécie não usa cartas de floresta na mão."
                    : "Sem cartas de floresta na mão."}
                </p>
              ))}
          </section>
        )}

      {!cleanBoardMode && needsObjectiveChoice && (
        <div className="choice-modal-backdrop objective-choice-backdrop" role="presentation">
          <div className="choice-modal objective-choice-modal" role="dialog" aria-modal="true" aria-label="Escolha objetivo">
            <header className="objective-choice-header">
              <span className="objective-choice-eyebrow">
                <Trophy aria-hidden="true" /> Carta de objetivo
              </span>
              <h2>Escolha seu objetivo</h2>
              <p>Fique com 1 carta. A outra será descartada.</p>
            </header>
            <div className="objective-choice-grid">
              {objectiveChoices.map((card, index) => {
                const isPending = pendingObjectiveCardId === card.id;
                return (
                  <div
                    className={`objective-choice-card ${isPending ? "is-pending" : ""} ${
                      pendingObjectiveCardId && !isPending ? "is-dimmed" : ""
                    }`}
                    key={card.id}
                  >
                    <button
                      type="button"
                      className="objective-choice-pick"
                      disabled={Boolean(pendingObjectiveCardId)}
                      onClick={() => {
                        void handleSelectObjective(card.id);
                      }}
                    >
                      <span className="objective-choice-badge">{index + 1}</span>
                      <span className="objective-choice-art">
                        <img src={encodeURI(card.imagePath)} alt={card.label} />
                      </span>
                      <span className="objective-choice-cta">
                        {isPending ? (
                          <>
                            <Check aria-hidden="true" /> Objetivo escolhido
                          </>
                        ) : (
                          "Escolher este objetivo"
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="objective-choice-zoom"
                      aria-label="Ampliar carta"
                      title="Ampliar"
                      onClick={() => setExpandedObjectiveCardId(card.id)}
                    >
                      <Eye aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
              <span className="objective-choice-or" aria-hidden="true">ou</span>
            </div>
          </div>
        </div>
      )}

      {expandedObjectiveCardId && (
        <div className="choice-modal-backdrop objective-preview-backdrop" role="presentation" onClick={() => setExpandedObjectiveCardId(null)}>
          <div className="objective-preview-modal" role="dialog" aria-modal="true" aria-label="Carta de objetivo" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="board-modal-close objective-preview-close"
              aria-label="Fechar objetivo"
              onClick={() => setExpandedObjectiveCardId(null)}
            >
              <X aria-hidden="true" />
            </button>
            <img
              src={encodeURI(getObjectiveCardDefinition(expandedObjectiveCardId).imagePath)}
              alt={getObjectiveCardDefinition(expandedObjectiveCardId).label}
            />
            {canDiscardSelectedObjective && expandedObjectiveCardId === currentGamePlayer?.selectedObjectiveCardId && (
              <button
                type="button"
                className="objective-discard-btn objective-preview-discard-btn"
                onClick={() => void handleDiscardObjective()}
              >
                <Leaf aria-hidden="true" />
                <span className="objective-discard-text">
                  <strong>Descartar</strong>
                  <small>Ganhe 1 de cada recurso</small>
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {hasStartedGame && !cleanBoardMode && !tutorialActive && opponentInspectorEntries.length > 0 && (
        <aside className="opponent-inspector" aria-label="Consultar outros jogadores">
          <div className="opponent-rail" role="list">
            {opponentInspectorEntries.map(({ player, gamePlayer, species, displayIndex, isActivePlayer }) => (
              <button
                type="button"
                role="listitem"
                ref={(node) => setEffectTarget(`portrait:${player.playerId}`, node)}
                className={`opponent-portrait-btn ${selectedOpponentPlayerId === player.playerId ? "is-selected" : ""} ${
                  isActivePlayer ? "is-active-turn" : ""
                }`}
                key={player.playerId}
                style={speciesVar(player.speciesId)}
                data-species={player.speciesId ?? undefined}
                title={species ? `Ver ${species.displayName}` : player.name}
                aria-label={species ? `Ver informações de ${species.displayName}` : `Ver informações de ${player.name}`}
                aria-pressed={selectedOpponentPlayerId === player.playerId}
                onClick={() =>
                  setSelectedOpponentPlayerId((current) => (current === player.playerId ? null : player.playerId))
                }
              >
                {species ? (
                  <span
                    className="opponent-portrait-image"
                    style={{
                      backgroundImage: `url("${encodeURI(getOpenPortraitAsset(species.portraitAsset))}")`
                    }}
                    aria-hidden="true"
                  />
                ) : (
                  <span>{displayIndex + 1}</span>
                )}
                {isActivePlayer && <i aria-hidden="true" />}
                {gamePlayer && (
                  <em aria-label={`${gamePlayer.score} pontos`}>
                    <img src={encodeURI(resourceAssets.point)} alt="" />
                    {gamePlayer.score}
                  </em>
                )}
                {gamePlayer && (
                  <span className="opponent-portrait-leaders" aria-hidden="true">
                    {(["meat", "egg", "fruit"] as const)
                      .filter((resource) => resourceLeaders[resource]?.has(gamePlayer.playerId))
                      .map((resource) => (
                        <span
                          key={resource}
                          className="opponent-portrait-leader"
                          data-resource={resource}
                          title={`Maioria de ${resourceLabels[resource]}: ${gamePlayer.resources[resource]}`}
                        >
                          <img src={encodeURI(resourceAssets[resource])} alt="" />
                          <b>{gamePlayer.resources[resource]}</b>
                        </span>
                      ))}
                  </span>
                )}
              </button>
            ))}
          </div>

          {selectedOpponentEntry?.gamePlayer && selectedOpponentEntry.species && (
            <section
              className="opponent-popover"
              data-species={selectedOpponentEntry.gamePlayer.speciesId}
              style={
                {
                  ...speciesVar(selectedOpponentEntry.gamePlayer.speciesId),
                  "--opponent-arrow-index": selectedOpponentRailIndex
                } as CSSProperties
              }
              aria-label={`Resumo de ${selectedOpponentEntry.species.displayName}`}
            >
              <button
                type="button"
                className="opponent-close opponent-close-floating"
                aria-label="Fechar resumo"
                onClick={() => setSelectedOpponentPlayerId(null)}
              >
                <X aria-hidden="true" />
              </button>

              <div className="opponent-resource-grid">
                {resourceOrder.map((resource) => {
                  const isLeader = resourceLeaders[resource]?.has(selectedOpponentEntry.gamePlayer!.playerId) ?? false;
                  return (
                    <span
                      className={`opponent-resource ${isLeader ? "is-leader" : ""}`}
                      data-resource={resource}
                      key={resource}
                      title={isLeader ? `${resourceLabels[resource]} · maioria` : resourceLabels[resource]}
                      ref={(node) => setEffectTarget(`${selectedOpponentEntry.gamePlayer!.playerId}:${resource}`, node)}
                    >
                      <img src={encodeURI(resourceAssets[resource])} alt="" />
                      <small>{resourceLabels[resource]}</small>
                      <strong><AnimatedNumber value={selectedOpponentEntry.gamePlayer!.resources[resource] ?? 0} /></strong>
                    </span>
                  );
                })}
              </div>

              <div className="opponent-movement-grid" role="list" aria-label="Movimentos por habitat">
                {(["forest", "field", "river"] as const).map((habitat) => {
                  const kind = selectedOpponentEntry.species!.movementPatternsByHabitat[habitat];
                  return (
                    <span
                      key={habitat}
                      role="listitem"
                      className={`opponent-movement is-${habitat}`}
                      title={`${habitatLabels[habitat]} · ${movementKindLabels[kind]}`}
                    >
                      <img
                        src={movementArtPath(habitat, kind)}
                        alt={`${habitatLabels[habitat]}: ${movementKindLabels[kind]}`}
                        className="opponent-movement-art"
                        draggable={false}
                      />
                    </span>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      )}

      {!cleanBoardMode && movementPreview && typeof document !== "undefined" && createPortal(
        <MovementGuideFloating
          speciesId={movementPreview.speciesId}
          left={movementPreview.left}
          top={movementPreview.top}
        />,
        document.body
      )}

      {!cleanBoardMode && shouldShowJaguarScoreModal && showJaguarScoreModal && (
        <JaguarScoreModal
          availablePointSpendCount={availableJaguarPointSpendCount}
          completeDisabled={tutorialActive}
          onSpend={handleSpendJaguarMeat}
          onComplete={handleCompleteAction}
        />
      )}

      {!cleanBoardMode && room?.game?.status === "finished" && room.game.finalScoreBreakdown && (
        <EndgameCeremony
          breakdown={room.game.finalScoreBreakdown}
          winnerPlayerIds={room.game.winnerPlayerIds}
          isLocalRoom={isLocalRoom}
          onPlayAgain={playAgainLocal}
          onLeave={leaveTable}
        />
      )}


      {!cleanBoardMode &&
        hasStartedGame &&
        !hasPendingCoatiPairBonus &&
        room?.game?.status === "active" &&
        activeGamePlayer &&
        activeSpecies?.speciesId === "maned_wolf" &&
        activeActionId === "C" &&
        canControlActivePlayer &&
        (!tutorialActive || tutorialId !== "wolf" || tutorialGate === "score") && (
          <WolfScoreModal
            resources={activeGamePlayer.resources}
            selectedResources={selectedWolfResources}
            spendableResources={wolfSpendableResources}
            availablePointSpendCount={availableWolfPointSpendCount}
            completeDisabled={tutorialActive}
            onToggleResource={(resource) =>
              setSelectedWolfResources((current) =>
                current.includes(resource)
                  ? current.filter((candidate) => candidate !== resource)
                  : current.length < availableWolfPointSpendCount
                    ? [...current, resource]
                    : current
              )
            }
            onSpend={handleSpendWolfResources}
            onComplete={handleCompleteAction}
          />
        )}

      {!cleanBoardMode && turnSummary && room?.game?.status === "active" && (
        <aside
          className={`turn-recap ${recapCollapsed ? "is-collapsed" : ""}`}
          role="status"
          aria-live="polite"
          aria-label="Resumo do turno anterior"
          style={speciesVar(turnSummary.speciesId)}
        >
          <header className="turn-recap-head">
            {turnSummary.speciesId && (
              <img src={encodeURI(speciesDefinitions[turnSummary.speciesId].meepleAsset)} alt="" />
            )}
            <div className="turn-recap-title">
              <span>Turno anterior</span>
              <h3>{turnSummary.playerName}</h3>
            </div>
            <div className="turn-recap-history" aria-label="Historico de turnos">
              <button
                type="button"
                className="turn-recap-history-btn"
                onClick={() => moveTurnRecapHistory(-1)}
                disabled={turnRecap.index <= 0}
                aria-label="Ver turno mais antigo"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <span>{turnRecap.index + 1}/{turnRecap.history.length}</span>
              <button
                type="button"
                className="turn-recap-history-btn"
                onClick={() => moveTurnRecapHistory(1)}
                disabled={turnRecap.index >= turnRecap.history.length - 1}
                aria-label="Ver turno mais recente"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
            <div className="turn-recap-score" title="Pontos no turno">
              <span>+{turnSummary.scoreDelta}</span>
              <small>pts</small>
            </div>
            <button
              type="button"
              className="turn-recap-toggle"
              onClick={() => setRecapCollapsed((value) => !value)}
              aria-label={recapCollapsed ? "Expandir resumo" : "Recolher resumo"}
              aria-expanded={!recapCollapsed}
            >
              {recapCollapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="turn-recap-close"
              onClick={closeTurnRecap}
              aria-label="Fechar resumo"
            >
              <X aria-hidden="true" />
            </button>
          </header>
          {!recapCollapsed && (
            <ul className="turn-recap-list">
              {turnSummary.entries.map((entry) => (
                <li
                  key={`${turnSummary.key}_${entry.id}`}
                  className={`turn-recap-item ${entry.cardInstanceIds.length > 0 ? "is-hoverable" : ""}`}
                  onMouseEnter={() => entry.cardInstanceIds.length > 0 && setHoveredSummaryCardIds(entry.cardInstanceIds)}
                  onMouseLeave={() => setHoveredSummaryCardIds([])}
                  onFocus={() => entry.cardInstanceIds.length > 0 && setHoveredSummaryCardIds(entry.cardInstanceIds)}
                  onBlur={() => setHoveredSummaryCardIds([])}
                  tabIndex={entry.cardInstanceIds.length > 0 ? 0 : -1}
                >
                  <span className={`turn-recap-icon turn-recap-icon-${entry.icon}`} aria-hidden="true" />
                  <span className="turn-recap-text">{entry.text}</span>
                  {typeof entry.points === "number" && entry.points > 0 && (
                    <span className="turn-recap-points">+{entry.points}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
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
