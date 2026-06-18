import "./env";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { Server } from "socket.io";
import type { MiniExpansionId, PublicRoomState, Resource, ScenarioCardId, ScenarioCount, SpeciesId } from "@oikos/shared";
import { getUserIdFromAccessToken } from "./auth";
import { projectRoomForViewer } from "./projection";
import { canUseSpecies } from "./speciesAccess";
import { purgeRoomsOlderThan } from "./store";
import { RoomScheduler } from "./roomScheduler";
import {
  addBots,
  addBotForSpecies,
  removeBotForSpecies,
  addArmadillo,
  addCapuchin,
  addCoati,
  addGalo,
  addMacaw,
  addWolf,
  completeAction,
  createRoom,
  setTurnTimer,
  chooseObjective,
  discardObjective,
  resolveExtraTurn,
  resolveSeedSpend,
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
  resolveGaloInterrupt,
  resolveCoatiPair,
  removeBots,
  scoreCapuchin,
  scoreGalo,
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
  collectCerrado,
  discardMataAtlanticaCard,
  resolveCacaIlegalThreat
} from "./rooms";

const port = Number(process.env.PORT ?? 4173);
const app = Fastify({ logger: true });
const configuredOrigin = process.env.CLIENT_ORIGIN;
const allowedOrigin = configuredOrigin && configuredOrigin !== "true" ? configuredOrigin : true;
const socketsByPlayerId = new Map<string, Set<string>>();
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

const scheduler = new RoomScheduler({
  io,
  log: app.log,
  turnTimeoutMs,
  botTurnDelayMs,
  automaticScoreDelayMs
});

io.use(async (socket, next) => {
  try {
    const accessToken = socket.handshake.auth.accessToken;
    if (typeof accessToken !== "string" || accessToken.trim().length < 20) {
      next(new Error("Login obrigatorio."));
      return;
    }

    socket.data.playerId = await getUserIdFromAccessToken(accessToken);
    next();
  } catch (error) {
    app.log.warn({ err: error }, "Falha ao autenticar socket.");
    next(new Error("Sessao invalida. Entre novamente."));
  }
});

