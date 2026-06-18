export type SpeciesId =
  | "jaguar"
  | "maned_wolf"
  | "armadillo"
  | "macaw"
  | "galo_de_campina"
  | "capuchin"
  | "coati";

export const MAX_PLAYERS = 6;

export type SpeciesCategory = "predator" | "subpredator" | "middle" | "base";
export type Habitat = "forest" | "field" | "river";
export type Resource = "meat" | "egg" | "fruit" | "seed";
export type MovementKind = "adjacent" | "diagonal" | "straight_jump" | "knight_jump";
export type GameStatus = "lobby" | "setup" | "active" | "scoring" | "finished";
export type RoomStatus = "lobby" | "scenario_voting" | "setup" | "active" | "finished";
export type CardKind = "common" | "initial";
export type ContentStatus = "complete" | "needs_review";
export type ActionId = "A" | "B" | "C" | "D";
export type ObjectiveRuleTier = "red" | "yellow" | "blue";
export type MiniExpansionId = "objectives" | "scenarios" | "threats";

export type ScenarioCardId =
  | "amazonia"
  | "caatinga"
  | "cerrado"
  | "mata_atlantica"
  | "pampa"
  | "pantanal";
export type ScenarioSelectionMode = "vote" | "host";
export type ScenarioCount = 1 | 2;
export type ObjectiveEligibilityCategory = "predator" | "middle" | "base";
export type ObjectiveScoringKind =
  | "removed_species"
  | "resource_majority"
  | "seed_spend"
  | "resource_majority_count"
  | "habitat_line"
  | "resource_line"
  | "missing_resources"
  | "extra_turn"
  | "discard_for_resources"
  | "resource_square"
  | "pieces_in_forest"
  | "connected_river";
export type ThreatCardId =
  | "threat_1"
  | "threat_2"
  | "threat_3"
  | "threat_4"
  | "threat_5"
  | "threat_6"
  | "threat_7"
  | "threat_8";

export interface GridPosition {
  x: number;
  y: number;
}

export interface PieceLocation extends GridPosition {
  siteId: string;
}

export interface ForestCardSiteDefinition {
  siteId: string;
  habitat: Habitat;
  resource: Resource | null;
  maxPieces: number | null;
}

export interface CardConnections {
  north: string | null;
  east: string | null;
  south: string | null;
  west: string | null;
}

export interface ForestCardDefinition {
  id: string;
  label: string;
  kind: CardKind;
  habitat: Habitat | null;
  resource: Resource | null;
  resources: Resource[];
  sites: ForestCardSiteDefinition[];
  imagePath: string;
  connections: CardConnections | null;
  metadataStatus: ContentStatus;
  notes?: string;
}

export interface ObjectiveCardDefinition {
  id: string;
  label: string;
  imagePath: string;
  eligibleCategories: ObjectiveEligibilityCategory[];
  scoring: {
    kind: ObjectiveScoringKind;
    resource?: Resource;
    habitat?: Habitat;
    minLength?: number;
    diagonalsOnly?: boolean;
    maxPoints?: number;
    points?: number;
    spendSeedCount?: number;
  };
  rules: Partial<Record<ObjectiveRuleTier, string>>;
}

export interface ScenarioCardDefinition {
  id: ScenarioCardId;
  label: string;
  imagePath: string;
  description: string;
}

export interface ThreatCardDefinition {
  id: ThreatCardId;
  label: string;
  imagePath?: string;
  description: string;
}

export interface ScenarioVotingState {
  candidateIds: ScenarioCardId[];
  scenarioCount: ScenarioCount;
  votesByPlayer: Record<string, ScenarioCardId[]>;
  deadline: number;
  selectedIds: ScenarioCardId[] | null;
}

export interface ForestCardState {
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  isInitial: boolean;
}

