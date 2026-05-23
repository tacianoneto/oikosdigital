import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Leaf,
  LogIn,
  LogOut,
  MapPin,
  Minus,
  Package,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import {
  getForestCardDefinition,
  habitatLabels,
  movementLabels,
  resourceAssets,
  resourceLabels,
  speciesDefinitions
} from "@oikos/content";
import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  completeCurrentAction,
  createInitialGameState,
  createPreviewInitialForest,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getArmadilloHidePieceIds,
  getArmadilloSharingDetails,
  getArmadilloSeedPlacementPositions,
  getArmadilloShareScore,
  getCapuchinHabitatScore,
  getCapuchinPlacementPositions,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getAvailableForestExpansionPositions,
  getAvailableForestExpansionPositionsForCard,
  getMacawActionCTargets,
  getCapuchinScoringHabitats,
  type CapuchinHabitatGroup,
  getMacawEggPlacementPositions,
  getMacawLineScore,
  getMacawScoringLines,
  type MacawScoringLine,
  getMacawRelocatablePieceIds,
  getRequiredCoatiRemovalCount,
  getValidPieceMovementDestinations,
  getWolfMeatPlacementPositions,
  getWolfRemovableBasePieceIds,
  getWolfSpendableResourceTypes,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece,
  removeBasePieceForWolfAction,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing,
  scoreCapuchinHabitatPresence,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints
} from "@oikos/rules";
import type { GameState, GridPosition, PublicRoomState, Resource, RoomPlayer, SpeciesId } from "@oikos/shared";
import { ForestCanvas, type ForestCanvasHandle } from "./game/ForestCanvas";
import { createSocket, roomApi, type OikosSocket } from "./socket";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import {
  getAudioSettings,
  initAudioOnGesture,
  playClick,
  playLogEvent,
  setAudioSettings,
  type AudioSettings
} from "./ui/audio";
import { getActionDescription } from "./ui/actionDescriptions";
import {
  HABITAT_SCORE_COLORS,
  SPECIES_HEX,
  botTurnDelayStepMs,
  categoryLabels,
  defaultBotTurnDelayMs,
  habitatShortLabel,
  localRoomId,
  maxBotTurnDelayMs,
  maxTurnHistory,
  minBotTurnDelayMs,
  resourceOrder,
  speciesList
} from "./ui/gameConstants";
import type { FloatingGain, TravelEffect } from "./ui/gameEffects";
import { elementCenter, sameGridPosition } from "./ui/geometry";
import {
  clearOnlineSession,
  isMissingRoomError,
  lastOnlineNameStorageKey,
  lastOnlineRoomStorageKey,
  saveOnlineSession
} from "./ui/session";
import { speciesVar } from "./ui/speciesStyle";
import { buildTurnSummaryEntries, type TurnRecapState, type TurnSummary } from "./ui/turnSummary";

