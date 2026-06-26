import type { User } from "@supabase/supabase-js";
import type { GameIntent, GridPosition, MovementKind, PublicRoomState, SpeciesId } from "@oikos/shared";
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

export const SERVER_UNAVAILABLE_MESSAGE = "Servidor indisponivel. Inicie o servidor para testar lobby multiplayer.";

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

// Per-species "add piece" wiring. Species not listed here (coati included) fall
// back to the coati intent, matching the previous default branch.
export type AddPieceIntentFactory = {
  intent: (position: GridPosition) => GameIntent;
  notice: string;
};

const ADD_PIECE_DEFAULT: AddPieceIntentFactory = {
  intent: (position) => ({ type: "species.add-piece", speciesId: "coati", x: position.x, y: position.y }),
  notice: "Quati adicionado em local de fruta."
};

const ADD_PIECE_HANDLERS: Partial<Record<SpeciesId, AddPieceIntentFactory>> = {
  capuchin: {
    intent: (position) => ({ type: "species.add-piece", speciesId: "capuchin", x: position.x, y: position.y }),
    notice: "Macaco-prego adicionado."
  },
  macaw: {
    intent: (position) => ({ type: "species.add-piece", speciesId: "macaw", x: position.x, y: position.y }),
    notice: "Arara adicionada."
  },
  galo_de_campina: {
    intent: (position) => ({ type: "species.add-piece", speciesId: "galo_de_campina", x: position.x, y: position.y }),
    notice: "Galo-de-campina adicionado."
  },
  armadillo: {
    intent: (position) => ({ type: "species.add-piece", speciesId: "armadillo", x: position.x, y: position.y }),
    notice: "Tatu-bola adicionado."
  },
  maned_wolf: {
    intent: (position) => ({ type: "species.add-piece", speciesId: "maned_wolf", x: position.x, y: position.y }),
    notice: "Lobo-guara adicionado."
  }
};

export function getAddPieceIntentFactory(speciesId: SpeciesId | null | undefined): AddPieceIntentFactory {
  return (speciesId && ADD_PIECE_HANDLERS[speciesId]) || ADD_PIECE_DEFAULT;
}