io.on("connection", (socket) => {
  const playerId = getPlayerId(socket);
  registerSocket(playerId, socket.id);

  // Every handler below replies through these wrappers, which rate-limit the
  // socket and project room-shaped payloads for this player's eyes only.
  const allowEvent = createRateLimiter();
  const withReply = <T>(reply: unknown, fn: () => T): void => {
    if (!allowEvent()) {
      sendRateLimited(reply);
      return;
    }
    sendReply(reply, playerId, fn);
  };
  const withReplyAsync = async <T>(reply: unknown, fn: () => Promise<T>): Promise<void> => {
    if (!allowEvent()) {
      sendRateLimited(reply);
      return;
    }
    await sendReplyAsync(reply, playerId, fn);
  };

  // Most game actions share one shape: run a rooms.ts mutator, broadcast the new
  // state, and return it through withReply. onRoomAction registers exactly that,
  // so each handler below collapses to its event name plus the mutator call.
  const onRoomAction = <P>(event: string, run: (payload: P, actingPlayerId: string) => PublicRoomState): void => {
    socket.on(event, (payload: P, reply: unknown) => {
      withReply(reply, () => {
        const room = run(payload, playerId);
        scheduler.broadcastRoom(room);
        return room;
      });
    });
  };

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
      scheduler.scheduleRoomSave(room);
      return room;
    });
  });

  socket.on("room:join", (payload: { roomId: string; name: string; password?: string | null }, reply) => {
    withReply(reply, () => {
      const room = joinRoom(payload.roomId, playerId, payload.name, payload.password);
      socket.join(room.roomId);
      scheduler.broadcastRoom(room);
      return room;
    });
  });

  socket.on("room:spectate", (payload: { roomId: string; password?: string | null }, reply) => {
    withReply(reply, () => {
      const room = spectateRoom(payload.roomId, playerId, payload.password);
      socket.join(room.roomId);
      scheduler.broadcastRoom(room);
      return room;
    });
  });

  socket.on("room:leave", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = leaveRoom(payload.roomId, playerId);
      socket.leave(room.roomId);
      scheduler.broadcastRoom(room);
      return room;
    });
  });

  socket.on("room:quit", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = quitRoom(payload.roomId, playerId);
      socket.leave(payload.roomId);
      if (room) {
        scheduler.broadcastRoom(room);
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
      scheduler.broadcastRoom(room);
      return room;
    });
  });

  onRoomAction("player:rename", (p: { roomId: string; name: string }, pid) => renamePlayer(p.roomId, pid, p.name));

  socket.on("room:get", (payload: { roomId: string }, reply) => {
    withReply(reply, () => getPublicRoom(payload.roomId));
  });

  onRoomAction("bots:add", (p: { roomId: string }, pid) => addBots(p.roomId, pid));
  onRoomAction("bots:remove", (p: { roomId: string }, pid) => removeBots(p.roomId, pid));
  onRoomAction("bots:add-species", (p: { roomId: string; speciesId: SpeciesId }, pid) => addBotForSpecies(p.roomId, pid, p.speciesId));
  onRoomAction("bots:remove-species", (p: { roomId: string; speciesId: SpeciesId }, pid) => removeBotForSpecies(p.roomId, pid, p.speciesId));

  socket.on("bots:speed", (payload: { roomId: string; delayMs: number }, reply) => {
    withReply(reply, () => {
      const room = setBotTurnDelay(payload.roomId, playerId, payload.delayMs);
      scheduler.clearBotTurnTimer(room.roomId);
      scheduler.broadcastRoom(room);
      return room;
    });
  });

  socket.on("turn-timer:set", (payload: { roomId: string; turnTimerMs: number | null }, reply) => {
    withReply(reply, () => {
      const room = setTurnTimer(payload.roomId, playerId, payload.turnTimerMs);
      scheduler.clearTurnPunishmentTimer(room.roomId);
      scheduler.broadcastRoom(room);
      return room;
    });
  });

  onRoomAction("mini-expansion:set", (p: { roomId: string; expansionId: MiniExpansionId; enabled: boolean }, pid) => setMiniExpansion(p.roomId, pid, p.expansionId, p.enabled));
  onRoomAction("scenario:selection-mode", (p: { roomId: string; mode: "vote" | "host" }, pid) => setScenarioSelectionMode(p.roomId, pid, p.mode));
  onRoomAction("scenario:count", (p: { roomId: string; scenarioCount: ScenarioCount }, pid) => setScenarioCount(p.roomId, pid, p.scenarioCount));
  onRoomAction("scenario:host-select", (p: { roomId: string; scenarioIds: ScenarioCardId[] }, pid) => setHostSelectedScenarios(p.roomId, pid, p.scenarioIds));

  socket.on("species:select", (payload: { roomId: string; speciesId: SpeciesId }, reply) => {
    void withReplyAsync(reply, async () => {
      if (!(await canUseSpecies(playerId, payload.speciesId))) {
        throw new Error("Especie nao liberada para sua conta.");
      }

      const room = selectSpecies(payload.roomId, playerId, payload.speciesId);
      scheduler.broadcastRoom(room);
      return room;
    });
  });

  onRoomAction("player:ready", (p: { roomId: string; ready: boolean }, pid) => setReady(p.roomId, pid, p.ready));

  socket.on("game:start", (payload: { roomId: string }, reply) => {
    withReply(reply, () => {
      const room = startGame(payload.roomId, playerId);
      scheduler.broadcastRoom(room);
      if (room.status === "scenario_voting" && isScenarioVotingComplete(room.roomId)) {
        const finalized = finalizeScenarioVoting(room.roomId);
        scheduler.broadcastRoom(finalized);
        return finalized;
      }
      return room;
    });
  });

  onRoomAction("scenario:caatinga-collect", (p: { roomId: string; mode?: "gain" | "lose" | "skip" }, pid) => collectCaatinga(p.roomId, pid, p.mode ?? "gain"));
  onRoomAction("scenario:cerrado-collect", (p: { roomId: string; mode?: "collect" | "skip" }, pid) => collectCerrado(p.roomId, pid, p.mode ?? "collect"));
  onRoomAction("scenario:mata-atlantica-discard", (p: { roomId: string; cardId: string }, pid) => discardMataAtlanticaCard(p.roomId, pid, p.cardId));
  onRoomAction(
    "threat:caca-ilegal-resolve",
    (
      p:
        | { roomId: string; kind: "remove_piece"; pieceId: string }
        | { roomId: string; kind: "spend_resource"; resource: Resource },
      pid
    ) => {
      const choice =
        p.kind === "remove_piece"
          ? { kind: "remove_piece" as const, pieceId: p.pieceId }
          : { kind: "spend_resource" as const, resource: p.resource };
      return resolveCacaIlegalThreat(p.roomId, pid, choice);
    }
  );

  socket.on("scenario:vote", (payload: { roomId: string; votes: ScenarioCardId[] }, reply) => {
    withReply(reply, () => {
      const room = castScenarioVote(payload.roomId, playerId, payload.votes);
      scheduler.broadcastRoom(room);
      if (isScenarioVotingComplete(room.roomId)) {
        const finalized = finalizeScenarioVoting(room.roomId);
        scheduler.broadcastRoom(finalized);
        return finalized;
      }
      return room;
    });
  });

  onRoomAction("objective:select", (p: { roomId: string; objectiveCardId: string }, pid) => chooseObjective(p.roomId, pid, p.objectiveCardId));
  onRoomAction("objective:discard", (p: { roomId: string }, pid) => discardObjective(p.roomId, pid));
  onRoomAction("objective:extra-turn", (p: { roomId: string; accept: boolean }, pid) => resolveExtraTurn(p.roomId, pid, p.accept));
  onRoomAction("objective:seed-spend", (p: { roomId: string; accept: boolean }, pid) => resolveSeedSpend(p.roomId, pid, p.accept));
  onRoomAction("setup:place-piece", (p: { roomId: string; x: number; y: number }, pid) => placeSetupPiece(p.roomId, pid, p.x, p.y));
  onRoomAction(
    "forest:place-card",
    (p: { roomId: string; cardId: string; x: number; y: number; rotation: 0 | 90 | 180 | 270 }, pid) =>
      placeCardInForest(p.roomId, pid, p.cardId, p.x, p.y, p.rotation)
  );
  onRoomAction("action:complete", (p: { roomId: string }, pid) => completeAction(p.roomId, pid));
  onRoomAction("coati:add", (p: { roomId: string; x: number; y: number }, pid) => addCoati(p.roomId, pid, p.x, p.y));
  onRoomAction("galo:add", (p: { roomId: string; x: number; y: number }, pid) => addGalo(p.roomId, pid, p.x, p.y));
  onRoomAction("galo:resolve-interrupt", (p: { roomId: string; pieceId?: string; x: number; y: number }, pid) =>
    resolveGaloInterrupt(p.roomId, pid, p.x, p.y, p.pieceId)
  );
  onRoomAction("coati:resolve-pair", (p: { roomId: string; x: number; y: number }, pid) => resolveCoatiPair(p.roomId, pid, p.x, p.y));
  onRoomAction("capuchin:add", (p: { roomId: string; x: number; y: number }, pid) => addCapuchin(p.roomId, pid, p.x, p.y));
  onRoomAction("macaw:add", (p: { roomId: string; x: number; y: number }, pid) => addMacaw(p.roomId, pid, p.x, p.y));
  onRoomAction("armadillo:add", (p: { roomId: string; x: number; y: number }, pid) => addArmadillo(p.roomId, pid, p.x, p.y));
  onRoomAction("wolf:add", (p: { roomId: string; x: number; y: number }, pid) => addWolf(p.roomId, pid, p.x, p.y));
  onRoomAction("piece:move", (p: { roomId: string; pieceId: string; targetPieceId?: string; x: number; y: number }, pid) => movePiece(p.roomId, pid, p.pieceId, p.x, p.y, p.targetPieceId));
  onRoomAction("pieces:remove", (p: { roomId: string; pieceIds: string[] }, pid) => removePieces(p.roomId, pid, p.pieceIds));
  onRoomAction("jaguar:spend-meat", (p: { roomId: string; count: number }, pid) => spendJaguarMeat(p.roomId, pid, p.count));
  onRoomAction("capuchin:score", (p: { roomId: string }, pid) => scoreCapuchin(p.roomId, pid));
  onRoomAction("macaw:score", (p: { roomId: string }, pid) => scoreMacaw(p.roomId, pid));
  onRoomAction("galo:score", (p: { roomId: string }, pid) => scoreGalo(p.roomId, pid));
  onRoomAction("armadillo:hide", (p: { roomId: string; pieceId: string }, pid) => hideArmadillo(p.roomId, pid, p.pieceId));
  onRoomAction("armadillo:score", (p: { roomId: string }, pid) => scoreArmadillo(p.roomId, pid));
  onRoomAction("wolf:remove-base", (p: { roomId: string; pieceId: string }, pid) => removeWolfBasePiece(p.roomId, pid, p.pieceId));
  onRoomAction("wolf:spend-resources", (p: { roomId: string; resources: Array<"meat" | "egg" | "fruit" | "seed"> }, pid) => spendWolfResources(p.roomId, pid, p.resources));

  socket.on("disconnect", () => {
    unregisterSocket(playerId, socket.id);
    if (hasActiveSocket(playerId)) {
      return;
    }

    for (const room of leaveRooms(playerId)) {
      scheduler.broadcastRoom(room);
    }
  });
});