export function App() {
  const [socket, setSocket] = useState<OikosSocket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [name, setName] = useState("Jogador");
  const [joinCode, setJoinCode] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesId | "">("");
  const [localSpeciesIds, setLocalSpeciesIds] = useState<SpeciesId[]>(["maned_wolf", "coati"]);
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedCardRotation, setSelectedCardRotation] = useState<0 | 90 | 180 | 270>(0);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [selectedJaguarDestination, setSelectedJaguarDestination] = useState<{ x: number; y: number } | null>(null);
  const [selectedJaguarTargetPieceId, setSelectedJaguarTargetPieceId] = useState<string | null>(null);
  const [selectedWolfTargetPieceId, setSelectedWolfTargetPieceId] = useState<string | null>(null);
  const [selectedWolfResources, setSelectedWolfResources] = useState<Resource[]>([]);
  const [selectedRemovalPieceIds, setSelectedRemovalPieceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handCollapsed, setHandCollapsed] = useState(false);
  const [boardSpecies, setBoardSpecies] = useState<SpeciesId | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [audioSettings, setAudioSettingsState] = useState<AudioSettings>(() => getAudioSettings());
  const seenLogIdRef = useRef<Set<string>>(new Set());
  const logInitializedRef = useRef(false);
  const [hudLeftCollapsed, setHudLeftCollapsed] = useState(false);
  const [hudRightCollapsed, setHudRightCollapsed] = useState(false);
  const [movementPreview, setMovementPreview] = useState<{ speciesId: SpeciesId; left: number; top: number } | null>(null);
  const [landingMode, setLandingMode] = useState<"idle" | "join" | "local">("idle");
  const [macawScoreAnim, setMacawScoreAnim] = useState<{
    lines: Array<{ positions: [GridPosition, GridPosition, GridPosition] }>;
    points: number;
    playerName: string;
  } | null>(null);
  const [macawAnimTick, setMacawAnimTick] = useState(0);
  const [capuchinScoreAnim, setCapuchinScoreAnim] = useState<{
    groups: CapuchinHabitatGroup[];
    points: number;
    playerName: string;
  } | null>(null);
  const [capuchinAnimTick, setCapuchinAnimTick] = useState(0);
  const [turnBanner, setTurnBanner] = useState<{ key: number; label: string; speciesId: SpeciesId | null } | null>(null);
  const [floatingGains, setFloatingGains] = useState<FloatingGain[]>([]);
  const [travelEffects, setTravelEffects] = useState<TravelEffect[]>([]);
  const [cardDrag, setCardDrag] = useState<{
    cardId: string;
    src: string;
    size: number;
    x: number;
    y: number;
    target: { x: number; y: number; rotation: 0 | 90 | 180 | 270 } | null;
  } | null>(null);
  const dragJustHandledRef = useRef(false);
  const pendingDragRef = useRef<
    | {
        cardId: string;
        src: string;
        size: number;
        startX: number;
        startY: number;
      }
    | null
  >(null);
  // Last pointer position during a drag, read by the live drag handlers so
  // rotating mid-drag recomputes targets without a stale closure.
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
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

  const applyOnlineRoomState = useCallback((nextRoom: PublicRoomState) => {
    const snapshot = JSON.stringify(nextRoom);
    if (lastOnlineRoomSnapshotRef.current === snapshot) {
      return false;
    }

    lastOnlineRoomSnapshotRef.current = snapshot;
    setRoom(nextRoom);
    return true;
  }, []);

  const clearRoomState = useCallback(() => {
    lastOnlineRoomSnapshotRef.current = "";
    setRoom(null);
  }, []);

  useEffect(() => {
    const nextSocket = createSocket();
    setSocket(nextSocket);

    nextSocket.on("connected", (payload: { playerId: string }) => {
      setPlayerId(payload.playerId);
      const savedRoomId = window.localStorage.getItem(lastOnlineRoomStorageKey);
      const savedName = window.localStorage.getItem(lastOnlineNameStorageKey) ?? name;

      if (savedRoomId) {
        setName(savedName);
        void roomApi
          .join(nextSocket, savedRoomId, savedName)
          .then((nextRoom) => {
            applyOnlineRoomState(nextRoom);
            setNotice("Reconectado a sala.");
          })
          .catch((err) => {
            clearOnlineSession();
            clearRoomState();
            setNotice(
              isMissingRoomError(err)
                ? "A sala anterior expirou no servidor gratuito. Crie uma nova sala para continuar."
                : "Nao foi possivel reconectar a sala anterior."
            );
          });
      }
    });

    nextSocket.on("room:update", (nextRoom: PublicRoomState) => {
      applyOnlineRoomState(nextRoom);
    });

    nextSocket.on("connect_error", () => {
      setError("Servidor indisponível. Inicie o servidor para testar lobby multiplayer.");
    });

    return () => {
      nextSocket.disconnect();
    };
  }, [applyOnlineRoomState]);

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
    if (!macawScoreAnim) return;
    let raf = 0;
    const tick = () => {
      setMacawAnimTick((t) => t + 1);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [macawScoreAnim]);

  useEffect(() => {
    if (!capuchinScoreAnim) return;
    let raf = 0;
    const tick = () => {
      setCapuchinAnimTick((t) => t + 1);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [capuchinScoreAnim]);


  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 4500);
    return () => window.clearTimeout(id);
  }, [error]);

  const isLocalRoom = room?.roomId === localRoomId;
  const controlledPlayerId = isLocalRoom ? room?.game?.setupActivePlayerId ?? room?.game?.activePlayerId ?? null : playerId;
  const currentPlayer = room?.players.find((player) => player.playerId === controlledPlayerId) ?? null;
  const currentGamePlayer = room?.game?.players.find((player) => player.playerId === controlledPlayerId) ?? null;
  const setupActivePlayer = room?.game?.players.find((player) => player.playerId === room.game?.setupActivePlayerId) ?? null;
  const activeGamePlayer = room?.game?.players.find((player) => player.playerId === room.game?.activePlayerId) ?? null;
  const activeSpecies = activeGamePlayer?.speciesId ? speciesDefinitions[activeGamePlayer.speciesId] : null;
  const activeActionId = activeSpecies && room?.game ? activeSpecies.actions[room.game.activeActionIndex] ?? null : null;
  const canControlActivePlayer = Boolean(room?.game?.activePlayerId && currentGamePlayer?.playerId === room.game.activePlayerId);
  const hasPendingCoatiPairBonus = Boolean(room?.game?.pendingCoatiPairBonus);
  const hasStartedGame = Boolean(room?.game);
  const gameLog = room?.game?.log;

  // Unlock the audio context on the first user gesture (browser autoplay policy)
  // and play a soft click on every button press.
  useEffect(() => {
    const onFirstGesture = () => initAudioOnGesture();
    const onPointerDown = (event: PointerEvent) => {
      initAudioOnGesture();
      const target = event.target as HTMLElement | null;
      if (target?.closest("button")) {
        playClick();
      }
    };
    window.addEventListener("keydown", onFirstGesture);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onFirstGesture);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

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

  const updateAudio = useCallback((partial: Partial<AudioSettings>) => {
    setAudioSettingsState(setAudioSettings(partial));
  }, []);

  const hudGamePlayer = currentGamePlayer ?? activeGamePlayer ?? setupActivePlayer ?? null;
  const hudSpecies = hudGamePlayer?.speciesId ? speciesDefinitions[hudGamePlayer.speciesId] : null;
  const isHost = Boolean(room && !isLocalRoom && playerId === room.hostPlayerId);
  const roomHasBots = Boolean(room?.players.some((player) => player.isBot));
  const botTurnDelayMs = room?.botTurnDelayMs ?? defaultBotTurnDelayMs;
  const setEffectTarget = useCallback((key: string, element: HTMLElement | null) => {
    if (element) {
      effectTargetRefs.current.set(key, element);
    } else {
      effectTargetRefs.current.delete(key);
    }
  }, []);
  const forestCards = room?.game?.forest.cards ?? createPreviewInitialForest();
  const pieces = room?.game?.pieces ?? [];
  const canPlaceSetupPiece = Boolean(room?.game?.status === "setup" && (isLocalRoom || room.game.setupActivePlayerId === playerId));
  const canPlaceSelectedForestCard = Boolean(
    room?.game?.status === "active" &&
      selectedHandCardId &&
      !hasPendingCoatiPairBonus &&
      !room.game.activePlayedForestCardId &&
      canControlActivePlayer &&
      (activeSpecies?.speciesId === "coati" ||
        activeSpecies?.speciesId === "capuchin" ||
        activeSpecies?.speciesId === "macaw" ||
        activeSpecies?.speciesId === "armadillo" ||
        activeSpecies?.speciesId === "maned_wolf") &&
      activeActionId === "A" &&
      currentGamePlayer?.hand.includes(selectedHandCardId)
  );
  const handPlayableThisAction = Boolean(
    room?.game?.status === "active" &&
      !hasPendingCoatiPairBonus &&
      !room.game.activePlayedForestCardId &&
      canControlActivePlayer &&
      activeActionId === "A" &&
      (activeSpecies?.speciesId === "coati" ||
        activeSpecies?.speciesId === "capuchin" ||
        activeSpecies?.speciesId === "macaw" ||
        activeSpecies?.speciesId === "armadillo" ||
        activeSpecies?.speciesId === "maned_wolf")
  );
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

  const expansionTargets = useMemo(
    () =>
      canPlaceSelectedForestCard && room?.game && selectedHandCardId && !pendingPlacement
        ? getAvailableForestExpansionPositionsForCard(room.game, selectedHandCardId, selectedCardRotation)
        : [],
    [canPlaceSelectedForestCard, room?.game, selectedCardRotation, selectedHandCardId, pendingPlacement]
  );
  // River cards that only fit after rotating: positions invalid at the current
  // rotation but valid at another, plus the rotation that connects there.
  const rotateFitTargets = useMemo(() => {
    if (!canPlaceSelectedForestCard || !room?.game || !selectedHandCardId || pendingPlacement) return [];
    const game = room.game;
    const currentKeys = new Set(expansionTargets.map((p) => `${p.x}:${p.y}`));
    const seen = new Set<string>();
    const result: { position: { x: number; y: number }; rotation: 0 | 90 | 180 | 270 }[] = [];
    for (const rotation of [0, 90, 180, 270] as const) {
      if (rotation === selectedCardRotation) continue;
      for (const p of getAvailableForestExpansionPositionsForCard(game, selectedHandCardId, rotation)) {
        const k = `${p.x}:${p.y}`;
        if (currentKeys.has(k) || seen.has(k)) continue;
        seen.add(k);
        result.push({ position: { x: p.x, y: p.y }, rotation });
      }
    }
    return result;
  }, [canPlaceSelectedForestCard, room?.game, selectedHandCardId, selectedCardRotation, expansionTargets, pendingPlacement]);

  // Keep a ref of the current drop targets so async drag handlers always see the
  // set for the latest rotation (the pointermove closure is captured once).
  // Each target carries the rotation to apply when dropped there.
  type DropTarget = { x: number; y: number; rotation: 0 | 90 | 180 | 270 };
  const dropTargetsRef = useRef<DropTarget[]>([]);
  dropTargetsRef.current = [
    ...expansionTargets.map((p) => ({ x: p.x, y: p.y, rotation: selectedCardRotation })),
    ...rotateFitTargets.map((t) => ({ x: t.position.x, y: t.position.y, rotation: t.rotation }))
  ];

  // Nearest valid slot to a screen point, or null if none within snap range.
  const computeNearestTarget = useCallback((x: number, y: number): DropTarget | null => {
    const targets = dropTargetsRef.current;
    const canvas = forestCanvasRef.current;
    if (!canvas || targets.length === 0) return null;
    let nearest: DropTarget | null = null;
    let nearestDist = 110 * 110;
    for (const t of targets) {
      const center = canvas.getCardCenter(t);
      if (!center) continue;
      const ddx = center.x - x;
      const ddy = center.y - y;
      const d = ddx * ddx + ddy * ddy;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = t;
      }
    }
    return nearest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotating mid-drag (without moving the pointer) must re-magnetize: the valid
  // slots changed, so recompute the target from the last known pointer position.
  useEffect(() => {
    if (!cardDrag) return;
    const p = dragPointerRef.current;
    if (!p) return;
    const target = computeNearestTarget(p.x, p.y);
    setCardDrag((current) => (current ? { ...current, target } : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardRotation]);
  const spotlightInstanceIds = useMemo(() => {
    if (!room?.game || room.game.status !== "active" || recapCollapsed || !turnSummary || hoveredSummaryCardIds.length === 0) return [];
    const alive = new Set(room.game.forest.cards.map((card) => card.instanceId));
    return hoveredSummaryCardIds.filter((id) => alive.has(id));
  }, [hoveredSummaryCardIds, recapCollapsed, room?.game, turnSummary?.key]);
  const selectablePieceIds = useMemo(() => {
    if (!room?.game || hasPendingCoatiPairBonus || !canControlActivePlayer) {
      return [];
    }

    if (activeSpecies?.speciesId === "jaguar" && (activeActionId === "A" || activeActionId === "B")) {
      return room.game.pieces
        .filter((piece) => piece.ownerId === room.game?.activePlayerId && piece.speciesId === "jaguar" && piece.location)
        .map((piece) => piece.pieceId);
    }

    if (activeSpecies?.speciesId === "macaw" && activeActionId === "C" && room.game.activePlayerId) {
      return getMacawRelocatablePieceIds(room.game, room.game.activePlayerId);
    }

    if (activeSpecies?.speciesId === "armadillo" && activeActionId === "C" && room.game.activePlayerId) {
      return getArmadilloHidePieceIds(room.game, room.game.activePlayerId);
    }

    if (activeSpecies?.speciesId === "maned_wolf" && activeActionId === "A" && room.game.pendingWolfMoves?.playerId === room.game.activePlayerId) {
      return room.game.pendingWolfMoves.pieceIds;
    }

    if (activeSpecies?.speciesId === "maned_wolf" && activeActionId === "B" && room.game.activePlayerId) {
      return getWolfRemovableBasePieceIds(room.game, room.game.activePlayerId);
    }

    if (
      activeSpecies?.speciesId !== "coati" &&
      activeSpecies?.speciesId !== "capuchin" &&
      activeSpecies?.speciesId !== "macaw" &&
      activeSpecies?.speciesId !== "armadillo"
    ) {
      return [];
    }

    if (activeActionId === "C" && getRequiredCoatiRemovalCount(room.game, room.game.activePlayerId ?? "") > 0) {
      return room.game.pieces
        .filter((piece) => piece.ownerId === room.game?.activePlayerId && piece.speciesId === "coati" && piece.location)
        .map((piece) => piece.pieceId);
    }

    if (activeActionId !== "B") {
      return [];
    }

    return room.game.pieces
      .filter((piece) => piece.ownerId === room.game?.activePlayerId && piece.speciesId === activeSpecies.speciesId && piece.location)
      .map((piece) => piece.pieceId);
  }, [activeActionId, activeSpecies?.speciesId, canControlActivePlayer, hasPendingCoatiPairBonus, room?.game]);
  const requiredCoatiRemovalCount =
    room?.game && room.game.activePlayerId ? getRequiredCoatiRemovalCount(room.game, room.game.activePlayerId) : 0;
  const availableJaguarPointSpendCount =
    room?.game && room.game.activePlayerId ? getAvailableJaguarPointSpendCount(room.game, room.game.activePlayerId) : 0;
  const shouldShowJaguarScoreModal = Boolean(
    hasStartedGame &&
      !hasPendingCoatiPairBonus &&
      room?.game?.status === "active" &&
      activeGamePlayer &&
      activeSpecies?.speciesId === "jaguar" &&
      activeActionId === "C" &&
      canControlActivePlayer
  );
  const movementTargets = useMemo(() => {
    if (!room?.game || hasPendingCoatiPairBonus || !room.game.activePlayerId || !selectedPieceId) {
      return [];
    }

    return getValidPieceMovementDestinations(room.game, room.game.activePlayerId, selectedPieceId);
  }, [hasPendingCoatiPairBonus, room?.game, selectedPieceId]);
  const canSkipJaguarMove =
    useMemo(() => {
      if (
        !room?.game ||
        !canControlActivePlayer ||
        hasPendingCoatiPairBonus ||
        activeSpecies?.speciesId !== "jaguar" ||
        (activeActionId !== "A" && activeActionId !== "B") ||
        !room.game.activePlayerId
      ) {
        return false;
      }

      const jaguarPieceId = room.game.pieces.find(
        (piece) => piece.ownerId === room.game?.activePlayerId && piece.speciesId === "jaguar" && piece.location
      )?.pieceId;

      return Boolean(
        jaguarPieceId &&
          getValidPieceMovementDestinations(room.game, room.game.activePlayerId, jaguarPieceId).length === 0
      );
    }, [activeActionId, activeSpecies?.speciesId, canControlActivePlayer, hasPendingCoatiPairBonus, room?.game]);
  const jaguarTargetPieceIds = useMemo(() => {
    if (
      !room?.game ||
      activeSpecies?.speciesId !== "jaguar" ||
      !selectedPieceId ||
      !selectedJaguarDestination ||
      movementTargets.length === 0
    ) {
      return [];
    }

    return room.game.pieces
      .filter(
        (piece) =>
          piece.ownerId !== room.game?.activePlayerId &&
          piece.location &&
          !piece.state.hidden &&
          piece.location.x === selectedJaguarDestination.x &&
          piece.location.y === selectedJaguarDestination.y
      )
      .map((piece) => piece.pieceId);
  }, [activeSpecies?.speciesId, movementTargets.length, room?.game, selectedJaguarDestination, selectedPieceId]);
  const boardSelectablePieceIds = useMemo(
    () => [...new Set([...selectablePieceIds, ...jaguarTargetPieceIds])],
    [jaguarTargetPieceIds, selectablePieceIds]
  );
  const highlightedPieceIds = useMemo(
    () => [
      ...selectedRemovalPieceIds,
      ...(selectedJaguarTargetPieceId ? [selectedJaguarTargetPieceId] : []),
      ...(selectedWolfTargetPieceId ? [selectedWolfTargetPieceId] : [])
    ],
    [selectedJaguarTargetPieceId, selectedRemovalPieceIds, selectedWolfTargetPieceId]
  );
  const coatiFruitTargets = useMemo(() => {
    if (!room?.game || hasPendingCoatiPairBonus || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getCoatiFruitPlacementPositions(room.game, room.game.activePlayerId);
  }, [canControlActivePlayer, hasPendingCoatiPairBonus, room?.game]);
  const coatiPairBonusTargets = useMemo(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getCoatiPairBonusTargets(room.game, room.game.activePlayerId);
  }, [canControlActivePlayer, room?.game]);
  const capuchinPlacementTargets = useMemo(() => {
    if (!room?.game || activeSpecies?.speciesId !== "capuchin" || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getCapuchinPlacementPositions(room.game, room.game.activePlayerId);
  }, [activeSpecies?.speciesId, canControlActivePlayer, room?.game]);
  const capuchinReserveCount = activeSpecies?.speciesId === "capuchin" ? activeGamePlayer?.reservePieces.length ?? 0 : 0;
  const macawEggTargets = useMemo(() => {
    if (!room?.game || activeSpecies?.speciesId !== "macaw" || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getMacawEggPlacementPositions(room.game, room.game.activePlayerId);
  }, [activeSpecies?.speciesId, canControlActivePlayer, room?.game]);
  const macawActionCTargets = useMemo(() => {
    if (!room?.game || activeSpecies?.speciesId !== "macaw" || !room.game.activePlayerId || !canControlActivePlayer || selectedPieceId) {
      return [];
    }

    return getMacawActionCTargets(room.game, room.game.activePlayerId);
  }, [activeSpecies?.speciesId, canControlActivePlayer, room?.game, selectedPieceId]);
  const macawAddTargets = useMemo(
    () => (activeActionId === "A" ? macawEggTargets : activeActionId === "C" ? macawActionCTargets : []),
    [activeActionId, macawActionCTargets, macawEggTargets]
  );
  const armadilloSeedTargets = useMemo(() => {
    if (!room?.game || activeSpecies?.speciesId !== "armadillo" || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getArmadilloSeedPlacementPositions(room.game, room.game.activePlayerId);
  }, [activeSpecies?.speciesId, canControlActivePlayer, room?.game]);
  const wolfMeatTargets = useMemo(() => {
    if (!room?.game || activeSpecies?.speciesId !== "maned_wolf" || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getWolfMeatPlacementPositions(room.game, room.game.activePlayerId);
  }, [activeSpecies?.speciesId, canControlActivePlayer, room?.game]);
  const addPieceTargets = useMemo(
    () =>
      activeSpecies?.speciesId === "capuchin"
        ? capuchinPlacementTargets
        : activeSpecies?.speciesId === "macaw"
          ? macawAddTargets
          : activeSpecies?.speciesId === "armadillo"
            ? armadilloSeedTargets
            : activeSpecies?.speciesId === "maned_wolf"
              ? wolfMeatTargets
          : coatiFruitTargets,
    [activeSpecies?.speciesId, armadilloSeedTargets, capuchinPlacementTargets, coatiFruitTargets, macawAddTargets, wolfMeatTargets]
  );
  const capuchinHabitatScore = room?.game && room.game.activePlayerId ? getCapuchinHabitatScore(room.game, room.game.activePlayerId) : 0;
  const macawLineScore = room?.game && room.game.activePlayerId ? getMacawLineScore(room.game, room.game.activePlayerId) : 0;
  const armadilloShareScore = room?.game && room.game.activePlayerId ? getArmadilloShareScore(room.game, room.game.activePlayerId) : 0;
  const scoringPreview = useMemo(() => {
    if (!room?.game || room.game.status !== "active" || !room.game.activePlayerId || activeActionId !== "D") {
      return {
        cardHighlights: [],
        lineHighlights: [],
        lines: 0,
        habitats: [] as ReturnType<typeof getCapuchinScoringHabitats>,
        armadillo: null as ReturnType<typeof getArmadilloSharingDetails> | null
      };
    }

    if (activeSpecies?.speciesId === "macaw") {
      const lines = getMacawScoringLines(room.game, room.game.activePlayerId);
      return {
        cardHighlights: [],
        lineHighlights: lines.map((line) => ({ positions: line.positions, label: "+1", color: 0x3a7fc4 })),
        lines: lines.length,
        habitats: [] as ReturnType<typeof getCapuchinScoringHabitats>,
        armadillo: null as ReturnType<typeof getArmadilloSharingDetails> | null
      };
    }

    if (activeSpecies?.speciesId === "capuchin") {
      const habitats = getCapuchinScoringHabitats(room.game, room.game.activePlayerId);
      return {
        cardHighlights: habitats.flatMap((group) =>
          group.positions.map((position) => ({
            position,
            label: `${habitatShortLabel[group.habitat as keyof typeof habitatShortLabel]} +1`,
            color: HABITAT_SCORE_COLORS[group.habitat as keyof typeof HABITAT_SCORE_COLORS]
          }))
        ),
        lineHighlights: [],
        lines: 0,
        habitats,
        armadillo: null as ReturnType<typeof getArmadilloSharingDetails> | null
      };
    }

    if (activeSpecies?.speciesId === "armadillo") {
      const armadillo = getArmadilloSharingDetails(room.game, room.game.activePlayerId);
      return {
        cardHighlights: armadillo.sharedPositions.map((position) => ({
          position,
          label: "compartilha",
          color: 0xf2c14e
        })),
        lineHighlights: [],
        lines: 0,
        habitats: [] as ReturnType<typeof getCapuchinScoringHabitats>,
        armadillo
      };
    }

    return {
      cardHighlights: [],
      lineHighlights: [],
      lines: 0,
      habitats: [] as ReturnType<typeof getCapuchinScoringHabitats>,
      armadillo: null as ReturnType<typeof getArmadilloSharingDetails> | null
    };
  }, [activeActionId, activeSpecies?.speciesId, room?.game]);
  const wolfRemovableBasePieceIds =
    room?.game && room.game.activePlayerId ? getWolfRemovableBasePieceIds(room.game, room.game.activePlayerId) : [];
  const wolfSpendableResources =
    room?.game && room.game.activePlayerId ? getWolfSpendableResourceTypes(room.game, room.game.activePlayerId) : [];
  const availableWolfPointSpendCount =
    room?.game && room.game.activePlayerId ? getAvailableWolfPointSpendCount(room.game, room.game.activePlayerId) : 0;
  const handCards = useMemo(
    () => (currentGamePlayer?.hand ?? []).map((cardId) => getForestCardDefinition(cardId)),
    [currentGamePlayer?.hand]
  );
  const showHandDuringGame = Boolean(hasStartedGame && currentGamePlayer && (room?.game?.status === "setup" || room?.game?.status === "active"));
  const canSelectHandCards = Boolean(room?.game?.status === "active");
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
      const removedPieces: Array<{ ownerId: string; speciesId: SpeciesId; location: GridPosition }> = [];

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
          const target =
            (hudGamePlayer?.playerId === player.playerId ? effectTargetRefs.current.get(`hud:${resource}`) : null) ??
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
        const from = forestCanvasRef.current?.getCardCenter(removed.location);
        const target =
          (hudGamePlayer?.playerId === removed.ownerId ? effectTargetRefs.current.get("hud:reserve") : null) ??
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
        }, 920);
      }
    }

    prevGameRef.current = game;
  }, [hudGamePlayer?.playerId, room?.game]);

  async function run(action: () => Promise<PublicRoomState>, success?: string) {
    if (onlineActionInFlightRef.current) {
      return;
    }

    onlineActionInFlightRef.current = true;
    setError(null);
    setNotice(null);

    try {
      const nextRoom = await action();
      applyOnlineRoomState(nextRoom);
      saveOnlineSession(nextRoom, name);
      if (success) {
        setNotice(success);
      }
    } catch (err) {
      if (isMissingRoomError(err)) {
        clearOnlineSession();
        clearRoomState();
        setJoinCode("");
        setNotice("Essa sala nao existe mais no servidor gratuito. Crie uma nova sala para continuar.");
        return;
      }

      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      onlineActionInFlightRef.current = false;
    }
  }

  function requireSocket(): OikosSocket {
    if (!socket) {
      throw new Error("Conexão com o servidor ainda não foi aberta.");
    }

    return socket;
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

  function adjustBotSpeed(deltaMs: number) {
    if (!room || !isHost) {
      return;
    }

    const nextDelay = Math.max(minBotTurnDelayMs, Math.min(maxBotTurnDelayMs, botTurnDelayMs + deltaMs));
    void run(() => roomApi.setBotSpeed(requireSocket(), room.roomId, nextDelay));
  }

  const handleCardClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room || !canPlaceSetupPiece) {
        return;
      }

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
    [canPlaceSetupPiece, isLocalRoom, room, socket]
  );

  const placeCard = useCallback(
    (position: { x: number; y: number }, rotation: 0 | 90 | 180 | 270) => {
      if (!room?.game || !selectedHandCardId || !canPlaceSelectedForestCard || !room.game.activePlayerId) {
        return;
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
    [canPlaceSelectedForestCard, isLocalRoom, room, selectedHandCardId, socket]
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
            ? "Onca movida."
            : activeSpecies?.speciesId === "capuchin"
              ? "Macaco-prego movido."
              : activeSpecies?.speciesId === "macaw"
              ? activeActionId === "C"
                ? "Arara realocada."
                : "Arara movida."
              : activeSpecies?.speciesId === "armadillo"
                ? "Tatu-bola movido."
                : activeSpecies?.speciesId === "maned_wolf"
                  ? "Lobo-guara movido."
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
    [activeActionId, activeSpecies?.speciesId, isLocalRoom, room, selectedPieceId, socket]
  );

  const handlePieceClick = useCallback(
    (pieceId: string) => {
      if (!boardSelectablePieceIds.includes(pieceId)) {
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
          setNotice("Escolha qual meeple a Onca deve remover neste local.");
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

      if (isLocalRoom) {
        const nextGame =
          activeSpecies?.speciesId === "capuchin"
            ? addCapuchinForCurrentAction(room.game, room.game.activePlayerId, position)
            : activeSpecies?.speciesId === "macaw"
              ? addMacawForCurrentAction(room.game, room.game.activePlayerId, position)
              : activeSpecies?.speciesId === "armadillo"
                ? addArmadilloForCurrentAction(room.game, room.game.activePlayerId, position)
                : activeSpecies?.speciesId === "maned_wolf"
                  ? addWolfForCurrentAction(room.game, room.game.activePlayerId, position)
            : addCoatiForCurrentAction(room.game, room.game.activePlayerId, position);
        setRoom({
          ...room,
          status: nextGame.status === "active" ? "active" : room.status,
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice(
          activeSpecies?.speciesId === "capuchin"
            ? "Macaco-prego adicionado."
            : activeSpecies?.speciesId === "macaw"
              ? "Arara adicionada."
              : activeSpecies?.speciesId === "armadillo"
                ? "Tatu-bola adicionado."
                : activeSpecies?.speciesId === "maned_wolf"
                  ? "Lobo-guara adicionado."
              : "Quati adicionado em local de fruta."
        );
        return;
      }

      void run(() =>
        activeSpecies?.speciesId === "capuchin"
          ? roomApi.addCapuchin(requireSocket(), room.roomId, position.x, position.y)
          : activeSpecies?.speciesId === "macaw"
            ? roomApi.addMacaw(requireSocket(), room.roomId, position.x, position.y)
            : activeSpecies?.speciesId === "armadillo"
              ? roomApi.addArmadillo(requireSocket(), room.roomId, position.x, position.y)
              : activeSpecies?.speciesId === "maned_wolf"
                ? roomApi.addWolf(requireSocket(), room.roomId, position.x, position.y)
          : roomApi.addCoati(requireSocket(), room.roomId, position.x, position.y)
      ).then(() => {
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
    },
    [activeSpecies?.speciesId, addPieceTargets.length, isLocalRoom, room, socket]
  );

  const handleCoatiPairBonusTargetClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room?.game || !room.game.activePlayerId || coatiPairBonusTargets.length === 0) {
        return;
      }

      if (isLocalRoom) {
        const nextGame = resolveCoatiPairBonus(room.game, room.game.activePlayerId, position);
        setRoom({
          ...room,
          status: nextGame.status === "active" ? "active" : room.status,
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice("Bonus da dupla de quatis resolvido.");
        return;
      }

      void run(() => roomApi.resolveCoatiPair(requireSocket(), room.roomId, position.x, position.y)).then(() => {
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
    },
    [coatiPairBonusTargets.length, isLocalRoom, room, socket]
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

    if (isLocalRoom) {
      const nextGame = removePiecesForCurrentAction(room.game, room.game.activePlayerId, selectedRemovalPieceIds);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
      setNotice("Quatis removidos da floresta.");
      return;
    }

    void run(() => roomApi.removePieces(requireSocket(), room.roomId, selectedRemovalPieceIds)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, requiredCoatiRemovalCount, room, selectedRemovalPieceIds, socket]);

  const handleSpendJaguarMeat = useCallback(
    (count: number) => {
      if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
        return;
      }

      if (isLocalRoom) {
        const nextGame = spendJaguarMeatForPoints(room.game, room.game.activePlayerId, count);
        setRoom({
          ...room,
          status: nextGame.status === "active" ? "active" : room.status,
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice("Carne gasta e pontos marcados.");
        return;
      }

      void run(() => roomApi.spendJaguarMeat(requireSocket(), room.roomId, count)).then(() => {
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
    },
    [canControlActivePlayer, isLocalRoom, room, socket]
  );

  const handleScoreCapuchin = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    const activeId = room.game.activePlayerId;
    const groups = getCapuchinScoringHabitats(room.game, activeId);
    const playerName = room.game.players.find((p) => p.playerId === activeId)?.name ?? "Macaco-prego";

    const finalize = () => {
      if (isLocalRoom) {
        const currentGame = room.game;
        if (!currentGame) return;
        const nextGame = scoreCapuchinHabitatPresence(currentGame, activeId);
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                status: nextGame.status === "active" ? "active" : prev.status,
                game: nextGame,
                warnings: nextGame.contentWarnings
              }
            : prev
        );
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice("Macaco-prego pontuado.");
        return;
      }

      void run(() => roomApi.scoreCapuchin(requireSocket(), room.roomId)).then(() => {
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
    };

    if (groups.length === 0) {
      finalize();
      return;
    }

    setCapuchinScoreAnim({ groups, points: groups.length, playerName });
    setCapuchinAnimTick((t) => t + 1);

    window.setTimeout(() => {
      setCapuchinScoreAnim(null);
      finalize();
    }, 2400);
  }, [canControlActivePlayer, isLocalRoom, room, socket]);

  const handleScoreMacaw = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    const activeId = room.game.activePlayerId;
    const lines: MacawScoringLine[] = getMacawScoringLines(room.game, activeId);
    const playerName = room.game.players.find((p) => p.playerId === activeId)?.name ?? "Arara-azul";

    const finalize = () => {
      if (isLocalRoom) {
        const currentGame = room.game;
        if (!currentGame) return;
        const nextGame = scoreMacawLines(currentGame, activeId);
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                status: nextGame.status === "active" ? "active" : prev.status,
                game: nextGame,
                warnings: nextGame.contentWarnings
              }
            : prev
        );
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice("Arara-azul pontuada.");
        return;
      }

      void run(() => roomApi.scoreMacaw(requireSocket(), room.roomId)).then(() => {
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
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
    setMacawAnimTick((tick) => tick + 1);

    window.setTimeout(() => {
      setMacawScoreAnim(null);
      finalize();
    }, 2400);
  }, [canControlActivePlayer, isLocalRoom, room, socket]);

  const handleHideArmadillo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || !selectedPieceId) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = hideArmadilloForCurrentAction(room.game, room.game.activePlayerId, selectedPieceId);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
      setNotice("Tatu-bola escondido.");
      return;
    }

    void run(() => roomApi.hideArmadillo(requireSocket(), room.roomId, selectedPieceId)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, room, selectedPieceId, socket]);

  const handleScoreArmadillo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = scoreArmadilloSharing(room.game, room.game.activePlayerId);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
      setNotice("Tatu-bola pontuado.");
      return;
    }

    void run(() => roomApi.scoreArmadillo(requireSocket(), room.roomId)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, room, socket]);

  const handleRemoveWolfBasePiece = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || !selectedWolfTargetPieceId) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = removeBasePieceForWolfAction(room.game, room.game.activePlayerId, selectedWolfTargetPieceId);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
      setNotice("Lobo-guara removeu peca de base.");
      return;
    }

    void run(() => roomApi.removeWolfBasePiece(requireSocket(), room.roomId, selectedWolfTargetPieceId)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, room, selectedWolfTargetPieceId, socket]);

  const handleSpendWolfResources = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || selectedWolfResources.length === 0) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = spendWolfResourcesForPoints(room.game, room.game.activePlayerId, selectedWolfResources);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
      setNotice("Lobo-guara gastou recursos e marcou pontos.");
      return;
    }

    void run(() => roomApi.spendWolfResources(requireSocket(), room.roomId, selectedWolfResources)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, room, selectedWolfResources, socket]);

  const handleCompleteAction = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = completeCurrentAction(room.game, room.game.activePlayerId);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
      setNotice("Acao concluida.");
      return;
    }

    void run(() => roomApi.completeAction(requireSocket(), room.roomId)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, room, socket]);

  function toggleLocalSpecies(speciesId: SpeciesId) {
    setLocalSpeciesIds((current) =>
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

    const localPlayers: RoomPlayer[] = localSpeciesIds.map((speciesId) => ({
      playerId: `local_${speciesId}`,
      name: speciesDefinitions[speciesId].displayName,
      speciesId,
      ready: true,
      connected: true
    }));
    const game = createInitialGameState(localRoomId, localPlayers);

    lastOnlineRoomSnapshotRef.current = "";
    setRoom({
      roomId: localRoomId,
      status: "setup",
      hostPlayerId: "local_host",
      players: localPlayers,
      game,
      warnings: game.contentWarnings
    });
    setNotice("Teste local iniciado.");
  }

  function stopLocalTest() {
    clearRoomState();
    setNotice("Teste local encerrado.");
  }

  function leaveTable() {
    if (room?.roomId !== localRoomId) {
      clearOnlineSession();
    }
    clearRoomState();
    setError(null);
    setNotice(isLocalRoom ? "Teste local encerrado." : "Voce saiu da mesa.");
  }

  useEffect(() => {
    if (
      room?.game?.status !== "active" ||
      hasPendingCoatiPairBonus ||
      !canControlActivePlayer ||
      activeActionId !== "D" ||
      !room.game.activePlayerId
    ) {
      return;
    }
    const species = activeSpecies?.speciesId;
    if (species !== "capuchin" && species !== "macaw" && species !== "armadillo") {
      return;
    }
    const key = `${room.game.activePlayerId}:${room.game.round}:${species}:D`;
    if (autoScoredRef.current === key) {
      return;
    }
    autoScoredRef.current = key;
    const timer = window.setTimeout(() => {
      if (species === "capuchin") {
        handleScoreCapuchin();
      } else if (species === "macaw") {
        handleScoreMacaw();
      } else {
        handleScoreArmadillo();
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    activeActionId,
    activeSpecies?.speciesId,
    canControlActivePlayer,
    handleScoreArmadillo,
    handleScoreCapuchin,
    handleScoreMacaw,
    hasPendingCoatiPairBonus,
    room?.game?.activePlayerId,
    room?.game?.round,
    room?.game?.status
  ]);

  const setupSpecies = currentGamePlayer?.speciesId ? speciesDefinitions[currentGamePlayer.speciesId] : null;
  const setupPlaced = currentGamePlayer?.piecesInForest.length ?? 0;
  const setupNeeded = setupSpecies?.initialPieces ?? 0;

  return (
    <main className={`app-shell ${hasStartedGame ? "game-active" : "menu-active"}`}>
      {cardDrag && (
        <div className="card-drag-layer" aria-hidden="true">
          <span
            className={`card-drag-ghost ${cardDrag.target ? "locked" : ""}`}
            style={
              {
                "--ghost-x": `${cardDrag.x}px`,
                "--ghost-y": `${cardDrag.y}px`,
                "--ghost-size": `${cardDrag.size}px`
              } as CSSProperties
            }
          >
            <img
              src={cardDrag.src}
              alt=""
              style={{ transform: `rotate(${selectedCardRotation}deg)` }}
            />
          </span>
        </div>
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
      {macawScoreAnim && (() => {
        void macawAnimTick;
        const hostEl = forestCanvasRef.current?.getHostElement();
        if (!hostEl) return null;
        const resolved = macawScoreAnim.lines
          .map((line) => {
            const a = forestCanvasRef.current?.getCardLocal(line.positions[0]);
            const m = forestCanvasRef.current?.getCardLocal(line.positions[1]);
            const c = forestCanvasRef.current?.getCardLocal(line.positions[2]);
            if (!a || !m || !c) return null;
            return { from: a, mid: m, to: c };
          })
          .filter((value): value is { from: { x: number; y: number }; mid: { x: number; y: number }; to: { x: number; y: number } } => value !== null);

        const overlay = (
          <>
            <svg className="macaw-score-overlay" aria-hidden="true">
              <defs>
                <filter id="macawGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {resolved.map((line, idx) => {
                const hueShift = idx * 22;
                const stroke = `hsl(${210 + hueShift}, 85%, 62%)`;
                const length = Math.hypot(line.to.x - line.from.x, line.to.y - line.from.y);
                const delay = idx * 280;
                return (
                  <g key={idx}>
                    <line
                      className="macaw-line-stroke macaw-line-glow"
                      x1={line.from.x}
                      y1={line.from.y}
                      x2={line.to.x}
                      y2={line.to.y}
                      stroke={stroke}
                      strokeOpacity="0.35"
                      strokeWidth={18}
                      strokeLinecap="round"
                      style={{ animationDelay: `${delay}ms` } as CSSProperties}
                    />
                    <line
                      className="macaw-line-stroke macaw-line-main"
                      x1={line.from.x}
                      y1={line.from.y}
                      x2={line.to.x}
                      y2={line.to.y}
                      stroke={stroke}
                      strokeWidth={6}
                      strokeLinecap="round"
                      strokeDasharray={length}
                      strokeDashoffset={length}
                      filter="url(#macawGlow)"
                      style={{ animationDelay: `${delay}ms`, ["--dash" as string]: `${length}` } as CSSProperties}
                    />
                    {[line.from, line.mid, line.to].map((dot, dotIdx) => (
                      <circle
                        key={dotIdx}
                        className="macaw-line-dot"
                        cx={dot.x}
                        cy={dot.y}
                        r={10}
                        fill={stroke}
                        style={{ animationDelay: `${delay + dotIdx * 120}ms` } as CSSProperties}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
            <div className="macaw-score-stamps" aria-hidden="true">
              {resolved.map((line, idx) => {
                const cx = (line.from.x + line.to.x) / 2;
                const cy = (line.from.y + line.to.y) / 2;
                const angle = Math.atan2(line.to.y - line.from.y, line.to.x - line.from.x) * (180 / Math.PI);
                const normalAngle = angle + 90;
                const offset = 32;
                const offX = Math.cos((normalAngle * Math.PI) / 180) * offset;
                const offY = Math.sin((normalAngle * Math.PI) / 180) * offset;
                return (
                  <span
                    key={idx}
                    className="macaw-score-stamp"
                    style={
                      {
                        left: `${cx + offX}px`,
                        top: `${cy + offY}px`,
                        animationDelay: `${idx * 280 + 600}ms`
                      } as CSSProperties
                    }
                  >
                    +1
                  </span>
                );
              })}
            </div>
          </>
        );

        return (
          <>
            {createPortal(overlay, hostEl)}
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
          </>
        );
      })()}
      {capuchinScoreAnim && (() => {
        void capuchinAnimTick;
        const hostEl = forestCanvasRef.current?.getHostElement();
        if (!hostEl) return null;
        const HABITAT_COLORS: Record<string, { fill: string; stroke: string; tagBg: string }> = {
          forest: { fill: "rgba(79, 174, 110, 0.32)", stroke: "#4fae6e", tagBg: "#2d8553" },
          field: { fill: "rgba(242, 193, 78, 0.32)", stroke: "#f2c14e", tagBg: "#d29a2f" },
          river: { fill: "rgba(79, 159, 216, 0.32)", stroke: "#4f9fd8", tagBg: "#2d70b5" }
        };
        const HABITAT_NAMES: Record<string, string> = {
          forest: "Bosque",
          field: "Campo",
          river: "Rio"
        };
        const cardSize = forestCanvasRef.current?.getCardScreenSize() ?? 0;
        const resolvedGroups = capuchinScoreAnim.groups.map((group, idx) => {
          const rects = group.positions
            .map((pos) => {
              const c = forestCanvasRef.current?.getCardLocal(pos);
              if (!c) return null;
              return { center: c };
            })
            .filter((value): value is { center: { x: number; y: number } } => value !== null);
          const centroid = rects.length
            ? {
                x: rects.reduce((acc, r) => acc + r.center.x, 0) / rects.length,
                y: rects.reduce((acc, r) => acc + r.center.y, 0) / rects.length
              }
            : null;
          const colors = HABITAT_COLORS[group.habitat] ?? HABITAT_COLORS.forest;
          const name = HABITAT_NAMES[group.habitat] ?? group.habitat;
          const delay = idx * 320;
          return { rects, centroid, colors, name, delay, habitat: group.habitat };
        });

        const overlay = (
          <>
            <svg className="capuchin-score-overlay" aria-hidden="true">
              {resolvedGroups.flatMap((group, gIdx) =>
                group.rects.map((rect, rIdx) => (
                  <rect
                    key={`${gIdx}-${rIdx}`}
                    className="capuchin-card-rect"
                    x={rect.center.x - cardSize / 2}
                    y={rect.center.y - cardSize / 2}
                    width={cardSize}
                    height={cardSize}
                    rx={14}
                    ry={14}
                    fill={group.colors.fill}
                    stroke={group.colors.stroke}
                    strokeWidth={4}
                    style={{ animationDelay: `${group.delay + rIdx * 90}ms` } as CSSProperties}
                  />
                ))
              )}
            </svg>
            <div className="capuchin-score-stamps" aria-hidden="true">
              {resolvedGroups.map((group, idx) =>
                group.centroid ? (
                  <span
                    key={idx}
                    className="capuchin-score-stamp"
                    style={
                      {
                        left: `${group.centroid.x}px`,
                        top: `${group.centroid.y}px`,
                        background: group.colors.tagBg,
                        borderColor: group.colors.stroke,
                        animationDelay: `${group.delay + 500}ms`
                      } as CSSProperties
                    }
                  >
                    <strong>{group.name}</strong>
                    <em>+1</em>
                  </span>
                ) : null
              )}
            </div>
          </>
        );

        return (
          <>
            {createPortal(overlay, hostEl)}
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
          </>
        );
      })()}
      {hasStartedGame && (
        <button
          type="button"
          className={`hud-collapse-tab hud-collapse-left ${hudLeftCollapsed ? "is-collapsed" : ""}`}
          title={hudLeftCollapsed ? "Mostrar painel" : "Ocultar painel"}
          aria-label={hudLeftCollapsed ? "Mostrar painel" : "Ocultar painel"}
          onClick={() => setHudLeftCollapsed((value) => !value)}
        >
          {hudLeftCollapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
        </button>
      )}
      {hasStartedGame && (
        <button
          type="button"
          className={`hud-collapse-tab hud-collapse-right ${hudRightCollapsed ? "is-collapsed" : ""}`}
          title={hudRightCollapsed ? "Mostrar jogadores" : "Ocultar jogadores"}
          aria-label={hudRightCollapsed ? "Mostrar jogadores" : "Ocultar jogadores"}
          onClick={() => setHudRightCollapsed((value) => !value)}
        >
          {hudRightCollapsed ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </button>
      )}
      {!hasStartedGame && !room && landingMode === "idle" && (
        <div className="landing-screen" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-2" />
            <span className="orb orb-3" />
          </div>

          <header className="landing-header landing-header-minimal">
            <span aria-hidden="true" />
            <span className="landing-version">v0.1 · beta</span>
          </header>

          <div className="landing-hero landing-hero-logo">
            <img className="brand-logo-hero" src="/oikos-logo.png" alt="Oikos Digital" />
          </div>

          <div className="landing-panel">
            <label className="landing-name-field">
              <Users aria-hidden="true" />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={24}
                placeholder="Seu nome"
                aria-label="Seu nome"
              />
            </label>

            <div className="landing-actions">
              <button
                type="button"
                className="landing-action landing-action-primary"
                onClick={() => run(() => roomApi.create(requireSocket(), name), "Sala criada.")}
              >
                <span className="landing-action-icon">
                  <Play aria-hidden="true" />
                </span>
                <span className="landing-action-text">
                  <strong>Criar Sala</strong>
                  <small>Hospede uma partida online</small>
                </span>
              </button>

              <button
                type="button"
                className="landing-action landing-action-secondary"
                onClick={() => setLandingMode("join")}
              >
                <span className="landing-action-icon">
                  <LogIn aria-hidden="true" />
                </span>
                <span className="landing-action-text">
                  <strong>Entrar com Código</strong>
                  <small>Junte-se a uma sala existente</small>
                </span>
              </button>

              <button
                type="button"
                className="landing-action landing-action-secondary"
                onClick={() => setLandingMode("local")}
              >
                <span className="landing-action-icon">
                  <MapPin aria-hidden="true" />
                </span>
                <span className="landing-action-text">
                  <strong>Teste Local</strong>
                  <small>Controle 2-6 espécies nesta tela</small>
                </span>
              </button>
            </div>
          </div>

          <div className="landing-species-rail" aria-hidden="true">
            {speciesList.map((species) => (
              <div
                key={species.speciesId}
                className="landing-species-card"
                style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
              >
                <img src={encodeURI(species.meepleAsset)} alt="" />
                <span>{species.displayName}</span>
              </div>
            ))}
          </div>

          <footer className="landing-footer">
            <span>Oikos Digital</span>
            <span className="landing-footer-sep">·</span>
            <span>Servidor autoritativo · Socket.IO</span>
          </footer>
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
              <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.png" alt="Oikos" />
            </div>
            <span className="flow-spacer" aria-hidden="true" />
          </header>

          <div className="flow-body">
            <div className="flow-icon-large">
              <LogIn aria-hidden="true" />
            </div>
            <h2 className="flow-title">Entrar em Sala</h2>
            <p className="flow-subtitle">
              Digite o código de 5 caracteres compartilhado pelo anfitrião.
            </p>

            <form
              className="flow-card flow-card-join"
              onSubmit={(event) => {
                event.preventDefault();
                if (joinCode.length >= 4) {
                  void run(() => roomApi.join(requireSocket(), joinCode, name), "Entrada confirmada.");
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
                  autoFocus
                />
              </div>

              <button type="submit" className="flow-submit" disabled={joinCode.length < 4}>
                <LogIn aria-hidden="true" />
                Entrar na Sala
              </button>
            </form>
          </div>
        </div>
      )}

      {!hasStartedGame && !room && landingMode === "local" && (
        <div className="flow-screen flow-screen-local" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-3" />
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
              <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.png" alt="Oikos" />
            </div>
            <span className="flow-spacer" aria-hidden="true" />
          </header>

          <div className="flow-body flow-body-wide">
            <div className="flow-icon-large flow-icon-amber">
              <MapPin aria-hidden="true" />
            </div>
            <h2 className="flow-title">Teste Local</h2>
            <p className="flow-subtitle">
              Controle de 2 a 6 espécies nesta mesma tela. Ideal para aprender as regras e testar estratégias.
            </p>

            <div className="flow-card flow-card-local">
              <div className="flow-card-header">
                <span>Escolha as espécies</span>
                <span className="flow-counter">
                  {localSpeciesIds.length}/6
                </span>
              </div>
              <div className="flow-species-grid">
                {speciesList.map((species) => {
                  const selected = localSpeciesIds.includes(species.speciesId);
                  return (
                    <button
                      key={species.speciesId}
                      type="button"
                      className={`flow-species-card ${selected ? "selected" : ""}`}
                      onClick={() => toggleLocalSpecies(species.speciesId)}
                      style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
                    >
                      <div className="flow-species-thumb">
                        <img src={encodeURI(species.meepleAsset)} alt="" />
                      </div>
                      <div className="flow-species-text">
                        <strong>{species.displayName}</strong>
                        <small>{categoryLabels[species.category]}</small>
                      </div>
                      {selected && (
                        <span className="flow-species-check" aria-hidden="true">
                          <Check />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="flow-submit"
                onClick={startLocalTest}
                disabled={localSpeciesIds.length < 2}
              >
                <Play aria-hidden="true" />
                Iniciar Partida ({localSpeciesIds.length} espécies)
              </button>
              {localSpeciesIds.length < 2 && (
                <small className="flow-hint">Mínimo 2 espécies para iniciar.</small>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasStartedGame && room && (
        <div className="flow-screen flow-screen-lobby" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-2" />
            <span className="orb orb-3" />
          </div>

          <header className="flow-header">
            <button
              type="button"
              className="flow-back"
              onClick={() => {
                if (isLocalRoom) {
                  stopLocalTest();
                } else {
                  leaveTable();
                }
                setLandingMode("idle");
              }}
              aria-label="Sair da sala"
            >
              <LogOut aria-hidden="true" />
              <span>Sair</span>
            </button>
            <div className="landing-logo flow-logo">
              <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.png" alt="Oikos" />
            </div>
            <span className="flow-spacer" aria-hidden="true" />
          </header>

          <div className="flow-body flow-body-lobby">
            <div className="lobby-hero">
              <span className="lobby-badge">{isLocalRoom ? "Teste Local" : "Sala Online"}</span>
              <h2 className="flow-title lobby-title">
                {isLocalRoom ? "Mesa Local" : "Sala de Espera"}
              </h2>
              {!isLocalRoom && (
                <div className="lobby-code-card">
                  <span className="lobby-code-label">Código da Sala</span>
                  <div className="lobby-code-display">
                    <span className="lobby-code-value">{room.roomId}</span>
                    <button
                      type="button"
                      className="lobby-code-copy"
                      title="Copiar código"
                      onClick={() => {
                        void navigator.clipboard?.writeText(room.roomId);
                        setNotice("Código copiado.");
                      }}
                    >
                      <Copy aria-hidden="true" />
                    </button>
                  </div>
                  <small>Compartilhe com seus amigos para entrarem.</small>
                </div>
              )}
            </div>

            <div className="lobby-columns">
              <section className="lobby-card lobby-players">
                <header className="lobby-card-header">
                  <Users aria-hidden="true" />
                  <h3>Jogadores</h3>
                  <span className="lobby-count">{room.players.length}</span>
                </header>
                <ul className="lobby-player-list">
                  {room.players.map((player) => {
                    const species = player.speciesId ? speciesDefinitions[player.speciesId] : null;
                    const isYou = player.playerId === playerId;
                    const isThisHost = player.playerId === room.hostPlayerId;
                    return (
                      <li
                        key={player.playerId}
                        className={`lobby-player ${player.ready ? "ready" : ""} ${isYou ? "you" : ""}`}
                        style={
                          species
                            ? ({ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties)
                            : undefined
                        }
                      >
                        <div className="lobby-player-avatar">
                          {species ? (
                            <img src={encodeURI(species.meepleAsset)} alt="" />
                          ) : (
                            <Users aria-hidden="true" />
                          )}
                        </div>
                        <div className="lobby-player-text">
                          <strong>
                            {player.name || "Jogador"}
                            {isYou && <span className="lobby-tag lobby-tag-you">Você</span>}
                            {isThisHost && !isLocalRoom && <span className="lobby-tag lobby-tag-host">Host</span>}
                            {player.isBot && <span className="lobby-tag lobby-tag-bot">Bot</span>}
                          </strong>
                          <small>
                            {species ? species.displayName : "Sem espécie"}
                            {player.ready && " · Pronto"}
                          </small>
                        </div>
                        {player.ready && (
                          <span className="lobby-player-check" aria-hidden="true">
                            <Check />
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {isHost && !isLocalRoom && (
                  <div className="lobby-host-controls">
                    <p className="lobby-hint">
                      <Bot aria-hidden="true" />
                      <span>Clique no botão de bot em cada espécie para adicionar/remover bots.</span>
                    </p>
                    {roomHasBots && (
                      <button
                        type="button"
                        className="lobby-mini-button"
                        onClick={() => run(() => roomApi.removeBots(requireSocket(), room.roomId), "Bots removidos.")}
                      >
                        <X aria-hidden="true" />
                        Remover todos os bots
                      </button>
                    )}
                    <div className="lobby-bot-speed">
                      <button
                        type="button"
                        className="icon-button compact"
                        title="Bots mais rápidos"
                        onClick={() => adjustBotSpeed(-botTurnDelayStepMs)}
                      >
                        <Minus aria-hidden="true" />
                      </button>
                      <span>Velocidade: {formatBotDelay(botTurnDelayMs)}</span>
                      <button
                        type="button"
                        className="icon-button compact"
                        title="Bots mais lentos"
                        onClick={() => adjustBotSpeed(botTurnDelayStepMs)}
                      >
                        <Plus aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="lobby-card lobby-species">
                <header className="lobby-card-header">
                  <ShieldCheck aria-hidden="true" />
                  <h3>Escolha sua Espécie</h3>
                </header>
                <div className="lobby-species-grid">
                  {speciesList.map((species) => {
                    const takenBy = room.players.find((player) => player.speciesId === species.speciesId);
                    const selected =
                      currentPlayer?.speciesId === species.speciesId || selectedSpecies === species.speciesId;
                    const takenByOther = Boolean(takenBy && takenBy.playerId !== controlledPlayerId);
                    const isBotSlot = Boolean(takenBy?.isBot);
                    const isHumanSlot = Boolean(takenBy && !takenBy.isBot);
                    const disabled = takenByOther || room.status !== "lobby";
                    const canToggleBot = isHost && !isLocalRoom && room.status === "lobby" && !isHumanSlot;
                    return (
                      <div
                        key={species.speciesId}
                        className={`lobby-species-card-wrap ${isBotSlot ? "is-bot" : ""}`}
                        style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
                      >
                        <button
                          type="button"
                          className={`lobby-species-card ${selected ? "selected" : ""}`}
                          disabled={disabled}
                          onClick={() => {
                            setSelectedSpecies(species.speciesId);
                            void run(() => roomApi.selectSpecies(requireSocket(), room.roomId, species.speciesId));
                          }}
                        >
                          <div className="lobby-species-thumb">
                            <img src={encodeURI(species.meepleAsset)} alt="" />
                          </div>
                          <div className="lobby-species-text">
                            <strong>{species.displayName}</strong>
                            <small>{categoryLabels[species.category]}</small>
                          </div>
                          {isBotSlot && (
                            <span className="lobby-species-taken lobby-species-bot-tag">
                              <Bot aria-hidden="true" />
                              Bot
                            </span>
                          )}
                          {isHumanSlot && takenBy?.playerId !== controlledPlayerId && (
                            <span className="lobby-species-taken">{takenBy?.name || "Em uso"}</span>
                          )}
                        </button>
                        {canToggleBot && (
                          <button
                            type="button"
                            className={`lobby-species-bot-btn ${isBotSlot ? "active" : ""}`}
                            title={isBotSlot ? "Remover bot" : "Adicionar bot"}
                            aria-label={isBotSlot ? "Remover bot" : "Adicionar bot"}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (isBotSlot) {
                                void run(
                                  () => roomApi.removeBotSpecies(requireSocket(), room.roomId, species.speciesId),
                                  "Bot removido."
                                );
                              } else {
                                void run(
                                  () => roomApi.addBotSpecies(requireSocket(), room.roomId, species.speciesId),
                                  "Bot adicionado."
                                );
                              }
                            }}
                          >
                            {isBotSlot ? <X aria-hidden="true" /> : <Bot aria-hidden="true" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="lobby-footer-actions">
              {!isLocalRoom && (
                <button
                  type="button"
                  className={`lobby-ready-btn ${currentPlayer?.ready ? "is-ready" : ""}`}
                  onClick={() =>
                    run(() => roomApi.ready(requireSocket(), requireRoom().roomId, !currentPlayer?.ready))
                  }
                  disabled={!currentPlayer?.speciesId}
                >
                  <Check aria-hidden="true" />
                  {currentPlayer?.ready ? "Pronto!" : "Marcar Pronto"}
                </button>
              )}
              {isHost && !isLocalRoom && (
                <button
                  type="button"
                  className="flow-submit lobby-start-btn"
                  onClick={() => run(() => roomApi.start(requireSocket(), room.roomId))}
                >
                  <Play aria-hidden="true" />
                  Iniciar Partida
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {hasStartedGame && (
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

      {hasStartedGame && configOpen && (
        <div className="config-modal-backdrop" role="presentation" onClick={() => setConfigOpen(false)}>
          <div
            className="config-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Mesa"
            onClick={(event) => event.stopPropagation()}
          >
          <section className="panel-block session-card">
            <div className="section-title">
              <Users aria-hidden="true" />
              <h2>Mesa</h2>
            </div>
            <div className="session-row">
              <div>
                <span>{isLocalRoom ? "Teste local" : "Sala online"}</span>
                <strong>{room?.roomId ?? "Mesa"}</strong>
              </div>
              {!isLocalRoom && room && (
                <button
                  className="icon-button compact"
                  title="Copiar codigo da sala"
                  onClick={() => {
                    void navigator.clipboard?.writeText(room.roomId);
                    setNotice("Codigo copiado.");
                  }}
                >
                  <Copy aria-hidden="true" />
                </button>
              )}
            </div>
            {!isLocalRoom && isHost && (
              <div className="bot-speed-control" aria-label="Velocidade dos bots">
                <button
                  type="button"
                  className="icon-button compact"
                  title="Bots mais rápidos"
                  aria-label="Bots mais rápidos"
                  onClick={() => adjustBotSpeed(-botTurnDelayStepMs)}
                >
                  <Minus aria-hidden="true" />
                </button>
                <span>Bots {formatBotDelay(botTurnDelayMs)}</span>
                <button
                  type="button"
                  className="icon-button compact"
                  title="Bots mais lentos"
                  aria-label="Bots mais lentos"
                  onClick={() => adjustBotSpeed(botTurnDelayStepMs)}
                >
                  <Plus aria-hidden="true" />
                </button>
              </div>
            )}
            <button className="secondary-button exit-button" onClick={leaveTable}>
              <LogOut aria-hidden="true" />
              Sair
            </button>
            <button type="button" className="secondary-button" onClick={() => setConfigOpen(false)}>
              <X aria-hidden="true" />
              Fechar
            </button>
          </section>

          <section className="panel-block audio-card">
            <div className="section-title">
              {audioSettings.muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              <h2>Áudio</h2>
            </div>
            <button
              type="button"
              className={`secondary-button ${audioSettings.muted ? "" : "is-active"}`}
              onClick={() => updateAudio({ muted: !audioSettings.muted })}
            >
              {audioSettings.muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              {audioSettings.muted ? "Som desligado" : "Som ligado"}
            </button>
            <label className="audio-slider">
              <span>Efeitos</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(audioSettings.sfxVolume * 100)}
                disabled={audioSettings.muted}
                onChange={(event) => updateAudio({ sfxVolume: Number(event.target.value) / 100 })}
              />
              <small>{Math.round(audioSettings.sfxVolume * 100)}%</small>
            </label>
          </section>
          </div>
        </div>
      )}

      {hasStartedGame && hudGamePlayer && hudSpecies && (
        <section className="hud-species panel-block species-hud" style={speciesVar(hudGamePlayer.speciesId)}>
            <div className="species-hud-header">
              <img className="player-portrait" src={encodeURI(hudSpecies.portraitAsset)} alt="" />
              <div>
                <span>{currentGamePlayer ? "Controlando" : "Vez atual"}</span>
                <h2>{hudSpecies.displayName}</h2>
                <p>{hudGamePlayer.name}</p>
              </div>
            </div>

            <div className="hud-stat-grid">
              <div className="hud-stat-card">
                <Trophy aria-hidden="true" />
                <span>Pontos</span>
                <strong><AnimatedNumber value={hudGamePlayer.score} /></strong>
              </div>
              <div className="hud-stat-card" ref={(node) => setEffectTarget("hud:reserve", node)}>
                <Package aria-hidden="true" />
                <span>Reserva</span>
                <strong>{hudGamePlayer.reservePieces.length}</strong>
              </div>
              <div className="hud-stat-card">
                <img src={encodeURI(hudSpecies.meepleAsset)} alt="" />
                <span>Na floresta</span>
                <strong>{hudGamePlayer.piecesInForest.length}</strong>
              </div>
            </div>

            <div className="resource-bank">
              {resourceOrder.map((resource) => (
                <div className="resource-chip" key={resource} ref={(node) => setEffectTarget(`hud:${resource}`, node)}>
                  <img src={encodeURI(resourceAssets[resource])} alt="" />
                  <span>{resourceLabels[resource]}</span>
                  <strong><AnimatedNumber value={hudGamePlayer.resources[resource] ?? 0} /></strong>
                </div>
              ))}
              {floatingGains.length > 0 && (
                <div className="floating-gains" aria-hidden="true">
                  {floatingGains.map((gain) => (
                    <span className="floating-gain" key={gain.id}>
                      <img src={encodeURI(resourceAssets[gain.resource])} alt="" />
                      +{gain.amount} {gain.resource === "point" ? "ponto" : resourceLabels[gain.resource]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {(error || notice) && (
          <div className={`status-message hud-toast ${error ? "error" : "notice"}`}>
            {error ? <AlertTriangle aria-hidden="true" /> : <Check aria-hidden="true" />}
            <span>{error ?? notice}</span>
          </div>
        )}

        {hasStartedGame && (
        <div className={`hud-action hud-dock hud-left ${hudLeftCollapsed ? "is-collapsed" : ""} ${turnSummary ? "has-turn-recap" : ""}`}>
        {room?.game?.status === "setup" && (
          <section className="panel-block setup-block">
            <div className="section-title">
              <MapPin aria-hidden="true" />
              <h2>Setup</h2>
            </div>
            <p>
              Vez de <strong>{setupActivePlayer?.name ?? "jogador"}</strong> posicionar peças iniciais.
            </p>
            {currentGamePlayer && (
              <div className="setup-meter">
                <span>Suas peças iniciais</span>
                <strong>
                  {setupPlaced}/{setupNeeded}
                </strong>
              </div>
            )}
            {canPlaceSetupPiece && <p className="action-hint">Clique em qualquer carta da floresta inicial.</p>}
          </section>
        )}

        {room?.game?.status === "active" && activeGamePlayer && (
          <section className="panel-block active-turn-block" style={speciesVar(activeGamePlayer.speciesId)}>
            <div className="section-title">
              <Play aria-hidden="true" />
              <h2>Turno ativo</h2>
            </div>
            <div className="active-turn-card">
              {activeSpecies && <img src={encodeURI(activeSpecies.meepleAsset)} alt="" />}
              <div>
                <span>Jogador atual</span>
                <strong>{activeSpecies?.displayName ?? activeGamePlayer.name}</strong>
                <small>Rodada {room.game.round}/{room.game.maxRounds}</small>
              </div>
            </div>
            {activeSpecies && (
              <div className="action-list">
                {activeSpecies.actions.map((action) => (
                  <span className={action === activeActionId ? "current" : ""} key={action}>{action}</span>
                ))}
              </div>
            )}
            {activeSpecies && activeActionId && (
              <div className="current-action-card">
                <span>Acao atual</span>
                <strong>{activeActionId}</strong>
                <p>{getActionDescription(activeSpecies.speciesId, activeActionId)}</p>
                {activeSpecies.speciesId === "coati" && hasPendingCoatiPairBonus && canControlActivePlayer && (
                  <small>Dupla de quatis formada: escolha uma carta adjacente para adicionar 1 quati e marcar 1 ponto.</small>
                )}
                {activeSpecies.speciesId === "coati" && !hasPendingCoatiPairBonus && activeActionId === "A" && canControlActivePlayer && (
                  <>
                    <small>
                      {room.game.activePlayedForestCardId
                        ? "Escolha uma carta com fruta para adicionar 1 quati, ou conclua sem adicionar."
                        : "Selecione uma carta na mao e coloque em um espaco vazio destacado."}
                    </small>
                    {room.game.activePlayedForestCardId && (
                      <button className="secondary-button" onClick={handleCompleteAction}>
                        Concluir sem adicionar
                      </button>
                    )}
                  </>
                )}
                {activeSpecies.speciesId === "coati" && !hasPendingCoatiPairBonus && activeActionId === "B" && canControlActivePlayer && (
                  <small>Selecione um meeple do Quati no tabuleiro e clique em um destino destacado.</small>
                )}
                {activeSpecies.speciesId === "coati" &&
                  !hasPendingCoatiPairBonus &&
                  activeActionId === "C" &&
                  canControlActivePlayer &&
                  requiredCoatiRemovalCount === 0 && (
                  <button className="secondary-button" onClick={handleCompleteAction}>
                    Concluir acao {activeActionId}
                  </button>
                )}
                {activeSpecies.speciesId === "coati" &&
                  !hasPendingCoatiPairBonus &&
                  activeActionId === "C" &&
                  canControlActivePlayer &&
                  requiredCoatiRemovalCount > 0 && (
                    <>
                      <small>
                        Selecione {requiredCoatiRemovalCount} quatis da floresta. Selecionados:{" "}
                        {selectedRemovalPieceIds.length}/{requiredCoatiRemovalCount}.
                      </small>
                      <button
                        className="secondary-button"
                        disabled={selectedRemovalPieceIds.length !== requiredCoatiRemovalCount}
                        onClick={handleRemoveSelectedPieces}
                      >
                        Remover quatis
                      </button>
                    </>
                  )}
                {activeSpecies.speciesId === "jaguar" &&
                  (activeActionId === "A" || activeActionId === "B") &&
                  canControlActivePlayer && (
                    <>
                      <small>
                        {canSkipJaguarMove
                          ? "Nao ha destino valido para mover nesta acao."
                          : selectedJaguarDestination
                            ? "Escolha qual meeple a Onca deve remover no destino selecionado."
                            : "Selecione a Onca e clique em um destino destacado. Com 1 meeple no destino, a remocao e automatica; com mais de 1, escolha qual remover depois."}
                      </small>
                      {canSkipJaguarMove && (
                        <button className="secondary-button" onClick={handleCompleteAction}>
                          Concluir sem movimento
                        </button>
                      )}
                    </>
                  )}
                {activeSpecies.speciesId === "jaguar" &&
                  activeActionId === "C" &&
                  canControlActivePlayer && (
                    <small>Escolha quantas carnes gastar na janela central.</small>
                  )}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "A" && canControlActivePlayer && (() => {
                  const canSkipAdd = Boolean(room.game.activePlayedForestCardId);
                  return (
                    <>
                      <small>
                        {!room.game.activePlayedForestCardId
                          ? "Selecione uma carta na mao e coloque em um espaco vazio destacado."
                          : capuchinReserveCount === 0 || capuchinPlacementTargets.length === 0
                            ? "Sem macacos na reserva. Conclua a acao para seguir."
                            : `Clique na carta jogada destacada para adicionar 1 macaco, ou conclua sem adicionar. Reserva: ${capuchinReserveCount}.`}
                      </small>
                      {canSkipAdd && (
                        <button className="secondary-button" onClick={handleCompleteAction}>
                          Concluir sem adicionar
                        </button>
                      )}
                    </>
                  );
                })()}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "B" && canControlActivePlayer && (
                  <small>Selecione um meeple do Macaco-prego e clique em um destino destacado conforme a carta jogada.</small>
                )}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "C" && canControlActivePlayer && (() => {
                  return (
                    <>
                      <small>
                        {capuchinReserveCount === 0 || capuchinPlacementTargets.length === 0
                          ? "Sem macaco na reserva ou sem local valido. Conclua a acao para pontuar."
                          : `Clique em um local destacado que ja tenha outro Macaco-prego, ou conclua sem adicionar. Reserva: ${capuchinReserveCount}.`}
                      </small>
                      <button className="secondary-button" onClick={handleCompleteAction}>
                        Concluir sem adicionar
                      </button>
                    </>
                  );
                })()}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "D" && canControlActivePlayer && (
                  <small>Pontuação automática: +{capuchinHabitatScore} ponto(s) por habitat com macacos.</small>
                )}
                {activeSpecies.speciesId === "macaw" && activeActionId === "A" && canControlActivePlayer && (() => {
                  const reserveCount = activeGamePlayer?.reservePieces.length ?? 0;
                  const noReserve = reserveCount === 0;
                  const noEggTargets = room.game.activePlayedForestCardId && macawEggTargets.length === 0;
                  return (
                    <>
                      <small>
                        {!room.game.activePlayedForestCardId
                          ? "Selecione uma carta na mao e coloque em um espaco vazio destacado."
                          : noReserve
                            ? "Sem araras na reserva. Conclua a ação para seguir."
                            : noEggTargets
                              ? "Nenhuma carta com ovo disponível. Conclua a ação para seguir."
                              : `Clique em uma carta com ovo destacada para adicionar 1 arara, ou conclua sem adicionar. Reserva: ${reserveCount}.`}
                      </small>
                      {room.game.activePlayedForestCardId && (
                        <button className="secondary-button" onClick={handleCompleteAction}>
                          Concluir sem adicionar
                        </button>
                      )}
                    </>
                  );
                })()}
                {activeSpecies.speciesId === "macaw" && activeActionId === "B" && canControlActivePlayer && (
                  <small>Selecione uma Arara-azul e clique em um destino destacado conforme a carta jogada.</small>
                )}
                {activeSpecies.speciesId === "macaw" && activeActionId === "C" && canControlActivePlayer && (
                  <>
                    <small>
                      Adicione uma arara da reserva ou selecione outra arara para realocar ao redor da arara movida.
                    </small>
                    <button className="secondary-button" onClick={handleCompleteAction}>
                      Concluir sem adicionar/realocar
                    </button>
                  </>
                )}
                {activeSpecies.speciesId === "macaw" && activeActionId === "D" && canControlActivePlayer && (
                  <small>Pontuação automática: +{macawLineScore} ponto(s) por linha de 3 araras.</small>
                )}
                {activeSpecies.speciesId === "armadillo" && activeActionId === "A" && canControlActivePlayer && (
                  <>
                    <small>
                      {room.game.activePlayedForestCardId
                        ? "Clique em uma carta com pinha destacada para adicionar 1 tatu, ou conclua sem adicionar."
                        : "Selecione uma carta na mao e coloque em um espaco vazio destacado."}
                    </small>
                    {room.game.activePlayedForestCardId && (
                      <button className="secondary-button" onClick={handleCompleteAction}>
                        Concluir sem adicionar
                      </button>
                    )}
                  </>
                )}
                {activeSpecies.speciesId === "armadillo" && activeActionId === "B" && canControlActivePlayer && (
                  <small>Selecione um Tatu-bola e clique em um destino destacado conforme a carta jogada.</small>
                )}
                {activeSpecies.speciesId === "armadillo" && activeActionId === "C" && canControlActivePlayer && (
                  <>
                    <small>Selecione um Tatu-bola visivel proprio para esconder.</small>
                    {selectedPieceId ? (
                      <button className="secondary-button" onClick={handleHideArmadillo}>
                        Esconder Tatu-bola
                      </button>
                    ) : getArmadilloHidePieceIds(room.game, room.game.activePlayerId ?? "").length === 0 ? (
                      <button className="secondary-button" onClick={handleCompleteAction}>
                        Concluir acao {activeActionId}
                      </button>
                    ) : null}
                  </>
                )}
                {activeSpecies.speciesId === "armadillo" && activeActionId === "D" && canControlActivePlayer && (
                  <small>Pontuação automática: +{armadilloShareScore} ponto(s) por compartilhamento.</small>
                )}
                {activeSpecies.speciesId === "maned_wolf" && activeActionId === "A" && canControlActivePlayer && (
                  <small>
                    {room.game.activePlayedForestCardId
                      ? `Mova os lobos destacados. Pendentes: ${room.game.pendingWolfMoves?.pieceIds.length ?? 0}.`
                      : "Selecione uma carta na mao e coloque em um espaco vazio destacado."}
                  </small>
                )}
                {activeSpecies.speciesId === "maned_wolf" && activeActionId === "B" && canControlActivePlayer && (
                  <div className="wolf-base-panel">
                    <div className="wolf-base-summary">
                      <span>Alvos validos</span>
                      <strong>{wolfRemovableBasePieceIds.length}</strong>
                    </div>
                    <small>
                      {wolfRemovableBasePieceIds.length > 0
                        ? selectedWolfTargetPieceId
                          ? "Peca de base selecionada. Remova ou cancele a acao."
                          : "Clique em uma peca de base que esteja no mesmo local de um lobo."
                        : "Nenhuma peca de base divide local com lobo."}
                    </small>
                    <div className="wolf-base-actions">
                      <button
                        className="wolf-remove-button"
                        disabled={!selectedWolfTargetPieceId}
                        onClick={handleRemoveWolfBasePiece}
                      >
                        <X aria-hidden="true" />
                        Remover peca
                      </button>
                      <button className="wolf-skip-button" onClick={handleCompleteAction}>
                        <Check aria-hidden="true" />
                        Concluir
                      </button>
                    </div>
                  </div>
                )}
                {activeSpecies.speciesId === "maned_wolf" && activeActionId === "C" && canControlActivePlayer && (
                  <small>Escolha os recursos na janela central para pontuar.</small>
                )}
                {activeSpecies.speciesId === "maned_wolf" && activeActionId === "D" && canControlActivePlayer && (
                  <>
                    <small>
                      Clique em uma carta com carne para adicionar 1 lobo, ou conclua sem adicionar. Locais validos: {wolfMeatTargets.length}.
                    </small>
                    <button className="secondary-button" onClick={handleCompleteAction}>
                      Concluir sem adicionar
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        )}
        </div>
        )}

      <section className="playfield-panel stage-layer">
        <div className="tabletop-stage">
          {turnBanner && (
            <div
              className="turn-banner"
              key={turnBanner.key}
              style={speciesVar(turnBanner.speciesId)}
              role="status"
            >
              {turnBanner.speciesId && (
                <img src={encodeURI(speciesDefinitions[turnBanner.speciesId].meepleAsset)} alt="" />
              )}
              <span className="turn-banner-label">Vez:</span>
              <strong>{turnBanner.label}</strong>
            </div>
          )}
          <ForestCanvas
            ref={forestCanvasRef}
            cards={forestCards}
            pieces={pieces}
            canPlaceSetupPiece={canPlaceSetupPiece}
            expansionTargets={expansionTargets}
            rotateFitTargets={rotateFitTargets}
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
            movementTargets={movementTargets}
            addPieceTargets={addPieceTargets}
            addPieceLabel={
              activeSpecies?.speciesId === "capuchin"
                ? "Adicionar macaco"
                : activeSpecies?.speciesId === "macaw"
                  ? "Adicionar arara"
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
                  : activeSpecies?.speciesId === "armadillo"
                    ? "Clique em uma carta com pinha para adicionar 1 tatu"
                    : activeSpecies?.speciesId === "maned_wolf"
                      ? "Clique em uma carta com carne para adicionar 1 lobo"
                  : "Clique em uma carta com fruta para adicionar 1 quati"
            }
            bonusTargets={coatiPairBonusTargets}
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
        </div>

        {showHandDuringGame && currentGamePlayer && (
          <section className={`table-hand ${handCollapsed ? "collapsed" : ""}`} aria-label="Mão de cartas">
            <div className="hand-header">
              <div>
                <span>Mão · {handCards.length} cartas</span>
                <strong>{currentGamePlayer.speciesId ? speciesDefinitions[currentGamePlayer.speciesId].displayName : "Espécie"}</strong>
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
            {!handCollapsed &&
              (handCards.length > 0 ? (
                <div
                  className={`hand-rail ${selectedHandCardId ? "has-selection" : ""} ${
                    handPlayableThisAction ? "hand-playable" : "hand-idle"
                  }`}
                  style={{ ["--hand-count" as string]: handCards.length }}
                >
                  {handCards.map((card, handIndex) => {
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
                        } ${cardDrag?.cardId === card.id ? "dragging" : ""}`}
                        style={{ ["--hand-index" as string]: handIndex }}
                        onPointerDown={(event) => {
                          if (!canSelectHandCards || event.button !== 0) {
                            return;
                          }
                          // Allow grabbing any playable card directly: no need to
                          // pre-select with a click. Selection happens on drag
                          // activation below, which unlocks the valid slots.
                          if (!handPlayableThisAction || pendingPlacement) {
                            return;
                          }
                          const target = event.currentTarget as HTMLDivElement;
                          const rect = target.getBoundingClientRect();
                          const startX = event.clientX;
                          const startY = event.clientY;
                          pendingDragRef.current = {
                            cardId: card.id,
                            src: encodeURI(card.imagePath),
                            size: rect.width,
                            startX,
                            startY
                          };
                          let activated = false;
                          const handleMove = (e: PointerEvent) => {
                            const pending = pendingDragRef.current;
                            if (!pending) return;
                            const x = e.clientX;
                            const y = e.clientY;
                            if (!activated) {
                              const dx = x - pending.startX;
                              const dy = y - pending.startY;
                              if (dx * dx + dy * dy < 36) return;
                              activated = true;
                              if (selectedHandCardId !== pending.cardId) {
                                setSelectedHandCardId(pending.cardId);
                                setSelectedCardRotation(0);
                              }
                            }
                            dragPointerRef.current = { x, y };
                            const nearest = computeNearestTarget(x, y);
                            setCardDrag({
                              cardId: pending.cardId,
                              src: pending.src,
                              size: pending.size,
                              x,
                              y,
                              target: nearest
                            });
                          };
                          const handleUp = () => {
                            document.removeEventListener("pointermove", handleMove);
                            document.removeEventListener("pointerup", handleUp);
                            document.removeEventListener("pointercancel", handleUp);
                            const pending = pendingDragRef.current;
                            pendingDragRef.current = null;
                            dragPointerRef.current = null;
                            if (!activated || !pending) {
                              setCardDrag(null);
                              return;
                            }
                            dragJustHandledRef.current = true;
                            setCardDrag((current) => {
                              if (current?.target) {
                                const t = current.target;
                                setPendingPlacement({
                                  position: { x: t.x, y: t.y },
                                  rotation: t.rotation
                                });
                              }
                              return null;
                            });
                          };
                          document.addEventListener("pointermove", handleMove);
                          document.addEventListener("pointerup", handleUp);
                          document.addEventListener("pointercancel", handleUp);
                        }}
                        onClick={() => {
                          if (dragJustHandledRef.current) {
                            dragJustHandledRef.current = false;
                            return;
                          }
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
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state">Esta espécie não usa cartas de floresta na mão.</p>
              ))}
          </section>
        )}
      </section>

      <aside className={`right-panel hud-dock hud-right ${hudRightCollapsed ? "is-collapsed" : ""}`}>
        <section className="panel-block">
          <h2>Jogadores</h2>
          <div className="player-list" onScroll={() => setMovementPreview(null)}>
            {(() => {
              const players = room?.players ?? [];
              if (!room?.game) return players;
              const order =
                room.game.status === "setup" ? room.game.setupOrder : room.game.turnOrder;
              const indexBy = new Map(order.map((id, i) => [id, i]));
              return [...players].sort((a, b) => {
                const ai = indexBy.get(a.playerId);
                const bi = indexBy.get(b.playerId);
                if (ai === undefined && bi === undefined) return 0;
                if (ai === undefined) return 1;
                if (bi === undefined) return -1;
                return ai - bi;
              });
            })().map((player, displayIndex) => {
              const gamePlayer = room?.game?.players.find((candidate) => candidate.playerId === player.playerId);
              const species = player.speciesId ? speciesDefinitions[player.speciesId] : null;
              const isActivePlayer = player.playerId === room?.game?.activePlayerId || player.playerId === room?.game?.setupActivePlayerId;

              return (
              <div
                className={`player-row ${isActivePlayer ? "active" : ""}`}
                key={player.playerId}
                style={speciesVar(player.speciesId)}
              >
                <button
                  type="button"
                  className={`player-summary-head ${species ? "clickable" : ""}`}
                  disabled={!species}
                  title={species ? `Ver tabuleiro de ${species.displayName}` : undefined}
                  onClick={() => player.speciesId && setBoardSpecies(player.speciesId)}
                >
                  {room?.game && species ? (
                    <span
                      className="turn-order-badge movement-guide"
                      aria-label={`Movimentos de ${species.displayName}`}
                      title={`Movimentos de ${species.displayName}`}
                      onMouseEnter={(event) => showMovementPreview(species.speciesId, event.currentTarget.getBoundingClientRect())}
                      onMouseLeave={() => setMovementPreview(null)}
                    >
                      <MapPin aria-hidden="true" />
                    </span>
                  ) : room?.game ? (
                    <span className="turn-order-badge" aria-hidden="true">{displayIndex + 1}</span>
                  ) : null}
                  {species && <img className="player-portrait" src={encodeURI(species.portraitAsset)} alt="" />}
                  <div>
                    <strong>{species?.displayName ?? "Sem especie"}</strong>
                    {!player.isBot && player.name && player.name !== species?.displayName && (
                      <span>{player.name}</span>
                    )}
                  </div>
                  <small>{isActivePlayer ? "Vez" : player.isBot ? "Bot" : player.ready ? "Pronto" : "Aguardando"}</small>
                </button>
                {gamePlayer && (
                  <>
                    <div className="player-summary-stats">
                      <span className="stat-score">
                        <img src={encodeURI(resourceAssets.point)} alt="" />
                        <b><AnimatedNumber value={gamePlayer.score} /></b>
                      </span>
                      {species && (
                        <div
                          className="player-piece-track"
                          ref={(node) => setEffectTarget(`${gamePlayer.playerId}:reserve`, node)}
                          title={`${gamePlayer.reservePieces.length} na reserva · ${gamePlayer.piecesInForest.length} na floresta`}
                        >
                          {Array.from({ length: species.totalPieces }, (_, pieceIndex) => {
                            const isInForest = pieceIndex >= gamePlayer.reservePieces.length;
                            return (
                              <img
                                key={`${gamePlayer.playerId}_piece_track_${pieceIndex}`}
                                src={encodeURI(species.meepleAsset)}
                                alt=""
                                className={isInForest ? "is-in-forest" : "is-in-reserve"}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="player-summary-resources">
                      {resourceOrder.map((resource) => (
                        <span
                          className="mini-resource"
                          title={resourceLabels[resource]}
                          key={resource}
                          ref={(node) => setEffectTarget(`${gamePlayer.playerId}:${resource}`, node)}
                        >
                          <img src={encodeURI(resourceAssets[resource])} alt="" />
                          <b>{gamePlayer.resources[resource] ?? 0}</b>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              );
            })}
            {!room && <p className="empty-state">Crie ou entre em uma sala para ver jogadores.</p>}
          </div>
        </section>

      </aside>

      {movementPreview && typeof document !== "undefined" && createPortal(
        (() => {
          const species = speciesDefinitions[movementPreview.speciesId];
          return (
            <div
              className="movement-guide-floating"
              role="tooltip"
              style={
                {
                  ...speciesVar(movementPreview.speciesId),
                  left: movementPreview.left,
                  top: movementPreview.top
                } as CSSProperties
              }
            >
              <strong>{species.displayName}</strong>
              <img src={encodeURI(species.movementAsset)} alt={`Movimentos de ${species.displayName}`} />
            </div>
          );
        })(),
        document.body
      )}

      {shouldShowJaguarScoreModal && showJaguarScoreModal && (
          <div className="choice-modal-backdrop" role="presentation">
            <div
              className="choice-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Onça-pintada — gastar carne"
              style={speciesVar("jaguar")}
            >
              <header className="choice-modal-head">
                <img src={encodeURI(speciesDefinitions.jaguar.meepleAsset)} alt="" />
                <div>
                  <span>Onça-pintada · Ação C</span>
                  <h2>Gastar carne para pontuar</h2>
                </div>
              </header>
              <p className="choice-modal-desc">
                Gaste 1 carne para marcar 1 ponto, até 3 vezes. Carnes disponíveis: {availableJaguarPointSpendCount}.
              </p>
              <div className="choice-count-grid">
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    className="choice-count-option"
                    disabled={count > availableJaguarPointSpendCount}
                    onClick={() => handleSpendJaguarMeat(count)}
                  >
                    <img src={encodeURI(resourceAssets.meat)} alt="" />
                    <strong>Gastar {count}</strong>
                    <span>+{count} ponto(s)</span>
                  </button>
                ))}
              </div>
              <div className="choice-modal-actions">
                <button className="secondary-button" onClick={handleCompleteAction}>
                  Concluir sem gastar
                </button>
              </div>
            </div>
          </div>
        )}

      {room?.game?.status === "finished" && room.game.finalScoreBreakdown && (
        <div className="choice-modal-backdrop" role="presentation">
          <div className="choice-modal final-score-modal" role="dialog" aria-modal="true" aria-label="Fim de jogo">
            <header className="choice-modal-head">
              <Trophy aria-hidden="true" />
              <div>
                <span>Fim de jogo</span>
                <h2>
                  {room.game.winnerPlayerIds.length === 0
                    ? "Sem vencedor"
                    : room.game.winnerPlayerIds.length === 1
                      ? `Vencedor: ${
                          room.game.finalScoreBreakdown.entries.find(
                            (entry) => entry.playerId === room.game?.winnerPlayerIds[0]
                          )?.name ?? "Jogador"
                        }`
                      : `Empate: ${room.game.finalScoreBreakdown.entries
                          .filter((entry) => room.game?.winnerPlayerIds.includes(entry.playerId))
                          .map((entry) => entry.name)
                          .join(", ")}`}
                </h2>
              </div>
            </header>
            <p className="choice-modal-desc">
              Total = pontos da partida + maioria de carne/ovo/fruta (+1 cada, gasta o recurso) + 1 ponto por 2
              sementes. Limite {room.game.finalScoreBreakdown.pointCap} pts. Desempate: recursos restantes, depois
              maior população.
            </p>
            <table className="final-score-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jogador</th>
                  <th>Partida</th>
                  <th>Maioria</th>
                  <th>Sementes</th>
                  <th>Total</th>
                  <th>Recursos</th>
                </tr>
              </thead>
              <tbody>
                {[...room.game.finalScoreBreakdown.entries]
                  .sort(
                    (a, b) =>
                      b.totalScore - a.totalScore ||
                      b.remainingResources - a.remainingResources ||
                      b.populationValue - a.populationValue
                  )
                  .map((entry, index) => (
                    <tr
                      key={entry.playerId}
                      className={room.game?.winnerPlayerIds.includes(entry.playerId) ? "winner" : ""}
                      style={speciesVar(entry.speciesId)}
                    >
                      <td>{index + 1}</td>
                      <td>
                        <strong>{entry.name}</strong>
                        {entry.speciesId && <small> · {speciesDefinitions[entry.speciesId].displayName}</small>}
                      </td>
                      <td>{entry.baseScore}</td>
                      <td>+{entry.resourceMajorityPoints}</td>
                      <td>+{entry.seedPoints}</td>
                      <td>
                        <strong>{entry.totalScore}</strong>
                      </td>
                      <td>{entry.remainingResources}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="choice-modal-actions">
              <button className="primary-button" onClick={leaveTable}>
                Voltar ao lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {hasStartedGame &&
        !hasPendingCoatiPairBonus &&
        room?.game?.status === "active" &&
        activeGamePlayer &&
        activeSpecies?.speciesId === "maned_wolf" &&
        activeActionId === "C" &&
        canControlActivePlayer && (
          <div className="choice-modal-backdrop" role="presentation">
            <div
              className="choice-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Lobo-guará — gastar recursos"
              style={speciesVar("maned_wolf")}
            >
              <header className="choice-modal-head">
                <img src={encodeURI(speciesDefinitions.maned_wolf.meepleAsset)} alt="" />
                <div>
                  <span>Lobo-guará · Ação C</span>
                  <h2>Gastar recursos para pontuar</h2>
                </div>
              </header>
              <p className="choice-modal-desc">
                Para cada lobo na floresta, gaste 1 recurso diferente e marque 1 ponto. Limite: 1 por lobo em campo.
              </p>
              <div className="wolf-spend-summary">
                <div>
                  <span>Seleção</span>
                  <strong>
                    {selectedWolfResources.length}/{availableWolfPointSpendCount}
                  </strong>
                </div>
                <div>
                  <span>Ganho</span>
                  <strong>{selectedWolfResources.length} ponto(s)</strong>
                </div>
              </div>
              <div className="wolf-resource-grid">
                {resourceOrder.map((resource) => (
                  <button
                    className={`wolf-resource-option ${selectedWolfResources.includes(resource) ? "selected" : ""}`}
                    disabled={!wolfSpendableResources.includes(resource)}
                    key={resource}
                    onClick={() =>
                      setSelectedWolfResources((current) =>
                        current.includes(resource)
                          ? current.filter((candidate) => candidate !== resource)
                          : current.length < availableWolfPointSpendCount
                            ? [...current, resource]
                            : current
                      )
                    }
                  >
                    <img src={resourceAssets[resource]} alt="" />
                    <span>{resourceLabels[resource]}</span>
                    <strong>{activeGamePlayer.resources[resource] ?? 0}</strong>
                  </button>
                ))}
              </div>
              <div className="choice-modal-actions">
                <button
                  className="primary-button"
                  disabled={selectedWolfResources.length === 0}
                  onClick={handleSpendWolfResources}
                >
                  <Check aria-hidden="true" />
                  Gastar selecionados
                </button>
                <button className="secondary-button" onClick={handleCompleteAction}>
                  Concluir sem gastar
                </button>
              </div>
            </div>
          </div>
        )}

      {turnSummary && room?.game?.status === "active" && (
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

      {boardSpecies && (
        <div
          className="board-modal-backdrop"
          role="presentation"
          onClick={() => setBoardSpecies(null)}
        >
          <div
            className="board-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Tabuleiro de ${speciesDefinitions[boardSpecies].displayName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="board-modal-head">
              <img src={encodeURI(speciesDefinitions[boardSpecies].meepleAsset)} alt="" />
              <div>
                <h2>{speciesDefinitions[boardSpecies].displayName}</h2>
                <span>{speciesDefinitions[boardSpecies].scientificName}</span>
              </div>
              <button
                type="button"
                className="board-modal-close"
                aria-label="Fechar"
                onClick={() => setBoardSpecies(null)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="board-modal-body">
              <img
                src={encodeURI(speciesDefinitions[boardSpecies].boardAsset)}
                alt={`Tabuleiro de ${speciesDefinitions[boardSpecies].displayName}`}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
