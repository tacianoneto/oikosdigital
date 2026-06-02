import cors from "@fastify/cors";
import Fastify from "fastify";
import { Server } from "socket.io";
import type { MiniExpansionId, PublicRoomState, ScenarioCardId, ScenarioCount, SpeciesId } from "@oikos/shared";
import { purgeRoomsOlderThan, saveRoom } from "./store";
import {
  addBots,
  addBotForSpecies,
  removeBotForSpecies,
  addArmadillo,
  addCapuchin,
  addCoati,
  addMacaw,
  addWolf,
  advanceAutomaticScore,
  advanceBot,
  advanceTurnTimeoutBot,
  completeAction,
  createRoom,
  getActiveBotPlayer,
  getActiveHumanPlayer,
  getAutomaticScorePlayer,
  getBotTurnDelay,
  getTurnTimerMs,
  setTurnTimer,
  chooseObjective,
  forceSkipActivePlayer,
  getActiveDisconnectedPlayer,
  getPublicRoom,
  listOpenRooms,
  hideArmadillo,
  joinRoom,
  leaveRoom,
  leaveRooms,
  quitRoom,
  kickPlayer,
  renamePlayer,
  movePiece,
  placeCardInForest,
  placeSetupPiece,
  removeWolfBasePiece,
  removePieces,
  resolveCoatiPair,
  removeBots,
  scoreCapuchin,
  scoreArmadillo,
  scoreMacaw,
  selectSpecies,
  setBotTurnDelay,
  setMiniExpansion,
  setScenarioSelectionMode,
  setScenarioCount,
  setHostSelectedScenarios,
  setReady,
  spectateRoom,
  spendJaguarMeat,
  spendWolfResources,
  startGame,
  castScenarioVote,
  finalizeScenarioVoting,
  isScenarioVotingComplete,
  collectCaatinga,
  discardMataAtlanticaCard,
  SCENARIO_VOTING_DURATION_MS
} from "./rooms";

const port = Number(process.env.PORT ?? 4173);
const app = Fastify({ logger: true });
const configuredOrigin = process.env.CLIENT_ORIGIN;
const allowedOrigin = configuredOrigin && configuredOrigin !== "true" ? configuredOrigin : true;
const socketsByPlayerId = new Map<string, Set<string>>();
const turnSkipTimers = new Map<string, NodeJS.Timeout>();
const botTurnTimers = new Map<string, NodeJS.Timeout>();
const automaticScoreTimers = new Map<string, NodeJS.Timeout>();
const turnPunishmentTimers = new Map<string, NodeJS.Timeout>();
const scenarioVotingTimers = new Map<string, NodeJS.Timeout>();
// Tracks when the current active turn began, per room, so clients can render a
// countdown and the punishment timer fires at the right moment.
const turnStartByRoom = new Map<string, { playerId: string; at: number }>();
const pendingRoomSaves = new Map<string, PublicRoomState>();
let roomSaveTimer: NodeJS.Timeout | null = null;
const turnTimeoutMs = Number(process.env.TURN_TIMEOUT_MS ?? 90000);
const botTurnDelayMs = Number(process.env.BOT_TURN_DELAY_MS ?? 2500);
const automaticScoreDelayMs = Number(process.env.AUTO_SCORE_DELAY_MS ?? 1500);

await app.register(cors, { origin: allowedOrigin });

app.get("/health", async () => ({
  ok: true,
  service: "oikos-server"
}));

const io = new Server(app.server, {
  cors: {
    origin: allowedOrigin
  }
});

function clearTurnSkipTimer(roomId: string): void {
  const timer = turnSkipTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    turnSkipTimers.delete(roomId);
  }
}

function reconcileTurnTimer(roomId: string): void {
  clearTurnSkipTimer(roomId);

  if (turnTimeoutMs <= 0) {
    return;
  }

  const disconnectedPlayerId = getActiveDisconnectedPlayer(roomId);
  if (!disconnectedPlayerId) {
    return;
  }

  const timer = setTimeout(() => {
    turnSkipTimers.delete(roomId);
    if (!getActiveDisconnectedPlayer(roomId)) {
      return;
    }

    try {
      const result = forceSkipActivePlayer(roomId, "jogador desconectado");
      if (result.skipped) {
        broadcastRoom(result.room);
      }
    } catch (error) {
      app.log.error({ err: error, roomId }, "Falha ao pular turno por desconexao.");
    }
  }, turnTimeoutMs);

  turnSkipTimers.set(roomId, timer);
}

