import { io, type Socket } from "socket.io-client";
import type { ForestCardState, PublicRoomState, Resource, SpeciesId } from "@oikos/shared";

export interface SocketReply<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type OikosSocket = Socket;

const playerIdStorageKey = "oikos:player-id";

export function createSocket(): OikosSocket {
  return io(import.meta.env.VITE_SERVER_URL ?? "http://localhost:4173", {
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
  create: (socket: OikosSocket, name: string) => emitWithReply<PublicRoomState>(socket, "room:create", { name }),
  join: (socket: OikosSocket, roomId: string, name: string) => emitWithReply<PublicRoomState>(socket, "room:join", { roomId, name }),
  selectSpecies: (socket: OikosSocket, roomId: string, speciesId: SpeciesId) =>
    emitWithReply<PublicRoomState>(socket, "species:select", { roomId, speciesId }),
  ready: (socket: OikosSocket, roomId: string, ready: boolean) =>
    emitWithReply<PublicRoomState>(socket, "player:ready", { roomId, ready }),
  start: (socket: OikosSocket, roomId: string) => emitWithReply<PublicRoomState>(socket, "game:start", { roomId }),
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
