import { commonForestCards, speciesDefinitions, speciesOrderBySetup } from "@oikos/content";
import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addGaloForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  completeCurrentAction,
  createInitialGameState,
  discardObjectiveForResources,
  forceEndPlayerTurn,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece,
  removeBasePieceForWolfAction,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus,
  resolveExtraTurnObjective,
  selectObjectiveCard,
  collectCaatingaBonus,
  collectCerradoBonus,
  resolveCacaIlegal,
  discardMataAtlanticaPileCard,
  resolveSeedSpendObjective,
  requiredCommonCardsForPlayers,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing,
  scoreCapuchinHabitatPresence,
  scoreGaloSeedCards,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints
} from "@oikos/rules";
import type {
  ForestCardState,
  MiniExpansionId,
  PublicRoomState,
  Resource,
  RoomPlayer,
  RoomSummary,
  ScenarioCount,
  ScenarioCardId,
  ScenarioSelectionMode,
  ScenarioVotingState,
  SpeciesId
} from "@oikos/shared";
import { scenarioCards } from "@oikos/content";
import { playBotStep, playRandomStep } from "@oikos/rules";
import { loadRooms } from "./store";

interface ServerRoom {
  roomId: string;
  hostPlayerId: string;
  players: RoomPlayer[];
  enabledMiniExpansions: MiniExpansionId[];
  status: PublicRoomState["status"];
  game: PublicRoomState["game"];
  warnings: string[];
  botTurnDelayMs?: number;
  turnTimerMs?: number | null;
  scenarioSelectionMode: ScenarioSelectionMode;
  scenarioCount: ScenarioCount;
  hostSelectedScenarioIds: ScenarioCardId[];
  scenarioVoting?: ScenarioVotingState | null;
  // Connected spectators (by playerId). They receive room broadcasts but never
  // occupy a player slot or affect game state. Not persisted: rebuilt as sockets
  // reconnect after a restart.
  spectators: Set<string>;
  // Optional join password. When set, the room is private: hidden from the public
  // open-room list and joinable/spectatable only with the matching password. Never
  // sent to clients. Not persisted, so a restart turns private rooms public.
  password?: string | null;
}

const MIN_TURN_TIMER_MS = 15000;
const MAX_TURN_TIMER_MS = 300000;
const defaultMiniExpansions: MiniExpansionId[] = [];
const defaultScenarioCount: ScenarioCount = 1;
export const SCENARIO_VOTING_DURATION_MS = 50000;

function pickRandom<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function shuffleArr<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Pantanal + Mata Atlântica are mutually exclusive: Pantanal needs personal
// hands at the end of the last round, but Mata Atlântica replaces personal
// hands with shared piles, so they can't coexist coherently.
function isExclusivePair(a: ScenarioCardId, b: ScenarioCardId): boolean {
  return (
    (a === "pantanal" && b === "mata_atlantica") ||
    (a === "mata_atlantica" && b === "pantanal")
  );
}

function tallyScenarioVotes(voting: ScenarioVotingState, random: () => number): ScenarioCardId[] {
  const scenarioCount = voting.scenarioCount ?? defaultScenarioCount;
  const tally = new Map<ScenarioCardId, number>();
  for (const id of voting.candidateIds) tally.set(id, 0);
  for (const votes of Object.values(voting.votesByPlayer)) {
    for (const id of votes) {
      if (tally.has(id)) tally.set(id, (tally.get(id) ?? 0) + 1);
    }
  }
  const byCount = new Map<number, ScenarioCardId[]>();
  for (const [id, count] of tally) {
    const arr = byCount.get(count) ?? [];
    arr.push(id);
    byCount.set(count, arr);
  }
  const sortedCounts = Array.from(byCount.keys()).sort((a, b) => b - a);
  const selected: ScenarioCardId[] = [];
  for (const count of sortedCounts) {
    const tied = shuffleArr(byCount.get(count) ?? [], random);
    for (const id of tied) {
      if (selected.length >= scenarioCount) break;
      // Skip ids that would form an exclusive pair with anything already
      // picked. They fall through to the next-most-voted scenario.
      if (selected.some((picked) => isExclusivePair(picked, id))) continue;
      selected.push(id);
    }
    if (selected.length >= scenarioCount) break;
  }
  return selected;
}

function fillMissingScenarioVotes(voting: ScenarioVotingState, players: RoomPlayer[], random: () => number): void {
  const scenarioCount = voting.scenarioCount ?? defaultScenarioCount;
  for (const player of players) {
    const existing = voting.votesByPlayer[player.playerId] ?? [];
    if (existing.length >= scenarioCount) continue;
    const pool = voting.candidateIds.filter((id) => !existing.includes(id));
    const shuffled = shuffleArr(pool, random);
    const needed = scenarioCount - existing.length;
    voting.votesByPlayer[player.playerId] = [...existing, ...shuffled.slice(0, needed)];
  }
}

function normalizeScenarioCount(value: unknown): ScenarioCount {
  return 1;
}

const rooms = new Map<string, ServerRoom>();

