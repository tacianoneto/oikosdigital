import { useMemo } from "react";
import {
  getBoardPieceTargets,
  getCardPlacementTargets,
  getMovementInteractionTargets,
  getSelectablePieceIds,
  getSpeciesPlacementTargets,
  type TutorialTargetState,
  type UseBoardInteractionTargetsOptions
} from "./boardInteractionTargets";

export function useBoardInteractionTargets(options: UseBoardInteractionTargetsOptions) {
  const tutorial = useMemo<TutorialTargetState>(
    () => ({
      active: options.tutorial.active,
      def: options.tutorial.def,
      gate: options.tutorial.gate
    }),
    [options.tutorial.active, options.tutorial.def, options.tutorial.gate]
  );

  const cardPlacement = useMemo(
    () => getCardPlacementTargets({ ...options, tutorial }),
    [
      options.canPlaceSelectedForestCard,
      options.game,
      options.hasPendingPlacement,
      options.selectedCardRotation,
      options.selectedHandCardId,
      tutorial
    ]
  );
  const selectablePieceIds = useMemo(
    () => getSelectablePieceIds(options),
    [
      options.activeActionId,
      options.activeGamePlayerSeedCount,
      options.activeSpeciesId,
      options.cacaIlegalRemovalMode,
      options.canControlActivePlayer,
      options.controlledPlayerId,
      options.game,
      options.hasPendingCoatiPairBonus
    ]
  );
  const movement = useMemo(
    () => getMovementInteractionTargets({ ...options, tutorial }),
    [
      options.activeActionId,
      options.activeSpeciesId,
      options.canControlActivePlayer,
      options.game,
      options.hasPendingCoatiPairBonus,
      options.selectedPieceId,
      tutorial
    ]
  );
  const speciesPlacement = useMemo(
    () => getSpeciesPlacementTargets({ ...options, tutorial }),
    [
      options.activeActionId,
      options.activeSpeciesId,
      options.canControlActivePlayer,
      options.game,
      options.hasPendingCoatiPairBonus,
      options.selectedPieceId,
      tutorial
    ]
  );
  const boardPieces = useMemo(
    () =>
      getBoardPieceTargets({
        ...options,
        movementTargetCount: movement.movementTargets.length,
        selectablePieceIds,
        tutorial
      }),
    [
      movement.movementTargets.length,
      options.activeSpeciesId,
      options.game,
      options.selectedJaguarDestination,
      options.selectedJaguarTargetPieceId,
      options.selectedPieceId,
      options.selectedRemovalPieceIds,
      options.selectedWolfTargetPieceId,
      selectablePieceIds,
      tutorial
    ]
  );

  return {
    ...cardPlacement,
    ...movement,
    ...speciesPlacement,
    ...boardPieces,
    selectablePieceIds
  };
}
