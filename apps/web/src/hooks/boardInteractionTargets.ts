import {
  getArmadilloHidePieceIds,
  getArmadilloSeedPlacementPositions,
  getAvailableForestExpansionPositionsForCard,
  getCapuchinPlacementPositions,
  getCacaIlegalRemovablePieceIds,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getGaloAdjacentAddPositions,
  getGaloFieldPlacementPositions,
  getMacawActionCTargets,
  getMacawEggPlacementPositions,
  getMacawRelocatablePieceIds,
  getRequiredCoatiRemovalCount,
  getValidPieceMovementDestinations,
  getWolfMeatPlacementPositions,
  getWolfRemovableBasePieceIds
} from "@oikos/rules";
import type { ActionId, GameState, GridPosition, SpeciesId } from "@oikos/shared";
import { sameGridPosition } from "../ui/geometry";
import type { TutorialGate, TutorialStepDef } from "../ui/tutorials";

type CardRotation = 0 | 90 | 180 | 270;

export interface RotateFitTarget {
  position: GridPosition;
  rotation: CardRotation;
}

export interface TutorialTargetState {
  active: boolean;
  def: TutorialStepDef | null;
  gate: TutorialGate | null;
}

interface CardPlacementTargetInput {
  canPlaceSelectedForestCard: boolean;
  game: GameState | null | undefined;
  hasPendingPlacement: boolean;
  selectedCardRotation: CardRotation;
  selectedHandCardId: string | null;
  tutorial: TutorialTargetState;
}

interface SelectablePieceInput {
  activeActionId: ActionId | null;
  activeGamePlayerSeedCount: number;
  activeSpeciesId: SpeciesId | null;
  cacaIlegalRemovalMode: boolean;
  canControlActivePlayer: boolean;
  controlledPlayerId: string | null;
  game: GameState | null | undefined;
  hasPendingCoatiPairBonus: boolean;
}

interface MovementTargetInput {
  activeActionId: ActionId | null;
  activeSpeciesId: SpeciesId | null;
  canControlActivePlayer: boolean;
  game: GameState | null | undefined;
  hasPendingCoatiPairBonus: boolean;
  selectedPieceId: string | null;
  tutorial: TutorialTargetState;
}

interface SpeciesPlacementTargetInput {
  activeActionId: ActionId | null;
  activeSpeciesId: SpeciesId | null;
  canControlActivePlayer: boolean;
  game: GameState | null | undefined;
  hasPendingCoatiPairBonus: boolean;
  selectedPieceId: string | null;
  tutorial: TutorialTargetState;
}

interface BoardPieceTargetInput {
  activeSpeciesId: SpeciesId | null;
  game: GameState | null | undefined;
  movementTargetCount: number;
  selectablePieceIds: string[];
  selectedJaguarDestination: GridPosition | null;
  selectedJaguarTargetPieceId: string | null;
  selectedPieceId: string | null;
  selectedRemovalPieceIds: string[];
  selectedWolfTargetPieceId: string | null;
  tutorial: TutorialTargetState;
}

export interface UseBoardInteractionTargetsOptions
  extends CardPlacementTargetInput,
    SelectablePieceInput,
    MovementTargetInput,
    SpeciesPlacementTargetInput {
  selectedJaguarDestination: GridPosition | null;
  selectedJaguarTargetPieceId: string | null;
  selectedRemovalPieceIds: string[];
  selectedWolfTargetPieceId: string | null;
}

