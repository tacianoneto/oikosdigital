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
import {
  completeCurrentAction,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece
} from "./setup";
import {
  discardObjectiveForResources,
  resolveExtraTurnObjective,
  resolveSeedSpendObjective,
  selectObjectiveCard
} from "./objectives";
import {
  collectCaatingaBonus,
  collectCerradoBonus,
  discardMataAtlanticaPileCard,
  resolveCacaIlegal
} from "./scenarioActions";
import { resolveCoatiPairBonus } from "./species/coati";
import { resolveGaloInterruptMove } from "./species/galo";

export function applyGameIntent(game: GameState, playerId: string, intent: GameIntent): GameState {
  switch (intent.type) {
    case "setup.place-piece":
      return placeInitialPiece(game, playerId, { x: intent.x, y: intent.y });
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
    case "coati.resolve-pair":
      return resolveCoatiPairBonus(game, playerId, { x: intent.x, y: intent.y });
    case "galo.resolve-interrupt":
      return resolveGaloInterruptMove(game, playerId, { x: intent.x, y: intent.y }, intent.pieceId);
    case "objective.select":
      return selectObjectiveCard(game, playerId, intent.objectiveCardId);
    case "objective.discard":
      return discardObjectiveForResources(game, playerId);
    case "objective.extra-turn":
      return resolveExtraTurnObjective(game, playerId, intent.accept);
    case "objective.seed-spend":
      return resolveSeedSpendObjective(game, playerId, intent.accept);
    case "scenario.caatinga-collect":
      return collectCaatingaBonus(game, playerId, intent.mode ?? "gain");
    case "scenario.cerrado-collect":
      return collectCerradoBonus(game, playerId, intent.mode ?? "collect");
    case "scenario.mata-atlantica-discard":
      return discardMataAtlanticaPileCard(game, playerId, intent.cardId);
    case "threat.caca-ilegal-resolve":
      return resolveCacaIlegal(game, playerId, intent.choice);
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