// Restore rooms persisted before a restart. No sockets exist yet, so human
// players start disconnected until they rejoin; bots remain ready and present.
for (const persisted of loadRooms()) {
  rooms.set(persisted.roomId, {
    roomId: persisted.roomId,
    hostPlayerId: persisted.hostPlayerId,
    players: persisted.players.map((player) => ({
      ...player,
      connected: Boolean(player.isBot),
      ready: player.isBot ? true : false
    })),
    enabledMiniExpansions: persisted.enabledMiniExpansions ?? persisted.game?.enabledMiniExpansions ?? defaultMiniExpansions,
    status: persisted.status,
    game: persisted.game,
    warnings: persisted.warnings,
    botTurnDelayMs: persisted.botTurnDelayMs,
    turnTimerMs: persisted.turnTimerMs ?? null,
    scenarioSelectionMode: persisted.scenarioSelectionMode ?? "vote",
    scenarioCount: normalizeScenarioCount(persisted.scenarioCount),
    hostSelectedScenarioIds: persisted.hostSelectedScenarioIds ?? [],
    spectators: new Set<string>(),
    password: null,
    scenarioVoting: persisted.scenarioVoting ?? null
  });
}

function normalizePassword(password?: string | null): string | null {
  const trimmed = typeof password === "string" ? password.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export function createRoom(hostSocketId: string, hostName: string, password?: string | null): PublicRoomState {
  const roomId = createRoomId();
  const player: RoomPlayer = {
    playerId: hostSocketId,
    name: hostName || "Jogador 1",
    speciesId: null,
    ready: false,
    connected: true
  };

  const room: ServerRoom = {
    roomId,
    hostPlayerId: hostSocketId,
    players: [player],
    enabledMiniExpansions: [...defaultMiniExpansions],
    status: "lobby",
    game: null,
    warnings: [],
    turnTimerMs: null,
    scenarioSelectionMode: "vote",
    scenarioCount: defaultScenarioCount,
    hostSelectedScenarioIds: [],
    spectators: new Set<string>(),
    password: normalizePassword(password),
    scenarioVoting: null
  };

  rooms.set(roomId, room);
  return toPublicRoom(room);
}

// Open rooms for the public matchmaking list: never private, never finished.
// Ordered with joinable lobbies first, then ongoing games.
export function listOpenRooms(): RoomSummary[] {
  const summaries: RoomSummary[] = [];

  for (const room of rooms.values()) {
    if (room.password || room.status === "finished" || room.game?.status === "finished") {
      continue;
    }

    // Only real, live rooms: at least one connected human. Excludes abandoned
    // rooms (everyone left), bot-only rooms, and ghosts restored from storage
    // after a restart (all humans start disconnected until they rejoin).
    const hasConnectedHuman = room.players.some((player) => !player.isBot && player.connected);
    if (!hasConnectedHuman) {
      continue;
    }

    const host = room.players.find((player) => player.playerId === room.hostPlayerId);
    summaries.push({
      roomId: room.roomId,
      hostName: host?.name ?? "Sala",
      status: room.status,
      playerCount: room.players.length,
      maxPlayers: 6,
      spectatorCount: room.spectators.size
    });
  }

  return summaries.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "lobby" ? -1 : 1;
    }
    return a.roomId.localeCompare(b.roomId);
  });
}

export function spectateRoom(roomId: string, playerId: string, password?: string | null): PublicRoomState {
  const room = getRoom(roomId);

  // A seated player is never a spectator; just return the current state.
  if (room.players.some((player) => player.playerId === playerId)) {
    return toPublicRoom(room);
  }

  assertPassword(room, playerId, password);
  room.spectators.add(playerId);
  return toPublicRoom(room);
}

export function joinRoom(roomId: string, playerId: string, playerName: string, password?: string | null): PublicRoomState {
  const room = getRoom(roomId);
  const existing = room.players.find((player) => player.playerId === playerId);

  if (existing) {
    room.spectators.delete(playerId);
    existing.connected = true;
    existing.name = playerName || existing.name;
    return toPublicRoom(room);
  }

  assertPassword(room, playerId, password);

  if (room.players.length >= 6) {
    throw new Error("A sala já tem 6 jogadores.");
  }

  room.spectators.delete(playerId);
  room.players.push({
    playerId,
    name: playerName || `Jogador ${room.players.length + 1}`,
    speciesId: null,
    ready: false,
    connected: true
  });

  return toPublicRoom(room);
}

export function leaveRooms(playerId: string): PublicRoomState[] {
  const updatedRooms: PublicRoomState[] = [];

  for (const room of rooms.values()) {
    const player = room.players.find((candidate) => candidate.playerId === playerId);
    if (player) {
      player.connected = false;
      player.ready = false;
      updatedRooms.push(toPublicRoom(room));
      continue;
    }

    if (room.spectators.delete(playerId)) {
      updatedRooms.push(toPublicRoom(room));
    }
  }

  return updatedRooms;
}