export function getCardPlacementTargets({
  canPlaceSelectedForestCard,
  game,
  hasPendingPlacement,
  selectedCardRotation,
  selectedHandCardId,
  tutorial
}: CardPlacementTargetInput) {
  const expansionTargets =
    canPlaceSelectedForestCard && game && selectedHandCardId && !hasPendingPlacement
      ? getAvailableForestExpansionPositionsForCard(
          game,
          selectedHandCardId,
          selectedCardRotation
        )
      : [];

  const rotateFitTargets: RotateFitTarget[] = [];
  if (canPlaceSelectedForestCard && game && selectedHandCardId && !hasPendingPlacement) {
    const currentKeys = new Set(expansionTargets.map((position) => `${position.x}:${position.y}`));
    const seen = new Set<string>();
    for (const rotation of [0, 90, 180, 270] as const) {
      if (rotation === selectedCardRotation) continue;
      for (const position of getAvailableForestExpansionPositionsForCard(
        game,
        selectedHandCardId,
        rotation
      )) {
        const key = `${position.x}:${position.y}`;
        if (currentKeys.has(key) || seen.has(key)) continue;
        seen.add(key);
        rotateFitTargets.push({
          position: { x: position.x, y: position.y },
          rotation
        });
      }
    }
  }

  const tutorialPlaceStep =
    tutorial.active &&
    tutorial.gate === "placeCard" &&
    Boolean(tutorial.def?.requiredCardId);
  const tutorialMarkedSlot = tutorialPlaceStep ? tutorial.def?.markedSlot ?? null : null;

  const filterTutorialSlot = <T extends { x: number; y: number }>(targets: T[]) =>
    tutorialMarkedSlot
      ? targets.filter(
          (target) =>
            target.x === tutorialMarkedSlot.x && target.y === tutorialMarkedSlot.y
        )
      : targets;

  const displayExpansionTargets =
    tutorial.active && !tutorialPlaceStep
      ? []
      : filterTutorialSlot(expansionTargets);
  const displayRotateFitTargets =
    tutorial.active && !tutorialPlaceStep
      ? []
      : tutorialMarkedSlot
        ? rotateFitTargets.filter(
            (target) =>
              target.position.x === tutorialMarkedSlot.x &&
              target.position.y === tutorialMarkedSlot.y
          )
        : rotateFitTargets;

  return {
    displayExpansionTargets,
    displayRotateFitTargets,
    expansionTargets,
    rotateFitTargets,
    tutorialMarkedSlot
  };
}

export function getSelectablePieceIds({
  activeActionId,
  activeGamePlayerSeedCount,
  activeSpeciesId,
  cacaIlegalRemovalMode,
  canControlActivePlayer,
  controlledPlayerId,
  game,
  hasPendingCoatiPairBonus
}: SelectablePieceInput): string[] {
  if (!game || hasPendingCoatiPairBonus || !canControlActivePlayer) return [];

  if (
    cacaIlegalRemovalMode &&
    game.cacaIlegalPending?.playerId === controlledPlayerId
  ) {
    return getCacaIlegalRemovablePieceIds(game, game.cacaIlegalPending.playerId);
  }

  if (activeSpeciesId === "jaguar" && (activeActionId === "A" || activeActionId === "B")) {
    return game.pieces
      .filter(
        (piece) =>
          piece.ownerId === game.activePlayerId &&
          piece.speciesId === "jaguar" &&
          piece.location
      )
      .map((piece) => piece.pieceId);
  }

  if (activeSpeciesId === "macaw" && activeActionId === "C" && game.activePlayerId) {
    return getMacawRelocatablePieceIds(game, game.activePlayerId);
  }

  if (activeSpeciesId === "armadillo" && activeActionId === "C" && game.activePlayerId) {
    return getArmadilloHidePieceIds(game, game.activePlayerId);
  }

  if (
    activeSpeciesId === "maned_wolf" &&
    activeActionId === "A" &&
    game.pendingWolfMoves?.playerId === game.activePlayerId
  ) {
    return game.pendingWolfMoves.pieceIds;
  }

  if (activeSpeciesId === "maned_wolf" && activeActionId === "B" && game.activePlayerId) {
    return getWolfRemovableBasePieceIds(game, game.activePlayerId);
  }

  if (activeSpeciesId === "galo_de_campina" && activeActionId === "C" && game.activePlayerId) {
    if (
      activeGamePlayerSeedCount <= 0 ||
      game.pendingGaloMovedPiece?.playerId !== game.activePlayerId
    ) {
      return [];
    }
    return game.pieces
      .filter(
        (piece) =>
          piece.ownerId === game.activePlayerId &&
          piece.speciesId === "galo_de_campina" &&
          piece.location &&
          piece.pieceId !== game.pendingGaloMovedPiece?.pieceId
      )
      .map((piece) => piece.pieceId);
  }

  if (
    activeSpeciesId !== "coati" &&
    activeSpeciesId !== "capuchin" &&
    activeSpeciesId !== "macaw" &&
    activeSpeciesId !== "galo_de_campina" &&
    activeSpeciesId !== "armadillo"
  ) {
    return [];
  }

  if (
    activeActionId === "C" &&
    getRequiredCoatiRemovalCount(game, game.activePlayerId ?? "") > 0
  ) {
    return game.pieces
      .filter(
        (piece) =>
          piece.ownerId === game.activePlayerId &&
          piece.speciesId === "coati" &&
          piece.location
      )
      .map((piece) => piece.pieceId);
  }

  if (activeActionId !== "B") return [];

  return game.pieces
    .filter(
      (piece) =>
        piece.ownerId === game.activePlayerId &&
        piece.speciesId === activeSpeciesId &&
        piece.location
    )
    .map((piece) => piece.pieceId);
}

