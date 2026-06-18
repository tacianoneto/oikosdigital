import { io, type Socket } from "socket.io-client";
import type {
  ForestCardState,
  GameIntent,
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

const serverUrlStorageKey = "oikos:server-url";
const productionHostnames = new Set(["oikosdigital.com.br", "www.oikosdigital.com.br"]);
const productionServerUrl = "https://api.oikosdigital.com.br";

export function createSocket(accessToken: string): OikosSocket {
  return io(getServerUrl(), {
    auth: {
      accessToken
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

  if (productionHostnames.has(window.location.hostname)) {
    window.localStorage.removeItem(serverUrlStorageKey);
    return productionServerUrl;
  }

  return window.localStorage.getItem(serverUrlStorageKey) ?? import.meta.env.VITE_SERVER_URL ?? "http://localhost:4173";
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

function sendIntent(socket: OikosSocket, roomId: string, intent: GameIntent): Promise<PublicRoomState> {
  return emitWithReply<PublicRoomState>(socket, "game:intent", { roomId, intent });
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
  quit: (socket: OikosSocket, roomId: string) =>
    emitWithReply<PublicRoomState | { roomId: string; status: "closed" }>(socket, "room:quit", { roomId }),
  kick: (socket: OikosSocket, roomId: string, targetPlayerId: string) =>
    emitWithReply<PublicRoomState>(socket, "room:kick", { roomId, targetPlayerId }),
  rename: (socket: OikosSocket, roomId: string, name: string) =>
    emitWithReply<PublicRoomState>(socket, "player:rename", { roomId, name }),
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
  collectCaatinga: (socket: OikosSocket, roomId: string, mode: "gain" | "lose" | "skip" = "gain") =>
    emitWithReply<PublicRoomState>(socket, "scenario:caatinga-collect", { roomId, mode }),
  collectCerrado: (socket: OikosSocket, roomId: string, mode: "collect" | "skip" = "collect") =>
    emitWithReply<PublicRoomState>(socket, "scenario:cerrado-collect", { roomId, mode }),
  discardMataAtlantica: (socket: OikosSocket, roomId: string, cardId: string) =>
    emitWithReply<PublicRoomState>(socket, "scenario:mata-atlantica-discard", { roomId, cardId }),
  resolveCacaIlegal: (
    socket: OikosSocket,
    roomId: string,
    choice: { kind: "remove_piece"; pieceId: string } | { kind: "spend_resource"; resource: Resource }
  ) =>
    emitWithReply<PublicRoomState>(socket, "threat:caca-ilegal-resolve", { roomId, ...choice }),
  selectObjective: (socket: OikosSocket, roomId: string, objectiveCardId: string) =>
    emitWithReply<PublicRoomState>(socket, "objective:select", { roomId, objectiveCardId }),
  discardObjective: (socket: OikosSocket, roomId: string) =>
    emitWithReply<PublicRoomState>(socket, "objective:discard", { roomId }),
  resolveExtraTurn: (socket: OikosSocket, roomId: string, accept: boolean) =>
    emitWithReply<PublicRoomState>(socket, "objective:extra-turn", { roomId, accept }),
  resolveSeedSpend: (socket: OikosSocket, roomId: string, accept: boolean) =>
    emitWithReply<PublicRoomState>(socket, "objective:seed-spend", { roomId, accept }),
  placeSetupPiece: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    emitWithReply<PublicRoomState>(socket, "setup:place-piece", { roomId, x, y }),
  placeForestCard: (
    socket: OikosSocket,
    roomId: string,
    cardId: string,
    x: number,
    y: number,
    rotation: ForestCardState["rotation"] = 0
  ) => sendIntent(socket, roomId, { type: "forest.place-card", cardId, x, y, rotation }),
  completeAction: (socket: OikosSocket, roomId: string) => sendIntent(socket, roomId, { type: "action.complete" }),
  addCoati: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    sendIntent(socket, roomId, { type: "species.add-piece", speciesId: "coati", x, y }),
  addGalo: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    sendIntent(socket, roomId, { type: "species.add-piece", speciesId: "galo_de_campina", x, y }),
  resolveGaloInterrupt: (socket: OikosSocket, roomId: string, pieceId: string | undefined, x: number, y: number) =>
    emitWithReply<PublicRoomState>(socket, "galo:resolve-interrupt", { roomId, pieceId, x, y }),
  resolveCoatiPair: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    emitWithReply<PublicRoomState>(socket, "coati:resolve-pair", { roomId, x, y }),
  addCapuchin: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    sendIntent(socket, roomId, { type: "species.add-piece", speciesId: "capuchin", x, y }),
  addMacaw: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    sendIntent(socket, roomId, { type: "species.add-piece", speciesId: "macaw", x, y }),
  addArmadillo: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    sendIntent(socket, roomId, { type: "species.add-piece", speciesId: "armadillo", x, y }),
  addWolf: (socket: OikosSocket, roomId: string, x: number, y: number) =>
    sendIntent(socket, roomId, { type: "species.add-piece", speciesId: "maned_wolf", x, y }),
  movePiece: (socket: OikosSocket, roomId: string, pieceId: string, x: number, y: number, targetPieceId?: string) =>
    sendIntent(socket, roomId, { type: "piece.move", pieceId, x, y, targetPieceId }),
  removePieces: (socket: OikosSocket, roomId: string, pieceIds: string[]) =>
    sendIntent(socket, roomId, { type: "pieces.remove", pieceIds }),
  spendJaguarMeat: (socket: OikosSocket, roomId: string, count: number) =>
    sendIntent(socket, roomId, { type: "jaguar.spend-meat", count }),
  scoreCapuchin: (socket: OikosSocket, roomId: string) => sendIntent(socket, roomId, { type: "species.score", speciesId: "capuchin" }),
  scoreMacaw: (socket: OikosSocket, roomId: string) => sendIntent(socket, roomId, { type: "species.score", speciesId: "macaw" }),
  scoreGalo: (socket: OikosSocket, roomId: string) => sendIntent(socket, roomId, { type: "species.score", speciesId: "galo_de_campina" }),
  hideArmadillo: (socket: OikosSocket, roomId: string, pieceId: string) =>
    sendIntent(socket, roomId, { type: "species.hide-piece", speciesId: "armadillo", pieceId }),
  scoreArmadillo: (socket: OikosSocket, roomId: string) => sendIntent(socket, roomId, { type: "species.score", speciesId: "armadillo" }),
  removeWolfBasePiece: (socket: OikosSocket, roomId: string, pieceId: string) =>
    sendIntent(socket, roomId, { type: "wolf.remove-base", pieceId }),
  spendWolfResources: (socket: OikosSocket, roomId: string, resources: Resource[]) =>
    sendIntent(socket, roomId, { type: "wolf.spend-resources", resources })
};
