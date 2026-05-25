import { commonForestCards, speciesDefinitions, speciesOrderBySetup } from "@oikos/content";
import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  completeCurrentAction,
  createInitialGameState,
  forceEndPlayerTurn,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece,
  removeBasePieceForWolfAction,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus,
  requiredCommonCardsForPlayers,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing,
  scoreCapuchinHabitatPresence,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints
} from "@oikos/rules";
import type { ForestCardState, PublicRoomState, Resource, RoomPlayer, SpeciesId } from "@oikos/shared";
import { playBotStep, playRandomStep } from "@oikos/rules";
import { loadRooms } from "./store";

interface ServerRoom {
  roomId: string;
  hostPlayerId: string;
  players: RoomPlayer[];
  status: PublicRoomState["status"];
  game: PublicRoomState["game"];
  warnings: string[];
  botTurnDelayMs?: number;
  turnTimerMs?: number | null;
  // Connected spectators (by playerId). They receive room broadcasts but never
  // occupy a player slot or affect game state. Not persisted: rebuilt as sockets
  // reconnect after a restart.
  spectators: Set<string>;
}

const MIN_TURN_TIMER_MS = 15000;
const MAX_TURN_TIMER_MS = 300000;

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
    status: persisted.status,
    game: persisted.game,
    warnings: persisted.warnings,
    botTurnDelayMs: persisted.botTurnDelayMs,
    turnTimerMs: persisted.turnTimerMs ?? null,
    spectators: new Set<string>()
  });
}

export function createRoom(hostSocketId: string, hostName: string): PublicRoomState {
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
    status: "lobby",
    game: null,
    warnings: [],
    turnTimerMs: null,
    spectators: new Set<string>()
  };

  rooms.set(roomId, room);
  return toPublicRoom(room);
}

export function spectateRoom(roomId: string, playerId: string): PublicRoomState {
  const room = getRoom(roomId);

  // A seated player is never a spectator; just return the current state.
  if (room.players.some((player) => player.playerId === playerId)) {
    return toPublicRoom(room);
  }

  room.spectators.add(playerId);
  return toPublicRoom(room);
}

export function joinRoom(roomId: string, playerId: string, playerName: string): PublicRoomState {
  const room = getRoom(roomId);
  room.spectators.delete(playerId);
  const existing = room.players.find((player) => player.playerId === playerId);

  if (existing) {
    existing.connected = true;
    existing.name = playerName || existing.name;
    return toPublicRoom(room);
  }

  if (room.players.length >= 6) {
    throw new Error("A sala já tem 6 jogadores.");
  }

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

  room.game = createInitialGameState(roomId, room.players);
  room.status = "setup";
  room.warnings = room.game.contentWarnings;

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
    action === "D" && (speciesId === "capuchin" || speciesId === "macaw" || speciesId === "armadillo");

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
    game: room.game,
    warnings: room.warnings,
    botTurnDelayMs: room.botTurnDelayMs,
    turnTimerMs: room.turnTimerMs ?? null,
    spectatorCount: room.spectators.size
  };
}

function getRoom(roomId: string): ServerRoom {
  const room = rooms.get(roomId.trim().toUpperCase());
  if (!room) {
    throw new Error("Sala não encontrada.");
  }

  return room;
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
