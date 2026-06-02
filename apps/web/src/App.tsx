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
  Clock,
  Copy,
  Crown,
  Eye,
  EyeOff,
  GraduationCap,
  Leaf,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Minus,
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
  getObjectiveCardDefinition,
  habitatLabels,
  movementLabels,
  objectiveCardBackPath,
  scenarioCardBackPath,
  scenarioCards,
  scenarioCardsById,
  threatCardBackPath,
  threatCardsById,
  objectiveCardsById,
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
  forceEndPlayerTurn,
  playBotStep,
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
  selectObjectiveCard,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing,
  scoreCapuchinHabitatPresence,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints,
  collectCaatingaBonus,
  discardMataAtlanticaPileCard
} from "@oikos/rules";
import type {
  GameState,
  GridPosition,
  Habitat,
  MiniExpansionId,
  MovementKind,
  ObjectiveCardDefinition,
  PlayerState,
  PublicRoomState,
  Resource,
  RoomPlayer,
  RoomSummary,
  ScenarioCount,
  ScenarioCardDefinition,
  ScenarioCardId,
  SpeciesId,
  ThreatCardDefinition
} from "@oikos/shared";
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
import { ActionStepsViewer } from "./ui/ActionStepsViewer";
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
  saveOnlineSession,
  wasSpectatorSession
} from "./ui/session";
import { speciesVar } from "./ui/speciesStyle";
import { buildTurnSummaryEntries, type TurnRecapState, type TurnSummary } from "./ui/turnSummary";
import {
  createArmadilloTutorialRoom,
  createCapuchinTutorialRoom,
  createCoatiTutorialRoom,
  createInitialTutorialRoom,
  createJaguarTutorialRoom,
  createMacawTutorialRoom,
  createWolfTutorialRoom,
  getTutorialPlayerId,
  getTutorialSteps,
  isTutorialArmadilloDone,
  isTutorialCapuchinDone,
  isTutorialCoatiDone,
  isTutorialInitialDone,
  isTutorialJaguarDone,
  isTutorialMacawDone,
  isTutorialWolfDone,
  markTutorialDone,
  moveArmadilloTutorialJaguarProbe,
  TUTORIAL_NONRIVER_CARD,
  type TutorialGate,
  type TutorialId
} from "./ui/tutorials";

// Phones/small tablets: start with the side docks and hand collapsed so the
// board owns the screen; the edge tabs reopen each panel on demand.
function isSmallScreen(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 820;
}

// Phone breakpoint that switches the HUD to the tabbed bottom-sheet layout.
// Matches the `.mobile-hud` media query in styles.css.
const MOBILE_HUD_QUERY = "(max-width: 560px)";
function isMobileWidth(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_HUD_QUERY).matches;
}

type MobileSheet = "acao" | "mao" | "jogadores" | "resumo" | null;

// Selectable turn-timer durations for online rooms (ms).
const TURN_TIMER_OPTIONS = [30000, 45000, 60000, 90000, 120000, 180000];
const DEFAULT_TURN_TIMER_MS = 60000;
const SERVER_UNAVAILABLE_MESSAGE = "Servidor indisponível. Inicie o servidor para testar lobby multiplayer.";
const handHabitatOrder: Habitat[] = ["forest", "field", "river"];
type HandSortMode = "habitat" | "resource";

function renderReserveMeeples(player: Pick<PlayerState, "playerId" | "reservePieces">, meepleAsset: string) {
  return player.reservePieces.map((pieceId, index) => (
    <img
      key={`${player.playerId}_reserve_${pieceId}_${index}`}
      className="is-in-reserve"
      src={encodeURI(meepleAsset)}
      alt="Na reserva"
    />
  ));
}

const miniExpansionOptions: Array<{
  id: MiniExpansionId;
  label: string;
  description: string;
  iconPath: string;
}> = [
  {
    id: "objectives",
    label: "Cartas de objetivo",
    description: "Cada jogador escolhe 1 de 2 objetivos e pode ganhar ponto extra no fim do turno.",
    iconPath: objectiveCardBackPath
  },
  {
    id: "scenarios",
    label: "Cartas de cenário",
    description:
      "Antes da partida, jogadores votam em 1 ou 2 cenarios (bioma do Brasil) que alteram regras durante todo o jogo.",
    iconPath: scenarioCardBackPath
  },
  {
    id: "threats",
    label: "Cartas de ameaca",
    description: "Revela 1 ameaca aleatoria no inicio de cada turno, sem repetir cartas na partida.",
    iconPath: threatCardBackPath
  }
];

const movementKindLabels: Record<MovementKind, string> = {
  adjacent: "Adjacente",
  diagonal: "Diagonal",
  straight_jump: "Salto reto",
  knight_jump: "Salto em curva"
};

const movementKindAssetSuffix: Record<MovementKind, string> = {
  adjacent: "ortogonal",
  diagonal: "diagonal",
  straight_jump: "salto",
  knight_jump: "cavalo"
};

const habitatAssetPrefix: Record<Habitat, string> = {
  forest: "bosque",
  field: "campo",
  river: "rios"
};

function movementArtPath(habitat: Habitat, kind: MovementKind): string {
  return `/assets/movimentos/separados/${habitatAssetPrefix[habitat]}_${movementKindAssetSuffix[kind]}.png`;
}

const movementGlyphOffsets: Record<MovementKind, Array<[number, number]>> = {
  adjacent: [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1]
  ],
  diagonal: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ],
  straight_jump: [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0]
  ],
  knight_jump: [
    [-1, -2],
    [1, -2],
    [2, -1],
    [2, 1],
    [1, 2],
    [-1, 2],
    [-2, 1],
    [-2, -1]
  ]
};

function MovementGlyph({ kind }: { kind: MovementKind }) {
  const offsets = movementGlyphOffsets[kind];
  const cell = 6;
  const center = 0;
  return (
    <svg
      className="movement-glyph"
      viewBox="-15 -15 30 30"
      width="22"
      height="22"
      aria-hidden="true"
    >
      <circle cx={center} cy={center} r={2.2} className="movement-glyph-origin" />
      {offsets.map(([dx, dy], i) => (
        <circle
          key={i}
          cx={dx * cell}
          cy={dy * cell}
          r={1.8}
          className="movement-glyph-target"
        />
      ))}
    </svg>
  );
}

function isExclusiveScenarioPair(a: ScenarioCardId, b: ScenarioCardId): boolean {
  return (a === "pantanal" && b === "mata_atlantica") || (a === "mata_atlantica" && b === "pantanal");
}

function formatTurnTimer(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}min ${rest}s` : `${minutes}min`;
}

// Live turn countdown shown in the turn banner for timed online games.
function TurnCountdown({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, durationMs - (now - startedAt));
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`;
  const ratio = durationMs > 0 ? Math.max(0, Math.min(1, remaining / durationMs)) : 0;
  const low = remaining <= 10000;

  return (
    <div className={`turn-countdown ${low ? "is-low" : ""}`} role="timer" aria-label="Tempo restante do turno">
      <Clock aria-hidden="true" />
      <span className="turn-countdown-value">{label}</span>
      <span className="turn-countdown-bar" aria-hidden="true">
        <span className="turn-countdown-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </span>
    </div>
  );
}

