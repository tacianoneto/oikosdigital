import type { GameState } from "@oikos/shared";
import { applyFinalScoring, type FinalScoringDeps } from "./scoring";

export function finalizeGameState(
  game: GameState,
  cloneGameState: (game: GameState) => GameState,
  deps: FinalScoringDeps
): GameState {
  if (game.status === "finished") {
    return game;
  }

  const next = cloneGameState(game);
  applyFinalScoring(next, deps);
  return next;
}
