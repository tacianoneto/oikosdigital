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
  MAX_PLAYERS,
  TURN_TIMER_DEFAULT_MS,
  TURN_TIMER_OPTIONS_MS,
  areScenariosExclusive,
  formatTurnTimer
} from "@oikos/shared";
import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addGaloForCurrentAction,
  addGaloAdjacentForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  completeCurrentAction,
  createInitialGameState,
  createPreviewInitialForest,
  forceEndPlayerTurn,
  playBotStep,
  getArmadilloHidePieceIds,
  getAvailableForestExpansionPositions,
  getCapuchinScoringHabitats,
  type CapuchinHabitatGroup,
  getMacawScoringLines,
  type MacawScoringLine,
  getWolfSpendableResourceTypes,
  getCacaIlegalRemovablePieceIds,
  getCacaIlegalTopResources,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece,
  removeBasePieceForWolfAction,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus,
  resolveCacaIlegal,
  selectObjectiveCard,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing,
  scoreCapuchinHabitatPresence,
  scoreGaloSeedCards,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints,
  collectCaatingaBonus,
  collectCerradoBonus,
  discardMataAtlanticaPileCard,
  discardObjectiveForResources,
  resolveExtraTurnObjective,
  resolveSeedSpendObjective
} from "@oikos/rules";
import type {
  GameState,
  GridPosition,
  Habitat,
  MiniExpansionId,
  MovementKind,
  PlayerState,
  PublicRoomState,
  Resource,
  RoomPlayer,
  ScenarioCount,
  ScenarioCardDefinition,
  ScenarioCardId,
  SpeciesId,
  ThreatCardId
} from "@oikos/shared";
import type { ForestCanvasComponent, ForestCanvasHandle } from "../game/ForestCanvasTypes";
import { useActiveActionState } from "../hooks/useActiveActionState";
import { useActiveScoringState } from "../hooks/useActiveScoringState";
import { useAudioSettings } from "../hooks/useAudioSettings";
import { useBoardInteractionTargets } from "../hooks/useBoardInteractionTargets";
import type { HandSortMode } from "../hooks/playerCardState";
import { usePlayerCardState } from "../hooks/usePlayerCardState";
import { usePlayerHudState } from "../hooks/usePlayerHudState";
import { useLocalGameConfig } from "../hooks/useLocalGameConfig";
import { useOikosSocket } from "../hooks/useOikosSocket";
import { useOpenRoomsPolling } from "../hooks/useOpenRoomsPolling";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { useScoringPreview } from "../hooks/useScoringPreview";
import { useTutorialController } from "../hooks/useTutorialController";
import { useTurnTimer } from "../hooks/useTurnTimer";
import { roomApi, type OikosSocket } from "../socket";
import { LobbyScreen } from "./LobbyScreen";
import { LocalSetupScreen } from "./LocalSetupScreen";
import { MainMenuScreen, type LandingMode } from "./MainMenuScreen";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { playLogEvent } from "../ui/audio";
import { ActiveRulesDock } from "../ui/ActiveRulesDock";
import { EndgameCeremony } from "../ui/EndgameCeremony";
import {
  ExpansionPreviewOverlay,
  ThreatRevealOverlay,
  type ExpansionPreviewKind
} from "../ui/GameOverlays";
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
import { ScenarioDescription } from "../ui/ScenarioDescription";
import { TurnCountdown } from "../ui/TurnCountdown";
import { TutorialChapterSelect } from "../ui/TutorialChapterSelect";
import { TutorialCoach } from "../ui/TutorialCoach";
import { movementArtPath } from "../ui/movementArt";
import { isSmallScreen } from "../ui/responsive";
import { getVisualAccessibilityPreference, setVisualAccessibilityPreference } from "../ui/visualAccessibility";
import {
  SPECIES_HEX,
  botTurnDelayStepMs,
  categoryLabels,
  defaultBotTurnDelayMs,
  localRoomId,
  maxBotTurnDelayMs,
  maxTurnHistory,
  minBotTurnDelayMs,
  resourceOrder,
  speciesList
} from "../ui/gameConstants";
import type { FloatingGain, TravelEffect } from "../ui/gameEffects";
import { elementCenter, sameGridPosition } from "../ui/geometry";
import {
  clearOnlineSession,
  isMissingRoomError,
  saveOnlineSession
} from "../ui/session";
import { speciesVar } from "../ui/speciesStyle";
import { buildTurnSummaryEntries, type TurnRecapState, type TurnSummary } from "../ui/turnSummary";
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
  markTutorialDone,
  TUTORIAL_NONRIVER_CARD,
  type TutorialId,
  type TutorialStepDef
} from "../ui/tutorials";
import {
  getAddPieceHandler,
  getAuthDisplayName,
  getOpenPortraitAsset,
  movementKindLabels,
  SkipExtraTurnNoCardAction,
  SERVER_UNAVAILABLE_MESSAGE,
  TUTORIAL_ROOM_FACTORIES,
  type MobileSheet
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
  const [name, setName] = useState(defaultPlayerName);
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [isSpectator, setIsSpectator] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesId | "">("");
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
  const [expandedObjectiveCardId, setExpandedObjectiveCardId] = useState<string | null>(null);
  const [pendingObjectiveCardId, setPendingObjectiveCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handCollapsed, setHandCollapsed] = useState(isSmallScreen);
  const [handSortMode, setHandSortMode] = useState<HandSortMode>("habitat");
  const [cleanBoardMode, setCleanBoardMode] = useState(false);
  const [boardSpecies, setBoardSpecies] = useState<SpeciesId | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scenarioDockOpen, setScenarioDockOpen] = useState(false);
  const [expansionPreview, setExpansionPreview] = useState<ExpansionPreviewKind | null>(null);
  // Viewport point (icon center) the preview should grow out from, for the
  // fly-from-origin open animation. Recomputed on each open.
  const [expansionOrigin, setExpansionOrigin] = useState<{ x: number; y: number } | null>(null);
  // Full-screen threat announcement shown to everyone when a new round reveals a
  // threat. Auto-dismisses after 5s or when the player clicks the close button.
  const [threatReveal, setThreatReveal] = useState<ThreatCardId | null>(null);
  // Tracks the last threat seen per game so the announcement fires only on an
  // actual change, not on the initial load / reconnect into an ongoing game.
  const lastThreatRef = useRef<{ gameId: string | null; threatId: ThreatCardId | null }>({
    gameId: null,
    threatId: null
  });
  // Mobile-only HUD: below this width the floating docks become bottom sheets
  // driven by a tab bar. Desktop keeps the original floating layout untouched.
  const { isMobile, isBelowDesktop } = useResponsiveLayout();
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const { audioSettings, updateAudio } = useAudioSettings();
  const [visualAccessibility, setVisualAccessibility] = useState(() => getVisualAccessibilityPreference());
  const seenLogIdRef = useRef<Set<string>>(new Set());
  const logInitializedRef = useRef(false);
  const [hudLeftCollapsed, setHudLeftCollapsed] = useState(isSmallScreen);
  const [hudRightCollapsed, setHudRightCollapsed] = useState(isSmallScreen);
  // Mobile-only: the species panel can collapse to its header. Desktop keeps it
  // open (toggle is hidden and the collapse CSS lives only in the phone query).
  const [hudSpeciesCollapsed, setHudSpeciesCollapsed] = useState(isSmallScreen);
  const [movementPreview, setMovementPreview] = useState<{ speciesId: SpeciesId; left: number; top: number } | null>(null);
  const [landingMode, setLandingMode] = useState<LandingMode>("idle");
  const [macawScoreAnim, setMacawScoreAnim] = useState<{
    lines: Array<{ positions: [GridPosition, GridPosition, GridPosition] }>;
    points: number;
    playerName: string;
  } | null>(null);
  const [capuchinScoreAnim, setCapuchinScoreAnim] = useState<{
    groups: CapuchinHabitatGroup[];
    points: number;
    playerName: string;
  } | null>(null);
  const [turnBanner, setTurnBanner] = useState<{ key: number; label: string; speciesId: SpeciesId | null } | null>(null);
  const [floatingGains, setFloatingGains] = useState<FloatingGain[]>([]);
  const [travelEffects, setTravelEffects] = useState<TravelEffect[]>([]);
  // Chosen-but-unconfirmed card placement: shows a preview with confirm/cancel
  // over the slot to guard against misclicks.
  const [pendingPlacement, setPendingPlacement] = useState<{
    position: { x: number; y: number };
    rotation: 0 | 90 | 180 | 270;
  } | null>(null);
  const [turnRecap, setTurnRecap] = useState<TurnRecapState>({ history: [], index: -1, visible: false });
  const [hoveredSummaryCardIds, setHoveredSummaryCardIds] = useState<string[]>([]);
  const [recapCollapsed, setRecapCollapsed] = useState(true);
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
  const [showJaguarScoreModal, setShowJaguarScoreModal] = useState(false);
  const prevTurnRef = useRef<string | null>(null);
  const prevSnapshotRef = useRef<{ playerId: string; score: number; resources: Record<string, number> } | null>(null);
  const prevGameRef = useRef<GameState | null>(null);
  const turnSnapshotRef = useRef<{ playerId: string; score: number; logLength: number; name: string; speciesId: SpeciesId | null } | null>(null);
  const forestCanvasRef = useRef<ForestCanvasHandle | null>(null);
  const travelSeqRef = useRef(0);
  const effectTargetRefs = useRef(new Map<string, HTMLElement>());
  const gainSeqRef = useRef(0);
  const autoScoredRef = useRef<string | null>(null);
  const lastOnlineRoomSnapshotRef = useRef("");
  const onlineActionInFlightRef = useRef(false);
  const activeOnlineRoomIdRef = useRef<string | null>(null);
  const showServerWarningRef = useRef(false);
  const ignoredOnlineRoomIdsRef = useRef<Set<string>>(new Set());
  const roomActionEpochRef = useRef(0);

  const showMovementPreview = useCallback((speciesId: SpeciesId, rect: DOMRect) => {
    const previewWidth = 220;
    const previewHeight = 300;
    const gap = 12;
    const safeMargin = 12;
    const left = Math.max(
      safeMargin,
      Math.min(window.innerWidth - previewWidth - safeMargin, rect.left - previewWidth - gap)
    );
    const top = Math.max(
      safeMargin,
      Math.min(window.innerHeight - previewHeight - safeMargin, rect.top - 8)
    );
    setMovementPreview({ speciesId, left, top });
  }, []);

  const resetRoomUiState = useCallback(() => {
    setConfigOpen(false);
    setBoardSpecies(null);
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setSelectedRemovalPieceIds([]);
    setPendingPlacement(null);
    setHoveredSummaryCardIds([]);
    setTurnRecap({ history: [], index: -1, visible: false });
    setRecapCollapsed(true);
  }, []);

  const applyOnlineRoomState = useCallback((nextRoom: PublicRoomState, options?: { direct?: boolean }) => {
    const direct = options?.direct ?? false;

    if (!direct) {
      if (ignoredOnlineRoomIdsRef.current.has(nextRoom.roomId)) {
        return false;
      }

      const activeRoomId = activeOnlineRoomIdRef.current;
      if (!activeRoomId || activeRoomId !== nextRoom.roomId) {
        return false;
      }
    }

    activeOnlineRoomIdRef.current = nextRoom.roomId;
    ignoredOnlineRoomIdsRef.current.delete(nextRoom.roomId);

    const snapshot = JSON.stringify(nextRoom);
    if (lastOnlineRoomSnapshotRef.current === snapshot) {
      return false;
    }

    lastOnlineRoomSnapshotRef.current = snapshot;
    setRoom(nextRoom);
    return true;
  }, []);

  const clearRoomState = useCallback(() => {
    roomActionEpochRef.current += 1;
    lastOnlineRoomSnapshotRef.current = "";
    activeOnlineRoomIdRef.current = null;
    resetRoomUiState();
    setIsSpectator(false);
    setRoom(null);
  }, [resetRoomUiState]);

  useEffect(() => {
    showServerWarningRef.current =
      landingMode === "create" || landingMode === "join" || Boolean(room && room.roomId !== localRoomId);
  }, [landingMode, room]);

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
    setName((current) => (current === "Jogador" ? defaultPlayerName : current));
  }, [defaultPlayerName]);

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
    highlightedMovementGuideSpecies,
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
  const setEffectTarget = useCallback((key: string, element: HTMLElement | null) => {
    if (element) {
      effectTargetRefs.current.set(key, element);
    } else {
      effectTargetRefs.current.delete(key);
    }
  }, []);
  const forestCards = room?.game?.forest.cards ?? createPreviewInitialForest();
  const pieces = room?.game?.pieces ?? [];
  const rotateSelectedCard = useCallback((dir: 1 | -1) => {
    setSelectedCardRotation((r) => (((r + (dir === 1 ? 90 : 270)) % 360) as 0 | 90 | 180 | 270));
  }, []);

  useEffect(() => {
    // No rotation while a placement is awaiting confirmation: the preview is at a
    // fixed orientation; the player confirms or cancels first.
    if (!selectedHandCardId || !canPlaceSelectedForestCard || pendingPlacement) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "q") {
        event.preventDefault();
        rotateSelectedCard(-1);
      } else if (key === "e" || key === "r") {
        event.preventDefault();
        rotateSelectedCard(1);
      }
    };

    // Right-click rotates while a placeable card is selected (e.g. mid-drag).
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      rotateSelectedCard(1);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [canPlaceSelectedForestCard, rotateSelectedCard, selectedHandCardId, pendingPlacement]);

  // Drop the staged placement if the card can no longer be played (turn change,
  // card left the hand, etc.).
  useEffect(() => {
    if (pendingPlacement && !canPlaceSelectedForestCard) {
      setPendingPlacement(null);
    }
  }, [canPlaceSelectedForestCard, pendingPlacement]);

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
    activeGamePlayerSeedCount: activeGamePlayer?.resources.seed ?? 0,
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
    galoSeedCardScore,
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

  function appendTurnSummary(summary: TurnSummary): void {
    setTurnRecap((current) => {
      const history = [...current.history, summary].slice(-maxTurnHistory);
      return { history, index: history.length - 1, visible: true };
    });
    setRecapCollapsed(true);
    setHoveredSummaryCardIds([]);
  }

  function closeTurnRecap(): void {
    setTurnRecap((current) => ({ ...current, visible: false }));
    setHoveredSummaryCardIds([]);
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

  useEffect(() => {
    if (room?.game?.status !== "active") {
      prevTurnRef.current = null;
      return;
    }
    const activeId = room.game.activePlayerId ?? null;
    if (!activeId || prevTurnRef.current === activeId) {
      return;
    }
    const first = prevTurnRef.current === null;
    prevTurnRef.current = activeId;
    if (first) {
      return;
    }
    const player = room.game.players.find((candidate) => candidate.playerId === activeId);
    const sp = player?.speciesId ? speciesDefinitions[player.speciesId] : null;
    setTurnBanner({
      key: Date.now(),
      label: sp?.displayName ?? player?.name ?? "Próximo jogador",
      speciesId: player?.speciesId ?? null
    });
  }, [room?.game?.activePlayerId, room?.game?.status, room?.game?.players]);

  useEffect(() => {
    if (!turnBanner) {
      return;
    }
    const timer = window.setTimeout(() => setTurnBanner(null), 2200);
    return () => window.clearTimeout(timer);
  }, [turnBanner]);

  useEffect(() => {
    if (!hudGamePlayer) {
      prevSnapshotRef.current = null;
      return;
    }
    const snap = {
      playerId: hudGamePlayer.playerId,
      score: hudGamePlayer.score,
      resources: { ...hudGamePlayer.resources } as Record<string, number>
    };
    const prev = prevSnapshotRef.current;
    prevSnapshotRef.current = snap;
    if (!prev || prev.playerId !== snap.playerId) {
      return;
    }
    const gains: FloatingGain[] = [];
    const scoreDelta = snap.score - prev.score;
    if (scoreDelta > 0) {
      gains.push({ id: ++gainSeqRef.current, resource: "point", amount: scoreDelta });
    }
    for (const resource of resourceOrder) {
      const delta = (snap.resources[resource] ?? 0) - (prev.resources[resource] ?? 0);
      if (delta > 0) {
        gains.push({ id: ++gainSeqRef.current, resource, amount: delta });
      }
    }
    if (gains.length === 0) {
      return;
    }
    setFloatingGains((current) => [...current, ...gains]);
    const ids = new Set(gains.map((gain) => gain.id));
    const timer = window.setTimeout(() => {
      setFloatingGains((current) => current.filter((gain) => !ids.has(gain.id)));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [hudGamePlayer]);

  useEffect(() => {
    const game = room?.game;
    if (!game) {
      prevGameRef.current = null;
      turnSnapshotRef.current = null;
      return;
    }

    const prevGame = prevGameRef.current;
    const activePlayerId = game.status === "active" ? game.activePlayerId : null;

    if (!activePlayerId) {
      turnSnapshotRef.current = null;
    } else if (!turnSnapshotRef.current) {
      const activePlayer = game.players.find((candidate) => candidate.playerId === activePlayerId);
      if (activePlayer) {
        turnSnapshotRef.current = {
          playerId: activePlayer.playerId,
          score: activePlayer.score,
          logLength: game.log.length,
          name: activePlayer.name,
          speciesId: activePlayer.speciesId
        };
      }
    } else if (turnSnapshotRef.current.playerId !== activePlayerId) {
      const finishedSnapshot = turnSnapshotRef.current;
      const finishedPlayer = game.players.find((candidate) => candidate.playerId === finishedSnapshot.playerId);
      if (finishedPlayer) {
        const scoreDelta = Math.max(0, finishedPlayer.score - finishedSnapshot.score);
        const turnLog = game.log.slice(finishedSnapshot.logLength).filter((entry) => {
          const payload = entry.payload;
          if (payload?.actorPlayerId) {
            return payload.actorPlayerId === finishedPlayer.playerId;
          }
          return entry.message?.startsWith(finishedPlayer.name) ?? false;
        });
        appendTurnSummary({
          key: Date.now(),
          playerName: finishedPlayer.name,
          speciesId: finishedPlayer.speciesId,
          scoreDelta,
          entries: buildTurnSummaryEntries(turnLog, finishedPlayer.speciesId, scoreDelta, game.pieces)
        });
      }

      const nextPlayer = game.players.find((candidate) => candidate.playerId === activePlayerId);
      turnSnapshotRef.current = nextPlayer
        ? {
            playerId: nextPlayer.playerId,
            score: nextPlayer.score,
            logLength: game.log.length,
            name: nextPlayer.name,
            speciesId: nextPlayer.speciesId
          }
        : null;
    }

    if (prevGame) {
      const prevPieces = new Map(prevGame.pieces.map((piece) => [piece.pieceId, piece]));
      const currentPieces = new Map(game.pieces.map((piece) => [piece.pieceId, piece]));
      const sourcesByOwner = new Map<string, GridPosition[]>();
      const removedPieces: Array<{ pieceId: string; ownerId: string; speciesId: SpeciesId; location: GridPosition }> = [];

      for (const piece of game.pieces) {
        const previous = prevPieces.get(piece.pieceId);
        if (piece.location && (!previous?.location || !sameGridPosition(previous.location, piece.location))) {
          const sources = sourcesByOwner.get(piece.ownerId) ?? [];
          sources.push(piece.location);
          sourcesByOwner.set(piece.ownerId, sources);
        }
      }

      for (const previous of prevGame.pieces) {
        const current = currentPieces.get(previous.pieceId);
        if (previous.location && !current?.location) {
          removedPieces.push({
            pieceId: previous.pieceId,
            ownerId: previous.ownerId,
            speciesId: previous.speciesId,
            location: previous.location
          });
        }
      }

      const nextEffects: TravelEffect[] = [];
      const sourceFallbacks = [
        ...Array.from(sourcesByOwner.values()).flat(),
        ...removedPieces.map((piece) => piece.location)
      ];

      for (const player of game.players) {
        const prevPlayer = prevGame.players.find((candidate) => candidate.playerId === player.playerId);
        if (!prevPlayer) {
          continue;
        }

        for (const resource of resourceOrder) {
          const delta = (player.resources[resource] ?? 0) - (prevPlayer.resources[resource] ?? 0);
          if (delta <= 0) {
            continue;
          }

          const source =
            sourcesByOwner.get(player.playerId)?.[0] ??
            removedPieces.find((piece) => piece.ownerId === player.playerId)?.location ??
            sourceFallbacks[0];
          const from = source ? forestCanvasRef.current?.getCardCenter(source) : null;
          // Own resources fly to the new species HUD bar; an opponent's fly
          // straight to their portrait in the rail. Legacy keys remain as
          // fallbacks for spectators / when the new HUD is not mounted.
          const isOwnPlayer = hudGamePlayer?.playerId === player.playerId;
          const target = isOwnPlayer
            ? effectTargetRefs.current.get(`hudbar:${resource}`) ??
              effectTargetRefs.current.get(`hud:${resource}`)
            : effectTargetRefs.current.get(`portrait:${player.playerId}`) ??
              effectTargetRefs.current.get(`${player.playerId}:${resource}`);
          const to = elementCenter(target);
          if (from && to) {
            nextEffects.push({
              id: ++travelSeqRef.current,
              kind: "resource",
              resource,
              from,
              to
            });
          }
        }
      }

      for (const removed of removedPieces) {
        // Exact last meeple position (card-local offset included); fall back to
        // the card center only if the piece was never rendered. The shrink +
        // red flash + particle burst itself is drawn inside the Phaser scene
        // (camera-locked); here we only fly a token to the reserve/portrait.
        const from =
          forestCanvasRef.current?.getPieceCenter(removed.pieceId) ??
          forestCanvasRef.current?.getCardCenter(removed.location);
        const isOwnPlayer = hudGamePlayer?.playerId === removed.ownerId;
        const target = isOwnPlayer
          ? effectTargetRefs.current.get("hudbar:reserve") ?? effectTargetRefs.current.get("hud:reserve")
          : effectTargetRefs.current.get(`portrait:${removed.ownerId}`) ??
            effectTargetRefs.current.get(`${removed.ownerId}:reserve`);
        const to = elementCenter(target);
        if (from && to) {
          nextEffects.push({
            id: ++travelSeqRef.current,
            kind: "piece",
            speciesId: removed.speciesId,
            from,
            to
          });
        }
      }

      if (nextEffects.length > 0) {
        setTravelEffects((current) => [...current, ...nextEffects]);
        const ids = new Set(nextEffects.map((effect) => effect.id));
        window.setTimeout(() => {
          setTravelEffects((current) => current.filter((effect) => !ids.has(effect.id)));
        }, 1850);
      }
    }

    prevGameRef.current = game;
  }, [hudGamePlayer?.playerId, room?.game]);

  const run = useCallback(async (action: () => Promise<PublicRoomState>, success?: string) => {
    if (onlineActionInFlightRef.current) {
      return;
    }

    const actionEpoch = roomActionEpochRef.current;
    onlineActionInFlightRef.current = true;
    setError(null);
    setNotice(null);

    try {
      const nextRoom = await action();
      if (roomActionEpochRef.current !== actionEpoch) {
        return;
      }

      applyOnlineRoomState(nextRoom, { direct: true });
      saveOnlineSession(nextRoom, name);
      if (success) {
        setNotice(success);
      }
    } catch (err) {
      if (isMissingRoomError(err)) {
        clearOnlineSession();
        clearRoomState();
        setJoinCode("");
        setNotice("Essa sala não existe mais no servidor gratuito. Crie uma nova sala para continuar.");
        return;
      }

      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      onlineActionInFlightRef.current = false;
    }
  }, [applyOnlineRoomState, clearRoomState, name]);

  const clearActionSelection = useCallback(() => {
    setSelectedHandCardId(null);
    setSelectedPieceId(null);
    setSelectedRemovalPieceIds([]);
  }, []);

  const clearWolfActionSelection = useCallback(() => {
    clearActionSelection();
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
  }, [clearActionSelection]);

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

  function formatBotDelay(delayMs: number): string {
    return delayMs >= 1000 ? `${(delayMs / 1000).toFixed(delayMs % 1000 === 0 ? 0 : 1)}s` : `${delayMs}ms`;
  }

  function clampBotSpeed(delayMs: number): number {
    return Math.max(minBotTurnDelayMs, Math.min(maxBotTurnDelayMs, delayMs));
  }

  function adjustLocalBotSpeed(deltaMs: number) {
    setLocalBotTurnDelayMs((current) => clampBotSpeed(current + deltaMs));
  }

  function adjustBotSpeed(deltaMs: number) {
    if (!room) {
      return;
    }

    const nextDelay = clampBotSpeed(botTurnDelayMs + deltaMs);
    if (isLocalRoom) {
      setLocalBotTurnDelayMs(nextDelay);
      setRoom((current) =>
        current?.roomId === localRoomId
          ? {
              ...current,
              botTurnDelayMs: nextDelay
            }
          : current
      );
      return;
    }

    if (!isHost) {
      return;
    }

    void run(() => roomApi.setBotSpeed(requireSocket(), room.roomId, nextDelay));
  }

  function toggleTurnTimer() {
    if (!room || !isHost) {
      return;
    }

    void run(
      () => roomApi.setTurnTimer(requireSocket(), room.roomId, turnTimerMs ? null : TURN_TIMER_DEFAULT_MS),
      turnTimerMs ? "Cronômetro de turno desligado." : "Cronômetro de turno ligado."
    );
  }

  function adjustTurnTimer(direction: number) {
    if (!room || !isHost || !turnTimerMs) {
      return;
    }

    const timerOptions: readonly number[] = TURN_TIMER_OPTIONS_MS;
    const currentIndex = timerOptions.indexOf(turnTimerMs);
    const baseIndex = currentIndex >= 0 ? currentIndex : timerOptions.indexOf(TURN_TIMER_DEFAULT_MS);
    const nextIndex = Math.max(0, Math.min(timerOptions.length - 1, baseIndex + direction));
    void run(() => roomApi.setTurnTimer(requireSocket(), room.roomId, timerOptions[nextIndex]));
  }

  function toggleMiniExpansion(expansionId: MiniExpansionId) {
    if (!room || !isHost || room.status !== "lobby") {
      return;
    }

    const enabled = !enabledMiniExpansions.includes(expansionId);
    void run(
      () => roomApi.setMiniExpansion(requireSocket(), room.roomId, expansionId, enabled),
      enabled ? "Mini-expansão ligada." : "Mini-expansão desligada."
    );
  }

  function setScenarioMode(mode: "vote" | "host") {
    if (!room || !isHost || room.status !== "lobby" || scenarioSelectionMode === mode) {
      return;
    }

    void run(
      () => roomApi.setScenarioSelectionMode(requireSocket(), room.roomId, mode),
      mode === "vote" ? "Cenários serão votados." : "Host escolherá os cenários."
    );
  }

  function setRoomScenarioCount(nextCount: ScenarioCount) {
    if (!room || !isHost || room.status !== "lobby" || scenarioCount === nextCount) {
      return;
    }

    void run(
      () => roomApi.setScenarioCount(requireSocket(), room.roomId, 1),
      "1 cenario por partida."
    );
  }

  function toggleHostScenario(scenarioId: ScenarioCardId) {
    if (!room || !isHost || room.status !== "lobby") {
      return;
    }

    if (
      !hostSelectedScenarioIds.includes(scenarioId) &&
      hostSelectedScenarioIds.some((id) => areScenariosExclusive(id, scenarioId))
    ) {
      setNotice("Pantanal e Mata Atlântica não podem ser jogados juntos.");
      return;
    }

    const next = hostSelectedScenarioIds.includes(scenarioId)
      ? hostSelectedScenarioIds.filter((id) => id !== scenarioId)
      : hostSelectedScenarioIds.length >= scenarioCount
        ? hostSelectedScenarioIds
        : [...hostSelectedScenarioIds, scenarioId];

    if (next === hostSelectedScenarioIds) {
      setNotice(`Escolha no maximo ${scenarioCount} cenario(s).`);
      return;
    }

    void run(() => roomApi.setHostSelectedScenarios(requireSocket(), room.roomId, next));
  }

  function toggleLocalMiniExpansion(expansionId: MiniExpansionId) {
    setLocalEnabledMiniExpansions((current) =>
      current.includes(expansionId)
        ? current.filter((candidate) => candidate !== expansionId)
        : [...current, expansionId]
    );
  }

  function setLocalScenarioCountValue(nextCount: ScenarioCount) {
    setLocalScenarioCount(1);
    setLocalSelectedScenarioIds((current) => current.slice(0, 1));
  }

  function toggleLocalScenario(scenarioId: ScenarioCardId) {
    setLocalSelectedScenarioIds((current) => {
      if (current.includes(scenarioId)) {
        return current.filter((candidate) => candidate !== scenarioId);
      }

      if (current.length >= localScenarioCount) {
        setNotice(`Escolha no maximo ${localScenarioCount} cenario(s).`);
        return current;
      }

      if (current.some((id) => areScenariosExclusive(id, scenarioId))) {
        setNotice("Pantanal e Mata Atlantica nao podem ser jogados juntos.");
        return current;
      }

      return [...current, scenarioId];
    });
  }

  const handleCardClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room || !canPlaceSetupPiece) {
        return;
      }
      if (tutorialBlocks("setupPlace")) return;

      if (isLocalRoom && room.game?.setupActivePlayerId) {
        const nextGame = placeInitialPiece(room.game, room.game.setupActivePlayerId, position);
        setRoom({
          ...room,
          status: nextGame.status === "active" ? "active" : "setup",
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        return;
      }

      void run(() => roomApi.placeSetupPiece(requireSocket(), room.roomId, position.x, position.y));
    },
    [canPlaceSetupPiece, isLocalRoom, room, socket, tutorialBlocks]
  );

  const placeCard = useCallback(
    (position: { x: number; y: number }, rotation: 0 | 90 | 180 | 270) => {
      if (!room?.game || !selectedHandCardId || !canPlaceSelectedForestCard || !room.game.activePlayerId) {
        return;
      }
      if (tutorialBlocks("placeCard")) return;
      // Tutorial: enforce the marked card and the marked slot.
      if (tutorialActive) {
        const def = tutorialStep !== null ? tutorialSteps[tutorialStep] : null;
        if (def?.requiredCardId && selectedHandCardId !== def.requiredCardId) return;
        if (tutorialMarkedSlot && (position.x !== tutorialMarkedSlot.x || position.y !== tutorialMarkedSlot.y)) return;
      }

      if (isLocalRoom) {
        const game = room.game;
        const activePlayerId = game.activePlayerId;
        if (!activePlayerId) {
          return;
        }
        const cardId = selectedHandCardId;
        const nextGame = placeForestCard(game, activePlayerId, cardId, position, rotation);
        setRoom((current) => current ? {
          ...current,
          status: "active",
          game: nextGame,
          warnings: nextGame.contentWarnings
        } : current);
        setSelectedHandCardId(null);
        setSelectedCardRotation(0);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setPendingPlacement(null);
        setNotice("Carta colocada na floresta.");
        return;
      }

      void run(() =>
        roomApi.placeForestCard(requireSocket(), room.roomId, selectedHandCardId, position.x, position.y, rotation)
      ).then(() => {
        setSelectedHandCardId(null);
        setSelectedCardRotation(0);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setPendingPlacement(null);
      });
    },
    [
      canPlaceSelectedForestCard,
      isLocalRoom,
      room,
      selectedHandCardId,
      socket,
      tutorialBlocks,
      tutorialActive,
      tutorialStep,
      tutorialSteps,
      tutorialMarkedSlot
    ]
  );

  // Selecting a slot does not place immediately: it stages a preview the player
  // then confirms or cancels, avoiding accidental placements from a misclick.
  const handleExpansionTargetClick = useCallback(
    (position: { x: number; y: number }) =>
      setPendingPlacement({ position, rotation: selectedCardRotation }),
    [selectedCardRotation]
  );

  // Choosing a rotate-to-fit ghost stages the placement at the rotation that
  // connects there.
  const handleRotateFitTargetClick = useCallback(
    (position: { x: number; y: number }, rotation: number) =>
      setPendingPlacement({ position, rotation: (rotation % 360) as 0 | 90 | 180 | 270 }),
    []
  );

  const handleConfirmPlacement = useCallback(() => {
    if (!pendingPlacement) return;
    placeCard(pendingPlacement.position, pendingPlacement.rotation);
    setPendingPlacement(null);
  }, [pendingPlacement, placeCard]);

  // Cancel returns the card to the hand (still selected) so the player can place
  // the same or another card anywhere valid.
  const handleCancelPlacement = useCallback(() => {
    setPendingPlacement(null);
  }, []);

  // Enter confirms / Escape cancels the staged placement.
  useEffect(() => {
    if (!pendingPlacement) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleConfirmPlacement();
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleCancelPlacement();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingPlacement, handleConfirmPlacement, handleCancelPlacement]);

  const executeSelectedPieceMove = useCallback(
    (position: { x: number; y: number }, targetPieceId?: string) => {
      if (!room?.game || !room.game.activePlayerId || !selectedPieceId) {
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
      const activePlayerId = currentGame.activePlayerId!;

      if (isLocalRoom) {
        const nextGame = movePieceForCurrentAction(currentGame, activePlayerId, movingPieceId, position, targetPieceId);
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
          activeSpecies?.speciesId === "jaguar"
            ? "Onça movida."
            : activeSpecies?.speciesId === "capuchin"
              ? "Macaco-prego movido."
              : activeSpecies?.speciesId === "macaw"
              ? activeActionId === "C"
                ? "Arara realocada."
                : "Arara movida."
              : activeSpecies?.speciesId === "armadillo"
                ? "Tatu-bola movido."
                : activeSpecies?.speciesId === "maned_wolf"
                  ? "Lobo-guará movido."
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
      activeSpecies?.speciesId,
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
        if (selectedJaguarDestination) {
          executeSelectedPieceMove(selectedJaguarDestination, pieceId);
        } else {
          setSelectedJaguarTargetPieceId((current) => (current === pieceId ? null : pieceId));
        }
        return;
      }

      if (activeSpecies?.speciesId === "maned_wolf" && activeActionId === "B") {
        setSelectedWolfTargetPieceId((current) => (current === pieceId ? null : pieceId));
        return;
      }

      if (activeSpecies?.speciesId === "coati" && activeActionId === "C") {
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
      activeSpecies?.speciesId,
      boardSelectablePieceIds,
      cacaIlegalPending?.playerId,
      cacaIlegalRemovalMode,
      controlledPlayerId,
      executeSelectedPieceMove,
      jaguarTargetPieceIds,
      requiredCoatiRemovalCount,
      selectedJaguarDestination
    ]
  );

  const handleMovementTargetClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room?.game || !room.game.activePlayerId || !selectedPieceId || movementTargets.length === 0) {
        return;
      }

      const currentGame = room.game;

      if (activeSpecies?.speciesId === "jaguar") {
        const removablePieces = currentGame.pieces.filter(
          (piece) =>
            piece.ownerId !== currentGame.activePlayerId &&
            !piece.state.hidden &&
            piece.location?.x === position.x &&
            piece.location.y === position.y
        );

        if (removablePieces.length > 1) {
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
    [activeSpecies?.speciesId, executeSelectedPieceMove, movementTargets.length, room, selectedPieceId]
  );

  const handleAddPieceTargetClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room?.game || !room.game.activePlayerId || addPieceTargets.length === 0) {
        return;
      }
      const galoAdjacentPending = room.game.pendingGaloAdjacentAdd?.playerId === room.game.activePlayerId;
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

      const addHandler = getAddPieceHandler(activeSpecies?.speciesId);

      executeGameAction(
        () => addHandler.local(room.game!, room.game!.activePlayerId!, position, galoAdjacentPending),
        () => addHandler.api(requireSocket(), room.roomId, position.x, position.y, galoAdjacentPending),
        addHandler.notice
      );
    },
    [
      activeSpecies?.speciesId,
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

  const handleRemoveSelectedPieces = useCallback(() => {
    if (
      !room?.game ||
      !room.game.activePlayerId ||
      !canControlActivePlayer ||
      selectedRemovalPieceIds.length !== requiredCoatiRemovalCount
    ) {
      return;
    }

    executeGameAction(
      () => removePiecesForCurrentAction(room.game!, room.game!.activePlayerId!, selectedRemovalPieceIds),
      () => roomApi.removePieces(requireSocket(), room.roomId, selectedRemovalPieceIds),
      "Quatis removidos da floresta.",
      clearWolfActionSelection
    );
  }, [
    canControlActivePlayer,
    clearWolfActionSelection,
    executeGameAction,
    requiredCoatiRemovalCount,
    room,
    selectedRemovalPieceIds,
    socket
  ]);

  const handleSpendJaguarMeat = useCallback(
    (count: number) => {
      if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
        return;
      }
      if (tutorialActive && tutorialDef?.requiredSpendCount && count !== tutorialDef.requiredSpendCount) {
        setNotice(`Neste tutorial, gaste ${tutorialDef.requiredSpendCount} carnes para ver a pontuação completa.`);
        return;
      }

      executeGameAction(
        () => spendJaguarMeatForPoints(room.game!, room.game!.activePlayerId!, count),
        () => roomApi.spendJaguarMeat(requireSocket(), room.roomId, count),
        "Carne gasta e pontos marcados."
      );
    },
    [canControlActivePlayer, executeGameAction, room, socket, tutorialActive, tutorialDef?.requiredSpendCount]
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
        () => scoreCapuchinHabitatPresence(room.game!, activeId),
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
        () => scoreMacawLines(room.game!, activeId),
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

  const handleScoreGalo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    executeGameAction(
      () => scoreGaloSeedCards(room.game!, room.game!.activePlayerId!),
      () => roomApi.scoreGalo(requireSocket(), room.roomId),
      "Galo-de-campina pontuado."
    );
  }, [canControlActivePlayer, executeGameAction, room, socket]);

  const handleHideArmadillo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || !selectedPieceId) {
      return;
    }
    if (tutorialActive && tutorialDef?.markedPieceId && selectedPieceId !== tutorialDef.markedPieceId) {
      return;
    }

    executeGameAction(
      () => hideArmadilloForCurrentAction(room.game!, room.game!.activePlayerId!, selectedPieceId),
      () => roomApi.hideArmadillo(requireSocket(), room.roomId, selectedPieceId),
      "Tatu-bola escondido."
    );
  }, [canControlActivePlayer, executeGameAction, room, selectedPieceId, socket, tutorialActive, tutorialDef?.markedPieceId]);

  const handleScoreArmadillo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    executeGameAction(
      () => scoreArmadilloSharing(room.game!, room.game!.activePlayerId!),
      () => roomApi.scoreArmadillo(requireSocket(), room.roomId),
      "Tatu-bola pontuado."
    );
  }, [canControlActivePlayer, executeGameAction, room, socket]);

  const handleRemoveWolfBasePiece = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || !selectedWolfTargetPieceId) {
      return;
    }
    if (tutorialActive && tutorialDef?.markedPieceId && selectedWolfTargetPieceId !== tutorialDef.markedPieceId) {
      return;
    }

    executeGameAction(
      () => removeBasePieceForWolfAction(room.game!, room.game!.activePlayerId!, selectedWolfTargetPieceId),
      () => roomApi.removeWolfBasePiece(requireSocket(), room.roomId, selectedWolfTargetPieceId),
      "Lobo-guará removeu peça de base.",
      clearWolfActionSelection
    );
  }, [
    canControlActivePlayer,
    clearWolfActionSelection,
    executeGameAction,
    room,
    selectedWolfTargetPieceId,
    socket,
    tutorialActive,
    tutorialDef?.markedPieceId
  ]);

  const handleSpendWolfResources = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || selectedWolfResources.length === 0) {
      return;
    }
    if (
      tutorialActive &&
      tutorialDef?.requiredSpendCount &&
      selectedWolfResources.length !== tutorialDef.requiredSpendCount
    ) {
      setNotice(`Neste tutorial, gaste ${tutorialDef.requiredSpendCount} recursos diferentes para ver a pontuação completa.`);
      return;
    }

    executeGameAction(
      () => spendWolfResourcesForPoints(room.game!, room.game!.activePlayerId!, selectedWolfResources),
      () => roomApi.spendWolfResources(requireSocket(), room.roomId, selectedWolfResources),
      "Lobo-guará gastou recursos e marcou pontos.",
      clearWolfActionSelection
    );
  }, [
    canControlActivePlayer,
    clearWolfActionSelection,
    executeGameAction,
    room,
    selectedWolfResources,
    socket,
    tutorialActive,
    tutorialDef?.requiredSpendCount
  ]);

  const handleCompleteAction = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }
    if (tutorialActive) {
      return;
    }

    executeGameAction(
      () => completeCurrentAction(room.game!, room.game!.activePlayerId!),
      () => roomApi.completeAction(requireSocket(), room.roomId),
      "Ação concluída."
    );
  }, [canControlActivePlayer, executeGameAction, room, socket, tutorialActive]);

  useEffect(() => {
    if ((!canSkipExtraTurnNoCardAction && !needsEndgameOverflowRepair) || tutorialActive) {
      return;
    }

    const id = window.setTimeout(() => {
      handleCompleteAction();
    }, 250);
    return () => window.clearTimeout(id);
  }, [canSkipExtraTurnNoCardAction, handleCompleteAction, needsEndgameOverflowRepair, tutorialActive]);

  const handleSelectObjective = useCallback(
    async (objectiveCardId: string) => {
      if (!room?.game || !currentGamePlayer || pendingObjectiveCardId) {
        return;
      }

      setPendingObjectiveCardId(objectiveCardId);
      setError(null);
      setNotice(null);

      if (isLocalRoom) {
        try {
          const nextGame = selectObjectiveCard(room.game, currentGamePlayer.playerId, objectiveCardId);
          setRoom({
            ...room,
            game: nextGame,
            warnings: nextGame.contentWarnings
          });
          setNotice("Objetivo escolhido.");
        } catch (err) {
          setPendingObjectiveCardId(null);
          setError(err instanceof Error ? err.message : "Falha ao escolher objetivo.");
        }
        return;
      }

      try {
        const nextRoom = await roomApi.selectObjective(requireSocket(), room.roomId, objectiveCardId);
        applyOnlineRoomState(nextRoom, { direct: true });
        saveOnlineSession(nextRoom, name);
        setNotice("Objetivo escolhido.");
      } catch (err) {
        setPendingObjectiveCardId(null);
        setError(err instanceof Error ? err.message : "Falha ao escolher objetivo.");
      }
    },
    [currentGamePlayer, isLocalRoom, name, pendingObjectiveCardId, room, socket]
  );

  const handleDiscardObjective = useCallback(async () => {
    if (!room?.game || !currentGamePlayer || !canDiscardSelectedObjective) {
      return;
    }

    setError(null);
    setNotice(null);

    if (isLocalRoom) {
      try {
        const nextGame = discardObjectiveForResources(room.game, currentGamePlayer.playerId);
        setRoom({
          ...room,
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setExpansionPreview(null);
        setExpandedObjectiveCardId(null);
        setNotice("Objetivo descartado: +1 recurso de cada.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao descartar objetivo.");
      }
      return;
    }

    await run(() => roomApi.discardObjective(requireSocket(), room.roomId), "Objetivo descartado: +1 recurso de cada.");
    setExpansionPreview(null);
    setExpandedObjectiveCardId(null);
  }, [canDiscardSelectedObjective, currentGamePlayer, isLocalRoom, room, socket]);

  // Toggle the centered card preview, capturing the clicked icon's center so the
  // modal can grow out from it.
  const toggleExpansionPreview = useCallback(
    (kind: "objective" | "scenarios" | "threat", event: React.MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setExpansionOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      setExpansionPreview((current) => (current === kind ? null : kind));
    },
    []
  );

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
  const resolveCacaIlegalChoice = (choice: { kind: "remove_piece"; pieceId: string } | { kind: "spend_resource"; resource: Resource }) => {
    if (!room?.game || !cacaIlegalPending || !canResolveCacaIlegal) return;
    if (isLocalRoom) {
      try {
        const nextGame = resolveCacaIlegal(room.game, cacaIlegalPending.playerId, choice);
        setRoom((current) => (current ? { ...current, game: nextGame } : current));
        setCacaIlegalRemovalMode(false);
        setSelectedRemovalPieceIds([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao resolver Caca ilegal.");
      }
    } else {
      const rid = room.roomId;
      run(() => roomApi.resolveCacaIlegal(requireSocket(), rid, choice)).then(() => {
        setCacaIlegalRemovalMode(false);
        setSelectedRemovalPieceIds([]);
      });
    }
  };
  const resolveSelectedCacaIlegalPiece = () => {
    const pieceId = selectedRemovalPieceIds[0];
    if (!pieceId) return;
    resolveCacaIlegalChoice({ kind: "remove_piece", pieceId });
  };
  const resolveCaatingaChoice = (mode: "gain" | "lose" | "skip") => {
    if (!room?.game || !caatingaPending || !canResolveCaatinga) return;
    if (isLocalRoom) {
      try {
        const nextGame = collectCaatingaBonus(room.game, caatingaPending.playerId, mode);
        setRoom((current) => (current ? { ...current, game: nextGame } : current));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao resolver Caatinga.");
      }
    } else {
      const rid = room.roomId;
      run(() => roomApi.collectCaatinga(requireSocket(), rid, mode));
    }
  };
  const resolveCerradoChoice = (mode: "collect" | "skip") => {
    if (!room?.game || !cerradoPending || !canResolveCerrado) return;
    if (isLocalRoom) {
      try {
        const nextGame = collectCerradoBonus(room.game, cerradoPending.playerId, mode);
        setRoom((current) => (current ? { ...current, game: nextGame } : current));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao resolver Cerrado.");
      }
    } else {
      const rid = room.roomId;
      run(() => roomApi.collectCerrado(requireSocket(), rid, mode));
    }
  };
  const resolveExtraTurnChoice = (accept: boolean) => {
    if (!room?.game?.pendingExtraTurnPlayerId || !canResolveExtraTurn) return;

    const pendingPlayerId = room.game.pendingExtraTurnPlayerId;
    if (isLocalRoom) {
      try {
        const nextGame = resolveExtraTurnObjective(room.game, pendingPlayerId, accept);
        setRoom({
          ...room,
          status: nextGame.status === "finished" ? "finished" : "active",
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setNotice(accept ? "Turno extra iniciado: -1 ponto." : "Turno extra recusado.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao resolver turno extra.");
      }
      return;
    }

    const rid = room.roomId;
    run(() => roomApi.resolveExtraTurn(requireSocket(), rid, accept));
  };
  const resolveSeedSpendChoice = (accept: boolean) => {
    if (!room?.game?.pendingSeedSpendObjectivePlayerId || !canResolveSeedSpend) return;

    const pendingPlayerId = room.game.pendingSeedSpendObjectivePlayerId;
    if (isLocalRoom) {
      try {
        const nextGame = resolveSeedSpendObjective(room.game, pendingPlayerId, accept);
        setRoom({
          ...room,
          status: nextGame.status === "finished" ? "finished" : "active",
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setNotice(accept ? `Objetivo ativado: -${pendingSeedSpendCount} sementes, +${pendingSeedSpendPoints} pontos.` : "Objetivo recusado.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao resolver objetivo de sementes.");
      }
      return;
    }

    const rid = room.roomId;
    run(() => roomApi.resolveSeedSpend(requireSocket(), rid, accept));
  };
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
  const resolveMataAtlanticaDiscard = (cardId: string) => {
    if (!room?.game || !currentGamePlayer) return;
    if (isLocalRoom) {
      try {
        const nextGame = discardMataAtlanticaPileCard(room.game, currentGamePlayer.playerId, cardId);
        setRoom((current) => (current ? { ...current, game: nextGame } : current));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao descartar (Mata Atlantica).");
      }
    } else {
      const rid = room.roomId;
      run(() => roomApi.discardMataAtlantica(requireSocket(), rid, cardId));
    }
  };

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
          onEnterRemovalMode={() => {
            setSelectedRemovalPieceIds([]);
            setCacaIlegalRemovalMode(true);
          }}
        />
      )}
      {cacaIlegalPending && canResolveCacaIlegal && cacaIlegalRemovalMode && (
        <CacaIlegalRemovalBanner
          selectedCount={selectedRemovalPieceIds.length}
          confirmDisabled={selectedRemovalPieceIds.length !== 1}
          onConfirm={resolveSelectedCacaIlegalPiece}
          onBack={() => {
            setCacaIlegalRemovalMode(false);
            setSelectedRemovalPieceIds([]);
          }}
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
            onCancelCacaIlegalRemoval={() => {
              setCacaIlegalRemovalMode(false);
              setSelectedRemovalPieceIds([]);
            }}
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
                                if (isLocalRoom) {
                                  try {
                                    const nextGame = discardMataAtlanticaPileCard(room.game!, currentGamePlayer.playerId, card.id);
                                    setRoom((current) => (current ? { ...current, game: nextGame } : current));
                                  } catch (e) {
                                    setError(e instanceof Error ? e.message : "Falha ao descartar.");
                                  }
                                } else {
                                  const rid = room.roomId;
                                  run(() => roomApi.discardMataAtlantica(requireSocket(), rid, card.id));
                                }
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
        <nav className="mobile-tabbar" aria-label="Painéis do jogo">
          {([
            { id: "acao", label: "Ação", icon: Play, available: true },
            {
              id: "mao",
              label: "Mão",
              icon: Leaf,
              available: showHandDuringGame && Boolean(currentGamePlayer)
            },
            { id: "jogadores", label: "Jogadores", icon: Users, available: Boolean(room) },
            {
              id: "resumo",
              label: "Resumo",
              icon: Clock,
              available: Boolean(turnSummary) && room?.game?.status === "active"
            }
          ] as const).map(({ id, label, icon: Icon, available }) => (
            <button
              key={id}
              type="button"
              className={`mobile-tab ${mobileSheet === id ? "is-active" : ""}`}
              aria-pressed={mobileSheet === id}
              disabled={!available}
              onClick={() =>
                setMobileSheet((current) => {
                  const next = current === id ? null : id;
                  if (next === "acao") setHudLeftCollapsed(false);
                  if (next === "mao") setHandCollapsed(false);
                  if (next === "jogadores") {
                    setHudRightCollapsed(false);
                    setSelectedOpponentPlayerId((currentId) => currentId ?? opponentInspectorEntries[0]?.player.playerId ?? null);
                  }
                  if (next === "resumo") setRecapCollapsed(false);
                  return next;
                })
              }
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
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
          galoSeedCardScore={galoSeedCardScore}
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