export interface SpeciesDefinition {
  speciesId: SpeciesId;
  displayName: string;
  scientificName: string;
  category: SpeciesCategory;
  totalPieces: number;
  initialPieces: number;
  usesForestCards: boolean;
  actions: ActionId[];
  movementPatternsByHabitat: Record<Habitat, MovementKind>;
  boardAsset: string;
  meepleAsset: string;
  portraitAsset: string;
  movementAsset: string;
}

export interface PieceState {
  pieceId: string;
  ownerId: string;
  speciesId: SpeciesId;
  location: PieceLocation | null;
  state: {
    hidden: boolean;
  };
}

export interface PlayerState {
  playerId: string;
  name: string;
  speciesId: SpeciesId | null;
  score: number;
  resources: Record<Resource, number>;
  hand: string[];
  // Set by the server-side per-viewer projection when `hand` was redacted
  // (other players only learn how many cards someone holds, never which ones).
  handCount?: number;
  objectiveChoices: string[];
  selectedObjectiveCardId: string | null;
  // Set by the per-viewer projection when `selectedObjectiveCardId` was
  // redacted, so the UI can still show that the player already chose one.
  hasSelectedObjective?: boolean;
  discardedObjectiveCardId: string | null;
  reservePieces: string[];
  piecesInForest: string[];
  turnsTaken: number;
}

export type GameLogPayloadKind =
  | "place_card"
  | "add_piece"
  | "move_piece"
  | "remove_piece"
  | "hide_piece"
  | "pair_bonus"
  | "score"
  | "spend"
  | "objective"
  | "skip"
  | "complete_action"
  | "advance_turn"
  | "setup_place"
  | "finish";

export interface GameLogPayload {
  kind: GameLogPayloadKind;
  actorPlayerId?: string;
  cardInstanceId?: string;
  cardDefinitionId?: string;
  habitat?: Habitat;
  location?: GridPosition;
  pieceIds?: string[];
  points?: number;
  actionId?: ActionId;
  resources?: Resource[];
  count?: number;
}

export interface GameLogEntry {
  id: string;
  message: string;
  createdAt: number;
  payload?: GameLogPayload;
}

export interface ResourceMajorityResult {
  resource: Resource;
  topCount: number;
  winnerPlayerIds: string[];
  pointsEach: number;
}

export interface FinalScoreEntry {
  playerId: string;
  name: string;
  speciesId: SpeciesId | null;
  baseScore: number;
  objectivePoints: number;
  scenarioPoints: number;
  resourceMajorityPoints: number;
  seedPoints: number;
  totalScore: number;
  remainingResources: number;
  populationValue: number;
}

export interface FinalScoreBreakdown {
  resourceMajorities: ResourceMajorityResult[];
  entries: FinalScoreEntry[];
  pointCap: number;
}