function clearBotTurnTimer(roomId: string): void {
  const timer = botTurnTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    botTurnTimers.delete(roomId);
  }
}

function scheduleBotTurn(roomId: string): void {
  const roomBotTurnDelayMs = getBotTurnDelay(roomId) ?? botTurnDelayMs;
  if (roomBotTurnDelayMs < 0 || botTurnTimers.has(roomId) || !getActiveBotPlayer(roomId)) {
    return;
  }

  const timer = setTimeout(() => {
    botTurnTimers.delete(roomId);
    if (!getActiveBotPlayer(roomId)) {
      return;
    }

    try {
      const room = advanceBot(roomId);
      if (room) {
        broadcastRoom(room);
      }
    } catch (error) {
      app.log.error({ err: error, roomId }, "Falha ao executar turno de bot.");
    }
  }, roomBotTurnDelayMs);

  timer.unref();
  botTurnTimers.set(roomId, timer);
}

function clearAutomaticScoreTimer(roomId: string): void {
  const timer = automaticScoreTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    automaticScoreTimers.delete(roomId);
  }
}

function scheduleAutomaticScore(roomId: string): void {
  if (automaticScoreDelayMs < 0 || automaticScoreTimers.has(roomId) || !getAutomaticScorePlayer(roomId)) {
    return;
  }

  const timer = setTimeout(() => {
    automaticScoreTimers.delete(roomId);
    if (!getAutomaticScorePlayer(roomId)) {
      return;
    }

    try {
      const room = advanceAutomaticScore(roomId);
      if (room) {
        broadcastRoom(room);
      }
    } catch (error) {
      app.log.error({ err: error, roomId }, "Falha ao pontuar acao automatica.");
    }
  }, automaticScoreDelayMs);

  timer.unref();
  automaticScoreTimers.set(roomId, timer);
}

function clearTurnPunishmentTimer(roomId: string): void {
  const timer = turnPunishmentTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    turnPunishmentTimers.delete(roomId);
  }
}

// Records when the active turn began (resets only when the active player
// changes) and returns that timestamp for the client countdown.
function trackActiveTurn(room: PublicRoomState): number | null {
  const activePlayerId = room.game?.status === "active" ? room.game.activePlayerId : null;
  if (!activePlayerId) {
    turnStartByRoom.delete(room.roomId);
    return null;
  }

  const existing = turnStartByRoom.get(room.roomId);
  if (!existing || existing.playerId !== activePlayerId) {
    const entry = { playerId: activePlayerId, at: Date.now() };
    turnStartByRoom.set(room.roomId, entry);
    return entry.at;
  }

  return existing.at;
}

function reconcileTurnPunishmentTimer(roomId: string): void {
  clearTurnPunishmentTimer(roomId);

  const turnTimerMs = getTurnTimerMs(roomId);
  if (!turnTimerMs || turnTimerMs <= 0) {
    return;
  }

  const humanPlayerId = getActiveHumanPlayer(roomId);
  if (!humanPlayerId) {
    return;
  }

  const started = turnStartByRoom.get(roomId);
  const elapsed = started && started.playerId === humanPlayerId ? Date.now() - started.at : 0;
  const remaining = Math.max(0, turnTimerMs - elapsed);

  const timer = setTimeout(() => {
    turnPunishmentTimers.delete(roomId);
    if (getActiveHumanPlayer(roomId) !== humanPlayerId || !getTurnTimerMs(roomId)) {
      return;
    }

    try {
      const result = advanceTurnTimeoutBot(roomId, humanPlayerId);
      if (result.ended) {
        broadcastRoom(result.room);
      }
    } catch (error) {
      app.log.error({ err: error, roomId }, "Falha ao resolver turno por tempo esgotado.");
    }
  }, remaining);

  timer.unref();
  turnPunishmentTimers.set(roomId, timer);
}

function clearScenarioVotingTimer(roomId: string): void {
  const timer = scenarioVotingTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    scenarioVotingTimers.delete(roomId);
  }
}

function scheduleScenarioVotingDeadline(room: PublicRoomState): void {
  clearScenarioVotingTimer(room.roomId);
  if (room.status !== "scenario_voting" || !room.scenarioVoting) return;
  const remaining = Math.max(0, room.scenarioVoting.deadline - Date.now());
  const timer = setTimeout(() => {
    scenarioVotingTimers.delete(room.roomId);
    try {
      const finalized = finalizeScenarioVoting(room.roomId);
      broadcastRoom(finalized);
    } catch (error) {
      app.log.error({ err: error, roomId: room.roomId }, "Falha ao finalizar votacao de cenarios.");
    }
  }, remaining);
  timer.unref();
  scenarioVotingTimers.set(room.roomId, timer);
}

