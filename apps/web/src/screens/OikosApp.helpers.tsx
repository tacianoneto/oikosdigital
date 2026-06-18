import type { User } from "@supabase/supabase-js";
import { applyGameIntent } from "@oikos/rules";
import type { GameState, GridPosition, MovementKind, PublicRoomState, SpeciesId } from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";
import {
  createArmadilloTutorialRoom,
  createCapuchinTutorialRoom,
  createCoatiTutorialRoom,
  createInitialTutorialRoom,
  createJaguarTutorialRoom,
  createMacawTutorialRoom,
  createWolfTutorialRoom,
  type TutorialId
} from "../ui/tutorials";

export const getOpenPortraitAsset = (portraitAsset: string) =>
  portraitAsset.replace("/assets/portraits/", "/assets/portraits-open/");

export type MobileSheet = "acao" | "mao" | "jogadores" | "resumo" | null;

export const SERVER_UNAVAILABLE_MESSAGE = "Servidor indisponível. Inicie o servidor para testar lobby multiplayer.";

export const movementKindLabels: Record<MovementKind, string> = {
  adjacent: "Adjacente",
  diagonal: "Diagonal",
  straight_jump: "Salto reto",
  knight_jump: "Salto em curva"
};

export function SkipExtraTurnNoCardAction({
  visible,
  onComplete
}: {
  visible: boolean;
  onComplete: () => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <div className="action-box-actions">
      <button type="button" className="action-box-btn is-secondary" onClick={onComplete}>
        Concluir sem carta
      </button>
    </div>
  );
}

// Maps each tutorial chapter to the factory that builds its scripted local room.
export const TUTORIAL_ROOM_FACTORIES: Record<TutorialId, () => PublicRoomState> = {
  initial: createInitialTutorialRoom,
  jaguar: createJaguarTutorialRoom,
  wolf: createWolfTutorialRoom,
  armadillo: createArmadilloTutorialRoom,
  macaw: createMacawTutorialRoom,
  capuchin: createCapuchinTutorialRoom,
  coati: createCoatiTutorialRoom
};

export function getAuthDisplayName(user: User): string {
  const metaName = user.user_metadata?.display_name;
  if (typeof metaName === "string" && metaName.trim()) {
    return metaName.trim().slice(0, 24);
  }

  return (user.email?.split("@")[0] || "Jogador").slice(0, 24);
}

// Per-species "add piece" wiring: the local engine step, the online socket call,
// and the confirmation notice. Species not listed here (coati included) fall back
// to the coati handler, matching the previous default branch.
export type AddPieceHandler = {
  local: (game: GameState, playerId: string, position: GridPosition) => GameState;
  api: (socket: OikosSocket, roomId: string, x: number, y: number) => Promise<PublicRoomState>;
  notice: string;
};

const ADD_PIECE_DEFAULT: AddPieceHandler = {
  local: (game, playerId, position) =>
    applyGameIntent(game, playerId, { type: "species.add-piece", speciesId: "coati", x: position.x, y: position.y }),
  api: (socket, roomId, x, y) => roomApi.addCoati(socket, roomId, x, y),
  notice: "Quati adicionado em local de fruta."
};

const ADD_PIECE_HANDLERS: Partial<Record<SpeciesId, AddPieceHandler>> = {
  capuchin: {
    local: (game, playerId, position) =>
      applyGameIntent(game, playerId, { type: "species.add-piece", speciesId: "capuchin", x: position.x, y: position.y }),
    api: (socket, roomId, x, y) => roomApi.addCapuchin(socket, roomId, x, y),
    notice: "Macaco-prego adicionado."
  },
  macaw: {
    local: (game, playerId, position) =>
      applyGameIntent(game, playerId, { type: "species.add-piece", speciesId: "macaw", x: position.x, y: position.y }),
    api: (socket, roomId, x, y) => roomApi.addMacaw(socket, roomId, x, y),
    notice: "Arara adicionada."
  },
  galo_de_campina: {
    local: (game, playerId, position) =>
      applyGameIntent(game, playerId, { type: "species.add-piece", speciesId: "galo_de_campina", x: position.x, y: position.y }),
    api: (socket, roomId, x, y) => roomApi.addGalo(socket, roomId, x, y),
    notice: "Galo-de-campina adicionado."
  },
  armadillo: {
    local: (game, playerId, position) =>
      applyGameIntent(game, playerId, { type: "species.add-piece", speciesId: "armadillo", x: position.x, y: position.y }),
    api: (socket, roomId, x, y) => roomApi.addArmadillo(socket, roomId, x, y),
    notice: "Tatu-bola adicionado."
  },
  maned_wolf: {
    local: (game, playerId, position) =>
      applyGameIntent(game, playerId, { type: "species.add-piece", speciesId: "maned_wolf", x: position.x, y: position.y }),
    api: (socket, roomId, x, y) => roomApi.addWolf(socket, roomId, x, y),
    notice: "Lobo-guará adicionado."
  }
};

export function getAddPieceHandler(speciesId: SpeciesId | null | undefined): AddPieceHandler {
  return (speciesId && ADD_PIECE_HANDLERS[speciesId]) || ADD_PIECE_DEFAULT;
}
