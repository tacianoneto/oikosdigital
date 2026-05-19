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
export type RoomStatus = "lobby" | "setup" | "active" | "finished";
export type CardKind = "common" | "initial";
export type ContentStatus = "complete" | "needs_review";
export type ActionId = "A" | "B" | "C" | "D";

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
  reservePieces: string[];
  piecesInForest: string[];
  turnsTaken: number;
}

export interface GameLogEntry {
  id: string;
  message: string;
  createdAt: number;
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
  game: GameState | null;
  warnings: string[];
}
