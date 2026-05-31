import { io, type Socket } from "socket.io-client";
import type {
  ForestCardState,
  MiniExpansionId,
  PublicRoomState,
  Resource,
  RoomSummary,
  ScenarioCount,
  ScenarioCardId,
  ScenarioSelectionMode,
  SpeciesId
} from "@oikos/shared";

export interface SocketReply<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type OikosSocket = Socket;

const playerIdStorageKey = "oikos:player-id";
const serverUrlStorageKey = "oikos:server-url";

export function createSocket(): OikosSocket {
  return io(getServerUrl(), {
    auth: {
      playerId: getOrCreatePlayerId()
    },
    transports: ["websocket", "polling"],
    timeout: 8000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000
  });
}

function getServerUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const shouldClear = params.get("clearServer") === "1";
  if (shouldClear) {
    window.localStorage.removeItem(serverUrlStorageKey);
  }

  const queryServerUrl = params.get("server");
  if (queryServerUrl && /^https?:\/\//i.test(queryServerUrl)) {
    const normalized = queryServerUrl.replace(/\/$/, "");
    window.localStorage.setItem(serverUrlStorageKey, normalized);
    return normalized;
  }

  return window.localStorage.getItem(serverUrlStorageKey) ?? import.meta.env.VITE_SERVER_URL ?? "http://localhost:4173";
}

function getOrCreatePlayerId(): string {
  const existing = window.localStorage.getItem(playerIdStorageKey);
  if (existing) {
    return existing;
  }

  const next = `player_${crypto.randomUUID()}`;
  window.localStorage.setItem(playerIdStorageKey, next);
  return next;
}

export function emitWithReply<T>(socket: OikosSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      settled = true;
      reject(new Error("Tempo limite esgotado. Verifique a conexão e tente novamente."));
    }, 10000);

    socket.emit(event, payload, (reply: SocketReply<T>) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      if (reply.ok && reply.data) {
        resolve(reply.data);
        return;
      }

      reject(new Error(reply.error ?? "Erro desconhecido."));
    });
  });
}

