import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertTriangle,
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
  Package,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
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
  getArmadilloSeedPlacementPositions,
  getArmadilloShareScore,
  getCapuchinHabitatScore,
  getCapuchinPlacementPositions,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getAvailableForestExpansionPositions,
  getAvailableForestExpansionPositionsForCard,
  getMacawActionCTargets,
  getMacawEggPlacementPositions,
  getMacawLineScore,
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
import type { ActionId, GameState, GridPosition, PublicRoomState, Resource, RoomPlayer, SpeciesId } from "@oikos/shared";
import { ForestCanvas, type ForestCanvasHandle } from "./game/ForestCanvas";
import { createSocket, roomApi, type OikosSocket } from "./socket";

const speciesList = Object.values(speciesDefinitions);

const SPECIES_HEX: Record<SpeciesId, string> = {
  jaguar: "#e8a33d",
  maned_wolf: "#c8553d",
  armadillo: "#b98a4b",
  macaw: "#3a7fc4",
  capuchin: "#6b8a76",
  coati: "#b6815f"
};

function speciesColor(speciesId: SpeciesId | null | undefined): string {
  return speciesId ? SPECIES_HEX[speciesId] : "var(--amber)";
}

function speciesVar(speciesId: SpeciesId | null | undefined): CSSProperties {
  return { ["--species" as string]: speciesColor(speciesId) } as CSSProperties;
}

function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) {
      return;
    }
    const start = performance.now();
    const duration = 600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value]);

  return <span className={shown !== value ? "num-roll active" : "num-roll"}>{shown}</span>;
}

interface FloatingGain {
  id: number;
  resource: Resource | "point";
  amount: number;
}

interface TravelEffect {
  id: number;
  kind: "resource" | "piece";
  resource?: Resource;
  speciesId?: SpeciesId;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface TurnSummary {
  key: number;
  playerName: string;
  speciesId: SpeciesId | null;
  scoreDelta: number;
  details: string[];
}

const categoryLabels = {
  predator: "Predador",
  subpredator: "Subpredador",
  middle: "Meio",
  base: "Base"
} as const;

const localRoomId = "LOCAL";
const resourceOrder: Resource[] = ["meat", "egg", "fruit", "seed"];
const lastOnlineRoomStorageKey = "oikos:last-online-room";
const lastOnlineNameStorageKey = "oikos:last-online-name";

function elementCenter(element: HTMLElement | null | undefined): { x: number; y: number } | null {
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function sameGridPosition(a: GridPosition | null | undefined, b: GridPosition | null | undefined): boolean {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

function saveOnlineSession(room: PublicRoomState, playerName: string): void {
  if (room.roomId === localRoomId) {
    return;
  }

  window.localStorage.setItem(lastOnlineRoomStorageKey, room.roomId);
  window.localStorage.setItem(lastOnlineNameStorageKey, playerName);
}

function clearOnlineSession(): void {
  window.localStorage.removeItem(lastOnlineRoomStorageKey);
  window.localStorage.removeItem(lastOnlineNameStorageKey);
}

function scoreSummaryDetails(messages: string[], scoreDelta: number): string[] {
  const scoring = messages.filter((message) => {
    const lower = message.toLowerCase();
    return lower.includes("marcou") || lower.includes("pontu") || lower.includes("gastou");
  });

  if (scoring.length > 0) {
    return scoring.slice(-3);
  }

  return scoreDelta > 0 ? ["Pontuou por efeito da acao final."] : ["Nao marcou pontos neste turno."];
}

const coatiActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Adicione 1 quati em um local de fruta.",
  B: "Mova 1 quati conforme a carta jogada. Colete o recurso da carta destino.",
  C: "Se houver menos de 2 quatis na reserva, remova 2 quatis da floresta."
};

const jaguarActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Mova a Onca para um local adjacente. Colete o recurso da carta destino. Se houver peca no local, remova 1 e colete 1 carne.",
  B: "Mova a Onca conforme o local onde ela esta. Colete o recurso da carta destino. Se houver peca no local, remova 1 e colete 1 carne.",
  C: "Gaste 1 carne para marcar 1 ponto, ate 3 vezes."
};

const capuchinActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta e adicione 1 macaco na carta jogada.",
  B: "Mova 1 macaco conforme a carta jogada. Colete o recurso da carta destino.",
  C: "Adicione 1 macaco em local com outro macaco.",
  D: "Marque 1 ponto por tipo de habitat com macacos em 2 ou mais cartas diferentes."
};

const macawActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta e adicione 1 arara em local de ovo.",
  B: "Mova 1 arara conforme a carta jogada. Colete o recurso da carta destino.",
  C: "Adicione ou realoque outra arara ao redor da arara movida. Se realocar, colete o recurso da carta destino.",
  D: "Marque 1 ponto por linha reta de 3 araras."
};

const armadilloActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta e adicione 1 tatu em local de pinha.",
  B: "Mova 1 tatu conforme a carta jogada. Colete o recurso da carta destino.",
  C: "Esconda qualquer tatu proprio.",
  D: "Marque 3 pontos menos 1 por especie adversaria que nao compartilhe local com tatu, minimo 1."
};

const wolfActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Mova cada lobo conforme o habitat da carta jogada. Cada lobo movido coleta recurso da carta destino.",
  B: "Pode remover 1 peca de especie de base em um local com lobo. Ambos coletam o recurso do local.",
  C: "Para cada lobo na floresta, gaste 1 recurso diferente e marque 1 ponto.",
  D: "Adicione 1 lobo em um local de carne."
};

function getActionDescription(speciesId: SpeciesId | null | undefined, actionId: ActionId | null): string {
  if (!speciesId || !actionId) {
    return "Use a mao de cartas e os destaques da mesa para executar a acao atual.";
  }

  if (speciesId === "coati") {
    return coatiActionDescriptions[actionId] ?? "Acao do Quati pendente de implementacao.";
  }

  if (speciesId === "jaguar") {
    return jaguarActionDescriptions[actionId] ?? "Acao da Onca pendente de implementacao.";
  }

  if (speciesId === "capuchin") {
    return capuchinActionDescriptions[actionId] ?? "Acao do Macaco-prego pendente de implementacao.";
  }

  if (speciesId === "macaw") {
    return macawActionDescriptions[actionId] ?? "Acao da Arara-azul pendente de implementacao.";
  }

  if (speciesId === "armadillo") {
    return armadilloActionDescriptions[actionId] ?? "Acao do Tatu-bola pendente de implementacao.";
  }

  if (speciesId === "maned_wolf") {
    return wolfActionDescriptions[actionId] ?? "Acao do Lobo-guara pendente de implementacao.";
  }

  return "Acoes desta especie ainda pendentes de implementacao.";
}

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
  const [hudLeftCollapsed, setHudLeftCollapsed] = useState(false);
  const [hudRightCollapsed, setHudRightCollapsed] = useState(false);
  const [turnBanner, setTurnBanner] = useState<{ key: number; label: string; speciesId: SpeciesId | null } | null>(null);
  const [floatingGains, setFloatingGains] = useState<FloatingGain[]>([]);
  const [travelEffects, setTravelEffects] = useState<TravelEffect[]>([]);
  const [turnSummary, setTurnSummary] = useState<TurnSummary | null>(null);
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
          .catch(() => {
            clearOnlineSession();
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
  const hudGamePlayer = currentGamePlayer ?? activeGamePlayer ?? setupActivePlayer ?? null;
  const hudSpecies = hudGamePlayer?.speciesId ? speciesDefinitions[hudGamePlayer.speciesId] : null;
  const isHost = Boolean(room && !isLocalRoom && playerId === room.hostPlayerId);
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
    if (!selectedHandCardId || !canPlaceSelectedForestCard) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "q") {
        event.preventDefault();
        rotateSelectedCard(-1);
      } else if (key === "e") {
        event.preventDefault();
        rotateSelectedCard(1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPlaceSelectedForestCard, rotateSelectedCard, selectedHandCardId]);

  const expansionTargets = useMemo(
    () =>
      canPlaceSelectedForestCard && room?.game && selectedHandCardId
        ? getAvailableForestExpansionPositionsForCard(room.game, selectedHandCardId, selectedCardRotation)
        : [],
    [canPlaceSelectedForestCard, room?.game, selectedCardRotation, selectedHandCardId]
  );
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
        const messages = game.log.slice(finishedSnapshot.logLength).map((entry) => entry.message);
        setTurnSummary({
          key: Date.now(),
          playerName: finishedPlayer.name,
          speciesId: finishedPlayer.speciesId,
          scoreDelta,
          details: scoreSummaryDetails(messages, scoreDelta)
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

  const handleExpansionTargetClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room?.game || !selectedHandCardId || !canPlaceSelectedForestCard || !room.game.activePlayerId) {
        return;
      }

      if (isLocalRoom) {
        const nextGame = placeForestCard(room.game, room.game.activePlayerId, selectedHandCardId, position, selectedCardRotation);
        setRoom({
          ...room,
          status: "active",
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setSelectedHandCardId(null);
        setSelectedCardRotation(0);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice("Carta colocada na floresta.");
        return;
      }

      void run(() =>
        roomApi.placeForestCard(requireSocket(), room.roomId, selectedHandCardId, position.x, position.y, selectedCardRotation)
      ).then(() => {
        setSelectedHandCardId(null);
        setSelectedCardRotation(0);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
    },
    [canPlaceSelectedForestCard, isLocalRoom, room, selectedCardRotation, selectedHandCardId, socket]
  );

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

    if (isLocalRoom) {
      const nextGame = scoreCapuchinHabitatPresence(room.game, room.game.activePlayerId);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
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
  }, [canControlActivePlayer, isLocalRoom, room, socket]);

  const handleScoreMacaw = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = scoreMacawLines(room.game, room.game.activePlayerId);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
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
    if (species === "capuchin") {
      handleScoreCapuchin();
    } else if (species === "macaw") {
      handleScoreMacaw();
    } else {
      handleScoreArmadillo();
    }
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
      {!hasStartedGame && (
      <aside className="left-panel menu-card">
        <header className="brand-strip">
          <Leaf aria-hidden="true" />
          <div>
            <h1>Oikos Digital</h1>
          </div>
        </header>

        {!hasStartedGame && (
          <div className="menu-grid">
          <div className="menu-col">
        <section className="panel-block">
          <div className="section-title">
            <Users aria-hidden="true" />
            <h2>Sala</h2>
          </div>

          <label>
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} />
          </label>

          <div className="room-actions">
            <button
              className="primary-button"
              onClick={() => run(() => roomApi.create(requireSocket(), name), "Sala criada.")}
            >
              <Play aria-hidden="true" />
              Criar sala
            </button>
            <div className="join-row">
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="Código"
                maxLength={5}
              />
              <button
                className="icon-button"
                title="Entrar na sala"
                onClick={() => run(() => roomApi.join(requireSocket(), joinCode, name), "Entrada confirmada.")}
              >
                <LogIn aria-hidden="true" />
              </button>
            </div>
          </div>

          {room && (
            <div className="room-code">
              <span>{room.roomId}</span>
              <button
                className="icon-button compact"
                title="Copiar código da sala"
                onClick={() => {
                  void navigator.clipboard?.writeText(room.roomId);
                  setNotice("Código copiado.");
                }}
              >
                <Copy aria-hidden="true" />
              </button>
            </div>
          )}
        </section>

        <section className="panel-block local-test-block">
          <div className="section-title">
            <MapPin aria-hidden="true" />
            <h2>Teste local</h2>
          </div>
          <p>Controle 2 a 6 espécies nesta tela para validar setup e regras sem abrir outros navegadores.</p>
          <div className="local-species-grid">
            {speciesList.map((species) => {
              const selected = localSpeciesIds.includes(species.speciesId);

              return (
                <button
                  key={species.speciesId}
                  className={`local-species-chip ${selected ? "selected" : ""}`}
                  disabled={isLocalRoom}
                  onClick={() => toggleLocalSpecies(species.speciesId)}
                >
                  <img src={encodeURI(species.meepleAsset)} alt="" />
                  <span>{species.displayName}</span>
                </button>
              );
            })}
          </div>
          <div className="ready-row">
            <button className="primary-button" disabled={isLocalRoom || localSpeciesIds.length < 2} onClick={startLocalTest}>
              <Play aria-hidden="true" />
              Iniciar teste local
            </button>
            {isLocalRoom && (
              <button className="secondary-button" onClick={stopLocalTest}>
                Encerrar teste
              </button>
            )}
          </div>
        </section>
          </div>
        <section className="panel-block menu-species">
          <div className="section-title">
            <ShieldCheck aria-hidden="true" />
            <h2>Espécie</h2>
          </div>

          <div className="species-grid">
            {speciesList.map((species) => {
              const takenBy = room?.players.find((player) => player.speciesId === species.speciesId);
              const selected = currentPlayer?.speciesId === species.speciesId || selectedSpecies === species.speciesId;

              return (
                <button
                  key={species.speciesId}
                  className={`species-option ${selected ? "selected" : ""}`}
                  disabled={Boolean(takenBy && takenBy.playerId !== playerId) || room?.status !== "lobby"}
                  onClick={() => {
                    setSelectedSpecies(species.speciesId);
                    if (room) {
                      void run(() => roomApi.selectSpecies(requireSocket(), room.roomId, species.speciesId));
                    }
                  }}
                >
                  <img src={encodeURI(species.meepleAsset)} alt="" />
                  <span>{species.displayName}</span>
                  <small>{categoryLabels[species.category]}</small>
                </button>
              );
            })}
          </div>

          {room && (
            <div className="ready-row">
              <button
                className="secondary-button"
                onClick={() => run(() => roomApi.ready(requireSocket(), requireRoom().roomId, !currentPlayer?.ready))}
              >
                <Check aria-hidden="true" />
                {currentPlayer?.ready ? "Pronto" : "Marcar pronto"}
              </button>
              {isHost && (
                <button className="primary-button" onClick={() => run(() => roomApi.start(requireSocket(), room.roomId))}>
                  <Play aria-hidden="true" />
                  Iniciar setup
                </button>
              )}
            </div>
          )}
        </section>
          </div>
        )}
      </aside>
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
            <button className="secondary-button exit-button" onClick={leaveTable}>
              <LogOut aria-hidden="true" />
              Sair
            </button>
            <button type="button" className="secondary-button" onClick={() => setConfigOpen(false)}>
              <X aria-hidden="true" />
              Fechar
            </button>
          </section>
          </div>
        </div>
      )}

      {hasStartedGame && hudGamePlayer && hudSpecies && (
        <section className="hud-species panel-block species-hud" style={speciesVar(hudGamePlayer.speciesId)}>
            <div className="species-hud-header">
              <img src={encodeURI(hudSpecies.meepleAsset)} alt="" />
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
        <div className={`hud-action hud-dock hud-left ${hudLeftCollapsed ? "is-collapsed" : ""}`}>
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
                  <small>
                    {room.game.activePlayedForestCardId
                      ? "Escolha uma carta com fruta para adicionar 1 quati."
                      : "Selecione uma carta na mao e coloque em um espaco vazio destacado."}
                  </small>
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
                {activeSpecies.speciesId === "capuchin" && activeActionId === "A" && canControlActivePlayer && (
                  <small>
                    {room.game.activePlayedForestCardId
                      ? "Clique na carta jogada destacada para adicionar 1 macaco."
                      : "Selecione uma carta na mao e coloque em um espaco vazio destacado."}
                  </small>
                )}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "B" && canControlActivePlayer && (
                  <small>Selecione um meeple do Macaco-prego e clique em um destino destacado conforme a carta jogada.</small>
                )}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "C" && canControlActivePlayer && (
                  <small>Clique em um local destacado que ja tenha outro Macaco-prego para adicionar 1 macaco.</small>
                )}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "D" && canControlActivePlayer && (
                  <small>Pontuação automática: +{capuchinHabitatScore} ponto(s) por habitat com macacos.</small>
                )}
                {activeSpecies.speciesId === "macaw" && activeActionId === "A" && canControlActivePlayer && (
                  <small>
                    {room.game.activePlayedForestCardId
                      ? "Clique em uma carta com ovo destacada para adicionar 1 arara."
                      : "Selecione uma carta na mao e coloque em um espaco vazio destacado."}
                  </small>
                )}
                {activeSpecies.speciesId === "macaw" && activeActionId === "B" && canControlActivePlayer && (
                  <small>Selecione uma Arara-azul e clique em um destino destacado conforme a carta jogada.</small>
                )}
                {activeSpecies.speciesId === "macaw" && activeActionId === "C" && canControlActivePlayer && (
                  <small>
                    Clique em uma carta destacada para adicionar uma arara da reserva, ou selecione outra arara para realocar ao
                    redor da arara movida.
                  </small>
                )}
                {activeSpecies.speciesId === "macaw" && activeActionId === "D" && canControlActivePlayer && (
                  <small>Pontuação automática: +{macawLineScore} ponto(s) por linha de 3 araras.</small>
                )}
                {activeSpecies.speciesId === "armadillo" && activeActionId === "A" && canControlActivePlayer && (
                  <small>
                    {room.game.activePlayedForestCardId
                      ? "Clique em uma carta com pinha destacada para adicionar 1 tatu."
                      : "Selecione uma carta na mao e coloque em um espaco vazio destacado."}
                  </small>
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
                      Clique em uma carta com carne para adicionar 1 lobo. Locais validos: {wolfMeatTargets.length}.
                    </small>
                    {wolfMeatTargets.length === 0 && (
                      <button className="secondary-button" onClick={handleCompleteAction}>
                        Concluir acao {activeActionId}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}
        </div>
        )}

      <section className="playfield-panel stage-layer">
        {hasStartedGame && (
        <div
          className="tabletop-hud"
          style={speciesVar(room?.game?.status === "setup" ? setupActivePlayer?.speciesId : activeGamePlayer?.speciesId)}
        >
          <div className="tabletop-turn">
            {activeSpecies && <img src={encodeURI(activeSpecies.meepleAsset)} alt="" />}
            <div>
              <span>{room?.game?.status === "setup" ? "Setup" : "Turno"}</span>
              <strong>
                {room?.game?.status === "setup"
                  ? setupActivePlayer?.name ?? "Aguardando setup"
                  : activeSpecies?.displayName ?? "Aguardando partida"}
              </strong>
            </div>
          </div>
          {activeSpecies && room?.game?.status === "active" && (
            <div className="tabletop-actions" aria-label="Ações da espécie atual">
              {activeSpecies.actions.map((action) => (
                <span className={action === activeActionId ? "current" : ""} key={action}>
                  {action}
                </span>
              ))}
            </div>
          )}
          {activeGamePlayer && room?.game?.status === "active" && (
            <div className="tabletop-metrics" aria-label="Resumo do jogador ativo">
              <span>
                <img src={encodeURI(resourceAssets.point)} alt="" />
                {activeGamePlayer.score}
              </span>
              <span>Reserva {activeGamePlayer.reservePieces.length}</span>
              <span>Campo {activeGamePlayer.piecesInForest.length}</span>
            </div>
          )}
          <p>
            {hasPendingCoatiPairBonus
              ? "Dupla formada: escolha uma carta adjacente para ganhar o bônus."
              : room?.game?.status === "setup"
                ? "Clique em uma carta da floresta inicial para posicionar a peça da espécie ativa."
                : getActionDescription(activeSpecies?.speciesId, activeActionId)}
          </p>
        </div>
        )}

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
            selectedHandCardId={selectedHandCardId}
            selectedPieceId={selectedPieceId}
            selectedPieceIds={highlightedPieceIds}
            selectablePieceIds={boardSelectablePieceIds}
            onCardClick={handleCardClick}
            onExpansionTargetClick={handleExpansionTargetClick}
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
                {room?.game?.status === "setup" && handCards.length > 0 && (
                  <small>Cartas ja distribuidas para planejar o posicionamento inicial.</small>
                )}
                {selectedHandCardId && canPlaceSelectedForestCard && (
                  <small>Gire com as setas ou Q / E e clique num espaço destacado.</small>
                )}
                {selectedHandCardId && !canPlaceSelectedForestCard && <small>Carta usável só na ação A da espécie ativa.</small>}
                <button
                  type="button"
                  className="hand-toggle"
                  onClick={() => setHandCollapsed((value) => !value)}
                >
                  {handCollapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                  {handCollapsed ? "Expandir" : "Recolher"}
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
                        className={`hand-card ${isSelected ? "selected" : ""} ${
                          handPlayableThisAction ? "playable" : "not-playable"
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
                        {showRotate && (
                          <div className="card-rotate" onClick={(event) => event.stopPropagation()}>
                            <button
                              type="button"
                              title="Girar à esquerda (Q)"
                              aria-label="Girar à esquerda"
                              onClick={() => rotateSelectedCard(-1)}
                            >
                              <RotateCcw aria-hidden="true" />
                            </button>
                            <span>{selectedCardRotation}°</span>
                            <button
                              type="button"
                              title="Girar à direita (E)"
                              aria-label="Girar à direita"
                              onClick={() => rotateSelectedCard(1)}
                            >
                              <RotateCw aria-hidden="true" />
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
          <div className="player-list">
            {(room?.players ?? []).map((player) => {
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
                  {species && <img src={encodeURI(species.meepleAsset)} alt="" />}
                  <div>
                    <strong>{species?.displayName ?? "Sem especie"}</strong>
                    <span>{player.name}</span>
                  </div>
                  <small>{isActivePlayer ? "Vez" : player.ready ? "Pronto" : "Aguardando"}</small>
                </button>
                {gamePlayer && (
                  <>
                    <div className="player-summary-stats">
                      <span>
                        <img src={encodeURI(resourceAssets.point)} alt="" />
                        <AnimatedNumber value={gamePlayer.score} />
                      </span>
                      <span ref={(node) => setEffectTarget(`${gamePlayer.playerId}:reserve`, node)}>
                        Reserva {gamePlayer.reservePieces.length}
                      </span>
                      <span>Campo {gamePlayer.piecesInForest.length}</span>
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
                          {gamePlayer.resources[resource] ?? 0}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <div>
                  <strong>{player.name}</strong>
                  <span>{player.speciesId ? speciesDefinitions[player.speciesId].displayName : "Sem espécie"}</span>
                  {room?.game && (
                    <span>Pontos: {room.game.players.find((candidate) => candidate.playerId === player.playerId)?.score ?? 0}</span>
                  )}
                </div>
                <small>{player.ready ? "Pronto" : "Aguardando"}</small>
              </div>
              );
            })}
            {!room && <p className="empty-state">Crie ou entre em uma sala para ver jogadores.</p>}
          </div>
        </section>

        {room?.game && (
          <section className="panel-block">
            <h2>{room.game.status === "setup" ? "Ordem de Setup" : "Ordem da Partida"}</h2>
            <div className="turn-order">
              {room.game.setupOrder.map((setupPlayerId, index) => {
                const player = room.game?.players.find((candidate) => candidate.playerId === setupPlayerId);
                const species = player?.speciesId ? speciesDefinitions[player.speciesId] : null;
                const isActive =
                  setupPlayerId === room.game?.setupActivePlayerId || setupPlayerId === room.game?.activePlayerId;

                return (
                  <div
                    className={`turn-order-row ${isActive ? "active" : ""}`}
                    key={setupPlayerId}
                    style={speciesVar(player?.speciesId)}
                  >
                    <span>{index + 1}</span>
                    <strong>{species?.displayName ?? "Espécie"}</strong>
                    <small>{player?.name}</small>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </aside>

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

      {turnSummary && (
        <div className="choice-modal-backdrop turn-summary-backdrop" role="presentation">
          <div
            className="choice-modal turn-summary-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Resumo do turno"
            style={speciesVar(turnSummary.speciesId)}
          >
            <header className="choice-modal-head">
              {turnSummary.speciesId && (
                <img src={encodeURI(speciesDefinitions[turnSummary.speciesId].meepleAsset)} alt="" />
              )}
              <div>
                <span>Fim do turno</span>
                <h2>{turnSummary.playerName}</h2>
              </div>
            </header>
            <div className="turn-summary-score">
              <span>Pontos neste turno</span>
              <strong>+{turnSummary.scoreDelta}</strong>
            </div>
            <div className="turn-summary-list">
              {turnSummary.details.map((detail, index) => (
                <p key={`${turnSummary.key}_${index}`}>{detail}</p>
              ))}
            </div>
            <div className="choice-modal-actions">
              <button className="primary-button" onClick={() => setTurnSummary(null)}>
                Finalizar turno
              </button>
            </div>
          </div>
        </div>
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