export interface GameState {
  gameId: string;
  status: GameStatus;
  enabledMiniExpansions: MiniExpansionId[];
  round: number;
  maxRounds: number;
  activePlayerId: string | null;
  activeActionIndex: number;
  activePlayedForestCardId: string | null;
  pendingCoatiPairBonus: {
    playerId: string;
    pairKey: string;
    origin: GridPosition;
  } | null;
  pendingMacawMovedPiece: {
    playerId: string;
    pieceId: string;
    location: GridPosition;
  } | null;
  pendingGaloInterrupt: {
    ownerId: string;
    location: GridPosition;
    interruptedPlayerId: string;
  } | null;
  pendingWolfMoves: {
    playerId: string;
    pieceIds: string[];
  } | null;
  pendingExtraTurnPlayerId: string | null;
  extraTurnPlayerId: string | null;
  resolvedExtraTurnPlayerIds: string[];
  pendingSeedSpendObjectivePlayerId: string | null;
  acceptedSeedSpendObjectivePlayerIds: string[];
  resolvedSeedSpendObjectivePlayerIds: string[];
  resolvedCoatiPairBonuses: string[];
  setupActivePlayerId: string | null;
  turnOrder: string[];
  setupOrder: string[];
  players: PlayerState[];
  pieces: PieceState[];
  forest: {
    cards: ForestCardState[];
  };
  deck: {
    commonCardIds: string[];
    initialCandidateIds: string[];
    // Set by the per-viewer projection when the deck order was redacted.
    commonCardCount?: number;
  };
  log: GameLogEntry[];
  contentWarnings: string[];
  finalScoreBreakdown: FinalScoreBreakdown | null;
  winnerPlayerIds: string[];
  activeScenarioIds: ScenarioCardId[];
  activeThreatCardId: ThreatCardId | null;
  threatDeckIds: ThreatCardId[];
  // Set by the per-viewer projection when the threat deck order was redacted.
  threatDeckCount?: number;
  threatDiscardIds: ThreatCardId[];
  // Tracks per-round/per-turn scenario usage. Reset by round/turn boundaries.
  cerradoTriggeredByPlayer: Record<string, number>;
  cerradoPending: {
    playerId: string;
    resource: Resource;
    location: GridPosition;
    round: number;
  } | null;
  caatingaUsedByPlayer: Record<string, number>;
  caatingaPending: {
    playerId: string;
    resource: Resource;
    location: GridPosition;
    trigger: "add" | "remove";
    round: number;
  } | null;
  // Mata Atlântica scenario: 3 shared piles of 6 cards. Each player's `hand`
  // mirrors the top of each non-empty pile (1 card per pile). When the player
  // picks a card, it's removed from the owning pile and the next card becomes
  // the new top. Piles do not refill from the deck.
  mataAtlanticaPiles: string[][] | null;
  // Set by the per-viewer projection when the piles were truncated to their
  // top card: number of cards remaining in each pile.
  mataAtlanticaPileCounts?: number[] | null;
  // Tracks per-player turnsTaken when they last manually discarded a card from
  // a Mata Atlântica pile. Used to avoid double-discard at turn end.
  mataAtlanticaDiscardByPlayer: Record<string, number>;
  // Threat 4 (Caca ilegal): at end of turn the active player must choose
  // between removing one of their own pieces from the forest or spending one
  // unit of the resource they currently hold the most of. Turn rotation
  // pauses until the choice is resolved.
  cacaIlegalPending: { playerId: string } | null;
}

export interface RoomPlayer {
  playerId: string;
  name: string;
  speciesId: SpeciesId | null;
  ready: boolean;
  connected: boolean;
  isBot?: boolean;
}

export interface PublicRoomState {
  roomId: string;
  status: RoomStatus;
  hostPlayerId: string;
  players: RoomPlayer[];
  enabledMiniExpansions: MiniExpansionId[];
  game: GameState | null;
  warnings: string[];
  botTurnDelayMs?: number;
  // Turn timer for online games. null/undefined = disabled. When set, an active
  // human player who runs out of time has a bot resolve the rest of their turn.
  turnTimerMs?: number | null;
  // Server timestamp (ms) when the current active turn began. Used by clients to
  // render the countdown. Transient: recomputed by the server, not authoritative
  // after a restart.
  activeTurnStartedAt?: number | null;
  // Number of connected spectators watching the room. Spectators do not occupy a
  // player slot and never affect game state. Transient: reset to 0 on restart.
  spectatorCount?: number;
  // True when the room was created with a password. The password itself is never
  // sent to clients. Private rooms are hidden from the public open-room list.
  isPrivate?: boolean;
  scenarioSelectionMode?: ScenarioSelectionMode;
  scenarioCount?: ScenarioCount;
  hostSelectedScenarioIds?: ScenarioCardId[];
  scenarioVoting?: ScenarioVotingState | null;
}

// Lightweight room descriptor for the public matchmaking list. Never includes
// the password and omits the full game state to keep the payload small.
export interface RoomSummary {
  roomId: string;
  hostName: string;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  spectatorCount: number;
}

export * from "./helpers";
