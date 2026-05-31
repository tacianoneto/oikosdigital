export type SpeciesId =
  | "jaguar"
  | "maned_wolf"
  | "armadillo"
  | "macaw"
  | "capuchin"
  | "coati";

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
export type MiniExpansionId = "objectives" | "scenarios";

export type ScenarioCardId =
  | "amazonia"
  | "caatinga"
  | "cerrado"
  | "mata_atlantica"
  | "pampa"
  | "pantanal";
export type ScenarioSelectionMode = "vote" | "host";

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
  rules: Partial<Record<ObjectiveRuleTier, string>>;
}

export interface ScenarioCardDefinition {
  id: ScenarioCardId;
  label: string;
  imagePath: string;
  description: string;
}

export interface ScenarioVotingState {
  candidateIds: ScenarioCardId[];
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
  objectiveChoices: string[];
  selectedObjectiveCardId: string | null;
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
  pendingWolfMoves: {
    playerId: string;
    pieceIds: string[];
  } | null;
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
  };
  log: GameLogEntry[];
  contentWarnings: string[];
  finalScoreBreakdown: FinalScoreBreakdown | null;
  winnerPlayerIds: string[];
  activeScenarioIds: ScenarioCardId[];
  // Tracks per-round/per-turn scenario usage. Reset by round/turn boundaries.
  cerradoTriggeredAtRound: number | null;
  caatingaUsedByPlayer: Record<string, number>;
  caatingaPending: { playerId: string; resource: Resource; location: GridPosition } | null;
  // Mata Atlântica scenario: a single shared hand replaces per-player hands.
  // When non-null, every card-using player draws from / sees this same list.
  sharedHand: string[] | null;
  // Tracks per-player turnsTaken when they last manually discarded a card from
  // the shared hand (Mata Atlântica). Used to avoid double-discard at turn end.
  mataAtlanticaDiscardByPlayer: Record<string, number>;
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
