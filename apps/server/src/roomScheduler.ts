import type { FastifyBaseLogger } from "fastify";
import type { Server } from "socket.io";
import type { PublicRoomState } from "@oikos/shared";
import { projectRoomForViewer } from "./projection";
import { deleteRoom, saveRoom } from "./store";
import {
  advanceAutomaticScore,
  advanceBot,
  advanceTurnTimeoutBot,
  finalizeScenarioVoting,
  forceSkipActivePlayer,
  getActiveBotPlayer,
  getActiveDisconnectedPlayer,
  getActiveHumanPlayer,
  getAutomaticScorePlayer,
  getBotTurnDelay,
  getTurnTimerMs,
  hasRoom
} from "./rooms";

export interface RoomSchedulerOptions {
  io: Server;
  log: FastifyBaseLogger;
  turnTimeoutMs: number;
  botTurnDelayMs: number;
  automaticScoreDelayMs: number;
}

// Owns every per-room timer (disconnect skip, bot turn, automatic score, turn
// punishment, scenario voting deadline) plus the debounced room persistence and
// the central broadcastRoom orchestration. Pulled out of the server entrypoint
// so index.ts keeps only socket wiring. Behavior is unchanged: same maps, same
// timer logic, same broadcast sequence.
export class RoomScheduler {
  private readonly io: Server;
  private readonly log: FastifyBaseLogger;
  private readonly turnTimeoutMs: number;
  private readonly botTurnDelayMs: number;
  private readonly automaticScoreDelayMs: number;

  private readonly turnSkipTimers = new Map<string, NodeJS.Timeout>();
  private readonly botTurnTimers = new Map<string, NodeJS.Timeout>();
  private readonly automaticScoreTimers = new Map<string, NodeJS.Timeout>();
  private readonly turnPunishmentTimers = new Map<string, NodeJS.Timeout>();
  private readonly scenarioVotingTimers = new Map<string, NodeJS.Timeout>();
  // Tracks when the current active turn began, per room, so clients can render a
  // countdown and the punishment timer fires at the right moment.
  private readonly turnStartByRoom = new Map<string, { playerId: string; at: number }>();
  private readonly pendingRoomSaves = new Map<string, PublicRoomState>();
  private roomSaveTimer: NodeJS.Timeout | null = null;

  constructor(options: RoomSchedulerOptions) {
    this.io = options.io;
    this.log = options.log;
    this.turnTimeoutMs = options.turnTimeoutMs;
    this.botTurnDelayMs = options.botTurnDelayMs;
    this.automaticScoreDelayMs = options.automaticScoreDelayMs;
  }