export function leaveRoom(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);
  const player = room.players.find((candidate) => candidate.playerId === playerId);

  if (player) {
    player.connected = false;
    player.ready = false;
  } else {
    room.spectators.delete(playerId);
  }

  return toPublicRoom(room);
}

function removePlayerFromRoom(room: ServerRoom, targetPlayerId: string): void {
  const index = room.players.findIndex((candidate) => candidate.playerId === targetPlayerId);
  if (index === -1) {
    throw new Error("Jogador não está nesta sala.");
  }
  room.players.splice(index, 1);
  if (room.hostPlayerId === targetPlayerId) {
    const nextHost = room.players.find((candidate) => !candidate.isBot);
    if (nextHost) {
      room.hostPlayerId = nextHost.playerId;
    }
  }
}

export function quitRoom(roomId: string, playerId: string): PublicRoomState | null {
  const room = getRoom(roomId);
  if (room.status !== "lobby") {
    throw new Error("Só é possível sair definitivamente no lobby.");
  }

  const isPlayer = room.players.some((candidate) => candidate.playerId === playerId);
  if (isPlayer) {
    removePlayerFromRoom(room, playerId);
  } else {
    room.spectators.delete(playerId);
  }

  if (room.players.filter((candidate) => !candidate.isBot).length === 0) {
    rooms.delete(roomId);
    return null;
  }

  return toPublicRoom(room);
}

export function kickPlayer(roomId: string, hostPlayerId: string, targetPlayerId: string): PublicRoomState {
  const room = getRoom(roomId);
  if (room.hostPlayerId !== hostPlayerId) {
    throw new Error("Apenas o anfitrião pode remover jogadores.");
  }
  if (room.status !== "lobby") {
    throw new Error("Jogadores só podem ser removidos no lobby.");
  }
  if (targetPlayerId === hostPlayerId) {
    throw new Error("O anfitrião não pode remover a si mesmo.");
  }

  removePlayerFromRoom(room, targetPlayerId);
  return toPublicRoom(room);
}

export function renamePlayer(roomId: string, playerId: string, rawName: string): PublicRoomState {
  const room = getRoom(roomId);
  const player = getPlayer(room, playerId);
  const trimmed = rawName.trim().slice(0, 24);
  if (!trimmed) {
    throw new Error("Nome inválido.");
  }
  player.name = trimmed;
  return toPublicRoom(room);
}

export function selectSpecies(roomId: string, playerId: string, speciesId: SpeciesId): PublicRoomState {
  const room = getRoom(roomId);
  const player = getPlayer(room, playerId);

  if (room.status !== "lobby") {
    throw new Error("Especies so podem ser escolhidas no lobby.");
  }

  if (!speciesDefinitions[speciesId]) {
    throw new Error("Especie desconhecida.");
  }

  const alreadyTaken = room.players.some((candidate) => candidate.playerId !== playerId && candidate.speciesId === speciesId);
  if (alreadyTaken) {
    throw new Error("Essa espécie já foi escolhida.");
  }

  player.speciesId = speciesId;
  player.ready = false;
  return toPublicRoom(room);
}

export function setReady(roomId: string, playerId: string, ready: boolean): PublicRoomState {
  const room = getRoom(roomId);
  const player = getPlayer(room, playerId);

  if (player.isBot) {
    throw new Error("Bots ficam prontos automaticamente.");
  }

  if (!player.speciesId && ready) {
    throw new Error("Escolha uma espécie antes de ficar pronto.");
  }

  player.ready = ready;
  return toPublicRoom(room);
}

export function addBots(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);
  assertHostCanManageBots(room, playerId);

  const selectedSpecies = new Set(room.players.map((player) => player.speciesId).filter(Boolean));
  const missingSpecies = speciesOrderBySetup.filter((speciesId) => !selectedSpecies.has(speciesId));

  for (const speciesId of missingSpecies) {
    if (room.players.length >= 6) {
      break;
    }

    room.players.push({
      playerId: `bot_${speciesId}`,
      name: `Bot ${speciesDefinitions[speciesId].displayName}`,
      speciesId,
      ready: true,
      connected: true,
      isBot: true
    });
  }

  return toPublicRoom(room);
}

export function removeBots(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);
  assertHostCanManageBots(room, playerId);

  room.players = room.players.filter((player) => !player.isBot);
  return toPublicRoom(room);
}

export function addBotForSpecies(roomId: string, playerId: string, speciesId: SpeciesId): PublicRoomState {
  const room = getRoom(roomId);
  assertHostCanManageBots(room, playerId);

  if (room.players.length >= 6) {
    throw new Error("Sala já está cheia.");
  }

  const existing = room.players.find((player) => player.speciesId === speciesId);
  if (existing) {
    throw new Error("Espécie já está em uso.");
  }

  if (!speciesDefinitions[speciesId]) {
    throw new Error("Espécie inválida.");
  }

  room.players.push({
    playerId: `bot_${speciesId}`,
    name: `Bot ${speciesDefinitions[speciesId].displayName}`,
    speciesId,
    ready: true,
    connected: true,
    isBot: true
  });

  return toPublicRoom(room);
}