function ScenarioVotingOverlay({
  room,
  playerId,
  isSpectator,
  onSubmitVotes
}: {
  room: PublicRoomState;
  playerId: string | null;
  isSpectator: boolean;
  onSubmitVotes: (votes: ScenarioCardId[]) => void;
}) {
  const voting = room.scenarioVoting;
  const [now, setNow] = useState(() => Date.now());
  const [localVotes, setLocalVotes] = useState<ScenarioCardId[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const scenarioCount = voting?.scenarioCount ?? room.scenarioCount ?? 2;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!voting || !playerId) return;
    const serverVotes = voting.votesByPlayer[playerId] ?? [];
    if (serverVotes.length >= scenarioCount) {
      setSubmitted(true);
      setLocalVotes(serverVotes);
    }
  }, [voting, playerId, scenarioCount]);

  if (!voting) return null;

  const remaining = Math.max(0, voting.deadline - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const low = remaining <= 10000;
  const canVote = Boolean(playerId) && !isSpectator && !submitted && !voting.selectedIds;
  const totalPlayers = room.players.length;
  const votedPlayers = room.players.filter(
    (p) => (voting.votesByPlayer[p.playerId] ?? []).length >= scenarioCount
  ).length;

  const toggleVote = (id: ScenarioCardId) => {
    if (!canVote) return;
    setLocalVotes((prev) => {
      if (prev.includes(id)) return prev.filter((v) => v !== id);
      if (prev.length >= scenarioCount) return prev;
      return [...prev, id];
    });
  };

  const submit = () => {
    if (!canVote || localVotes.length !== scenarioCount) return;
    onSubmitVotes(localVotes);
    setSubmitted(true);
  };

  const selectedDefinitions = voting.selectedIds?.map((id) => scenarioCardsById.get(id)).filter(Boolean) ?? [];

  return (
    <div className="scenario-vote-overlay" role="dialog" aria-label="Votação de cenários">
      <div className="scenario-vote-panel">
        <header className="scenario-vote-header">
          <div className="scenario-vote-copy">
            <span className="scenario-vote-badge">Mini-expansão: Cenários</span>
            <h2>Vote em {scenarioCount} carta{scenarioCount === 1 ? "" : "s"} de cenário</h2>
            <p>
              {scenarioCount === 1 ? "A mais votada altera" : "As mais votadas alteram"} regras durante toda esta partida.
            </p>
            <div className="scenario-vote-progress" aria-hidden="true">
              <span style={{ width: `${Math.round((votedPlayers / Math.max(1, totalPlayers)) * 100)}%` }} />
            </div>
          </div>
          <div className={`scenario-vote-timer ${low ? "is-low" : ""}`}>
            <Clock aria-hidden="true" />
            <span>{totalSeconds}s</span>
          </div>
        </header>

        <div className="scenario-vote-status">
          <span>{votedPlayers}/{totalPlayers} jogadores votaram</span>
          {isSpectator && <span>· Você está assistindo</span>}
          {submitted && !isSpectator && <span>· Aguardando demais jogadores…</span>}
        </div>

        <ul className="scenario-vote-grid">
          {voting.candidateIds.map((id) => {
            const def = scenarioCardsById.get(id);
            if (!def) return null;
            const selected = localVotes.includes(id);
            const winner = voting.selectedIds?.includes(id);
            return (
              <li key={id} className="scenario-vote-card-wrap">
                <button
                  type="button"
                  className={`scenario-vote-card ${selected ? "is-selected" : ""} ${winner ? "is-winner" : ""}`}
                  disabled={!canVote}
                  onClick={() => toggleVote(id)}
                  aria-pressed={selected}
                  aria-label={`${def.label}: ${def.description}`}
                >
                  <span className="scenario-vote-card-img">
                    <img src={encodeURI(def.imagePath)} alt={def.label} />
                    <span className="scenario-vote-zoom-cue" aria-hidden="true">
                      <Eye aria-hidden="true" />
                    </span>
                  </span>
                  <span className="scenario-vote-card-copy">
                    <span className="scenario-vote-card-name">{def.label}</span>
                    <span className="scenario-vote-card-desc">{def.description}</span>
                  </span>
                  {selected && (
                    <span className="scenario-vote-card-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
                <span className="scenario-vote-card-zoom" aria-hidden="true">
                  <img src={encodeURI(def.imagePath)} alt="" />
                </span>
              </li>
            );
          })}
        </ul>

        {voting.selectedIds && voting.selectedIds.length > 0 && (
          <div className="scenario-vote-result">
            <strong>Cenários selecionados:</strong>
            <div>
              {selectedDefinitions.map((def) =>
                def ? <span key={def.id} className="scenario-vote-result-tag">{def.label}</span> : null
              )}
            </div>
          </div>
        )}

        <footer className="scenario-vote-footer">
          {canVote ? (
            <button
              type="button"
              className="primary-button"
              disabled={localVotes.length !== scenarioCount}
              onClick={submit}
            >
              Confirmar voto ({localVotes.length}/{scenarioCount})
            </button>
          ) : isSpectator ? (
            <span className="scenario-vote-hint">Espectadores não votam.</span>
          ) : (
            <span className="scenario-vote-hint">Voto registrado.</span>
          )}
        </footer>
      </div>
    </div>
  );
}

function ActiveRulesDock({
  scenarios,
  threat,
  open,
  onToggle
}: {
  scenarios: ScenarioCardDefinition[];
  threat: ThreatCardDefinition | null;
  open: boolean;
  onToggle: () => void;
}) {
  const ruleCount = scenarios.length + (threat ? 1 : 0);
  if (ruleCount === 0) return null;

  return (
    <aside className={`scenario-dock ${open ? "is-open" : ""}`} aria-label="Regras ativas">
      <button
        type="button"
        className="scenario-dock-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <MapPin aria-hidden="true" />
        <span>Regras</span>
        <strong>{ruleCount}</strong>
        {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </button>
      {open && (
        <div className="scenario-dock-panel">
          <div className="scenario-dock-head">
            <span>Regras da partida</span>
            <small>Ameaca por rodada; cenarios ate o fim</small>
          </div>
          <div className="scenario-dock-list">
            {threat && (
              <article className="scenario-dock-card scenario-dock-threat-card">
                {threat.imagePath ? (
                  <img src={encodeURI(threat.imagePath)} alt="" />
                ) : (
                  <div className="scenario-dock-threat-icon">
                    <AlertTriangle aria-hidden="true" />
                  </div>
                )}
                <div>
                  <div className="threat-dock-badge">
                    <AlertTriangle aria-hidden="true" />
                    <span>Ameaca da rodada</span>
                  </div>
                  <strong>{threat.label}</strong>
                  <p>{threat.description}</p>
                </div>
              </article>
            )}
            {scenarios.map((scenario) => (
              <article className="scenario-dock-card" key={scenario.id}>
                <img src={encodeURI(scenario.imagePath)} alt="" />
                <div>
                  <strong>{scenario.label}</strong>
                  <p>{scenario.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export function App() {
  const [socket, setSocket] = useState<OikosSocket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [name, setName] = useState("Jogador");
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [openRooms, setOpenRooms] = useState<RoomSummary[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesId | "">("");
  const [localSpeciesIds, setLocalSpeciesIds] = useState<SpeciesId[]>(["maned_wolf", "coati"]);
  const [localBotSpeciesIds, setLocalBotSpeciesIds] = useState<SpeciesId[]>([]);
  const [localBotTurnDelayMs, setLocalBotTurnDelayMs] = useState(defaultBotTurnDelayMs);
  const [localEnabledMiniExpansions, setLocalEnabledMiniExpansions] = useState<MiniExpansionId[]>(["objectives"]);
  const [localScenarioCount, setLocalScenarioCount] = useState<ScenarioCount>(2);
  const [localSelectedScenarioIds, setLocalSelectedScenarioIds] = useState<ScenarioCardId[]>(["amazonia", "cerrado"]);
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedCardRotation, setSelectedCardRotation] = useState<0 | 90 | 180 | 270>(0);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [selectedJaguarDestination, setSelectedJaguarDestination] = useState<{ x: number; y: number } | null>(null);
  const [selectedJaguarTargetPieceId, setSelectedJaguarTargetPieceId] = useState<string | null>(null);
  const [selectedWolfTargetPieceId, setSelectedWolfTargetPieceId] = useState<string | null>(null);
  const [selectedWolfResources, setSelectedWolfResources] = useState<Resource[]>([]);
  const [selectedRemovalPieceIds, setSelectedRemovalPieceIds] = useState<string[]>([]);
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
  const [scenarioDockOpen, setScenarioDockOpen] = useState(false);
  const [expansionPreview, setExpansionPreview] = useState<"objective" | "scenarios" | "threat" | null>(null);
  // Mobile-only HUD: below this width the floating docks become bottom sheets
  // driven by a tab bar. Desktop keeps the original floating layout untouched.
  const [isMobile, setIsMobile] = useState(isMobileWidth);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [audioSettings, setAudioSettingsState] = useState<AudioSettings>(() => getAudioSettings());
  const seenLogIdRef = useRef<Set<string>>(new Set());
  const logInitializedRef = useRef(false);
  const endgameConfetti = useMemo<CSSProperties[]>(() => {
    const colors = ["#f2c14e", "#5fd08a", "#3a7fc4", "#e06a5a", "#b6815f", "#ffd773"];
    return Array.from({ length: 80 }, () => ({
      left: `${Math.random() * 100}%`,
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      animationDelay: `${Math.random() * 2.5}s`,
      animationDuration: `${2.6 + Math.random() * 2.2}s`,
      transform: `rotate(${Math.random() * 360}deg)`,
      width: `${6 + Math.random() * 6}px`,
      height: `${9 + Math.random() * 8}px`
    }) as CSSProperties);
  }, []);
  const [hudLeftCollapsed, setHudLeftCollapsed] = useState(isSmallScreen);
  const [hudRightCollapsed, setHudRightCollapsed] = useState(isSmallScreen);
  // Mobile-only: the species panel can collapse to its header. Desktop keeps it
  // open (toggle is hidden and the collapse CSS lives only in the phone query).
  const [hudSpeciesCollapsed, setHudSpeciesCollapsed] = useState(isSmallScreen);
  const [movementPreview, setMovementPreview] = useState<{ speciesId: SpeciesId; left: number; top: number } | null>(null);
  const [landingMode, setLandingMode] = useState<"idle" | "create" | "join" | "local" | "tutorials">("idle");
  const [tutorialId, setTutorialId] = useState<TutorialId | null>(null);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  // Log length captured when the move step begins, to detect the taught move.
  const tutorialMoveLogLenRef = useRef<number | null>(null);
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

  // Keep `isMobile` in sync with the phone breakpoint; close any open sheet
  // when leaving mobile so the desktop layout is never left in a sheet state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(MOBILE_HUD_QUERY);
    const onChange = () => {
      setIsMobile(mql.matches);
      if (!mql.matches) setMobileSheet(null);
    };
    onChange();
    mql.addEventListener("change", onChange);
    // Fallback: some environments don't dispatch matchMedia "change" reliably.
    window.addEventListener("resize", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

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

  useEffect(() => {
    const nextSocket = createSocket();
    setSocket(nextSocket);

    nextSocket.on("connect", () => {
      setError((current) => (current === SERVER_UNAVAILABLE_MESSAGE ? null : current));
    });

    nextSocket.on("connected", (payload: { playerId: string }) => {
      setPlayerId(payload.playerId);
      const savedRoomId = window.localStorage.getItem(lastOnlineRoomStorageKey);
      const savedName = window.localStorage.getItem(lastOnlineNameStorageKey) ?? name;

      if (savedRoomId) {
        const reconnectEpoch = roomActionEpochRef.current;
        const reconnectAsSpectator = wasSpectatorSession();
        setName(savedName);
        const reconnectPromise = reconnectAsSpectator
          ? roomApi.spectate(nextSocket, savedRoomId)
          : roomApi.join(nextSocket, savedRoomId, savedName);
        void reconnectPromise
          .then((nextRoom) => {
            if (roomActionEpochRef.current !== reconnectEpoch) {
              return;
            }

            setIsSpectator(reconnectAsSpectator);
            applyOnlineRoomState(nextRoom, { direct: true });
            setNotice(reconnectAsSpectator ? "Reconectado como espectador." : "Reconectado a sala.");
          })
          .catch((err) => {
            if (roomActionEpochRef.current !== reconnectEpoch) {
              return;
            }

            clearOnlineSession();
            clearRoomState();
            setNotice(
              isMissingRoomError(err)
                ? "A sala anterior expirou no servidor gratuito. Crie uma nova sala para continuar."
                : "Não foi possível reconectar a sala anterior."
            );
          });
      }
    });

    nextSocket.on("room:update", (nextRoom: PublicRoomState) => {
      applyOnlineRoomState(nextRoom);
    });

    nextSocket.on("room:kicked", (payload: { roomId: string }) => {
      ignoredOnlineRoomIdsRef.current.add(payload.roomId);
      clearOnlineSession();
      setLandingMode("idle");
      autoScoredRef.current = null;
      clearRoomState();
      setError("Você foi removido da sala pelo anfitrião.");
    });

    nextSocket.on("connect_error", () => {
      if (showServerWarningRef.current) {
        setError(SERVER_UNAVAILABLE_MESSAGE);
      }
    });

    return () => {
      nextSocket.disconnect();
    };
  }, [applyOnlineRoomState]);

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

  // Poll the public open-room list while the "Entrar em Sala" screen is open.
  useEffect(() => {
    if (landingMode !== "join" || !socket) {
      return;
    }

    let active = true;
    const fetchRooms = () => {
      setRoomsLoading(true);
      roomApi
        .listRooms(socket)
        .then((rooms) => {
          if (active) {
            setOpenRooms(rooms);
          }
        })
        .catch(() => {
          if (active) {
            setOpenRooms([]);
          }
        })
        .finally(() => {
          if (active) {
            setRoomsLoading(false);
          }
        });
    };

    fetchRooms();
    const interval = window.setInterval(fetchRooms, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [landingMode, socket]);

  const isLocalRoom = room?.roomId === localRoomId;
  const controlledPlayerId = isLocalRoom
    ? room?.game?.setupActivePlayerId ?? room?.game?.activePlayerId ?? null
    : isSpectator
      ? null
      : playerId;
  const currentPlayer = room?.players.find((player) => player.playerId === controlledPlayerId) ?? null;
  // In a local game the active species is auto-played when it is a bot, so the
  // human must not be able to act on its turn.
  const activeIsLocalBot = Boolean(isLocalRoom && currentPlayer?.isBot);
  const currentGamePlayer = room?.game?.players.find((player) => player.playerId === controlledPlayerId) ?? null;
  const setupActivePlayer = room?.game?.players.find((player) => player.playerId === room.game?.setupActivePlayerId) ?? null;
  const activeGamePlayer = room?.game?.players.find((player) => player.playerId === room.game?.activePlayerId) ?? null;
  const activeSpecies = activeGamePlayer?.speciesId ? speciesDefinitions[activeGamePlayer.speciesId] : null;
  const activeActionId = activeSpecies && room?.game ? activeSpecies.actions[room.game.activeActionIndex] ?? null : null;
  const canControlActivePlayer = Boolean(
    room?.game?.activePlayerId && currentGamePlayer?.playerId === room.game.activePlayerId && !activeIsLocalBot
  );
  // Action step viewer should only flag a step as "em andamento" when the
  // controlled player is the active player. Otherwise the opponent's progress
  // would steal focus on the local HUD.
  const ownActiveActionId =
    room?.game?.activePlayerId && currentGamePlayer?.playerId === room.game.activePlayerId
      ? activeActionId
      : null;
  const hasPendingCoatiPairBonus = Boolean(room?.game?.pendingCoatiPairBonus);
  const hasStartedGame = Boolean(room?.game);
  const gameLog = room?.game?.log;

  // Leader(s) per resource for the players panel. Seed (pinha) has no majority
  // in scoring, so it is excluded. Ties highlight every top holder. Count 0 = no
  // leader. Mirrors the endgame resource-majority rule (meat/egg/fruit only).
  const resourceLeaders = useMemo(() => {
    const leaders: Partial<Record<Resource, Set<string>>> = {};
    const gamePlayers = room?.game?.players ?? [];
    if (gamePlayers.length === 0) {
      return leaders;
    }

    for (const resource of ["meat", "egg", "fruit"] as Resource[]) {
      let top = 0;
      for (const player of gamePlayers) {
        top = Math.max(top, player.resources[resource] ?? 0);
      }
      if (top <= 0) {
        continue;
      }
      leaders[resource] = new Set(
        gamePlayers.filter((player) => (player.resources[resource] ?? 0) === top).map((player) => player.playerId)
      );
    }

    return leaders;
  }, [room?.game?.players]);

  // Tutorial state derived from the current step.
  const tutorialSteps = getTutorialSteps(tutorialId);
  const tutorialActive = tutorialId !== null && tutorialStep !== null;
  const tutorialDef = tutorialActive ? tutorialSteps[tutorialStep] ?? null : null;
  const tutorialGate: TutorialGate | null = tutorialDef?.gate ?? null;
  const highlightedMovementGuideSpecies =
    tutorialActive ? tutorialDef?.highlightMovementGuideSpecies ?? null : null;
  const tutorialRequiredCardId =
    tutorialActive && tutorialDef?.gate === "placeCard" ? tutorialDef.requiredCardId ?? null : null;
  // True when the tutorial forbids a given board interaction for the current step.
  const tutorialBlocks = useCallback(
    (action: "setupPlace" | "placeCard" | "move") => {
      if (!tutorialActive) return false;
      if (tutorialGate === "setup") return action !== "setupPlace";
      if (tutorialGate === "placeCard") return action !== "placeCard";
      if (tutorialGate === "move") return action !== "move";
      return true; // "none" steps block all board actions
    },
    [tutorialActive, tutorialGate]
  );

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

  // Orchestrate the scripted tutorial: detect when the taught action is done and
  // craft the next state. Card placements are detected by the card appearing in
  // the forest (so we are not bound to the species action pipeline).
  const tutorialGameStatus = room?.game?.status;
  useEffect(() => {
    if (tutorialStep === null || !room?.game) return;
    const def = tutorialSteps[tutorialStep];
    if (!def?.autoAdvance) return;
    const game = room.game;
    const forestHas = (cardId: string) => game.forest.cards.some((card) => card.definitionId === cardId);
    const tutorialPlayerId = getTutorialPlayerId(tutorialId, game.activePlayerId);

    if (def.gate === "setup") {
      if (game.status === "active") setTutorialStep((step) => (step === null ? step : step + 1));
      return;
    }

    if (def.gate === "placeCard" && def.requiredCardId && forestHas(def.requiredCardId)) {
      if (tutorialId === "initial") {
        const isRiverStep = Boolean(def.requiresRiver);
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
      tutorialMoveLogLenRef.current = null;
      setTutorialStep((step) => (step === null ? step : step + 1));
      return;
    }

    if (def.completeWhenCoatiPairPending) {
      if (game.activePlayerId === tutorialPlayerId && game.pendingCoatiPairBonus?.playerId === tutorialPlayerId) {
        tutorialMoveLogLenRef.current = null;
        setTutorialStep((step) => (step === null ? step : step + 1));
      }
      return;
    }

    if (typeof def.completeWhenActionIndex === "number") {
      if (game.activePlayerId === tutorialPlayerId && game.activeActionIndex >= def.completeWhenActionIndex) {
        tutorialMoveLogLenRef.current = null;
        setTutorialStep((step) => (step === null ? step : step + 1));
      }
      return;
    }

    if (typeof def.completeWhenScoreAtLeast === "number") {
      const player = game.players.find((candidate) => candidate.playerId === tutorialPlayerId);
      if (player && player.score >= def.completeWhenScoreAtLeast) {
        tutorialMoveLogLenRef.current = null;
        setTutorialStep((step) => (step === null ? step : step + 1));
      }
      return;
    }

    if (typeof def.completeWhenRoundAtLeast === "number") {
      if (game.round >= def.completeWhenRoundAtLeast) {
        tutorialMoveLogLenRef.current = null;
        setTutorialStep((step) => (step === null ? step : step + 1));
      }
      return;
    }

    if (def.gate === "move") {
      if (tutorialMoveLogLenRef.current === null) {
        tutorialMoveLogLenRef.current = game.log.length;
        return;
      }
      const moved = game.log
        .slice(tutorialMoveLogLenRef.current)
        .some((entry) => entry.payload?.kind === "move_piece");
      if (moved) setTutorialStep((step) => (step === null ? step : step + 1));
    }
  }, [tutorialId, tutorialStep, tutorialSteps, tutorialGameStatus, room?.game]);

  // When a tutorial step starts: pre-select the required card and open the board
  // it asks to show, so the player only has to act, not hunt for the right card.
  useEffect(() => {
    if (tutorialStep === null) {
      return;
    }
    // Reset any board selection so a read-only step never inherits a clickable
    // piece/target from the previous step.
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedRemovalPieceIds([]);
    const def = tutorialSteps[tutorialStep];
    if (def?.gate === "placeCard" && def.requiredCardId) {
      setSelectedHandCardId(def.requiredCardId);
      setSelectedCardRotation(0);
      setPendingPlacement(null);
    }
    if (def?.openBoard) {
      setBoardSpecies(def.openBoard);
    } else {
      setBoardSpecies(null);
    }
    if (tutorialId === "armadillo" && def?.jaguarProbeTarget) {
      setRoom((current) =>
        current?.game
          ? { ...current, game: moveArmadilloTutorialJaguarProbe(current.game, def.jaguarProbeTarget!) }
          : current
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialId, tutorialStep, tutorialSteps]);

  const hudGamePlayer = currentGamePlayer ?? activeGamePlayer ?? setupActivePlayer ?? null;
  const hudSpecies = hudGamePlayer?.speciesId ? speciesDefinitions[hudGamePlayer.speciesId] : null;
  const playerInspectorEntries = useMemo(() => {
    const players = room?.players ?? [];
    if (!room?.game) {
      return players.map((player, displayIndex) => ({
        player,
        gamePlayer: null,
        species: player.speciesId ? speciesDefinitions[player.speciesId] : null,
        displayIndex,
        isActivePlayer: false
      }));
    }

    const order = room.game.status === "setup" ? room.game.setupOrder : room.game.turnOrder;
    const indexByPlayerId = new Map(order.map((id, index) => [id, index]));
    return [...players]
      .sort((a, b) => {
        const ai = indexByPlayerId.get(a.playerId);
        const bi = indexByPlayerId.get(b.playerId);
        if (ai === undefined && bi === undefined) return 0;
        if (ai === undefined) return 1;
        if (bi === undefined) return -1;
        return ai - bi;
      })
      .map((player, displayIndex) => ({
        player,
        gamePlayer: room.game?.players.find((candidate) => candidate.playerId === player.playerId) ?? null,
        species: player.speciesId ? speciesDefinitions[player.speciesId] : null,
        displayIndex,
        isActivePlayer:
          player.playerId === room.game?.activePlayerId ||
          player.playerId === room.game?.setupActivePlayerId
      }));
  }, [room?.players, room?.game]);
  const opponentInspectorEntries = useMemo(
    () =>
      playerInspectorEntries.filter(
        (entry) => !currentGamePlayer || entry.player.playerId !== currentGamePlayer.playerId
      ),
    [currentGamePlayer?.playerId, playerInspectorEntries]
  );
  const selectedOpponentEntry = useMemo(
    () => opponentInspectorEntries.find((entry) => entry.player.playerId === selectedOpponentPlayerId) ?? null,
    [opponentInspectorEntries, selectedOpponentPlayerId]
  );
  const selectedOpponentRailIndex = selectedOpponentEntry
    ? Math.max(
        0,
        opponentInspectorEntries.findIndex((entry) => entry.player.playerId === selectedOpponentEntry.player.playerId)
      )
    : 0;
  const isHost = Boolean(room && !isLocalRoom && playerId === room.hostPlayerId);
  const roomHasBots = Boolean(room?.players.some((player) => player.isBot));
  const readyPlayerCount = room?.players.filter((player) => player.ready).length ?? 0;
  const enabledMiniExpansions = room?.enabledMiniExpansions ?? room?.game?.enabledMiniExpansions ?? ["objectives"];
  const scenarioSelectionMode = room?.scenarioSelectionMode ?? "vote";
  const scenarioCount = room?.scenarioCount ?? 2;
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
  const canPlaceSetupPiece = Boolean(
    room?.game?.status === "setup" &&
      !activeIsLocalBot &&
      (isLocalRoom || room.game.setupActivePlayerId === playerId)
  );
  const playableCardIds = useMemo(() => {
    const pile = room?.game?.mataAtlanticaPiles
      ? room.game.mataAtlanticaPiles.map((p) => p[0]).filter((id): id is string => Boolean(id))
      : [];
    return new Set<string>([...(currentGamePlayer?.hand ?? []), ...pile]);
  }, [currentGamePlayer?.hand, room?.game?.mataAtlanticaPiles]);
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
      selectedHandCardId &&
      playableCardIds.has(selectedHandCardId)
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

  // During a tutorial placeCard step, restrict placement to a single marked slot.
  const tutorialPlaceStep = tutorialActive && tutorialGate === "placeCard" && Boolean(tutorialDef?.requiredCardId);
  const tutorialMarkedSlot = useMemo<GridPosition | null>(() => {
    if (!tutorialPlaceStep) return null;
    return tutorialDef?.markedSlot ?? null;
  }, [tutorialPlaceStep, tutorialDef?.markedSlot]);

  const displayExpansionTargets = useMemo(() => {
    if (!tutorialPlaceStep || !tutorialMarkedSlot) return expansionTargets;
    return expansionTargets.filter((p) => p.x === tutorialMarkedSlot.x && p.y === tutorialMarkedSlot.y);
  }, [tutorialPlaceStep, tutorialMarkedSlot, expansionTargets]);

  const displayRotateFitTargets = useMemo(() => {
    if (!tutorialPlaceStep || !tutorialMarkedSlot) return rotateFitTargets;
    return rotateFitTargets.filter(
      (t) => t.position.x === tutorialMarkedSlot.x && t.position.y === tutorialMarkedSlot.y
    );
  }, [tutorialPlaceStep, tutorialMarkedSlot, rotateFitTargets]);

  // Keep a ref of the current drop targets so async drag handlers always see the
  // set for the latest rotation (the pointermove closure is captured once).
  // Each target carries the rotation to apply when dropped there.
  type DropTarget = { x: number; y: number; rotation: 0 | 90 | 180 | 270 };
  const dropTargetsRef = useRef<DropTarget[]>([]);
  dropTargetsRef.current = [
    ...displayExpansionTargets.map((p) => ({ x: p.x, y: p.y, rotation: selectedCardRotation })),
    ...displayRotateFitTargets.map((t) => ({ x: t.position.x, y: t.position.y, rotation: t.rotation }))
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
      canControlActivePlayer &&
      (!tutorialActive || tutorialId !== "jaguar" || tutorialGate === "score")
  );
  const movementTargets = useMemo(() => {
    if (!room?.game || hasPendingCoatiPairBonus || !room.game.activePlayerId || !selectedPieceId) {
      return [];
    }

    return getValidPieceMovementDestinations(room.game, room.game.activePlayerId, selectedPieceId);
  }, [hasPendingCoatiPairBonus, room?.game, selectedPieceId]);
  const displayMovementTargets = useMemo(() => {
    if (!tutorialActive || tutorialGate !== "move" || !tutorialDef?.markedMoveTarget) {
      return movementTargets;
    }

    return movementTargets.filter((position) => sameGridPosition(position, tutorialDef.markedMoveTarget));
  }, [movementTargets, tutorialActive, tutorialDef?.markedMoveTarget, tutorialGate]);
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
  const boardSelectablePieceIds = useMemo(() => {
    const ids = [...new Set([...selectablePieceIds, ...jaguarTargetPieceIds])];
    if (!tutorialActive) {
      return ids;
    }
    // Lock the board during a tutorial: only the exact piece the step asks for is
    // clickable. A marked piece restricts to it; an unmarked move step (e.g. the
    // Onça's single meeple) keeps the engine's selectable set; every other gate
    // (none/placeCard/score/addPiece/resolvePair) locks selection entirely.
    if (tutorialDef?.markedPieceId) {
      return ids.filter((pieceId) => pieceId === tutorialDef.markedPieceId);
    }
    if (tutorialGate === "move" || tutorialGate === "removeCoati") {
      return ids;
    }
    return [];
  }, [jaguarTargetPieceIds, selectablePieceIds, tutorialActive, tutorialDef?.markedPieceId, tutorialGate]);
  const highlightedPieceIds = useMemo(
    () => [
      ...(tutorialActive && tutorialDef?.markedPieceId ? [tutorialDef.markedPieceId] : []),
      ...selectedRemovalPieceIds,
      ...(selectedJaguarTargetPieceId ? [selectedJaguarTargetPieceId] : []),
      ...(selectedWolfTargetPieceId ? [selectedWolfTargetPieceId] : [])
    ],
    [selectedJaguarTargetPieceId, selectedRemovalPieceIds, selectedWolfTargetPieceId, tutorialActive, tutorialDef?.markedPieceId]
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
  const displayCoatiPairBonusTargets = useMemo(() => {
    if (!tutorialActive || tutorialGate !== "resolvePair" || !tutorialDef?.markedPairTarget) {
      return coatiPairBonusTargets;
    }

    return coatiPairBonusTargets.filter((position) => sameGridPosition(position, tutorialDef.markedPairTarget));
  }, [coatiPairBonusTargets, tutorialActive, tutorialDef?.markedPairTarget, tutorialGate]);
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
  const displayAddPieceTargets = useMemo(() => {
    if (!tutorialActive || tutorialGate !== "addPiece" || !tutorialDef?.markedAddPieceTarget) {
      return addPieceTargets;
    }

    return addPieceTargets.filter((position) => sameGridPosition(position, tutorialDef.markedAddPieceTarget));
  }, [addPieceTargets, tutorialActive, tutorialDef?.markedAddPieceTarget, tutorialGate]);
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
  const mataAtlanticaPileTopIds = useMemo(() => {
    const piles = room?.game?.mataAtlanticaPiles;
    if (!piles) return [] as string[];
    return piles.map((pile) => pile[0]).filter((id): id is string => Boolean(id));
  }, [room?.game?.mataAtlanticaPiles]);
  const mataAtlanticaPileIndexByCardId = useMemo(() => {
    const map = new Map<string, number>();
    mataAtlanticaPileTopIds.forEach((id, index) => {
      if (id) map.set(id, index);
    });
    return map;
  }, [mataAtlanticaPileTopIds]);
  const handCards = useMemo(
    () => {
      const personal = (currentGamePlayer?.hand ?? []).map((cardId) => getForestCardDefinition(cardId));
      const piles = mataAtlanticaPileTopIds.map((cardId) => getForestCardDefinition(cardId));
      return [...personal, ...piles];
    },
    [currentGamePlayer?.hand, mataAtlanticaPileTopIds]
  );
  const objectiveChoices = useMemo(
    () =>
      (currentGamePlayer?.objectiveChoices ?? [])
        .map((cardId) => objectiveCardsById.get(cardId))
        .filter((card): card is ObjectiveCardDefinition => Boolean(card)),
    [currentGamePlayer?.objectiveChoices]
  );
  const selectedObjectiveCard = currentGamePlayer?.selectedObjectiveCardId
    ? getObjectiveCardDefinition(currentGamePlayer.selectedObjectiveCardId)
    : null;
  const needsObjectiveChoice = Boolean(
    currentGamePlayer &&
      objectiveChoices.length > 0 &&
      !currentGamePlayer.selectedObjectiveCardId &&
      !pendingObjectiveCardId
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
  const sortedHandCards = useMemo(() => {
    const habitatRank = new Map(handHabitatOrder.map((habitat, index) => [habitat, index]));
    const resourceRank = new Map(resourceOrder.map((resource, index) => [resource, index]));

    return handCards
      .map((card, index) => ({ card, index }))
      .sort((a, b) => {
        if (handSortMode === "habitat") {
          return (
            (habitatRank.get(a.card.habitat as Habitat) ?? 99) -
              (habitatRank.get(b.card.habitat as Habitat) ?? 99) ||
            a.index - b.index
          );
        }
        if (handSortMode === "resource") {
          return (
            (resourceRank.get(a.card.resource as Resource) ?? 99) -
              (resourceRank.get(b.card.resource as Resource) ?? 99) ||
            a.index - b.index
          );
        }
        return a.index - b.index;
      });
  }, [handCards, handSortMode]);
  const showHandDuringGame = Boolean(
    hasStartedGame &&
      currentGamePlayer &&
      (room?.game?.status === "setup" || room?.game?.status === "active")
  );
  const canSelectHandCards = Boolean(room?.game?.status === "active");
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
  }

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
      () => roomApi.setTurnTimer(requireSocket(), room.roomId, turnTimerMs ? null : DEFAULT_TURN_TIMER_MS),
      turnTimerMs ? "Cronômetro de turno desligado." : "Cronômetro de turno ligado."
    );
  }

  function adjustTurnTimer(direction: number) {
    if (!room || !isHost || !turnTimerMs) {
      return;
    }

    const currentIndex = TURN_TIMER_OPTIONS.indexOf(turnTimerMs);
    const baseIndex = currentIndex >= 0 ? currentIndex : TURN_TIMER_OPTIONS.indexOf(DEFAULT_TURN_TIMER_MS);
    const nextIndex = Math.max(0, Math.min(TURN_TIMER_OPTIONS.length - 1, baseIndex + direction));
    void run(() => roomApi.setTurnTimer(requireSocket(), room.roomId, TURN_TIMER_OPTIONS[nextIndex]));
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
      () => roomApi.setScenarioCount(requireSocket(), room.roomId, nextCount),
      `${nextCount} cenario${nextCount === 1 ? "" : "s"} por partida.`
    );
  }

  function toggleHostScenario(scenarioId: ScenarioCardId) {
    if (!room || !isHost || room.status !== "lobby") {
      return;
    }

    if (
      !hostSelectedScenarioIds.includes(scenarioId) &&
      hostSelectedScenarioIds.some((id) => isExclusiveScenarioPair(id, scenarioId))
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
    setLocalScenarioCount(nextCount);
    setLocalSelectedScenarioIds((current) => current.slice(0, nextCount));
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

      if (current.some((id) => isExclusiveScenarioPair(id, scenarioId))) {
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
                  ? "Lobo-guará adicionado."
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
    [
      activeSpecies?.speciesId,
      addPieceTargets.length,
      isLocalRoom,
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
      if (
        tutorialActive &&
        tutorialGate === "resolvePair" &&
        tutorialDef?.markedPairTarget &&
        !sameGridPosition(position, tutorialDef.markedPairTarget)
      ) {
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
    [coatiPairBonusTargets.length, isLocalRoom, room, socket, tutorialActive, tutorialDef?.markedPairTarget, tutorialGate]
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
      if (tutorialActive && tutorialDef?.requiredSpendCount && count !== tutorialDef.requiredSpendCount) {
        setNotice(`Neste tutorial, gaste ${tutorialDef.requiredSpendCount} carnes para ver a pontuação completa.`);
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
    [canControlActivePlayer, isLocalRoom, room, socket, tutorialActive, tutorialDef?.requiredSpendCount]
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

    window.setTimeout(() => {
      setMacawScoreAnim(null);
      finalize();
    }, 2400);
  }, [canControlActivePlayer, isLocalRoom, room, socket]);

  const handleHideArmadillo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || !selectedPieceId) {
      return;
    }
    if (tutorialActive && tutorialDef?.markedPieceId && selectedPieceId !== tutorialDef.markedPieceId) {
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
  }, [canControlActivePlayer, isLocalRoom, room, selectedPieceId, socket, tutorialActive, tutorialDef?.markedPieceId]);

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
    if (tutorialActive && tutorialDef?.markedPieceId && selectedWolfTargetPieceId !== tutorialDef.markedPieceId) {
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
      setNotice("Lobo-guará removeu peça de base.");
      return;
    }

    void run(() => roomApi.removeWolfBasePiece(requireSocket(), room.roomId, selectedWolfTargetPieceId)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
    });
  }, [
    canControlActivePlayer,
    isLocalRoom,
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
      setNotice("Lobo-guará gastou recursos e marcou pontos.");
      return;
    }

    void run(() => roomApi.spendWolfResources(requireSocket(), room.roomId, selectedWolfResources)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
    });
  }, [
    canControlActivePlayer,
    isLocalRoom,
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
      setNotice("Ação concluída.");
      return;
    }

    void run(() => roomApi.completeAction(requireSocket(), room.roomId)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, room, socket, tutorialActive]);

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

  function toggleLocalSpecies(speciesId: SpeciesId) {
    setLocalSpeciesIds((current) =>
      current.includes(speciesId) ? current.filter((candidate) => candidate !== speciesId) : [...current, speciesId]
    );
    // Dropping a species also clears its bot flag.
    setLocalBotSpeciesIds((current) => current.filter((candidate) => candidate !== speciesId));
  }

  function toggleLocalBot(speciesId: SpeciesId) {
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

  // Launch the scripted initial tutorial on a real local game with one species.
  function startInitialTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setPendingPlacement(null);
    setRoom(createInitialTutorialRoom());
    setTutorialStep(0);
    setTutorialId("initial");
  }

  function startJaguarTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setPendingPlacement(null);
    setRoom(createJaguarTutorialRoom());
    setTutorialStep(0);
    setTutorialId("jaguar");
  }

  function startWolfTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setPendingPlacement(null);
    setRoom(createWolfTutorialRoom());
    setTutorialStep(0);
    setTutorialId("wolf");
  }

  function startArmadilloTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setSelectedRemovalPieceIds([]);
    setPendingPlacement(null);
    setRoom(createArmadilloTutorialRoom());
    setTutorialStep(0);
    setTutorialId("armadillo");
  }

  function startMacawTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setSelectedRemovalPieceIds([]);
    setPendingPlacement(null);
    setRoom(createMacawTutorialRoom());
    setTutorialStep(0);
    setTutorialId("macaw");
  }

  function startCapuchinTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setSelectedRemovalPieceIds([]);
    setPendingPlacement(null);
    setRoom(createCapuchinTutorialRoom());
    setTutorialStep(0);
    setTutorialId("capuchin");
  }

  function startCoatiTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setSelectedRemovalPieceIds([]);
    setPendingPlacement(null);
    setRoom(createCoatiTutorialRoom());
    setTutorialStep(0);
    setTutorialId("coati");
  }

  function exitTutorial(completed: boolean) {
    if (completed && tutorialId) markTutorialDone(tutorialId);
    autoScoredRef.current = null;
    setTutorialId(null);
    setTutorialStep(null);
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

    setTutorialId(null);
    setTutorialStep(null);
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
    room?.game?.status,
    tutorialActive,
    tutorialDef?.completeWhenScoreAtLeast,
    tutorialGate
  ]);

  const setupSpecies = currentGamePlayer?.speciesId ? speciesDefinitions[currentGamePlayer.speciesId] : null;
  const setupPlaced = currentGamePlayer?.piecesInForest.length ?? 0;
  const setupNeeded = setupSpecies?.initialPieces ?? 0;

  return (
    <main
      className={`app-shell ${hasStartedGame ? "game-active" : "menu-active"} ${
        isMobile && hasStartedGame && !cleanBoardMode ? "mobile-hud" : ""
      } ${currentGamePlayer?.speciesId === "jaguar" ? "is-jaguar-active" : ""} ${
        currentGamePlayer?.speciesId === "maned_wolf" ? "is-wolf-active" : ""
      } ${currentGamePlayer?.speciesId === "armadillo" ? "is-armadillo-active" : ""} ${
        currentGamePlayer?.speciesId === "macaw" ? "is-macaw-active" : ""
      } ${currentGamePlayer?.speciesId === "capuchin" ? "is-capuchin-active" : ""} ${
        currentGamePlayer?.speciesId === "coati" ? "is-coati-active" : ""
      }`}
      data-sheet={isMobile && hasStartedGame && !cleanBoardMode ? mobileSheet ?? "none" : undefined}
    >
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
                onClick={() => setLandingMode("create")}
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
                  <strong>Entrar em Sala</strong>
                  <small>Escolha uma sala aberta ou use o código</small>
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

              <button
                type="button"
                className="landing-action landing-action-secondary"
                onClick={() => setLandingMode("tutorials")}
              >
                <span className="landing-action-icon">
                  <GraduationCap aria-hidden="true" />
                </span>
                <span className="landing-action-text">
                  <strong>Tutoriais</strong>
                  <small>Aprenda a jogar passo a passo</small>
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
              <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.png" alt="Oikos" />
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
                  onClick={() => {
                    if (socket) {
                      setRoomsLoading(true);
                      roomApi
                        .listRooms(socket)
                        .then(setOpenRooms)
                        .catch(() => setOpenRooms([]))
                        .finally(() => setRoomsLoading(false));
                    }
                  }}
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
                  const isBotSlot = localBotSpeciesIds.includes(species.speciesId);
                  return (
                    <div
                      key={species.speciesId}
                      className={`flow-species-card-wrap ${isBotSlot ? "is-bot" : ""}`}
                      style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
                    >
                      <button
                        type="button"
                        className={`flow-species-card ${selected ? "selected" : ""}`}
                        onClick={() => toggleLocalSpecies(species.speciesId)}
                      >
                        <div className="flow-species-thumb">
                          <img src={encodeURI(species.meepleAsset)} alt="" />
                        </div>
                        <div className="flow-species-text">
                          <strong>{species.displayName}</strong>
                          <small>{categoryLabels[species.category]}</small>
                        </div>
                        {isBotSlot ? (
                          <span className="flow-species-bot-tag" aria-hidden="true">
                            <Bot /> Bot
                          </span>
                        ) : (
                          selected && (
                            <span className="flow-species-check" aria-hidden="true">
                              <Check />
                            </span>
                          )
                        )}
                      </button>
                      <button
                        type="button"
                        className={`flow-species-bot-btn ${isBotSlot ? "active" : ""}`}
                        title={isBotSlot ? "Controlar manualmente" : "Controlar por bot"}
                        aria-label={isBotSlot ? "Controlar manualmente" : "Controlar por bot"}
                        onClick={() => toggleLocalBot(species.speciesId)}
                      >
                        {isBotSlot ? <X aria-hidden="true" /> : <Bot aria-hidden="true" />}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="lobby-expansions-block">
                <div className="lobby-expansions-head">
                  <strong>Mini-expansoes</strong>
                  <span className="lobby-expansions-count">
                    {localEnabledMiniExpansions.filter((id) => miniExpansionOptions.some((opt) => opt.id === id)).length}/{miniExpansionOptions.length}
                  </span>
                </div>
                <ul className="lobby-expansion-list">
                  {miniExpansionOptions.map((expansion) => {
                    const enabled = localEnabledMiniExpansions.includes(expansion.id);
                    return (
                      <li key={expansion.id}>
                        <label className={`lobby-expansion-card ${enabled ? "is-on" : ""}`}>
                          <span className="lobby-expansion-thumb" aria-hidden="true">
                            <img src={encodeURI(expansion.iconPath)} alt="" />
                          </span>
                          <span className="lobby-expansion-text">
                            <strong>{expansion.label}</strong>
                            <small>{expansion.description}</small>
                          </span>
                          <span className="lobby-switch" aria-hidden="true">
                            <span className="lobby-switch-knob" />
                          </span>
                          <input
                            type="checkbox"
                            className="lobby-expansion-input"
                            checked={enabled}
                            onChange={() => toggleLocalMiniExpansion(expansion.id)}
                            aria-label={`${enabled ? "Desligar" : "Ligar"} ${expansion.label}. ${expansion.description}`}
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {localEnabledMiniExpansions.includes("scenarios") && (
                  <div className="lobby-scenario-picker">
                    <div className="lobby-scenario-picker-head">
                      <div>
                        <strong>Cenarios</strong>
                        <small>Escolha {localScenarioCount} cenario(s) para o teste local ({localSelectedScenarioIds.length}/{localScenarioCount}).</small>
                      </div>
                      <div className="lobby-segmented" role="group" aria-label="Quantidade de cenarios no teste local">
                        <button
                          type="button"
                          className={localScenarioCount === 1 ? "is-active" : ""}
                          onClick={() => setLocalScenarioCountValue(1)}
                        >
                          1 carta
                        </button>
                        <button
                          type="button"
                          className={localScenarioCount === 2 ? "is-active" : ""}
                          onClick={() => setLocalScenarioCountValue(2)}
                        >
                          2 cartas
                        </button>
                      </div>
                    </div>
                    <ul className="lobby-scenario-card-list">
                      {scenarioCards.map((scenario) => {
                        const selected = localSelectedScenarioIds.includes(scenario.id);
                        const disabled = !selected && localSelectedScenarioIds.length >= localScenarioCount;
                        return (
                          <li key={scenario.id}>
                            <button
                              type="button"
                              className={`lobby-scenario-card ${selected ? "is-selected" : ""}`}
                              disabled={disabled}
                              onClick={() => toggleLocalScenario(scenario.id)}
                              aria-pressed={selected}
                            >
                              <img src={encodeURI(scenario.imagePath)} alt="" />
                              <span>
                                <strong>{scenario.label}</strong>
                                <small>{scenario.description}</small>
                              </span>
                              {selected && <Check aria-hidden="true" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flow-bot-speed" aria-label="Velocidade dos bots no teste local">
                <button
                  type="button"
                  className="icon-button compact"
                  title="Bots mais rápidos"
                  aria-label="Bots mais rápidos"
                  onClick={() => adjustLocalBotSpeed(-botTurnDelayStepMs)}
                >
                  <Minus aria-hidden="true" />
                </button>
                <span>Bots {formatBotDelay(localBotTurnDelayMs)}</span>
                <button
                  type="button"
                  className="icon-button compact"
                  title="Bots mais lentos"
                  aria-label="Bots mais lentos"
                  onClick={() => adjustLocalBotSpeed(botTurnDelayStepMs)}
                >
                  <Plus aria-hidden="true" />
                </button>
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

      {!hasStartedGame && !room && landingMode === "tutorials" && (
        <div className="flow-screen" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-2" />
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

          <div className="flow-body">
            <h2 className="flow-title">Tutoriais</h2>
            <p className="flow-subtitle">Escolha um capítulo. Comece pelo tutorial inicial.</p>

            <div className="tutorial-chapters">
              <button
                type="button"
                className={`tutorial-chapter ${isTutorialInitialDone() ? "is-done" : "is-available"}`}
                onClick={startInitialTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <GraduationCap aria-hidden="true" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>Tutorial inicial</strong>
                  <small>Mecânicas básicas: cartas, movimento, recursos e turno.</small>
                </span>
                {isTutorialInitialDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialJaguarDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.jaguar } as CSSProperties}
                onClick={startJaguarTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.jaguar.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.jaguar.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialJaguarDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialWolfDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.maned_wolf } as CSSProperties}
                onClick={startWolfTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.maned_wolf.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.maned_wolf.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialWolfDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialArmadilloDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.armadillo } as CSSProperties}
                onClick={startArmadilloTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.armadillo.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.armadillo.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialArmadilloDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialMacawDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.macaw } as CSSProperties}
                onClick={startMacawTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.macaw.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.macaw.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialMacawDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialCapuchinDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.capuchin } as CSSProperties}
                onClick={startCapuchinTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.capuchin.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.capuchin.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialCapuchinDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialCoatiDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.coati } as CSSProperties}
                onClick={startCoatiTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.coati.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.coati.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialCoatiDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              {speciesList.filter((species) => species.speciesId !== "jaguar" && species.speciesId !== "maned_wolf" && species.speciesId !== "armadillo" && species.speciesId !== "macaw" && species.speciesId !== "capuchin" && species.speciesId !== "coati").map((species) => (
                <div
                  key={species.speciesId}
                  className="tutorial-chapter is-locked"
                  style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
                  aria-disabled="true"
                >
                  <span className="tutorial-chapter-icon">
                    <img className="is-portrait" src={encodeURI(species.portraitAsset)} alt="" />
                  </span>
                  <span className="tutorial-chapter-text">
                    <strong>{species.displayName}</strong>
                    <small>Aprenda a jogar com esta espécie.</small>
                  </span>
                  <span className="tutorial-chapter-badge locked">
                    <Lock aria-hidden="true" /> Em breve
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!hasStartedGame && room && (
        <div className="flow-screen flow-screen-lobby" role="main">
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
              <div className="lobby-hero-copy">
                <span className="lobby-badge">
                  {isLocalRoom ? "Teste Local" : isSpectator ? "Espectador" : "Sala Online"}
                </span>
                <h2 className="flow-title lobby-title">
                  {isLocalRoom ? "Mesa Local" : isSpectator ? "Assistindo" : "Sala de Espera"}
                </h2>
                <div className="lobby-status-strip" aria-label="Status da sala">
                  <span>
                    <Users aria-hidden="true" />
                    {room.players.length}/6 jogadores
                  </span>
                  <span>
                    <Check aria-hidden="true" />
                    {readyPlayerCount}/{room.players.length} prontos
                  </span>
                  <span>
                    <Leaf aria-hidden="true" />
                    {enabledMiniExpansions.includes("objectives") ? "Objetivos ligados" : "Objetivos desligados"}
                  </span>
                </div>
              </div>
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
              <div className="lobby-side-stack">
              <section className="lobby-card lobby-players">
                <header className="lobby-card-header">
                  <Users aria-hidden="true" />
                  <h3>Jogadores</h3>
                  <span className="lobby-count">{room.players.length}</span>
                  {Boolean(room.spectatorCount) && (
                    <span className="lobby-spectator-count" title="Espectadores assistindo">
                      <Eye aria-hidden="true" />
                      {room.spectatorCount}
                    </span>
                  )}
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
                            <img className="is-portrait" src={encodeURI(species.portraitAsset)} alt="" />
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
                        {!isLocalRoom && isYou && !player.isBot && (
                          <button
                            type="button"
                            className="lobby-player-action"
                            onClick={handleRenameSelf}
                            title="Renomear"
                            aria-label="Renomear"
                          >
                            ✎
                          </button>
                        )}
                        {!isLocalRoom && isHost && !isYou && !player.isBot && (
                          <button
                            type="button"
                            className="lobby-player-action is-danger"
                            onClick={() => handleKickPlayer(player.playerId, player.name)}
                            title="Remover jogador"
                            aria-label="Remover jogador"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>

              </section>

              {!isLocalRoom && (
                <section className="lobby-card lobby-settings">
                  <header className="lobby-card-header">
                    <Settings aria-hidden="true" />
                    <h3>Configuração da Mesa</h3>
                    {isHost ? <span className="lobby-count">Host</span> : <span className="lobby-count">Leitura</span>}
                  </header>

                  <div className="lobby-setting-list">
                    <div className="lobby-expansions-block">
                      <div className="lobby-expansions-head">
                        <strong>Mini-expansões</strong>
                        <span className="lobby-expansions-count">
                          {enabledMiniExpansions.filter((id) => miniExpansionOptions.some((opt) => opt.id === id)).length}/{miniExpansionOptions.length}
                        </span>
                      </div>
                      <ul className="lobby-expansion-list">
                        {miniExpansionOptions.map((expansion) => {
                          const enabled = enabledMiniExpansions.includes(expansion.id);
                          const locked = !isHost || room.status !== "lobby";
                          return (
                            <li key={expansion.id}>
                              <label
                                className={`lobby-expansion-card ${enabled ? "is-on" : ""} ${locked ? "is-locked" : ""}`}
                              >
                                <span className="lobby-expansion-thumb" aria-hidden="true">
                                  <img src={encodeURI(expansion.iconPath)} alt="" />
                                </span>
                                <span className="lobby-expansion-text">
                                  <strong>{expansion.label}</strong>
                                  <small>{expansion.description}</small>
                                </span>
                                <span className="lobby-switch" aria-hidden="true">
                                  <span className="lobby-switch-knob" />
                                </span>
                                <input
                                  type="checkbox"
                                  className="lobby-expansion-input"
                                  checked={enabled}
                                  disabled={locked}
                                  onChange={() => toggleMiniExpansion(expansion.id)}
                                  aria-label={`${enabled ? "Desligar" : "Ligar"} ${expansion.label}. ${expansion.description}`}
                                />
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                      {enabledMiniExpansions.includes("scenarios") && (
                        <div className="lobby-scenario-picker">
                          <div className="lobby-scenario-picker-head">
                            <div>
                              <strong>Cenários</strong>
                              <small>
                                {scenarioSelectionMode === "vote"
                                  ? `Jogadores votam em ${scenarioCount} carta${scenarioCount === 1 ? "" : "s"} antes do setup.`
                                  : `Definido pelo host (${hostSelectedScenarioIds.length}/${scenarioCount}).`}
                              </small>
                            </div>
                            <div className="lobby-segmented" role="group" aria-label="Quantidade de cenarios">
                              <button
                                type="button"
                                className={scenarioCount === 1 ? "is-active" : ""}
                                disabled={!isHost || room.status !== "lobby"}
                                onClick={() => setRoomScenarioCount(1)}
                              >
                                1 carta
                              </button>
                              <button
                                type="button"
                                className={scenarioCount === 2 ? "is-active" : ""}
                                disabled={!isHost || room.status !== "lobby"}
                                onClick={() => setRoomScenarioCount(2)}
                              >
                                2 cartas
                              </button>
                            </div>
                            <div className="lobby-segmented" role="group" aria-label="Modo de escolha dos cenários">
                              <button
                                type="button"
                                className={scenarioSelectionMode === "vote" ? "is-active" : ""}
                                disabled={!isHost || room.status !== "lobby"}
                                onClick={() => setScenarioMode("vote")}
                              >
                                Votação
                              </button>
                              <button
                                type="button"
                                className={scenarioSelectionMode === "host" ? "is-active" : ""}
                                disabled={!isHost || room.status !== "lobby"}
                                onClick={() => setScenarioMode("host")}
                              >
                                Definido
                              </button>
                            </div>
                          </div>

                          {scenarioSelectionMode === "host" && (
                            <ul className="lobby-scenario-card-list">
                              {scenarioCards.map((scenario) => {
                                const selected = hostSelectedScenarioIds.includes(scenario.id);
                                const disabled =
                                  !isHost ||
                                  room.status !== "lobby" ||
                                  (!selected && hostSelectedScenarioIds.length >= scenarioCount);
                                return (
                                  <li key={scenario.id}>
                                    <button
                                      type="button"
                                      className={`lobby-scenario-card ${selected ? "is-selected" : ""}`}
                                      disabled={disabled}
                                      onClick={() => toggleHostScenario(scenario.id)}
                                      aria-pressed={selected}
                                    >
                                      <img src={encodeURI(scenario.imagePath)} alt="" />
                                      <span>
                                        <strong>{scenario.label}</strong>
                                        <small>{scenario.description}</small>
                                      </span>
                                      {selected && <Check aria-hidden="true" />}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="lobby-setting-row">
                      <div className="lobby-setting-copy">
                        <strong>Cronômetro</strong>
                        <small>{turnTimerMs ? `${formatTurnTimer(turnTimerMs)} por turno` : "Sem limite por turno."}</small>
                      </div>
                      <div className="lobby-setting-actions">
                        <button
                          type="button"
                          className={`lobby-mini-button ${turnTimerMs ? "is-on" : ""}`}
                          disabled={!isHost}
                          onClick={toggleTurnTimer}
                        >
                          <Clock aria-hidden="true" />
                          {turnTimerMs ? "Ligado" : "Desligado"}
                        </button>
                        {turnTimerMs && (
                          <div className="lobby-stepper">
                            <button
                              type="button"
                              className="icon-button compact"
                              title="Menos tempo por turno"
                              disabled={!isHost}
                              onClick={() => adjustTurnTimer(-1)}
                            >
                              <Minus aria-hidden="true" />
                            </button>
                            <span>{formatTurnTimer(turnTimerMs)}</span>
                            <button
                              type="button"
                              className="icon-button compact"
                              title="Mais tempo por turno"
                              disabled={!isHost}
                              onClick={() => adjustTurnTimer(1)}
                            >
                              <Plus aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lobby-setting-row">
                      <div className="lobby-setting-copy">
                        <strong>Bots</strong>
                        <small>Velocidade: {formatBotDelay(botTurnDelayMs)}</small>
                      </div>
                      <div className="lobby-setting-actions">
                        {isHost && roomHasBots && (
                          <button
                            type="button"
                            className="lobby-mini-button"
                            onClick={() => run(() => roomApi.removeBots(requireSocket(), room.roomId), "Bots removidos.")}
                          >
                            <X aria-hidden="true" />
                            Remover bots
                          </button>
                        )}
                        <div className="lobby-stepper">
                          <button
                            type="button"
                            className="icon-button compact"
                            title="Bots mais rápidos"
                            disabled={!isHost}
                            onClick={() => adjustBotSpeed(-botTurnDelayStepMs)}
                          >
                            <Minus aria-hidden="true" />
                          </button>
                          <span>{formatBotDelay(botTurnDelayMs)}</span>
                          <button
                            type="button"
                            className="icon-button compact"
                            title="Bots mais lentos"
                            disabled={!isHost}
                            onClick={() => adjustBotSpeed(botTurnDelayStepMs)}
                          >
                            <Plus aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
              </div>

              {isSpectator ? (
                <section className="lobby-card lobby-species">
                  <header className="lobby-card-header">
                    <Eye aria-hidden="true" />
                    <h3>Modo Espectador</h3>
                  </header>
                  <div className="lobby-spectator-note">
                    <Eye aria-hidden="true" />
                    <p>
                      Você está assistindo a esta sala. Quando o anfitrião iniciar, a partida
                      aparecerá aqui automaticamente.
                    </p>
                  </div>
                </section>
              ) : (
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
                            <img className="is-portrait" src={encodeURI(species.portraitAsset)} alt="" />
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
              )}
            </div>

            <div className="lobby-footer-actions">
              {!isLocalRoom && !isSpectator && (
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
                  disabled={needsHostScenarioSelection}
                  title={needsHostScenarioSelection ? `Escolha ${scenarioCount} cenario(s) antes de iniciar.` : undefined}
                >
                  <Play aria-hidden="true" />
                  Iniciar Partida
                </button>
              )}
            </div>
          </div>
        </div>
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
        <div className={`expansion-preview is-${expansionPreview}`} role="dialog" aria-label="Carta da partida">
          <button
            type="button"
            className="expansion-preview-close"
            aria-label="Fechar"
            onClick={() => setExpansionPreview(null)}
          >
            <X aria-hidden="true" />
          </button>
          {expansionPreview === "objective" && selectedObjectiveCard && (
            <img
              src={encodeURI(selectedObjectiveCard.imagePath)}
              alt={selectedObjectiveCard.label}
              draggable={false}
            />
          )}
          {expansionPreview === "scenarios" && (
            <div className="expansion-preview-stack">
              {activeScenarioDefinitions.map((scenario) => (
                <img
                  key={scenario.id}
                  src={encodeURI(scenario.imagePath)}
                  alt={scenario.label}
                  draggable={false}
                />
              ))}
            </div>
          )}
          {expansionPreview === "threat" && activeThreatDefinition?.imagePath && (
            <img
              src={encodeURI(activeThreatDefinition.imagePath)}
              alt={activeThreatDefinition.label}
              draggable={false}
            />
          )}
        </div>
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
        <div className="tutorial-coach" role="dialog" aria-live="polite">
          <div className="tutorial-coach-progress" aria-hidden="true">
            {tutorialSteps.map((_, i) => (
              <span
                key={i}
                className={`tutorial-dot ${
                  i === tutorialStep ? "active" : i < (tutorialStep ?? 0) ? "done" : ""
                }`}
              />
            ))}
          </div>
          <div className="tutorial-coach-body">
            <span className="tutorial-coach-step">
              Passo {(tutorialStep ?? 0) + 1}/{tutorialSteps.length}
            </span>
            <h3>{tutorialDef.title}</h3>
            <p>{tutorialDef.body}</p>
          </div>
          <div className="tutorial-coach-actions">
            <button type="button" className="tutorial-coach-exit" onClick={() => exitTutorial(false)}>
              Sair
            </button>
            {!tutorialDef.autoAdvance &&
              (tutorialStep === tutorialSteps.length - 1 ? (
                <button type="button" className="primary-button" onClick={() => exitTutorial(true)}>
                  Concluir
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setTutorialStep((step) => (step === null ? step : step + 1))}
                >
                  Próximo
                </button>
              ))}
          </div>
        </div>
      )}

      {hasStartedGame && !cleanBoardMode && configOpen && (
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
            {((!isLocalRoom && isHost) || (isLocalRoom && roomHasBots)) && (
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
            {activeScenarioDefinitions.length > 0 && (
              <div className="config-scenarios">
                <strong>Cenários ativos</strong>
                {activeScenarioDefinitions.map((scenario) => (
                  <article key={scenario.id} className="config-scenario-card">
                    <img src={encodeURI(scenario.imagePath)} alt="" />
                    <div>
                      <span>{scenario.label}</span>
                      <p>{scenario.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {activeThreatDefinition && (
              <div className="config-scenarios">
                <strong>Ameaca ativa</strong>
                <article className="config-scenario-card">
                  {activeThreatDefinition.imagePath ? (
                    <img src={encodeURI(activeThreatDefinition.imagePath)} alt="" />
                  ) : (
                    <span className="config-threat-icon" aria-hidden="true">
                      <AlertTriangle />
                    </span>
                  )}
                  <div>
                    <span>{activeThreatDefinition.label}</span>
                    <p>{activeThreatDefinition.description}</p>
                  </div>
                </article>
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

      {hasStartedGame && !cleanBoardMode && hudGamePlayer && hudSpecies && (
        <section
          className={`hud-species panel-block species-hud ${hudSpeciesCollapsed ? "is-collapsed" : ""}`}
          style={speciesVar(hudGamePlayer.speciesId)}
        >
            <div className="species-hud-header">
              <img className="player-portrait" src={encodeURI(hudSpecies.portraitAsset)} alt="" />
              <div>
                <span>{currentGamePlayer ? "Controlando" : "Vez atual"}</span>
                <h2>{hudSpecies.displayName}</h2>
                <p>{hudGamePlayer.name}</p>
              </div>
              <button
                type="button"
                className="species-hud-toggle"
                onClick={() => setHudSpeciesCollapsed((value) => !value)}
                aria-label={hudSpeciesCollapsed ? "Expandir painel da espécie" : "Recolher painel da espécie"}
                title={hudSpeciesCollapsed ? "Expandir" : "Recolher"}
              >
                {hudSpeciesCollapsed ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
              </button>
            </div>

            <div className="hud-player-strip">
              <div className="hud-score-chip" title="Pontos" aria-label={`Pontos: ${hudGamePlayer.score}`}>
                <img src={encodeURI(resourceAssets.point)} alt="" />
                <strong><AnimatedNumber value={hudGamePlayer.score} /></strong>
              </div>
              <div
                className="hud-piece-track"
                ref={(node) => setEffectTarget("hud:reserve", node)}
                title={`${hudGamePlayer.reservePieces.length} na reserva`}
                aria-label={`${hudGamePlayer.reservePieces.length} peças na reserva`}
              >
                {renderReserveMeeples(hudGamePlayer, hudSpecies.meepleAsset)}
              </div>
            </div>

            <div className="resource-bank">
              {resourceOrder.map((resource) => (
                <div
                  className="resource-chip"
                  key={resource}
                  ref={(node) => setEffectTarget(`hud:${resource}`, node)}
                  title={resourceLabels[resource]}
                  aria-label={`${resourceLabels[resource]}: ${hudGamePlayer.resources[resource] ?? 0}`}
                >
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

        {!cleanBoardMode && turnBanner && turnBanner.speciesId && (
          <div
            className="turn-sweep"
            key={`turn-sweep-${turnBanner.key}`}
            style={speciesVar(turnBanner.speciesId)}
            aria-hidden="true"
          >
            <span className="turn-sweep-band" />
            <span className="turn-sweep-card">
              <img src={encodeURI(speciesDefinitions[turnBanner.speciesId].portraitAsset)} alt="" />
              <span className="turn-sweep-text">
                <small>Vez de</small>
                <strong>{turnBanner.label}</strong>
              </span>
            </span>
          </div>
        )}

        {!cleanBoardMode && (error || notice) && (
          <div className={`status-message hud-toast ${error ? "error" : "notice"}`}>
            {error ? <AlertTriangle aria-hidden="true" /> : <Check aria-hidden="true" />}
            <span>{error ?? notice}</span>
          </div>
        )}

        {hasStartedGame && !cleanBoardMode && (
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
              {activeSpecies && <img src={encodeURI(activeSpecies.portraitAsset)} alt="" />}
              <div>
                <span>Jogador atual</span>
                <strong>{activeSpecies?.displayName ?? activeGamePlayer.name}</strong>
                <small>{activeGamePlayer.name}</small>
              </div>
              <span className="active-turn-round">R{room.game.round}/{room.game.maxRounds}</span>
            </div>
            {activeSpecies && (
              <div className="action-list">
                {activeSpecies.actions.map((action) => (
                  <span className={action === activeActionId ? "current" : ""} key={action}>{action}</span>
                ))}
              </div>
            )}
            <div className="active-turn-vitals" aria-label="Resumo do jogador ativo">
              <span>
                <img src={encodeURI(resourceAssets.point)} alt="" />
                <strong>{activeGamePlayer.score}</strong>
              </span>
              <span>
                <strong>{activeGamePlayer.piecesInForest.length}</strong>
                <small>/ {activeSpecies?.totalPieces ?? activeGamePlayer.piecesInForest.length}</small>
              </span>
              {resourceOrder.map((resource) => (
                <span key={resource} title={resourceLabels[resource]}>
                  <img src={encodeURI(resourceAssets[resource])} alt="" />
                  <strong>{activeGamePlayer.resources[resource] ?? 0}</strong>
                </span>
              ))}
            </div>
            {activeSpecies && activeActionId && (
              <div className="current-action-card">
                <ActionStepsViewer
                  speciesId={activeSpecies.speciesId}
                  activeActionId={activeActionId}
                  variant="card"
                />
                {activeSpecies.speciesId === "coati" && hasPendingCoatiPairBonus && canControlActivePlayer && (
                  <small>Dupla de quatis formada: escolha uma carta adjacente para adicionar 1 quati e marcar 1 ponto.</small>
                )}
                {activeSpecies.speciesId === "coati" && !hasPendingCoatiPairBonus && activeActionId === "A" && canControlActivePlayer && (
                  <>
                    <small>
                      {room.game.activePlayedForestCardId
                        ? "Escolha uma carta com fruta para adicionar 1 quati, ou conclua sem adicionar."
                        : "Selecione uma carta na mão e coloque em um espaço vazio destacado."}
                    </small>
                    {room.game.activePlayedForestCardId && !tutorialActive && (
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
                  !tutorialActive &&
                  requiredCoatiRemovalCount === 0 && (
                  <button className="secondary-button" onClick={handleCompleteAction}>
                    Concluir ação {activeActionId}
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
                          ? "Não há destino válido para mover nesta ação."
                          : selectedJaguarDestination
                            ? "Escolha qual meeple a Onça deve remover no destino selecionado."
                            : "Selecione a Onça e clique em um destino destacado. Com 1 meeple no destino, a remoção é automática; com mais de 1, escolha qual remover depois."}
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
                          ? "Selecione uma carta na mão e coloque em um espaço vazio destacado."
                          : capuchinReserveCount === 0 || capuchinPlacementTargets.length === 0
                            ? "Sem macacos na reserva. Conclua a ação para seguir."
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
                          ? "Sem macaco na reserva ou sem local válido. Conclua a ação para pontuar."
                          : `Clique em um local destacado que já tenha outro Macaco-prego, ou conclua sem adicionar. Reserva: ${capuchinReserveCount}.`}
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
                          ? "Selecione uma carta na mão e coloque em um espaço vazio destacado."
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
                        : "Selecione uma carta na mão e coloque em um espaço vazio destacado."}
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
                    <small>Selecione um Tatu-bola visível próprio para esconder.</small>
                    {selectedPieceId ? (
                      <button className="secondary-button" onClick={handleHideArmadillo}>
                        Esconder Tatu-bola
                      </button>
                    ) : getArmadilloHidePieceIds(room.game, room.game.activePlayerId ?? "").length === 0 ? (
                      <button className="secondary-button" onClick={handleCompleteAction}>
                        Concluir ação {activeActionId}
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
                      : "Selecione uma carta na mão e coloque em um espaço vazio destacado."}
                  </small>
                )}
                {activeSpecies.speciesId === "maned_wolf" && activeActionId === "B" && canControlActivePlayer && (
                  <div className="wolf-base-panel">
                    <div className="wolf-base-summary">
                      <span>Alvos válidos</span>
                      <strong>{wolfRemovableBasePieceIds.length}</strong>
                    </div>
                    <small>
                      {wolfRemovableBasePieceIds.length > 0
                        ? selectedWolfTargetPieceId
                          ? "Peça de base selecionada. Remova ou cancele a ação."
                          : "Clique em uma peça de base que esteja no mesmo local de um lobo."
                        : "Nenhuma peça de base divide local com lobo."}
                    </small>
                    <div className="wolf-base-actions">
                      <button
                        className="wolf-remove-button"
                        disabled={!selectedWolfTargetPieceId}
                        onClick={handleRemoveWolfBasePiece}
                      >
                        <X aria-hidden="true" />
                        Remover peça
                      </button>
                      <button className="wolf-skip-button" disabled={tutorialActive} onClick={handleCompleteAction}>
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
                      Clique em uma carta com carne para adicionar 1 lobo, ou conclua sem adicionar. Locais válidos: {wolfMeatTargets.length}.
                    </small>
                    <button className="secondary-button" disabled={tutorialActive} onClick={handleCompleteAction}>
                      Concluir sem adicionar
                    </button>
                  </>
                )}
              </div>
            )}
            {room?.game?.caatingaPending &&
              controlledPlayerId &&
              room.game.caatingaPending.playerId === controlledPlayerId && (() => {
                const pending = room.game.caatingaPending;
                const owned = currentGamePlayer?.resources[pending.resource] ?? 0;
                const handle = (mode: "gain" | "lose") => {
                  if (!room.game) return;
                  if (isLocalRoom) {
                    try {
                      const nextGame = collectCaatingaBonus(room.game, controlledPlayerId, mode);
                      setRoom((current) => (current ? { ...current, game: nextGame } : current));
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Falha ao resolver Caatinga.");
                    }
                  } else {
                    const rid = room.roomId;
                    run(() => roomApi.collectCaatinga(requireSocket(), rid, mode));
                  }
                };
                const triggerLabel = pending.trigger === "remove" ? "remoção" : "adição";
                return (
                  <div className="caatinga-collect-row">
                    <span className="caatinga-collect-title">
                      Caatinga ({triggerLabel}): {resourceLabels[pending.resource]}
                    </span>
                    <div className="caatinga-collect-buttons">
                      <button
                        type="button"
                        className="caatinga-collect-btn"
                        onClick={() => handle("gain")}
                      >
                        <img src={encodeURI(resourceAssets[pending.resource])} alt="" />
                        +1
                      </button>
                      <button
                        type="button"
                        className="caatinga-collect-btn caatinga-collect-btn--lose"
                        onClick={() => handle("lose")}
                        disabled={owned <= 0}
                        title={owned <= 0 ? "Sem recurso para perder" : undefined}
                      >
                        <img src={encodeURI(resourceAssets[pending.resource])} alt="" />
                        -1
                      </button>
                    </div>
                  </div>
                );
              })()}
          </section>
        )}
        </div>
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
                <img src={encodeURI(speciesDefinitions[turnBanner.speciesId].meepleAsset)} alt="" />
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
          <ForestCanvas
            ref={forestCanvasRef}
            cards={forestCards}
            pieces={pieces}
            canPlaceSetupPiece={canPlaceSetupPiece}
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
        </div>
      </section>

        {!cleanBoardMode && showHandDuringGame && currentGamePlayer && (
          <section className={`table-hand ${handCollapsed ? "collapsed" : ""}`} aria-label="Mão de cartas">
            <div className="hand-header">
              <div>
                <span>Mão · {handCards.length} cartas</span>
                <strong>{currentGamePlayer.speciesId ? speciesDefinitions[currentGamePlayer.speciesId].displayName : "Espécie"}</strong>
              </div>
              <div className="hand-header-side">
                {!handCollapsed && handCards.length > 0 && (
                  <div className="hand-tools" aria-label="Organizar mão">
                    {([
                      ["habitat", "Hab."],
                      ["resource", "Rec."]
                    ] as const).map(([mode, label]) => (
                      <button
                        type="button"
                        className={handSortMode === mode ? "is-active" : ""}
                        key={mode}
                        title={mode === "habitat" ? "Organizar por habitat" : "Organizar por recurso"}
                        aria-label={mode === "habitat" ? "Organizar por habitat" : "Organizar por recurso"}
                        onClick={() => setHandSortMode(mode)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
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
            {(!handCollapsed || currentGamePlayer?.speciesId === "maned_wolf" || currentGamePlayer?.speciesId === "armadillo") &&
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
                        } ${cardDrag?.cardId === card.id ? "dragging" : ""} ${
                          tutorialRequiredCardId === card.id ? "tutorial-marked" : ""
                        }`}
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
            <header className="choice-modal-head">
              <span className="choice-icon">
                <Trophy aria-hidden="true" />
              </span>
              <div>
                <strong>Escolha seu objetivo</strong>
                <small>Fique com 1 carta. A outra sera descartada.</small>
              </div>
            </header>
            <div className="objective-choice-grid">
              {objectiveChoices.map((card) => (
                <button
                  type="button"
                  className={`objective-choice-card ${pendingObjectiveCardId === card.id ? "is-pending" : ""}`}
                  key={card.id}
                  disabled={Boolean(pendingObjectiveCardId)}
                  onClick={() => {
                    void handleSelectObjective(card.id);
                  }}
                >
                  <img src={encodeURI(card.imagePath)} alt={card.label} />
                </button>
              ))}
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
          </div>
        </div>
      )}

      {hasStartedGame && !cleanBoardMode && opponentInspectorEntries.length > 0 && (
        <aside className="opponent-inspector" aria-label="Consultar outros jogadores">
          <div className="opponent-rail" role="list">
            {opponentInspectorEntries.map(({ player, gamePlayer, species, displayIndex, isActivePlayer }) => (
              <button
                type="button"
                role="listitem"
                className={`opponent-portrait-btn ${selectedOpponentPlayerId === player.playerId ? "is-selected" : ""} ${
                  isActivePlayer ? "is-active-turn" : ""
                }`}
                key={player.playerId}
                style={speciesVar(player.speciesId)}
                title={species ? `Ver ${species.displayName}` : player.name}
                aria-label={species ? `Ver informações de ${species.displayName}` : `Ver informações de ${player.name}`}
                aria-pressed={selectedOpponentPlayerId === player.playerId}
                onClick={() =>
                  setSelectedOpponentPlayerId((current) => (current === player.playerId ? null : player.playerId))
                }
              >
                {species ? (
                  <span className="opponent-portrait-frame">
                    <img src={encodeURI(species.portraitAsset)} alt="" />
                  </span>
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

      {false && !cleanBoardMode && (
      <aside className={`right-panel hud-dock hud-right ${hudRightCollapsed ? "is-collapsed" : ""}`}>
        <section className="panel-block">
          <h2>Jogadores</h2>
          <div className="player-list" onScroll={() => setMovementPreview(null)}>
            {(() => {
              const players = room?.players ?? [];
              const game = room?.game;
              if (!game) return players;
              const order =
                game!.status === "setup" ? game!.setupOrder : game!.turnOrder;
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
                      className={`turn-order-badge movement-guide ${
                        highlightedMovementGuideSpecies === player.speciesId ? "is-tutorial-highlight" : ""
                      }`}
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
                    <strong>{species?.displayName ?? "Sem espécie"}</strong>
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
                          title={`${gamePlayer.reservePieces.length} na reserva`}
                        >
                          {renderReserveMeeples(gamePlayer, species.meepleAsset)}
                        </div>
                      )}
                    </div>
                    <div className="player-summary-resources">
                      {resourceOrder.map((resource) => {
                        const isLeader = resourceLeaders[resource]?.has(gamePlayer.playerId) ?? false;
                        return (
                          <span
                            className={`mini-resource ${isLeader ? "is-leader" : ""}`}
                            title={isLeader ? `${resourceLabels[resource]} · maioria` : resourceLabels[resource]}
                            key={resource}
                            ref={(node) => setEffectTarget(`${gamePlayer.playerId}:${resource}`, node)}
                          >
                            <img src={encodeURI(resourceAssets[resource])} alt="" />
                            <b>{gamePlayer.resources[resource] ?? 0}</b>
                          </span>
                        );
                      })}
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
      )}

      {!cleanBoardMode && movementPreview && typeof document !== "undefined" && createPortal(
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

      {!cleanBoardMode && shouldShowJaguarScoreModal && showJaguarScoreModal && (
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
                <button className="secondary-button" disabled={tutorialActive} onClick={handleCompleteAction}>
                  Concluir sem gastar
                </button>
              </div>
            </div>
          </div>
        )}

      {!cleanBoardMode && room?.game?.status === "finished" && room.game.finalScoreBreakdown && (() => {
        const breakdown = room.game.finalScoreBreakdown;
        const winnerIds = room.game.winnerPlayerIds;
        const ranked = [...breakdown.entries].sort(
          (a, b) =>
            b.totalScore - a.totalScore ||
            b.remainingResources - a.remainingResources ||
            b.populationValue - a.populationValue
        );
        const top = ranked.slice(0, 3).map((entry, index) => ({ entry, rank: index + 1 }));
        // Visual order so 1st sits in the middle, taller.
        const podiumOrder =
          top.length === 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top;
        const winnerText =
          winnerIds.length === 0
            ? "Sem vencedor"
            : winnerIds.length === 1
              ? `${ranked.find((e) => e.playerId === winnerIds[0])?.name ?? "Jogador"} venceu!`
              : `Empate: ${ranked
                  .filter((e) => winnerIds.includes(e.playerId))
                  .map((e) => e.name)
                  .join(", ")}`;

        return (
          <div className="choice-modal-backdrop endgame-backdrop" role="presentation">
            {winnerIds.length > 0 && (
              <div className="endgame-confetti" aria-hidden="true">
                {endgameConfetti.map((piece, i) => (
                  <span key={i} className="confetti-piece" style={piece} />
                ))}
              </div>
            )}
            <div className="endgame-modal" role="dialog" aria-modal="true" aria-label="Fim de jogo">
              <header className="endgame-head">
                <span className="endgame-eyebrow">
                  <Trophy aria-hidden="true" /> Fim de jogo
                </span>
                <h2 className="endgame-title">{winnerText}</h2>
              </header>

              <div className={`endgame-podium count-${podiumOrder.length}`}>
                {podiumOrder.map(({ entry, rank }) => {
                  const species = entry.speciesId ? speciesDefinitions[entry.speciesId] : null;
                  return (
                    <div
                      key={entry.playerId}
                      className={`podium-slot rank-${rank}`}
                      style={speciesVar(entry.speciesId)}
                    >
                      <div className="podium-figure">
                        {rank === 1 && <Crown className="podium-crown" aria-hidden="true" />}
                        <div className="podium-portrait">
                          {species ? (
                            <img src={encodeURI(species.portraitAsset)} alt="" />
                          ) : (
                            <Users aria-hidden="true" />
                          )}
                        </div>
                        <strong className="podium-name">{entry.name}</strong>
                        {species && <small className="podium-species">{species.displayName}</small>}
                        <div className="podium-score">
                          <AnimatedNumber value={entry.totalScore} />
                          <span>pts</span>
                        </div>
                      </div>
                      <div className="podium-stand">
                        <span>{rank}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <details className="endgame-details">
                <summary>Ver detalhamento de pontos</summary>
                <p className="endgame-note">
                  Total = pontos da partida + objetivo + cenário + maioria de carne/ovo/fruta (+1 cada, gasta o recurso) + 1 ponto por 2
                  sementes. Limite {breakdown.pointCap} pts. Desempate: recursos restantes, depois maior população.
                </p>
                <table className="final-score-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Jogador</th>
                      <th>Partida</th>
                      <th>Objetivo</th>
                      <th>Cenário</th>
                      <th>Maioria</th>
                      <th>Sementes</th>
                      <th>Total</th>
                      <th>Recursos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((entry, index) => (
                      <tr
                        key={entry.playerId}
                        className={winnerIds.includes(entry.playerId) ? "winner" : ""}
                        style={speciesVar(entry.speciesId)}
                      >
                        <td>{index + 1}</td>
                        <td>
                          <strong>{entry.name}</strong>
                          {entry.speciesId && <small> · {speciesDefinitions[entry.speciesId].displayName}</small>}
                        </td>
                        <td>{entry.baseScore}</td>
                        <td>+{entry.objectivePoints}</td>
                        <td>+{entry.scenarioPoints}</td>
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
              </details>

              <div className="endgame-actions">
                {isLocalRoom ? (
                  <>
                    <button className="primary-button" onClick={playAgainLocal}>
                      <Play aria-hidden="true" />
                      Jogar de novo
                    </button>
                    <button className="secondary-button" onClick={leaveTable}>
                      <LogOut aria-hidden="true" />
                      Sair
                    </button>
                  </>
                ) : (
                  <button className="primary-button" onClick={leaveTable}>
                    <LogOut aria-hidden="true" />
                    Voltar ao lobby
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {!cleanBoardMode &&
        hasStartedGame &&
        !hasPendingCoatiPairBonus &&
        room?.game?.status === "active" &&
        activeGamePlayer &&
        activeSpecies?.speciesId === "maned_wolf" &&
        activeActionId === "C" &&
        canControlActivePlayer &&
        (!tutorialActive || tutorialId !== "wolf" || tutorialGate === "score") && (
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
                <button className="secondary-button" disabled={tutorialActive} onClick={handleCompleteAction}>
                  Concluir sem gastar
                </button>
              </div>
            </div>
          </div>
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
      {hasStartedGame && !cleanBoardMode && currentGamePlayer?.speciesId === "jaguar" && (
        <div className="hud-overlay-jaguar">
          <div className="hud-top-jaguar">
            <img src="/assets/interface/onça/UI_oncaTOP.png" alt="" className="hud-top-jaguar-bg" />
            <div className="hud-top-jaguar-score">{currentGamePlayer.score}</div>
            <div className="hud-top-jaguar-meeples">
              {renderReserveMeeples(currentGamePlayer, speciesDefinitions.jaguar.meepleAsset)}
            </div>
          </div>
          <div className="hud-bottom-jaguar">
            <img src="/assets/interface/onça/UI_oncaDOWN.png" alt="" className="hud-bottom-jaguar-bg" />
            <div className="hud-bottom-jaguar-action-text">
              <div className="action-box" style={{ "--action-accent": SPECIES_HEX.jaguar } as CSSProperties}>
                <ActionStepsViewer
                  speciesId="jaguar"
                  activeActionId={ownActiveActionId}
                  accent={SPECIES_HEX.jaguar}
                />

                {room?.game?.activePlayerId === currentGamePlayer.playerId && (
                  <>
                    {(activeActionId === "A" || activeActionId === "B") && (
                      <div className="action-box-hint">
                        {canSkipJaguarMove
                          ? "Nenhum destino válido — conclua a ação para seguir."
                          : selectedJaguarDestination
                            ? "Escolha qual meeple remover no destino selecionado."
                            : "Selecione a Onça e clique em um destino destacado."}
                      </div>
                    )}
                    {activeActionId === "C" && (
                      <div className="action-box-hint">
                        Defina quantas carnes converter em pontos na janela central.
                      </div>
                    )}

                    {canSkipJaguarMove && (activeActionId === "A" || activeActionId === "B") && (
                      <div className="action-box-actions">
                        <button type="button" className="action-box-btn is-secondary" onClick={handleCompleteAction}>
                          Concluir
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="hud-bottom-jaguar-resources">
              <div className="hud-bottom-jaguar-resource-item res-meat">{currentGamePlayer.resources.meat ?? 0}</div>
              <div className="hud-bottom-jaguar-resource-item res-fruit">{currentGamePlayer.resources.fruit ?? 0}</div>
              <div className="hud-bottom-jaguar-resource-item res-egg">{currentGamePlayer.resources.egg ?? 0}</div>
              <div className="hud-bottom-jaguar-resource-item res-seed">{currentGamePlayer.resources.seed ?? 0}</div>
            </div>
            <div className="hud-bottom-jaguar-movements">
              <img src="/assets/interface/onça/Movimentos_onca.png" alt="Movimentos" />
            </div>
            <div className="hud-bottom-jaguar-expansions">
              {selectedObjectiveCard && (
                <button type="button" className="hud-bottom-jaguar-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "objective" ? null : "objective"))} title="Ver Objetivo">
                  <img src={encodeURI(objectiveCardBackPath)} alt="Objetivos" />
                </button>
              )}
              {activeScenarioDefinitions && activeScenarioDefinitions.length > 0 && (
                <button type="button" className="hud-bottom-jaguar-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "scenarios" ? null : "scenarios"))} title="Ver Cenários">
                  <img src={encodeURI(scenarioCardBackPath)} alt="Cenários" />
                </button>
              )}
              {activeThreatDefinition && (
                <button type="button" className="hud-bottom-jaguar-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "threat" ? null : "threat"))} title="Ver Ameaça">
                  <img src={encodeURI(threatCardBackPath)} alt="Ameaças" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {hasStartedGame && !cleanBoardMode && currentGamePlayer?.speciesId === "maned_wolf" && (
        <div className="hud-overlay-wolf">
          <div className="hud-top-wolf">
            <img src="/assets/interface/lobo/UI_loboTOP.png" alt="" className="hud-top-wolf-bg" />
            <div className="hud-top-wolf-score">{currentGamePlayer.score}</div>
            <div className="hud-top-wolf-meeples">
              {renderReserveMeeples(currentGamePlayer, speciesDefinitions.maned_wolf.meepleAsset)}
            </div>
          </div>
          <div className="hud-bottom-wolf">
            <img src="/assets/interface/lobo/UI_lobo.png" alt="" className="hud-bottom-wolf-bg" />
            <div className="hud-bottom-wolf-action-text">
              <div className="action-box" style={{ "--action-accent": SPECIES_HEX.maned_wolf } as CSSProperties}>
                <ActionStepsViewer
                  speciesId="maned_wolf"
                  activeActionId={ownActiveActionId}
                  accent={SPECIES_HEX.maned_wolf}
                />

                {room?.game?.activePlayerId === currentGamePlayer.playerId && room.game && (
                  <>
                    {activeActionId === "A" && (
                      <div className="action-box-hint">
                        {room.game.activePlayedForestCardId
                          ? <>Conduza os lobos destacados pelo padrão da carta. Pendentes: <strong>{room.game.pendingWolfMoves?.pieceIds.length ?? 0}</strong>.</>
                          : "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."}
                      </div>
                    )}
                    {activeActionId === "B" && (
                      <>
                        <div className="action-box-hint">
                          {wolfRemovableBasePieceIds.length > 0
                            ? selectedWolfTargetPieceId
                              ? "Peça de base selecionada — confirme a remoção ou cancele a ação."
                              : "Clique em uma peça de base que divida local com um lobo."
                            : "Nenhuma peça de base partilha local com lobo."}
                        </div>
                        <div className="action-box-actions">
                          <button
                            className="action-box-btn"
                            disabled={!selectedWolfTargetPieceId}
                            onClick={handleRemoveWolfBasePiece}
                          >
                            Remover peça
                          </button>
                          <button className="action-box-btn is-secondary" disabled={tutorialActive} onClick={handleCompleteAction}>
                            Concluir
                          </button>
                        </div>
                      </>
                    )}
                    {activeActionId === "C" && (
                      <div className="action-box-hint">
                        Escolha na janela central os recursos a converter em pontos.
                      </div>
                    )}
                    {activeActionId === "D" && (
                      <>
                        <div className="action-box-hint">
                          Clique em uma carta de carne para abrigar 1 lobo. Locais válidos: <strong>{wolfMeatTargets.length}</strong>.
                        </div>
                        <div className="action-box-actions">
                          <button className="action-box-btn is-secondary" disabled={tutorialActive} onClick={handleCompleteAction}>
                            Concluir sem adicionar
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="hud-bottom-wolf-resources">
              <div className="hud-bottom-wolf-resource-item res-meat">{currentGamePlayer.resources.meat ?? 0}</div>
              <div className="hud-bottom-wolf-resource-item res-fruit">{currentGamePlayer.resources.fruit ?? 0}</div>
              <div className="hud-bottom-wolf-resource-item res-egg">{currentGamePlayer.resources.egg ?? 0}</div>
              <div className="hud-bottom-wolf-resource-item res-seed">{currentGamePlayer.resources.seed ?? 0}</div>
            </div>
            <div className="hud-bottom-wolf-movements">
              <img src="/assets/interface/lobo/Movimentos_lobo.png" alt="Movimentos" />
            </div>
            <div className="hud-bottom-wolf-expansions">
              {selectedObjectiveCard && (
                <button type="button" className="hud-bottom-wolf-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "objective" ? null : "objective"))} title="Ver Objetivo">
                  <img src={encodeURI(objectiveCardBackPath)} alt="Objetivos" />
                </button>
              )}
              {activeScenarioDefinitions && activeScenarioDefinitions.length > 0 && (
                <button type="button" className="hud-bottom-wolf-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "scenarios" ? null : "scenarios"))} title="Ver Cenários">
                  <img src={encodeURI(scenarioCardBackPath)} alt="Cenários" />
                </button>
              )}
              {activeThreatDefinition && (
                <button type="button" className="hud-bottom-wolf-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "threat" ? null : "threat"))} title="Ver Ameaça">
                  <img src={encodeURI(threatCardBackPath)} alt="Ameaças" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {hasStartedGame && !cleanBoardMode && currentGamePlayer?.speciesId === "armadillo" && (
        <div className="hud-overlay-tatu">
          <div className="hud-top-tatu">
            <img src="/assets/interface/tatu/UI_tatuTOP.png" alt="" className="hud-top-tatu-bg" />
            <div className="hud-top-tatu-score">
              {currentGamePlayer.score ?? 0}
            </div>
            <div className="hud-top-tatu-meeples">
              {renderReserveMeeples(currentGamePlayer, speciesDefinitions.armadillo.meepleAsset)}
            </div>
          </div>
          <div className="hud-bottom-tatu">
            <img src="/assets/interface/tatu/UI_tatu.png" alt="" className="hud-bottom-tatu-bg" />
            <div className="hud-bottom-tatu-action-text">
              <div className="action-box" style={{ "--action-accent": SPECIES_HEX.armadillo } as CSSProperties}>
                <ActionStepsViewer
                  speciesId="armadillo"
                  activeActionId={ownActiveActionId}
                  accent={SPECIES_HEX.armadillo}
                />

                {room?.game?.activePlayerId === currentGamePlayer.playerId && room.game && (
                  <>
                    {activeActionId === "A" && (
                      <>
                        <div className="action-box-hint">
                          {room.game.activePlayedForestCardId
                            ? "Clique em uma carta com pinha destacada para abrigar 1 tatu."
                            : "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."}
                        </div>
                        {room.game.activePlayedForestCardId && (
                          <div className="action-box-actions">
                            <button className="action-box-btn is-secondary" disabled={tutorialActive} onClick={handleCompleteAction}>
                              Avançar sem instalar
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {activeActionId === "B" && (
                      <div className="action-box-hint">
                        Selecione um Tatu-bola e clique em um destino destacado para conduzi-lo pelo padrão da carta jogada.
                      </div>
                    )}
                    {activeActionId === "C" && (
                      <>
                        <div className="action-box-hint">
                          Selecione um Tatu-bola visível para recolhê-lo em sua carapaça.
                        </div>
                        {selectedPieceId ? (
                          <div className="action-box-actions">
                            <button className="action-box-btn" onClick={handleHideArmadillo}>
                              Esconder Tatu-bola
                            </button>
                          </div>
                        ) : getArmadilloHidePieceIds(room.game, room.game.activePlayerId ?? "").length === 0 ? (
                          <div className="action-box-actions">
                            <button className="action-box-btn is-secondary" disabled={tutorialActive} onClick={handleCompleteAction}>
                              Concluir ação
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                    {activeActionId === "D" && (
                      <div className="action-box-hint">
                        Pontuação automática: <strong>+{armadilloShareScore}</strong> {armadilloShareScore === 1 ? "ponto" : "pontos"} pela presença adversária.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="hud-bottom-tatu-resources">
              <div className="hud-bottom-tatu-resource-item res-meat">{currentGamePlayer.resources.meat ?? 0}</div>
              <div className="hud-bottom-tatu-resource-item res-fruit">{currentGamePlayer.resources.fruit ?? 0}</div>
              <div className="hud-bottom-tatu-resource-item res-egg">{currentGamePlayer.resources.egg ?? 0}</div>
              <div className="hud-bottom-tatu-resource-item res-seed">{currentGamePlayer.resources.seed ?? 0}</div>
            </div>
            <div className="hud-bottom-tatu-movements">
              <img src="/assets/interface/tatu/Movimentos_tatu.png" alt="Movimentos" />
            </div>
            <div className="hud-bottom-tatu-expansions">
              {selectedObjectiveCard && (
                <button type="button" className="hud-bottom-tatu-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "objective" ? null : "objective"))} title="Ver Objetivo">
                  <img src={encodeURI(objectiveCardBackPath)} alt="Objetivos" />
                </button>
              )}
              {activeScenarioDefinitions && activeScenarioDefinitions.length > 0 && (
                <button type="button" className="hud-bottom-tatu-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "scenarios" ? null : "scenarios"))} title="Ver Cenários">
                  <img src={encodeURI(scenarioCardBackPath)} alt="Cenários" />
                </button>
              )}
              {activeThreatDefinition && (
                <button type="button" className="hud-bottom-tatu-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "threat" ? null : "threat"))} title="Ver Ameaça">
                  <img src={encodeURI(threatCardBackPath)} alt="Ameaças" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {hasStartedGame && !cleanBoardMode && currentGamePlayer?.speciesId === "macaw" && (
        <div className="hud-overlay-macaw">
          <div className="hud-top-macaw">
            <img src="/assets/interface/arara/UI_araraTOP.png" alt="" className="hud-top-macaw-bg" />
            <div className="hud-top-macaw-score">
              {currentGamePlayer.score ?? 0}
            </div>
            <div className="hud-top-macaw-meeples">
              {renderReserveMeeples(currentGamePlayer, speciesDefinitions.macaw.meepleAsset)}
            </div>
          </div>
          <div className="hud-bottom-macaw">
            <img src="/assets/interface/arara/UI_arara.png" alt="" className="hud-bottom-macaw-bg" />
            <div className="hud-bottom-macaw-action-text">
              <div className="action-box" style={{ "--action-accent": SPECIES_HEX.macaw } as CSSProperties}>
                <ActionStepsViewer
                  speciesId="macaw"
                  activeActionId={ownActiveActionId}
                  accent={SPECIES_HEX.macaw}
                />

                {room?.game?.activePlayerId === currentGamePlayer.playerId && room.game && (
                  <>
                    {activeActionId === "A" && (
                      <>
                        <div className="action-box-hint">
                          {room.game.activePlayedForestCardId
                            ? "Clique em uma carta com ovo destacada para abrigar 1 arara."
                            : "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."}
                        </div>
                        {room.game.activePlayedForestCardId && (
                          <div className="action-box-actions">
                            <button className="action-box-btn is-secondary" disabled={tutorialActive} onClick={handleCompleteAction}>
                              Avançar sem instalar
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {activeActionId === "B" && (
                      <div className="action-box-hint">
                        Selecione uma Arara-azul e clique em um destino destacado para conduzi-la pelo padrão da carta jogada.
                      </div>
                    )}
                    {activeActionId === "C" && (
                      <>
                        <div className="action-box-hint">
                          Adicione uma arara da reserva ou realoque outra ao redor da que acabou de se mover.
                        </div>
                        <div className="action-box-actions">
                          <button className="action-box-btn is-secondary" disabled={tutorialActive} onClick={handleCompleteAction}>
                            {macawActionCTargets.length === 0 && !selectedPieceId ? "Concluir (sem espaço válido)" : "Avançar sem adicionar"}
                          </button>
                        </div>
                      </>
                    )}
                    {activeActionId === "D" && (
                      <div className="action-box-hint">
                        Pontuação automática: <strong>+{macawLineScore}</strong> {macawLineScore === 1 ? "ponto" : "pontos"} pelas formações lineares.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="hud-bottom-macaw-resources">
              <div className="hud-bottom-macaw-resource-item res-meat">{currentGamePlayer.resources.meat ?? 0}</div>
              <div className="hud-bottom-macaw-resource-item res-fruit">{currentGamePlayer.resources.fruit ?? 0}</div>
              <div className="hud-bottom-macaw-resource-item res-egg">{currentGamePlayer.resources.egg ?? 0}</div>
              <div className="hud-bottom-macaw-resource-item res-seed">{currentGamePlayer.resources.seed ?? 0}</div>
            </div>
            <div className="hud-bottom-macaw-movements">
              <img src="/assets/interface/arara/Movimentos_arara.png" alt="Movimentos" />
            </div>
            <div className="hud-bottom-macaw-expansions">
              {selectedObjectiveCard && (
                <button type="button" className="hud-bottom-macaw-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "objective" ? null : "objective"))} title="Ver Objetivo">
                  <img src={encodeURI(objectiveCardBackPath)} alt="Objetivos" />
                </button>
              )}
              {activeScenarioDefinitions && activeScenarioDefinitions.length > 0 && (
                <button type="button" className="hud-bottom-macaw-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "scenarios" ? null : "scenarios"))} title="Ver Cenários">
                  <img src={encodeURI(scenarioCardBackPath)} alt="Cenários" />
                </button>
              )}
              {activeThreatDefinition && (
                <button type="button" className="hud-bottom-macaw-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "threat" ? null : "threat"))} title="Ver Ameaça">
                  <img src={encodeURI(threatCardBackPath)} alt="Ameaças" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {hasStartedGame && !cleanBoardMode && currentGamePlayer?.speciesId === "capuchin" && (
        <div className="hud-overlay-capuchin">
          <div className="hud-top-capuchin">
            <img src="/assets/interface/macaco/UI_macacoTOP.png" alt="" className="hud-top-capuchin-bg" />
            <div className="hud-top-capuchin-score">
              {currentGamePlayer.score ?? 0}
            </div>
            <div className="hud-top-capuchin-meeples">
              {renderReserveMeeples(currentGamePlayer, speciesDefinitions.capuchin.meepleAsset)}
            </div>
          </div>
          <div className="hud-bottom-capuchin">
            <img src="/assets/interface/macaco/UI_macaco.png" alt="" className="hud-bottom-capuchin-bg" />
            <div className="hud-bottom-capuchin-action-text">
              <div className="action-box" style={{ "--action-accent": SPECIES_HEX.capuchin } as CSSProperties}>
                <ActionStepsViewer
                  speciesId="capuchin"
                  activeActionId={ownActiveActionId}
                  accent={SPECIES_HEX.capuchin}
                />

                {room?.game?.activePlayerId === currentGamePlayer.playerId && room.game && (
                  <>
                    {activeActionId === "A" && (
                      <>
                        <div className="action-box-hint">
                          {capuchinReserveCount === 0 || capuchinPlacementTargets.length === 0
                            ? "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."
                            : <>Clique na carta recém-revelada para abrigar 1 macaco. Reserva disponível: <strong>{capuchinReserveCount}</strong>.</>}
                        </div>
                        {room.game.activePlayedForestCardId && (
                          <div className="action-box-actions">
                            <button className="action-box-btn is-secondary" disabled={tutorialActive} onClick={handleCompleteAction}>
                              Avançar sem instalar
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {activeActionId === "B" && (
                      <div className="action-box-hint">
                        Selecione um Macaco-prego e clique em um destino destacado para conduzi-lo pelo padrão da carta jogada.
                      </div>
                    )}
                    {activeActionId === "C" && (
                      <>
                        <div className="action-box-hint">
                          {capuchinReserveCount === 0 || capuchinPlacementTargets.length === 0
                            ? "Sem locais elegíveis ou reserva esgotada — conclua a ação para seguir."
                            : <>Clique em um local com macaco já estabelecido para reforçar o bando. Reserva: <strong>{capuchinReserveCount}</strong>.</>}
                        </div>
                        <div className="action-box-actions">
                          <button className="action-box-btn is-secondary" disabled={tutorialActive} onClick={handleCompleteAction}>
                            {capuchinPlacementTargets.length === 0 ? "Concluir ação" : "Avançar sem reforçar"}
                          </button>
                        </div>
                      </>
                    )}
                    {activeActionId === "D" && (
                      <div className="action-box-hint">
                        Pontuação automática: <strong>+{capuchinHabitatScore}</strong> {capuchinHabitatScore === 1 ? "ponto" : "pontos"} pelos habitats dominados.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="hud-bottom-capuchin-resources">
              <div className="hud-bottom-capuchin-resource-item res-meat">{currentGamePlayer.resources.meat ?? 0}</div>
              <div className="hud-bottom-capuchin-resource-item res-fruit">{currentGamePlayer.resources.fruit ?? 0}</div>
              <div className="hud-bottom-capuchin-resource-item res-egg">{currentGamePlayer.resources.egg ?? 0}</div>
              <div className="hud-bottom-capuchin-resource-item res-seed">{currentGamePlayer.resources.seed ?? 0}</div>
            </div>
            <div className="hud-bottom-capuchin-movements">
              <img src="/assets/interface/macaco/Movimentos_macaco.png" alt="Movimentos" />
            </div>
            <div className="hud-bottom-capuchin-expansions">
              {selectedObjectiveCard && (
                <button type="button" className="hud-bottom-capuchin-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "objective" ? null : "objective"))} title="Ver Objetivo">
                  <img src={encodeURI(objectiveCardBackPath)} alt="Objetivos" />
                </button>
              )}
              {activeScenarioDefinitions && activeScenarioDefinitions.length > 0 && (
                <button type="button" className="hud-bottom-capuchin-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "scenarios" ? null : "scenarios"))} title="Ver Cenários">
                  <img src={encodeURI(scenarioCardBackPath)} alt="Cenários" />
                </button>
              )}
              {activeThreatDefinition && (
                <button type="button" className="hud-bottom-capuchin-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "threat" ? null : "threat"))} title="Ver Ameaça">
                  <img src={encodeURI(threatCardBackPath)} alt="Ameaças" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {hasStartedGame && !cleanBoardMode && currentGamePlayer?.speciesId === "coati" && (
        <div className="hud-overlay-coati">
          <div className="hud-top-coati">
            <img src="/assets/interface/quati/UI_quatiTOP.png" alt="" className="hud-top-coati-bg" />
            <div className="hud-top-coati-score">
              {currentGamePlayer.score ?? 0}
            </div>
            <div className="hud-top-coati-meeples">
              {renderReserveMeeples(currentGamePlayer, speciesDefinitions.coati.meepleAsset)}
            </div>
          </div>
          <div className="hud-bottom-coati">
            <img src="/assets/interface/quati/UI_quati.png" alt="" className="hud-bottom-coati-bg" />
            <div className="hud-bottom-coati-action-text">
              <div className="action-box" style={{ "--action-accent": SPECIES_HEX.coati } as CSSProperties}>
                <ActionStepsViewer
                  speciesId="coati"
                  activeActionId={ownActiveActionId}
                  accent={SPECIES_HEX.coati}
                />

                {room?.game?.activePlayerId === currentGamePlayer.playerId && room.game && (
                  hasPendingCoatiPairBonus ? (
                    <div className="action-box-hint">
                      Dupla formada! Escolha uma carta adjacente para abrigar 1 quati e marcar 1 ponto.
                    </div>
                  ) : (
                    <>
                      {activeActionId === "A" && (
                        <>
                          <div className="action-box-hint">
                            {room.game.activePlayedForestCardId
                              ? "Clique em uma carta com fruta destacada para abrigar 1 quati."
                              : "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."}
                          </div>
                          {room.game.activePlayedForestCardId && !tutorialActive && (
                            <div className="action-box-actions">
                              <button className="action-box-btn is-secondary" onClick={handleCompleteAction}>
                                Avançar sem instalar
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      {activeActionId === "B" && (
                        <div className="action-box-hint">
                          Selecione um quati no tabuleiro e clique em um destino destacado para conduzi-lo pelo padrão da carta jogada.
                        </div>
                      )}
                      {activeActionId === "C" && (
                        <>
                          {requiredCoatiRemovalCount === 0 ? (
                            <div className="action-box-actions">
                              <button className="action-box-btn is-secondary" disabled={tutorialActive} onClick={handleCompleteAction}>
                                Concluir ação
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="action-box-hint">
                                Selecione <strong>{requiredCoatiRemovalCount}</strong> {requiredCoatiRemovalCount === 1 ? "quati" : "quatis"} para retirar. Marcados: <strong>{selectedRemovalPieceIds.length}/{requiredCoatiRemovalCount}</strong>.
                              </div>
                              <div className="action-box-actions">
                                <button
                                  className="action-box-btn"
                                  disabled={selectedRemovalPieceIds.length !== requiredCoatiRemovalCount}
                                  onClick={handleRemoveSelectedPieces}
                                >
                                  Retirar quatis
                                </button>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )
                )}
              </div>
            </div>
            <div className="hud-bottom-coati-resources">
              <div className="hud-bottom-coati-resource-item res-meat">{currentGamePlayer.resources.meat ?? 0}</div>
              <div className="hud-bottom-coati-resource-item res-fruit">{currentGamePlayer.resources.fruit ?? 0}</div>
              <div className="hud-bottom-coati-resource-item res-egg">{currentGamePlayer.resources.egg ?? 0}</div>
              <div className="hud-bottom-coati-resource-item res-seed">{currentGamePlayer.resources.seed ?? 0}</div>
            </div>
            <div className="hud-bottom-coati-movements">
              <img src="/assets/interface/quati/Movimentos_quati.png" alt="Movimentos" />
            </div>
            <div className="hud-bottom-coati-expansions">
              {selectedObjectiveCard && (
                <button type="button" className="hud-bottom-coati-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "objective" ? null : "objective"))} title="Ver Objetivo">
                  <img src={encodeURI(objectiveCardBackPath)} alt="Objetivos" />
                </button>
              )}
              {activeScenarioDefinitions && activeScenarioDefinitions.length > 0 && (
                <button type="button" className="hud-bottom-coati-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "scenarios" ? null : "scenarios"))} title="Ver Cenários">
                  <img src={encodeURI(scenarioCardBackPath)} alt="Cenários" />
                </button>
              )}
              {activeThreatDefinition && (
                <button type="button" className="hud-bottom-coati-expansion-btn" onClick={() => setExpansionPreview((p) => (p === "threat" ? null : "threat"))} title="Ver Ameaça">
                  <img src={encodeURI(threatCardBackPath)} alt="Ameaças" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