  private clearTurnSkipTimer(roomId: string): void {
    const timer = this.turnSkipTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnSkipTimers.delete(roomId);
    }
  }

  private reconcileTurnTimer(roomId: string): void {
    this.clearTurnSkipTimer(roomId);

    if (this.turnTimeoutMs <= 0) {
      return;
    }

    const disconnectedPlayerId = getActiveDisconnectedPlayer(roomId);
    if (!disconnectedPlayerId) {
      return;
    }

    const timer = setTimeout(() => {
      this.turnSkipTimers.delete(roomId);
      if (!getActiveDisconnectedPlayer(roomId)) {
        return;
      }

      try {
        const result = forceSkipActivePlayer(roomId, "jogador desconectado");
        if (result.skipped) {
          this.broadcastRoom(result.room);
        }
      } catch (error) {
        this.log.error({ err: error, roomId }, "Falha ao pular turno por desconexao.");
      }
    }, this.turnTimeoutMs);

    this.turnSkipTimers.set(roomId, timer);
  }

  clearBotTurnTimer(roomId: string): void {
    const timer = this.botTurnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.botTurnTimers.delete(roomId);
    }
  }

  private scheduleBotTurn(roomId: string): void {
    const roomBotTurnDelayMs = getBotTurnDelay(roomId) ?? this.botTurnDelayMs;
    if (roomBotTurnDelayMs < 0 || this.botTurnTimers.has(roomId) || !getActiveBotPlayer(roomId)) {
      return;
    }

    const timer = setTimeout(() => {
      this.botTurnTimers.delete(roomId);
      if (!getActiveBotPlayer(roomId)) {
        return;
      }

      try {
        const room = advanceBot(roomId);
        if (room) {
          this.broadcastRoom(room);
        }
      } catch (error) {
        this.log.error({ err: error, roomId }, "Falha ao executar turno de bot.");
      }
    }, roomBotTurnDelayMs);

    timer.unref();
    this.botTurnTimers.set(roomId, timer);
  }

  private clearAutomaticScoreTimer(roomId: string): void {
    const timer = this.automaticScoreTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.automaticScoreTimers.delete(roomId);
    }
  }

  private scheduleAutomaticScore(roomId: string): void {
    if (this.automaticScoreDelayMs < 0 || this.automaticScoreTimers.has(roomId) || !getAutomaticScorePlayer(roomId)) {
      return;
    }

    const timer = setTimeout(() => {
      this.automaticScoreTimers.delete(roomId);
      if (!getAutomaticScorePlayer(roomId)) {
        return;
      }

      try {
        const room = advanceAutomaticScore(roomId);
        if (room) {
          this.broadcastRoom(room);
        }
      } catch (error) {
        this.log.error({ err: error, roomId }, "Falha ao pontuar acao automatica.");
      }
    }, this.automaticScoreDelayMs);

    timer.unref();
    this.automaticScoreTimers.set(roomId, timer);
  }

  clearTurnPunishmentTimer(roomId: string): void {
    const timer = this.turnPunishmentTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnPunishmentTimers.delete(roomId);
    }
  }

  // Records when the active turn began (resets only when the active player
  // changes) and returns that timestamp for the client countdown.
  private trackActiveTurn(room: PublicRoomState): number | null {
    const activePlayerId = room.game?.status === "active" ? room.game.activePlayerId : null;
    if (!activePlayerId) {
      this.turnStartByRoom.delete(room.roomId);
      return null;
    }

    const existing = this.turnStartByRoom.get(room.roomId);
    if (!existing || existing.playerId !== activePlayerId) {
      const entry = { playerId: activePlayerId, at: Date.now() };
      this.turnStartByRoom.set(room.roomId, entry);
      return entry.at;
    }

    return existing.at;
  }

  private reconcileTurnPunishmentTimer(roomId: string): void {
    this.clearTurnPunishmentTimer(roomId);

    const turnTimerMs = getTurnTimerMs(roomId);
    if (!turnTimerMs || turnTimerMs <= 0) {
      return;
    }

    const humanPlayerId = getActiveHumanPlayer(roomId);
    if (!humanPlayerId) {
      return;
    }

    const started = this.turnStartByRoom.get(roomId);
    const elapsed = started && started.playerId === humanPlayerId ? Date.now() - started.at : 0;
    const remaining = Math.max(0, turnTimerMs - elapsed);

    const timer = setTimeout(() => {
      this.turnPunishmentTimers.delete(roomId);
      if (getActiveHumanPlayer(roomId) !== humanPlayerId || !getTurnTimerMs(roomId)) {
        return;
      }

      try {
        const result = advanceTurnTimeoutBot(roomId, humanPlayerId);
        if (result.ended) {
          this.broadcastRoom(result.room);
        }
      } catch (error) {
        this.log.error({ err: error, roomId }, "Falha ao resolver turno por tempo esgotado.");
      }
    }, remaining);

    timer.unref();
    this.turnPunishmentTimers.set(roomId, timer);
  }

  private clearScenarioVotingTimer(roomId: string): void {
    const timer = this.scenarioVotingTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.scenarioVotingTimers.delete(roomId);
    }
  }

  private scheduleScenarioVotingDeadline(room: PublicRoomState): void {
    this.clearScenarioVotingTimer(room.roomId);
    if (room.status !== "scenario_voting" || !room.scenarioVoting) return;
    const remaining = Math.max(0, room.scenarioVoting.deadline - Date.now());
    const timer = setTimeout(() => {
      this.scenarioVotingTimers.delete(room.roomId);
      try {
        const finalized = finalizeScenarioVoting(room.roomId);
        this.broadcastRoom(finalized);
      } catch (error) {
        this.log.error({ err: error, roomId: room.roomId }, "Falha ao finalizar votacao de cenarios.");
      }
    }, remaining);
    timer.unref();
    this.scenarioVotingTimers.set(room.roomId, timer);
  }

  broadcastRoom(room: PublicRoomState): void {
    room.activeTurnStartedAt = this.trackActiveTurn(room);
    this.emitRoomUpdateProjected(room);
    this.scheduleRoomSave(room);
    this.reconcileTurnTimer(room.roomId);
    if (room.status === "finished") {
      this.clearBotTurnTimer(room.roomId);
      this.clearAutomaticScoreTimer(room.roomId);
      this.clearTurnPunishmentTimer(room.roomId);
      this.clearScenarioVotingTimer(room.roomId);
      this.turnStartByRoom.delete(room.roomId);
      return;
    }
    if (room.status === "scenario_voting") {
      this.scheduleScenarioVotingDeadline(room);
    } else {
      this.clearScenarioVotingTimer(room.roomId);
    }
    this.scheduleAutomaticScore(room.roomId);
    this.scheduleBotTurn(room.roomId);
    this.reconcileTurnPunishmentTimer(room.roomId);
  }

  // Emits "room:update" individually per connected socket so each player only
  // receives their own projection of the state (own hand, redacted decks). The
  // projection is cached per viewer because a player can have multiple sockets.
  private emitRoomUpdateProjected(room: PublicRoomState): void {
    const socketIds = this.io.sockets.adapter.rooms.get(room.roomId);
    if (!socketIds) {
      return;
    }

    const viewCache = new Map<string | null, PublicRoomState>();
    for (const socketId of socketIds) {
      const target = this.io.sockets.sockets.get(socketId);
      if (!target) {
        continue;
      }

      const viewerId = typeof target.data.playerId === "string" ? target.data.playerId : null;
      let view = viewCache.get(viewerId);
      if (!view) {
        view = projectRoomForViewer(room, viewerId);
        viewCache.set(viewerId, view);
      }
      target.emit("room:update", view);
    }
  }

  scheduleRoomSave(room: PublicRoomState): void {
    this.pendingRoomSaves.set(room.roomId, room);

    if (this.roomSaveTimer) {
      return;
    }

    this.roomSaveTimer = setTimeout(() => this.flushPendingRoomSaves(), 250);
    this.roomSaveTimer.unref();
  }

  flushPendingRoomSaves(): void {
    this.roomSaveTimer = null;
    const roomsToSave = [...this.pendingRoomSaves.values()];
    this.pendingRoomSaves.clear();

    for (const room of roomsToSave) {
      if (hasRoom(room.roomId)) {
        saveRoom(room);
      } else {
        deleteRoom(room.roomId);
      }
    }
  }
}