// Room-shaped reply payloads must go through the per-viewer projection so the
// acknowledgement a player receives never leaks other players' hands or deck
// order. Detected structurally because handlers return several payload types.
function isPublicRoomState(value: unknown): value is PublicRoomState {
  return (
    typeof value === "object" &&
    value !== null &&
    "roomId" in value &&
    "players" in value &&
    "game" in value
  );
}

function projectReplyData<T>(data: T, viewerPlayerId: string): T {
  if (isPublicRoomState(data)) {
    return projectRoomForViewer(data, viewerPlayerId) as T;
  }

  return data;
}

// Token-bucket rate limiter, one per socket. Generous for human play (bursts
// of clicks are fine) but stops a hostile client from flooding the server
// with event spam. Bots run server-side and are unaffected.
function createRateLimiter(capacity = 25, refillPerSecond = 10): () => boolean {
  let tokens = capacity;
  let lastRefill = Date.now();

  return () => {
    const now = Date.now();
    tokens = Math.min(capacity, tokens + ((now - lastRefill) / 1000) * refillPerSecond);
    lastRefill = now;
    if (tokens < 1) {
      return false;
    }
    tokens -= 1;
    return true;
  };
}

function sendRateLimited(reply: unknown): void {
  const send = typeof reply === "function" ? reply : undefined;
  send?.({ ok: false, error: "Muitas ações em sequência. Aguarde um instante." });
}