export function removeBotForSpecies(roomId: string, playerId: string, speciesId: SpeciesId): PublicRoomState {
  const room = getRoom(roomId);
  assertHostCanManageBots(room, playerId);

  const target = room.players.find((player) => player.isBot && player.speciesId === speciesId);
  if (!target) {
    throw new Error("Bot não encontrado para esta espécie.");
  }

  room.players = room.players.filter((player) => player.playerId !== target.playerId);
  return toPublicRoom(room);
}

export function setBotTurnDelay(roomId: string, playerId: string, delayMs: number): PublicRoomState {
  const room = getRoom(roomId);

  if (room.hostPlayerId !== playerId) {
    throw new Error("Apenas o anfitriao pode ajustar a velocidade dos bots.");
  }

  room.botTurnDelayMs = clampBotTurnDelay(delayMs);
  return toPublicRoom(room);
}

export function getBotTurnDelay(roomId: string): number | null {
  return rooms.get(roomId.trim().toUpperCase())?.botTurnDelayMs ?? null;
}

export function setTurnTimer(roomId: string, playerId: string, turnTimerMs: number | null): PublicRoomState {
  const room = getRoom(roomId);

  if (room.hostPlayerId !== playerId) {
    throw new Error("Apenas o anfitriao pode ajustar o cronometro de turno.");
  }

  room.turnTimerMs = turnTimerMs === null ? null : clampTurnTimer(turnTimerMs);
  return toPublicRoom(room);
}

export function setScenarioSelectionMode(
  roomId: string,
  playerId: string,
  mode: ScenarioSelectionMode
): PublicRoomState {
  const room = getRoom(roomId);

  if (room.hostPlayerId !== playerId) {
    throw new Error("Apenas o anfitriao pode alterar o modo dos cenarios.");
  }

  if (room.status !== "lobby") {
    throw new Error("Modo de cenarios so pode ser alterado no lobby.");
  }

  if (mode !== "vote" && mode !== "host") {
    throw new Error("Modo de cenarios invalido.");
  }

  room.scenarioSelectionMode = mode;
  return toPublicRoom(room);
}

export function setScenarioCount(roomId: string, playerId: string, scenarioCount: ScenarioCount): PublicRoomState {
  const room = getRoom(roomId);

  if (room.hostPlayerId !== playerId) {
    throw new Error("Apenas o anfitriao pode alterar a quantidade de cenarios.");
  }

  if (room.status !== "lobby") {
    throw new Error("Quantidade de cenarios so pode ser alterada no lobby.");
  }

  room.scenarioCount = normalizeScenarioCount(scenarioCount);
  room.hostSelectedScenarioIds = room.hostSelectedScenarioIds.slice(0, room.scenarioCount);
  return toPublicRoom(room);
}

export function setHostSelectedScenarios(
  roomId: string,
  playerId: string,
  scenarioIds: ScenarioCardId[]
): PublicRoomState {
  const room = getRoom(roomId);

  if (room.hostPlayerId !== playerId) {
    throw new Error("Apenas o anfitriao pode escolher cenarios.");
  }

  if (room.status !== "lobby") {
    throw new Error("Cenarios so podem ser escolhidos no lobby.");
  }

  const validIds = new Set(scenarioCards.map((card) => card.id));
  const unique = Array.from(new Set(scenarioIds)).filter((id) => validIds.has(id));
  if (unique.length > room.scenarioCount) {
    throw new Error(`Escolha no maximo ${room.scenarioCount} cenario(s).`);
  }
  if (unique.includes("pantanal") && unique.includes("mata_atlantica")) {
    throw new Error("Pantanal e Mata Atlantica nao podem coexistir na mesma partida.");
  }

  room.hostSelectedScenarioIds = unique;
  return toPublicRoom(room);
}

export function getTurnTimerMs(roomId: string): number | null {
  return rooms.get(roomId.trim().toUpperCase())?.turnTimerMs ?? null;
}

// Active player whose own turn timer should run: an online, non-bot human in an
// active game. Bots advance through scheduleBotTurn instead.
export function getActiveHumanPlayer(roomId: string): string | null {
  const room = rooms.get(roomId.trim().toUpperCase());
  if (!room?.game || room.game.status !== "active" || !room.game.activePlayerId) {
    return null;
  }

  const activePlayer = room.players.find((player) => player.playerId === room.game?.activePlayerId);
  if (!activePlayer || activePlayer.isBot) {
    return null;
  }

  return activePlayer.playerId;
}

