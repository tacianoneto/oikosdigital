import type { ActionId, GameIntent, GameState } from "@oikos/shared";
import {
  applySpeciesCountSpendAction,
  applySpeciesPieceTargetAction,
  applySpeciesPieceTargetsAction,
  applySpeciesPlacementAction,
  applySpeciesResourceSpendAction,
  applySpeciesScoreAction
} from "./speciesActions";
import { getCurrentAction } from "./state";
import { completeCurrentAction, movePieceForCurrentAction, placeForestCard } from "./setup";

export function applyGameIntent(game: GameState, playerId: string, intent: GameIntent): GameState {
  switch (intent.type) {
    case "action.complete":
      return completeCurrentAction(game, playerId);
    case "forest.place-card":
      return placeForestCard(game, playerId, intent.cardId, { x: intent.x, y: intent.y }, intent.rotation);
    case "species.add-piece":
      return applySpeciesPlacementAction(game, playerId, intent.speciesId, requireCurrentAction(game), {
        x: intent.x,
        y: intent.y
      });
    case "species.score":
      return applySpeciesScoreAction(game, playerId, intent.speciesId, "D");
    case "species.hide-piece":
      return applySpeciesPieceTargetAction(game, playerId, intent.speciesId, "C", intent.pieceId);
    case "pieces.remove":
      return applySpeciesPieceTargetsAction(game, playerId, "coati", "C", intent.pieceIds);
    case "piece.move":
      return movePieceForCurrentAction(game, playerId, intent.pieceId, { x: intent.x, y: intent.y }, intent.targetPieceId);
    case "jaguar.spend-meat":
      return applySpeciesCountSpendAction(game, playerId, "jaguar", "C", intent.count);
    case "wolf.remove-base":
      return applySpeciesPieceTargetAction(game, playerId, "maned_wolf", "B", intent.pieceId);
    case "wolf.spend-resources":
      return applySpeciesResourceSpendAction(game, playerId, "maned_wolf", "C", intent.resources);
    default:
      return assertNever(intent);
  }
}

function requireCurrentAction(game: GameState): ActionId {
  const action = getCurrentAction(game);
  if (!action) {
    throw new Error("Nao ha acao ativa para aplicar esta intencao.");
  }

  return action;
}

function assertNever(value: never): never {
  throw new Error(`Intencao de jogo desconhecida: ${JSON.stringify(value)}`);
}