export function getMovementInteractionTargets({
  activeActionId,
  activeSpeciesId,
  canControlActivePlayer,
  game,
  hasPendingCoatiPairBonus,
  selectedPieceId,
  tutorial
}: MovementTargetInput) {
  const movementTargets =
    game && !hasPendingCoatiPairBonus && game.activePlayerId && selectedPieceId
      ? getValidPieceMovementDestinations(game, game.activePlayerId, selectedPieceId)
      : [];

  const displayMovementTargets =
    tutorial.active && tutorial.gate === "move" && tutorial.def?.markedMoveTarget
      ? movementTargets.filter((position) =>
          sameGridPosition(position, tutorial.def!.markedMoveTarget!)
        )
      : movementTargets;

  let canSkipJaguarMove = false;
  if (
    game &&
    canControlActivePlayer &&
    !hasPendingCoatiPairBonus &&
    activeSpeciesId === "jaguar" &&
    (activeActionId === "A" || activeActionId === "B") &&
    game.activePlayerId
  ) {
    const jaguarPieceId = game.pieces.find(
      (piece) =>
        piece.ownerId === game.activePlayerId &&
        piece.speciesId === "jaguar" &&
        piece.location
    )?.pieceId;
    canSkipJaguarMove = Boolean(
      jaguarPieceId &&
        getValidPieceMovementDestinations(game, game.activePlayerId, jaguarPieceId).length === 0
    );
  }

  return { canSkipJaguarMove, displayMovementTargets, movementTargets };
}