// Turn-timeout punishment: a random bot resolves the rest of the active human's
// turn. Steps until the turn ends (active player changes or game finishes), with
// a hard cap so a stuck state cannot loop forever.
export function advanceTurnTimeoutBot(roomId: string, playerId: string): { room: PublicRoomState; ended: boolean } {
  const room = getRoom(roomId);
  if (!room.game || room.game.status !== "active" || room.game.activePlayerId !== playerId) {
    return { room: toPublicRoom(room), ended: false };
  }

  room.game = {
    ...room.game,
    log: [
      ...room.game.log,
      {
        id: `turn_timeout_${playerId}_${room.game.log.length + 1}`,
        message: "Tempo do turno esgotado: jogada resolvida automaticamente.",
        createdAt: Date.now()
      }
    ]
  };

  let guard = 0;
  while (room.game.status === "active" && room.game.activePlayerId === playerId && guard < 100) {
    guard += 1;
    try {
      room.game = playRandomStep(room.game, playerId);
    } catch {
      room.game = forceEndPlayerTurn(room.game, playerId, "tempo do turno esgotado");
    }
  }

  if (room.game.status === "active" && room.game.activePlayerId === playerId) {
    room.game = forceEndPlayerTurn(room.game, playerId, "tempo do turno esgotado");
  }

  room.status = room.game.status === "finished" ? "finished" : "active";
  room.warnings = room.game.contentWarnings;

  return { room: toPublicRoom(room), ended: true };
}

export function startGame(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);

  if (room.hostPlayerId !== playerId) {
    throw new Error("Apenas o anfitrião pode iniciar a partida.");
  }

  if (room.players.length < 2) {
    throw new Error("O mínimo para iniciar é 2 jogadores.");
  }

  if (room.players.length > 6) {
    throw new Error("O máximo é 6 jogadores.");
  }

  if (room.players.some((player) => !player.speciesId)) {
    throw new Error("Todos os jogadores precisam escolher espécie.");
  }

  if (room.players.some((player) => !player.ready)) {
    throw new Error("Todos os jogadores precisam estar prontos.");
  }

  const selected = new Set(room.players.map((player) => player.speciesId));
  if (selected.size !== room.players.length) {
    throw new Error("Não é permitido repetir espécie.");
  }

  const requiredCommonCards = requiredCommonCardsForPlayers(room.players);
  if (requiredCommonCards > commonForestCards.length) {
    throw new Error(
      `Regra de mãos pendente: esta composição exige ${requiredCommonCards} cartas comuns, mas há ${commonForestCards.length} assets comuns validados.`
    );
  }

  if (room.enabledMiniExpansions.includes("scenarios") && room.scenarioSelectionMode === "host") {
    if (room.hostSelectedScenarioIds.length !== room.scenarioCount) {
      throw new Error(`Escolha exatamente ${room.scenarioCount} carta(s) de cenario antes de iniciar.`);
    }

    room.game = createInitialGameState(roomId, room.players, Math.random, undefined, {
      enabledMiniExpansions: room.enabledMiniExpansions,
      activeScenarioIds: room.hostSelectedScenarioIds
    });
    room.status = "setup";
    room.warnings = room.game.contentWarnings;
    room.scenarioVoting = null;
    return toPublicRoom(room);
  }

  if (room.enabledMiniExpansions.includes("scenarios")) {
    const candidateIds = shuffleArr(scenarioCards.map((c) => c.id), Math.random);
    const votesByPlayer: Record<string, ScenarioCardId[]> = {};
    for (const player of room.players) {
      if (player.isBot) {
        const shuffled = shuffleArr(candidateIds, Math.random);
        votesByPlayer[player.playerId] = shuffled.slice(0, room.scenarioCount);
      } else {
        votesByPlayer[player.playerId] = [];
      }
    }
    room.scenarioVoting = {
      candidateIds,
      scenarioCount: room.scenarioCount,
      votesByPlayer,
      deadline: Date.now() + SCENARIO_VOTING_DURATION_MS,
      selectedIds: null
    };
    room.status = "scenario_voting";
    room.warnings = [];
    return toPublicRoom(room);
  }

  room.game = createInitialGameState(roomId, room.players, Math.random, undefined, {
    enabledMiniExpansions: room.enabledMiniExpansions
  });
  room.status = "setup";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function castScenarioVote(roomId: string, playerId: string, votes: ScenarioCardId[]): PublicRoomState {
  const room = getRoom(roomId);
  if (room.status !== "scenario_voting" || !room.scenarioVoting) {
    throw new Error("Votação de cenários não está ativa.");
  }
  const player = getPlayer(room, playerId);
  if (!player) throw new Error("Jogador não encontrado.");
  const unique = Array.from(new Set(votes)).filter((id) => room.scenarioVoting!.candidateIds.includes(id));
  const scenarioCount = room.scenarioVoting.scenarioCount ?? defaultScenarioCount;
  if (unique.length > scenarioCount) throw new Error(`Maximo ${scenarioCount} voto(s) por jogador.`);
  room.scenarioVoting.votesByPlayer[playerId] = unique;
  return toPublicRoom(room);
}

export function finalizeScenarioVoting(roomId: string): PublicRoomState {
  const room = getRoom(roomId);
  if (room.status !== "scenario_voting" || !room.scenarioVoting) {
    return toPublicRoom(room);
  }
  fillMissingScenarioVotes(room.scenarioVoting, room.players, Math.random);
  const selected = tallyScenarioVotes(room.scenarioVoting, Math.random);
  room.scenarioVoting.selectedIds = selected;

  room.game = createInitialGameState(room.roomId, room.players, Math.random, undefined, {
    enabledMiniExpansions: room.enabledMiniExpansions,
    activeScenarioIds: selected
  });
  room.status = "setup";
  room.warnings = room.game.contentWarnings;
  return toPublicRoom(room);
}