function sendReply<T>(reply: unknown, viewerPlayerId: string, fn: () => T): void {
  const send = typeof reply === "function" ? reply : undefined;

  try {
    send?.({ ok: true, data: projectReplyData(fn(), viewerPlayerId) });
  } catch (error) {
    send?.({ ok: false, error: error instanceof Error ? error.message : "Erro desconhecido." });
  }
}

async function sendReplyAsync<T>(reply: unknown, viewerPlayerId: string, fn: () => Promise<T>): Promise<void> {
  const send = typeof reply === "function" ? reply : undefined;

  try {
    send?.({ ok: true, data: projectReplyData(await fn(), viewerPlayerId) });
  } catch (error) {
    send?.({ ok: false, error: error instanceof Error ? error.message : "Erro desconhecido." });
  }
}

const roomMaxAgeMs = Number(process.env.ROOM_MAX_AGE_MS ?? 24 * 60 * 60 * 1000);
const roomPurgeIntervalMs = 60 * 60 * 1000;
const purgeTimer = setInterval(() => {
  scheduler.flushPendingRoomSaves();
  const removed = purgeRoomsOlderThan(roomMaxAgeMs);
  if (removed > 0) {
    app.log.info({ removed }, "Salas antigas removidas do armazenamento.");
  }
}, roomPurgeIntervalMs);
purgeTimer.unref();

process.once("SIGINT", () => {
  scheduler.flushPendingRoomSaves();
  process.exit(0);
});

process.once("SIGTERM", () => {
  scheduler.flushPendingRoomSaves();
  process.exit(0);
});

await app.ready();
await app.listen({ port, host: "0.0.0.0" });

function getPlayerId(socket: { data: { playerId?: unknown } }): string {
  const authPlayerId = socket.data.playerId;
  if (typeof authPlayerId === "string" && authPlayerId.trim().length > 0) {
    return authPlayerId;
  }

  throw new Error("Socket sem playerId autenticado.");
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