export function getSpeciesPlacementTargets({
  activeActionId,
  activeSpeciesId,
  canControlActivePlayer,
  game,
  hasPendingCoatiPairBonus,
  selectedPieceId,
  tutorial
}: SpeciesPlacementTargetInput) {
  const activePlayerId = game?.activePlayerId ?? null;
  const canTarget = Boolean(game && activePlayerId && canControlActivePlayer);

  const coatiFruitTargets =
    canTarget && !hasPendingCoatiPairBonus
      ? getCoatiFruitPlacementPositions(game!, activePlayerId!)
      : [];
  const coatiPairBonusTargets = canTarget
    ? getCoatiPairBonusTargets(game!, activePlayerId!)
    : [];
  const capuchinPlacementTargets =
    canTarget && activeSpeciesId === "capuchin"
      ? getCapuchinPlacementPositions(game!, activePlayerId!)
      : [];
  const macawEggTargets =
    canTarget && activeSpeciesId === "macaw"
      ? getMacawEggPlacementPositions(game!, activePlayerId!)
      : [];
  const macawActionCTargets =
    canTarget && activeSpeciesId === "macaw" && !selectedPieceId
      ? getMacawActionCTargets(game!, activePlayerId!)
      : [];
  const macawAddTargets =
    activeActionId === "A"
      ? macawEggTargets
      : activeActionId === "C"
        ? macawActionCTargets
        : [];
  const galoFieldTargets =
    canTarget && activeSpeciesId === "galo_de_campina"
      ? getGaloFieldPlacementPositions(game!, activePlayerId!)
      : [];
  const galoAdjacentTargets =
    canTarget && activeSpeciesId === "galo_de_campina"
      ? getGaloAdjacentAddPositions(game!, activePlayerId!)
      : [];
  const galoAddTargets =
    galoAdjacentTargets.length > 0 ? galoAdjacentTargets : galoFieldTargets;
  const armadilloSeedTargets =
    canTarget && activeSpeciesId === "armadillo"
      ? getArmadilloSeedPlacementPositions(game!, activePlayerId!)
      : [];
  const wolfMeatTargets =
    canTarget && activeSpeciesId === "maned_wolf"
      ? getWolfMeatPlacementPositions(game!, activePlayerId!)
      : [];
  const addPieceTargets =
    activeSpeciesId === "capuchin"
      ? capuchinPlacementTargets
      : activeSpeciesId === "macaw"
        ? macawAddTargets
        : activeSpeciesId === "galo_de_campina"
          ? galoAddTargets
          : activeSpeciesId === "armadillo"
            ? armadilloSeedTargets
            : activeSpeciesId === "maned_wolf"
              ? wolfMeatTargets
              : coatiFruitTargets;

  const displayCoatiPairBonusTargets =
    tutorial.active && tutorial.gate !== "resolvePair"
      ? []
      : tutorial.active && tutorial.def?.markedPairTarget
        ? coatiPairBonusTargets.filter((position) =>
            sameGridPosition(position, tutorial.def!.markedPairTarget!)
          )
        : coatiPairBonusTargets;

  const displayAddPieceTargets =
    tutorial.active && tutorial.gate !== "addPiece" && tutorial.gate !== "placeCard"
      ? []
      : tutorial.active &&
          tutorial.gate === "addPiece" &&
          tutorial.def?.markedAddPieceTarget
        ? addPieceTargets.filter((position) =>
            sameGridPosition(position, tutorial.def!.markedAddPieceTarget!)
          )
        : addPieceTargets;

  return {
    addPieceTargets,
    armadilloSeedTargets,
    capuchinPlacementTargets,
    coatiFruitTargets,
    coatiPairBonusTargets,
    displayAddPieceTargets,
    displayCoatiPairBonusTargets,
    galoAddTargets,
    galoAdjacentTargets,
    galoFieldTargets,
    macawActionCTargets,
    macawAddTargets,
    macawEggTargets,
    wolfMeatTargets
  };
}

export function getBoardPieceTargets({
  activeSpeciesId,
  game,
  movementTargetCount,
  selectablePieceIds,
  selectedJaguarDestination,
  selectedJaguarTargetPieceId,
  selectedPieceId,
  selectedRemovalPieceIds,
  selectedWolfTargetPieceId,
  tutorial
}: BoardPieceTargetInput) {
  const jaguarTargetPieceIds =
    game &&
    activeSpeciesId === "jaguar" &&
    selectedPieceId &&
    selectedJaguarDestination &&
    movementTargetCount > 0
      ? game.pieces
          .filter(
            (piece) =>
              piece.ownerId !== game.activePlayerId &&
              piece.location &&
              !piece.state.hidden &&
              piece.location.x === selectedJaguarDestination.x &&
              piece.location.y === selectedJaguarDestination.y
          )
          .map((piece) => piece.pieceId)
      : [];

  const combinedIds = [...new Set([...selectablePieceIds, ...jaguarTargetPieceIds])];
  const boardSelectablePieceIds = !tutorial.active
    ? combinedIds
    : tutorial.def?.markedPieceId
      ? combinedIds.filter((pieceId) => pieceId === tutorial.def?.markedPieceId)
      : tutorial.gate === "move" || tutorial.gate === "removeCoati"
        ? combinedIds
        : [];

  const highlightedPieceIds = [
    ...(tutorial.active && tutorial.def?.markedPieceId
      ? [tutorial.def.markedPieceId]
      : []),
    ...selectedRemovalPieceIds,
    ...(selectedJaguarTargetPieceId ? [selectedJaguarTargetPieceId] : []),
    ...(selectedWolfTargetPieceId ? [selectedWolfTargetPieceId] : [])
  ];

  return { boardSelectablePieceIds, highlightedPieceIds, jaguarTargetPieceIds };
}