export function isScenarioVotingComplete(roomId: string): boolean {
  const room = rooms.get(roomId.trim().toUpperCase());
  if (!room || room.status !== "scenario_voting" || !room.scenarioVoting) return false;
  const scenarioCount = room.scenarioVoting.scenarioCount ?? defaultScenarioCount;
  return room.players.every((p) => (room.scenarioVoting!.votesByPlayer[p.playerId] ?? []).length >= scenarioCount);
}

export function setMiniExpansion(roomId: string, playerId: string, expansionId: MiniExpansionId, enabled: boolean): PublicRoomState {
  const room = getRoom(roomId);

  if (room.hostPlayerId !== playerId) {
    throw new Error("Apenas o anfitrião pode alterar mini-expansões.");
  }

  if (room.status !== "lobby") {
    throw new Error("Mini-expansões só podem ser alteradas no lobby.");
  }

  if (expansionId !== "objectives" && expansionId !== "scenarios" && expansionId !== "threats") {
    throw new Error("Mini-expansão indisponível.");
  }

  const current = new Set(room.enabledMiniExpansions ?? defaultMiniExpansions);
  if (enabled) {
    current.add(expansionId);
  } else {
    current.delete(expansionId);
  }
  room.enabledMiniExpansions = Array.from(current);

  return toPublicRoom(room);
}

export function placeSetupPiece(roomId: string, playerId: string, x: number, y: number): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = placeInitialPiece(room.game, playerId, { x, y });
  room.status = room.game.status === "active" ? "active" : "setup";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function chooseObjective(roomId: string, playerId: string, objectiveCardId: string): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda nao foi iniciada.");
  }

  room.game = selectObjectiveCard(room.game, playerId, objectiveCardId);
  room.status = room.game.status === "setup" ? "setup" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function discardObjective(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda nao foi iniciada.");
  }

  room.game = discardObjectiveForResources(room.game, playerId);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function resolveExtraTurn(roomId: string, playerId: string, accept: boolean): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda nao foi iniciada.");
  }

  room.game = resolveExtraTurnObjective(room.game, playerId, accept);
  room.status = room.game.status === "finished" ? "finished" : "active";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function resolveSeedSpend(roomId: string, playerId: string, accept: boolean): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda nao foi iniciada.");
  }

  room.game = resolveSeedSpendObjective(room.game, playerId, accept);
  room.status = room.game.status === "finished" ? "finished" : "active";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function collectCaatinga(
  roomId: string,
  playerId: string,
  mode: "gain" | "lose" | "skip" = "gain"
): PublicRoomState {
  const room = getRoom(roomId);
  if (!room.game) {
    throw new Error("A partida ainda nao foi iniciada.");
  }
  room.game = collectCaatingaBonus(room.game, playerId, mode);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;
  return toPublicRoom(room);
}

export function collectCerrado(
  roomId: string,
  playerId: string,
  mode: "collect" | "skip" = "collect"
): PublicRoomState {
  const room = getRoom(roomId);
  if (!room.game) {
    throw new Error("A partida ainda nao foi iniciada.");
  }
  room.game = collectCerradoBonus(room.game, playerId, mode);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;
  return toPublicRoom(room);
}

export function resolveCacaIlegalThreat(
  roomId: string,
  playerId: string,
  choice: Parameters<typeof resolveCacaIlegal>[2]
): PublicRoomState {
  const room = getRoom(roomId);
  if (!room.game) {
    throw new Error("A partida ainda nao foi iniciada.");
  }
  room.game = resolveCacaIlegal(room.game, playerId, choice);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;
  return toPublicRoom(room);
}

export function discardMataAtlanticaCard(roomId: string, playerId: string, cardId: string): PublicRoomState {
  const room = getRoom(roomId);
  if (!room.game) {
    throw new Error("A partida ainda nao foi iniciada.");
  }
  room.game = discardMataAtlanticaPileCard(room.game, playerId, cardId);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;
  return toPublicRoom(room);
}