function broadcastRoom(room: PublicRoomState): void {
  room.activeTurnStartedAt = trackActiveTurn(room);
  io.to(room.roomId).emit("room:update", room);
  scheduleRoomSave(room);
  reconcileTurnTimer(room.roomId);
  if (room.status === "finished") {
    clearBotTurnTimer(room.roomId);
    clearAutomaticScoreTimer(room.roomId);
    clearTurnPunishmentTimer(room.roomId);
    clearScenarioVotingTimer(room.roomId);
    turnStartByRoom.delete(room.roomId);
    return;
  }
  if (room.status === "scenario_voting") {
    scheduleScenarioVotingDeadline(room);
  } else {
    clearScenarioVotingTimer(room.roomId);
  }
  scheduleAutomaticScore(room.roomId);
  scheduleBotTurn(room.roomId);
  reconcileTurnPunishmentTimer(room.roomId);
}

function scheduleRoomSave(room: PublicRoomState): void {
  pendingRoomSaves.set(room.roomId, room);

  if (roomSaveTimer) {
    return;
  }

  roomSaveTimer = setTimeout(flushPendingRoomSaves, 250);
  roomSaveTimer.unref();
}

function flushPendingRoomSaves(): void {
  roomSaveTimer = null;
  const roomsToSave = [...pendingRoomSaves.values()];
  pendingRoomSaves.clear();

  for (const room of roomsToSave) {
    saveRoom(room);
  }
}

