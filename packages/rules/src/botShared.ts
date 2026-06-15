import { completeCurrentAction, forceEndPlayerTurn } from "./setup";
import type { GameState } from "@oikos/shared";

export const rotations = [0, 90, 180, 270] as const;

export function completeOrSkip(game: GameState, playerId: string): GameState {
  try {
    return completeCurrentAction(game, playerId);
  } catch {
    return forceEndPlayerTurn(game, playerId, "bot sem jogada valida");
  }
}