export function placeCardInForest(
  roomId: string,
  playerId: string,
  cardId: string,
  x: number,
  y: number,
  rotation: ForestCardState["rotation"]
): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = placeForestCard(room.game, playerId, cardId, { x, y }, rotation);
  room.status = "active";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function addCoati(roomId: string, playerId: string, x: number, y: number): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = addCoatiForCurrentAction(room.game, playerId, { x, y });
  room.status = "active";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function addGalo(roomId: string, playerId: string, x: number, y: number): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = addGaloForCurrentAction(room.game, playerId, { x, y });
  room.status = "active";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function resolveCoatiPair(roomId: string, playerId: string, x: number, y: number): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = resolveCoatiPairBonus(room.game, playerId, { x, y });
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function addCapuchin(roomId: string, playerId: string, x: number, y: number): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = addCapuchinForCurrentAction(room.game, playerId, { x, y });
  room.status = "active";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function addMacaw(roomId: string, playerId: string, x: number, y: number): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = addMacawForCurrentAction(room.game, playerId, { x, y });
  room.status = "active";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function addArmadillo(roomId: string, playerId: string, x: number, y: number): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = addArmadilloForCurrentAction(room.game, playerId, { x, y });
  room.status = "active";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function addWolf(roomId: string, playerId: string, x: number, y: number): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = addWolfForCurrentAction(room.game, playerId, { x, y });
  room.status = "active";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function completeAction(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = completeCurrentAction(room.game, playerId);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function scoreCapuchin(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  if (isStaleScoreRequest(room, playerId, "capuchin")) {
    return toPublicRoom(room);
  }

  room.game = scoreCapuchinHabitatPresence(room.game, playerId);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function scoreMacaw(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  if (isStaleScoreRequest(room, playerId, "macaw")) {
    return toPublicRoom(room);
  }

  room.game = scoreMacawLines(room.game, playerId);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function scoreGalo(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  if (isStaleScoreRequest(room, playerId, "galo_de_campina")) {
    return toPublicRoom(room);
  }

  room.game = scoreGaloSeedCards(room.game, playerId);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function hideArmadillo(roomId: string, playerId: string, pieceId: string): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = hideArmadilloForCurrentAction(room.game, playerId, pieceId);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function scoreArmadillo(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  if (isStaleScoreRequest(room, playerId, "armadillo")) {
    return toPublicRoom(room);
  }

  room.game = scoreArmadilloSharing(room.game, playerId);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function removeWolfBasePiece(roomId: string, playerId: string, pieceId: string): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = removeBasePieceForWolfAction(room.game, playerId, pieceId);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function spendWolfResources(roomId: string, playerId: string, resources: Resource[]): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = spendWolfResourcesForPoints(room.game, playerId, resources);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function movePiece(roomId: string, playerId: string, pieceId: string, x: number, y: number, targetPieceId?: string): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = movePieceForCurrentAction(room.game, playerId, pieceId, { x, y }, targetPieceId);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function removePieces(roomId: string, playerId: string, pieceIds: string[]): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = removePiecesForCurrentAction(room.game, playerId, pieceIds);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function spendJaguarMeat(roomId: string, playerId: string, count: number): PublicRoomState {
  const room = getRoom(roomId);

  if (!room.game) {
    throw new Error("A partida ainda não foi iniciada.");
  }

  room.game = spendJaguarMeatForPoints(room.game, playerId, count);
  room.status = room.game.status === "active" ? "active" : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function getPublicRoom(roomId: string): PublicRoomState {
  return toPublicRoom(getRoom(roomId));
}

export function forceSkipActivePlayer(roomId: string, reason: string): { room: PublicRoomState; skipped: boolean } {
  const room = getRoom(roomId);

  if (!room.game || room.game.status !== "active" || !room.game.activePlayerId) {
    return { room: toPublicRoom(room), skipped: false };
  }

  room.game = forceEndPlayerTurn(room.game, room.game.activePlayerId, reason);
  room.status = room.game.status === "finished" ? "finished" : "active";
  room.warnings = room.game.contentWarnings;

  return { room: toPublicRoom(room), skipped: true };
}

export function getActiveDisconnectedPlayer(roomId: string): string | null {
  const room = rooms.get(roomId.trim().toUpperCase());
  if (!room || !room.game || room.game.status !== "active" || !room.game.activePlayerId) {
    return null;
  }

  const activePlayer = room.players.find((player) => player.playerId === room.game?.activePlayerId);
  if (!activePlayer || activePlayer.connected) {
    return null;
  }

  return activePlayer.playerId;
}

export function getActiveBotPlayer(roomId: string): string | null {
  const room = rooms.get(roomId.trim().toUpperCase());
  if (!room?.game) {
    return null;
  }

  const activePlayerId =
    room.game.status === "setup"
      ? room.game.setupActivePlayerId
      : room.game.status === "active"
        ? room.game.activePlayerId
        : null;

  if (!activePlayerId) {
    return null;
  }

  const activePlayer = room.players.find((player) => player.playerId === activePlayerId);
  return activePlayer?.isBot ? activePlayer.playerId : null;
}

export function getAutomaticScorePlayer(roomId: string): string | null {
  const room = rooms.get(roomId.trim().toUpperCase());
  if (!room?.game || room.game.status !== "active" || !room.game.activePlayerId) {
    return null;
  }

  const activePlayer = room.game.players.find((player) => player.playerId === room.game?.activePlayerId);
  const speciesId = activePlayer?.speciesId;
  if (!speciesId) {
    return null;
  }

  const action = speciesDefinitions[speciesId].actions[room.game.activeActionIndex];
  const isAutomaticScoreAction =
    action === "D" &&
    (speciesId === "capuchin" || speciesId === "macaw" || speciesId === "galo_de_campina" || speciesId === "armadillo");

  return isAutomaticScoreAction ? activePlayer.playerId : null;
}

export function advanceAutomaticScore(roomId: string): PublicRoomState | null {
  const room = getRoom(roomId);
  const playerId = getAutomaticScorePlayer(roomId);
  if (!room.game || !playerId) {
    return null;
  }

  const player = room.game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId === "capuchin") {
    room.game = scoreCapuchinHabitatPresence(room.game, playerId);
  } else if (player?.speciesId === "macaw") {
    room.game = scoreMacawLines(room.game, playerId);
  } else if (player?.speciesId === "galo_de_campina") {
    room.game = scoreGaloSeedCards(room.game, playerId);
  } else if (player?.speciesId === "armadillo") {
    room.game = scoreArmadilloSharing(room.game, playerId);
  } else {
    return null;
  }

  room.status = room.game.status === "finished" ? "finished" : "active";
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

export function advanceBot(roomId: string): PublicRoomState | null {
  const room = getRoom(roomId);
  const botPlayerId = getActiveBotPlayer(roomId);
  if (!room.game || !botPlayerId) {
    return null;
  }

  try {
    room.game = playBotStep(room.game, botPlayerId);
  } catch (error) {
    if (room.game.status !== "active") {
      throw error;
    }

    try {
      room.game = completeCurrentAction(room.game, botPlayerId);
    } catch {
      room.game = forceEndPlayerTurn(room.game, botPlayerId, "bot sem jogada valida");
    }
  }

  room.status =
    room.game.status === "finished"
      ? "finished"
      : room.game.status === "active"
        ? "active"
        : room.game.status === "setup"
          ? "setup"
          : room.status;
  room.warnings = room.game.contentWarnings;

  return toPublicRoom(room);
}

function toPublicRoom(room: ServerRoom): PublicRoomState {
  return {
    roomId: room.roomId,
    status: room.game?.status === "finished" ? "finished" : room.status,
    hostPlayerId: room.hostPlayerId,
    players: room.players,
    enabledMiniExpansions: [...(room.enabledMiniExpansions ?? defaultMiniExpansions)],
    game: room.game,
    warnings: room.warnings,
    botTurnDelayMs: room.botTurnDelayMs,
    turnTimerMs: room.turnTimerMs ?? null,
    spectatorCount: room.spectators.size,
    isPrivate: Boolean(room.password),
    scenarioSelectionMode: room.scenarioSelectionMode,
    scenarioCount: room.scenarioCount,
    hostSelectedScenarioIds: [...room.hostSelectedScenarioIds],
    scenarioVoting: room.scenarioVoting
      ? {
          candidateIds: [...room.scenarioVoting.candidateIds],
          scenarioCount: room.scenarioVoting.scenarioCount ?? defaultScenarioCount,
          votesByPlayer: Object.fromEntries(
            Object.entries(room.scenarioVoting.votesByPlayer).map(([id, votes]) => [id, [...votes]])
          ),
          deadline: room.scenarioVoting.deadline,
          selectedIds: room.scenarioVoting.selectedIds ? [...room.scenarioVoting.selectedIds] : null
        }
      : null
  };
}

function getRoom(roomId: string): ServerRoom {
  const room = rooms.get(roomId.trim().toUpperCase());
  if (!room) {
    throw new Error("Sala não encontrada.");
  }

  return room;
}

function assertPassword(room: ServerRoom, playerId: string, password?: string | null): void {
  // Players already seated (reconnects) bypass the password check.
  if (!room.password || room.players.some((player) => player.playerId === playerId)) {
    return;
  }

  if (normalizePassword(password) !== room.password) {
    throw new Error("Senha incorreta.");
  }
}

function getPlayer(room: ServerRoom, playerId: string): RoomPlayer {
  const player = room.players.find((candidate) => candidate.playerId === playerId);
  if (!player) {
    throw new Error("Jogador não está nesta sala.");
  }

  return player;
}

function assertHostCanManageBots(room: ServerRoom, playerId: string): void {
  if (room.hostPlayerId !== playerId) {
    throw new Error("Apenas o anfitriao pode gerenciar bots.");
  }

  if (room.status !== "lobby") {
    throw new Error("Bots so podem ser alterados no lobby.");
  }
}

function isStaleScoreRequest(room: ServerRoom, playerId: string, speciesId: SpeciesId): boolean {
  if (!room.game || room.game.activePlayerId === playerId) {
    return false;
  }

  return room.game.players.some((player) => player.playerId === playerId && player.speciesId === speciesId);
}

function clampBotTurnDelay(delayMs: number): number {
  if (!Number.isFinite(delayMs)) {
    return 2500;
  }

  return Math.max(250, Math.min(8000, Math.round(delayMs)));
}

function clampTurnTimer(turnTimerMs: number): number {
  if (!Number.isFinite(turnTimerMs)) {
    return 60000;
  }

  return Math.max(MIN_TURN_TIMER_MS, Math.min(MAX_TURN_TIMER_MS, Math.round(turnTimerMs)));
}

function createRoomId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let roomId = "";

  do {
    roomId = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(roomId));

  return roomId;
}
