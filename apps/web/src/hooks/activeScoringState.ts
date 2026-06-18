import {
  getArmadilloShareScore,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getCapuchinHabitatScore,
  getGaloActionDScore,
  getMacawLineScore,
  getRequiredCoatiRemovalCount,
  getWolfRemovableBasePieceIds,
  getWolfSpendableResourceTypes
} from "@oikos/rules";
import type {
  ActionId,
  GameState,
  Resource,
  SpeciesId
} from "@oikos/shared";
import type {
  TutorialGate,
  TutorialId
} from "../ui/tutorials";

export interface ActiveScoringStateOptions {
  activeActionId: ActionId | null;
  activeSpeciesId: SpeciesId | null;
  canControlActivePlayer: boolean;
  game: GameState | null | undefined;
  hasPendingCoatiPairBonus: boolean;
  tutorialActive: boolean;
  tutorialGate: TutorialGate | null;
  tutorialId: TutorialId | null;
}

export interface ActiveScoringState {
  armadilloShareScore: number;
  availableJaguarPointSpendCount: number;
  availableWolfPointSpendCount: number;
  cacaIlegalPending: GameState["cacaIlegalPending"];
  capuchinHabitatScore: number;
  capuchinReserveCount: number;
  galoScore: number;
  macawLineScore: number;
  requiredCoatiRemovalCount: number;
  shouldShowJaguarScoreModal: boolean;
  wolfRemovableBasePieceIds: string[];
  wolfSpendableResources: Resource[];
}

export function getActiveScoringState({
  activeActionId,
  activeSpeciesId,
  canControlActivePlayer,
  game,
  hasPendingCoatiPairBonus,
  tutorialActive,
  tutorialGate,
  tutorialId
}: ActiveScoringStateOptions): ActiveScoringState {
  const activePlayerId = game?.activePlayerId ?? null;
  const activePlayer = activePlayerId
    ? game?.players.find((player) => player.playerId === activePlayerId) ?? null
    : null;

  return {
    armadilloShareScore:
      game && activePlayerId
        ? getArmadilloShareScore(game, activePlayerId)
        : 0,
    availableJaguarPointSpendCount:
      game && activePlayerId
        ? getAvailableJaguarPointSpendCount(game, activePlayerId)
        : 0,
    availableWolfPointSpendCount:
      game && activePlayerId
        ? getAvailableWolfPointSpendCount(game, activePlayerId)
        : 0,
    cacaIlegalPending: game?.cacaIlegalPending ?? null,
    capuchinHabitatScore:
      game && activePlayerId
        ? getCapuchinHabitatScore(game, activePlayerId)
        : 0,
    capuchinReserveCount:
      activeSpeciesId === "capuchin"
        ? activePlayer?.reservePieces.length ?? 0
        : 0,
    galoScore:
      game && activePlayerId
        ? getGaloActionDScore(game, activePlayerId)
        : 0,
    macawLineScore:
      game && activePlayerId ? getMacawLineScore(game, activePlayerId) : 0,
    requiredCoatiRemovalCount:
      game && activePlayerId
        ? getRequiredCoatiRemovalCount(game, activePlayerId)
        : 0,
    shouldShowJaguarScoreModal: Boolean(
      game?.status === "active" &&
        activePlayer &&
        activeSpeciesId === "jaguar" &&
        activeActionId === "C" &&
        canControlActivePlayer &&
        !hasPendingCoatiPairBonus &&
        (!tutorialActive ||
          tutorialId !== "jaguar" ||
          tutorialGate === "score")
    ),
    wolfRemovableBasePieceIds:
      game && activePlayerId
        ? getWolfRemovableBasePieceIds(game, activePlayerId)
        : [],
    wolfSpendableResources:
      game && activePlayerId
        ? getWolfSpendableResourceTypes(game, activePlayerId)
        : []
  };
}