io.on("connection", (socket) => {
  const playerId = getPlayerId(socket);
  registerSocket(playerId, socket.id);

  socket.emit("connected", { playerId });

  socket.on("presence:ping", (payload: { roomId?: string } | undefined, reply) => {
    withReply(reply, () => ({
      ok: true,
      roomId: typeof payload?.roomId === "string" ? payload.roomId : null,
      now: Date.now()
    }));
  });

  socket.on("rooms:list", (_payload: unknown, reply) => {
    withReply(reply, () => listOpenRooms());
  });

  socket.on("room:create", (payload: { name: string; password?: string | null }, reply) => {
    withReply(reply, () => {
      const room = createRoom(playerId, payload.name, payload.password);
      socket.join(room.roomId);
      scheduleRoomSave(room);
      return room;
    });
  });

  socket.on("room:join", (payload: { roomId: string; name: string; password?: string | null }, reply) => {
    withReply(reply, () => {
      const room = joinRoom(payload.roomId, playerId, payload.name, payload.password);
      socket.join(room.roomId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("room:spectate", (payload: { roomId: string; password?: string | null }, reply) => {
    withReply(reply, () => {
      const room = spectateRoom(payload.roomId, playerId, payload.password);
      socket.join(room.roomId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("room:leave", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = leaveRoom(payload.roomId, playerId);
      socket.leave(room.roomId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("room:quit", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = quitRoom(payload.roomId, playerId);
      socket.leave(payload.roomId);
      if (room) {
        broadcastRoom(room);
        return room;
      }
      return { roomId: payload.roomId, status: "closed" as const };
    });
  });

  socket.on("room:kick", (payload: { roomId: string; targetPlayerId: string }, reply) => {
    withReply(reply, () => {
      const room = kickPlayer(payload.roomId, playerId, payload.targetPlayerId);
      const targetSockets = socketsByPlayerId.get(payload.targetPlayerId);
      if (targetSockets) {
        for (const socketId of targetSockets) {
          const s = io.sockets.sockets.get(socketId);
          if (s) {
            s.leave(payload.roomId);
            s.emit("room:kicked", { roomId: payload.roomId });
          }
        }
      }
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("player:rename", (payload: { roomId: string; name: string }, reply) => {
    withReply(reply, () => {
      const room = renamePlayer(payload.roomId, playerId, payload.name);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("room:get", (payload: { roomId: string }, reply) => {
    withReply(reply, () => getPublicRoom(payload.roomId));
  });

  socket.on("bots:add", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = addBots(payload.roomId, playerId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("bots:remove", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = removeBots(payload.roomId, playerId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("bots:add-species", (payload: { roomId: string; speciesId: SpeciesId }, reply) => {
    withReply(reply, () => {
      const room = addBotForSpecies(payload.roomId, playerId, payload.speciesId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("bots:remove-species", (payload: { roomId: string; speciesId: SpeciesId }, reply) => {
    withReply(reply, () => {
      const room = removeBotForSpecies(payload.roomId, playerId, payload.speciesId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("bots:speed", (payload: { roomId: string; delayMs: number }, reply) => {
    withReply(reply, () => {
      const room = setBotTurnDelay(payload.roomId, playerId, payload.delayMs);
      clearBotTurnTimer(room.roomId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("turn-timer:set", (payload: { roomId: string; turnTimerMs: number | null }, reply) => {
    withReply(reply, () => {
      const room = setTurnTimer(payload.roomId, playerId, payload.turnTimerMs);
      clearTurnPunishmentTimer(room.roomId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("mini-expansion:set", (payload: { roomId: string; expansionId: MiniExpansionId; enabled: boolean }, reply) => {
    withReply(reply, () => {
      const room = setMiniExpansion(payload.roomId, playerId, payload.expansionId, payload.enabled);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("scenario:selection-mode", (payload: { roomId: string; mode: "vote" | "host" }, reply) => {
    withReply(reply, () => {
      const room = setScenarioSelectionMode(payload.roomId, playerId, payload.mode);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("scenario:count", (payload: { roomId: string; scenarioCount: ScenarioCount }, reply) => {
    withReply(reply, () => {
      const room = setScenarioCount(payload.roomId, playerId, payload.scenarioCount);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("scenario:host-select", (payload: { roomId: string; scenarioIds: ScenarioCardId[] }, reply) => {
    withReply(reply, () => {
      const room = setHostSelectedScenarios(payload.roomId, playerId, payload.scenarioIds);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("species:select", (payload: { roomId: string; speciesId: SpeciesId }, reply) => {
    withReply(reply, () => {
      const room = selectSpecies(payload.roomId, playerId, payload.speciesId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("player:ready", (payload: { roomId: string; ready: boolean }, reply) => {
    withReply(reply, () => {
      const room = setReady(payload.roomId, playerId, payload.ready);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("game:start", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = startGame(payload.roomId, playerId);
      broadcastRoom(room);
      if (room.status === "scenario_voting" && isScenarioVotingComplete(room.roomId)) {
        const finalized = finalizeScenarioVoting(room.roomId);
        broadcastRoom(finalized);
        return finalized;
      }
      return room;
    });
  });

  socket.on("scenario:caatinga-collect", (payload: { roomId: string; mode?: "gain" | "lose" | "skip" }, reply) => {
    withReply(reply, () => {
      const room = collectCaatinga(payload.roomId, playerId, payload.mode ?? "gain");
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("scenario:mata-atlantica-discard", (payload: { roomId: string; cardId: string }, reply) => {
    withReply(reply, () => {
      const room = discardMataAtlanticaCard(payload.roomId, playerId, payload.cardId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("scenario:vote", (payload: { roomId: string; votes: ScenarioCardId[] }, reply) => {
    withReply(reply, () => {
      const room = castScenarioVote(payload.roomId, playerId, payload.votes);
      broadcastRoom(room);
      if (isScenarioVotingComplete(room.roomId)) {
        const finalized = finalizeScenarioVoting(room.roomId);
        broadcastRoom(finalized);
        return finalized;
      }
      return room;
    });
  });

  socket.on("objective:select", (payload: { roomId: string; objectiveCardId: string }, reply) => {
    withReply(reply, () => {
      const room = chooseObjective(payload.roomId, playerId, payload.objectiveCardId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("setup:place-piece", (payload: { roomId: string; x: number; y: number }, reply) => {
    withReply(reply, () => {
      const room = placeSetupPiece(payload.roomId, playerId, payload.x, payload.y);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on(
    "forest:place-card",
    (payload: { roomId: string; cardId: string; x: number; y: number; rotation: 0 | 90 | 180 | 270 }, reply) => {
      withReply(reply, () => {
        const room = placeCardInForest(payload.roomId, playerId, payload.cardId, payload.x, payload.y, payload.rotation);
        broadcastRoom(room);
        return room;
      });
    }
  );

  socket.on("action:complete", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = completeAction(payload.roomId, playerId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("coati:add", (payload: { roomId: string; x: number; y: number }, reply) => {
    withReply(reply, () => {
      const room = addCoati(payload.roomId, playerId, payload.x, payload.y);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("coati:resolve-pair", (payload: { roomId: string; x: number; y: number }, reply) => {
    withReply(reply, () => {
      const room = resolveCoatiPair(payload.roomId, playerId, payload.x, payload.y);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("capuchin:add", (payload: { roomId: string; x: number; y: number }, reply) => {
    withReply(reply, () => {
      const room = addCapuchin(payload.roomId, playerId, payload.x, payload.y);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("macaw:add", (payload: { roomId: string; x: number; y: number }, reply) => {
    withReply(reply, () => {
      const room = addMacaw(payload.roomId, playerId, payload.x, payload.y);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("armadillo:add", (payload: { roomId: string; x: number; y: number }, reply) => {
    withReply(reply, () => {
      const room = addArmadillo(payload.roomId, playerId, payload.x, payload.y);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("wolf:add", (payload: { roomId: string; x: number; y: number }, reply) => {
    withReply(reply, () => {
      const room = addWolf(payload.roomId, playerId, payload.x, payload.y);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("piece:move", (payload: { roomId: string; pieceId: string; targetPieceId?: string; x: number; y: number }, reply) => {
    withReply(reply, () => {
      const room = movePiece(payload.roomId, playerId, payload.pieceId, payload.x, payload.y, payload.targetPieceId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("pieces:remove", (payload: { roomId: string; pieceIds: string[] }, reply) => {
    withReply(reply, () => {
      const room = removePieces(payload.roomId, playerId, payload.pieceIds);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("jaguar:spend-meat", (payload: { roomId: string; count: number }, reply) => {
    withReply(reply, () => {
      const room = spendJaguarMeat(payload.roomId, playerId, payload.count);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("capuchin:score", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = scoreCapuchin(payload.roomId, playerId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("macaw:score", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = scoreMacaw(payload.roomId, playerId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("armadillo:hide", (payload: { roomId: string; pieceId: string }, reply) => {
    withReply(reply, () => {
      const room = hideArmadillo(payload.roomId, playerId, payload.pieceId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("armadillo:score", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = scoreArmadillo(payload.roomId, playerId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("wolf:remove-base", (payload: { roomId: string; pieceId: string }, reply) => {
    withReply(reply, () => {
      const room = removeWolfBasePiece(payload.roomId, playerId, payload.pieceId);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("wolf:spend-resources", (payload: { roomId: string; resources: Array<"meat" | "egg" | "fruit" | "seed"> }, reply) => {
    withReply(reply, () => {
      const room = spendWolfResources(payload.roomId, playerId, payload.resources);
      broadcastRoom(room);
      return room;
    });
  });

  socket.on("disconnect", () => {
    unregisterSocket(playerId, socket.id);
    if (hasActiveSocket(playerId)) {
      return;
    }

    for (const room of leaveRooms(playerId)) {
      broadcastRoom(room);
    }
  });
});

function withReply<T>(reply: unknown, fn: () => T): void {
  const send = typeof reply === "function" ? reply : undefined;

  try {
    send?.({ ok: true, data: fn() });
  } catch (error) {
    send?.({ ok: false, error: error instanceof Error ? error.message : "Erro desconhecido." });
  }
}

const roomMaxAgeMs = Number(process.env.ROOM_MAX_AGE_MS ?? 24 * 60 * 60 * 1000);
const roomPurgeIntervalMs = 60 * 60 * 1000;
const purgeTimer = setInterval(() => {
  flushPendingRoomSaves();
  const removed = purgeRoomsOlderThan(roomMaxAgeMs);
  if (removed > 0) {
    app.log.info({ removed }, "Salas antigas removidas do armazenamento.");
  }
}, roomPurgeIntervalMs);
purgeTimer.unref();

process.once("SIGINT", () => {
  flushPendingRoomSaves();
  process.exit(0);
});

process.once("SIGTERM", () => {
  flushPendingRoomSaves();
  process.exit(0);
});

await app.ready();
await app.listen({ port, host: "0.0.0.0" });

function getPlayerId(socket: { handshake: { auth: Record<string, unknown> }; id: string }): string {
  const authPlayerId = socket.handshake.auth.playerId;
  return typeof authPlayerId === "string" && authPlayerId.trim().length >= 12 ? authPlayerId : socket.id;
}

function registerSocket(playerId: string, socketId: string): void {
  const sockets = socketsByPlayerId.get(playerId) ?? new Set<string>();
  sockets.add(socketId);
  socketsByPlayerId.set(playerId, sockets);
}

function unregisterSocket(playerId: string, socketId: string): void {
  const sockets = socketsByPlayerId.get(playerId);
  if (!sockets) {
    return;
  }

  sockets.delete(socketId);
  if (sockets.size === 0) {
    socketsByPlayerId.delete(playerId);
  }
}

function hasActiveSocket(playerId: string): boolean {
  return Boolean(socketsByPlayerId.get(playerId)?.size);
}