export const roomApi = {
  ping: (socket: OikosSocket, roomId: string) => emitWithReply<{ ok: true; roomId: string | null; now: number }>(socket, "presence:ping", { roomId }),
  listRooms: (socket: OikosSocket) => emitWithReply<RoomSummary[]>(socket, "rooms:list", {}),
  create: (socket: OikosSocket, name: string, password?: string | null) =>
    emitWithReply<PublicRoomState>(socket, "room:create", { name, password }),
  join: (socket: OikosSocket, roomId: string, name: string, password?: string | null) =>
    emitWithReply<PublicRoomState>(socket, "room:join", { roomId, name, password }),
  spectate: (socket: OikosSocket, roomId: string, password?: string | null) =>
    emitWithReply<PublicRoomState>(socket, "room:spectate", { roomId, password }),
  leave: (socket: OikosSocket, roomId: string) => emitWithReply<PublicRoomState>(socket, "room:leave", { roomId }),
  addBots: (socket: OikosSocket, roomId: string) => emitWithReply<PublicRoomState>(socket, "bots:add", { roomId }),
  removeBots: (socket: OikosSocket, roomId: string) => emitWithReply<PublicRoomState>(socket, "bots:remove", { roomId }),
  addBotSpecies: (socket: OikosSocket, roomId: string, speciesId: SpeciesId) =>
    emitWithReply<PublicRoomState>(socket, "bots:add-species", { roomId, speciesId }),
  removeBotSpecies: (socket: OikosSocket, roomId: string, speciesId: SpeciesId) =>
    emitWithReply<PublicRoomState>(socket, "bots:remove-species", { roomId, speciesId }),
  setBotSpeed: (socket: OikosSocket, roomId: string, delayMs: number) =>
    emitWithReply<PublicRoomState>(socket, "bots:speed", { roomId, delayMs }),
  setTurnTimer: (socket: OikosSocket, roomId: string, turnTimerMs: number | null) =>
    emitWithReply<PublicRoomState>(socket, "turn-timer:set", { roomId, turnTimerMs }),
  setMiniExpansion: (socket: OikosSocket, roomId: string, expansionId: MiniExpansionId, enabled: boolean) =>
    emitWithReply<PublicRoomState>(socket, "mini-expansion:set", { roomId, expansionId, enabled }),
  setScenarioSelectionMode: (socket: OikosSocket, roomId: string, mode: ScenarioSelectionMode) =>
    emitWithReply<PublicRoomState>(socket, "scenario:selection-mode", { roomId, mode }),
  setScenarioCount: (socket: OikosSocket, roomId: string, scenarioCount: ScenarioCount) =>
    emitWithReply<PublicRoomState>(socket, "scenario:count", { roomId, scenarioCount }),
  setHostSelectedScenarios: (socket: OikosSocket, roomId: string, scenarioIds: ScenarioCardId[]) =>
    emitWithReply<PublicRoomState>(socket, "scenario:host-select", { roomId, scenarioIds }),
  selectSpecies: (socket: OikosSocket, roomId: string, speciesId: SpeciesId) =>
    emitWithReply<PublicRoomState>(socket, "species:select", { roomId, speciesId }),
  ready: (socket: OikosSocket, roomId: string, ready: boolean) =>
    emitWithReply<PublicRoomState>(socket, "player:ready", { roomId, ready }),
  start: (socket: OikosSocket, roomId: string) => emitWithReply<PublicRoomState>(socket, "game:start", { roomId }),
  voteScenarios: (socket: OikosSocket, roomId: string, votes: ScenarioCardId[]) =>
    emitWithReply<PublicRoomState>(socket, "scenario:vote", { roomId, votes }),
  collectCaatinga: (socket: OikosSocket, roomId: string, mode: "gain" | "lose" = "gain") =>
    emitWithReply<PublicRoomState>(socket, "scenario:caatinga-collect", { roomId, mode }),
  discardMataAtlantica: (socket: OikosSocket, roomId: string, cardId: string) =>
    emitWithReply<PublicRoomState>(socket, "scenario:mata-atlantica-discard", { roomId, cardId }),
  selectObjective: (socket: OikosSocket, roomId: string, objectiveCardId: string) =>
    emitWithReply<PublicRoomState>(socket, "objective:select", { roomId, objectiveCardId }),
  placeSetupPiece: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    emitWithReply<PublicRoomState>(socket, "setup:place-piece", { roomId, x, y }),
  placeForestCard: (
    socket: OikosSocket,
    roomId: string,
    cardId: string,
    x: number,
    y: number,
    rotation: ForestCardState["rotation"] = 0
  ) =>
    emitWithReply<PublicRoomState>(socket, "forest:place-card", { roomId, cardId, x, y, rotation }),
  completeAction: (socket: OikosSocket, roomId: string) =>
    emitWithReply<PublicRoomState>(socket, "action:complete", { roomId }),
  addCoati: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    emitWithReply<PublicRoomState>(socket, "coati:add", { roomId, x, y }),
  resolveCoatiPair: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    emitWithReply<PublicRoomState>(socket, "coati:resolve-pair", { roomId, x, y }),
  addCapuchin: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    emitWithReply<PublicRoomState>(socket, "capuchin:add", { roomId, x, y }),
  addMacaw: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    emitWithReply<PublicRoomState>(socket, "macaw:add", { roomId, x, y }),
  addArmadillo: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    emitWithReply<PublicRoomState>(socket, "armadillo:add", { roomId, x, y }),
  addWolf: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    emitWithReply<PublicRoomState>(socket, "wolf:add", { roomId, x, y }),
  movePiece: (socket: OikosSocket, roomId: string, pieceId: string, x: number, y: number, targetPieceId?: string) =>
    emitWithReply<PublicRoomState>(socket, "piece:move", { roomId, pieceId, x, y, targetPieceId }),
  removePieces: (socket: OikosSocket, roomId: string, pieceIds: string[]) =>
    emitWithReply<PublicRoomState>(socket, "pieces:remove", { roomId, pieceIds }),
  spendJaguarMeat: (socket: OikosSocket, roomId: string, count: number) =>
    emitWithReply<PublicRoomState>(socket, "jaguar:spend-meat", { roomId, count }),
  scoreCapuchin: (socket: OikosSocket, roomId: string) =>
    emitWithReply<PublicRoomState>(socket, "capuchin:score", { roomId }),
  scoreMacaw: (socket: OikosSocket, roomId: string) =>
    emitWithReply<PublicRoomState>(socket, "macaw:score", { roomId }),
  hideArmadillo: (socket: OikosSocket, roomId: string, pieceId: string) =>
    emitWithReply<PublicRoomState>(socket, "armadillo:hide", { roomId, pieceId }),
  scoreArmadillo: (socket: OikosSocket, roomId: string) =>
    emitWithReply<PublicRoomState>(socket, "armadillo:score", { roomId }),
  removeWolfBasePiece: (socket: OikosSocket, roomId: string, pieceId: string) =>
    emitWithReply<PublicRoomState>(socket, "wolf:remove-base", { roomId, pieceId }),
  spendWolfResources: (socket: OikosSocket, roomId: string, resources: Resource[]) =>
    emitWithReply<PublicRoomState>(socket, "wolf:spend-resources", { roomId, resources })
};
