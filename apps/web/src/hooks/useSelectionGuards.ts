import { useEffect, type Dispatch, type SetStateAction } from "react";
import { getWolfSpendableResourceTypes } from "@oikos/rules";
import type { ForestCardDefinition, GameState, Resource } from "@oikos/shared";
import type { PlayerInspectorEntry } from "./playerHudState";

type PendingCacaIlegal = NonNullable<GameState["cacaIlegalPending"]>;

interface SelectionGuardsParams {
  cacaIlegalPending: PendingCacaIlegal | null;
  cleanBoardMode: boolean;
  controlledPlayerId: string | null;
  game: GameState | null | undefined;
  handCards: ForestCardDefinition[];
  hasStartedGame: boolean;
  jaguarTargetPieceIds: string[];
  opponentInspectorEntries: PlayerInspectorEntry[];
  selectablePieceIds: string[];
  selectedHandCardId: string | null;
  selectedJaguarTargetPieceId: string | null;
  selectedOpponentPlayerId: string | null;
  selectedPieceId: string | null;
  selectedRemovalPieceIds: string[];
  selectedWolfResources: Resource[];
  selectedWolfTargetPieceId: string | null;
  setCacaIlegalRemovalMode: Dispatch<SetStateAction<boolean>>;
  setSelectedCardRotation: Dispatch<SetStateAction<0 | 90 | 180 | 270>>;
  setSelectedHandCardId: Dispatch<SetStateAction<string | null>>;
  setSelectedJaguarTargetPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedOpponentPlayerId: Dispatch<SetStateAction<string | null>>;
  setSelectedPieceId: Dispatch<SetStateAction<string | null>>;
  setSelectedRemovalPieceIds: Dispatch<SetStateAction<string[]>>;
  setSelectedWolfResources: Dispatch<SetStateAction<Resource[]>>;
  setSelectedWolfTargetPieceId: Dispatch<SetStateAction<string | null>>;
}

export function useSelectionGuards({
  cacaIlegalPending,
  cleanBoardMode,
  controlledPlayerId,
  game,
  handCards,
  hasStartedGame,
  jaguarTargetPieceIds,
  opponentInspectorEntries,
  selectablePieceIds,
  selectedHandCardId,
  selectedJaguarTargetPieceId,
  selectedOpponentPlayerId,
  selectedPieceId,
  selectedRemovalPieceIds,
  selectedWolfResources,
  selectedWolfTargetPieceId,
  setCacaIlegalRemovalMode,
  setSelectedCardRotation,
  setSelectedHandCardId,
  setSelectedJaguarTargetPieceId,
  setSelectedOpponentPlayerId,
  setSelectedPieceId,
  setSelectedRemovalPieceIds,
  setSelectedWolfResources,
  setSelectedWolfTargetPieceId
}: SelectionGuardsParams) {
  useEffect(() => {
    if (!selectedOpponentPlayerId) {
      return;
    }
    if (
      !hasStartedGame ||
      cleanBoardMode ||
      !opponentInspectorEntries.some((entry) => entry.player.playerId === selectedOpponentPlayerId)
    ) {
      setSelectedOpponentPlayerId(null);
    }
  }, [
    cleanBoardMode,
    hasStartedGame,
    opponentInspectorEntries,
    selectedOpponentPlayerId,
    setSelectedOpponentPlayerId
  ]);

  useEffect(() => {
    if (selectedHandCardId && !handCards.some((card) => card.id === selectedHandCardId)) {
      setSelectedHandCardId(null);
      setSelectedCardRotation(0);
    }
  }, [handCards, selectedHandCardId, setSelectedCardRotation, setSelectedHandCardId]);

  useEffect(() => {
    if (selectedPieceId && !selectablePieceIds.includes(selectedPieceId)) {
      setSelectedPieceId(null);
    }
  }, [selectablePieceIds, selectedPieceId, setSelectedPieceId]);

  useEffect(() => {
    if (selectedJaguarTargetPieceId && !jaguarTargetPieceIds.includes(selectedJaguarTargetPieceId)) {
      setSelectedJaguarTargetPieceId(null);
    }
  }, [jaguarTargetPieceIds, selectedJaguarTargetPieceId, setSelectedJaguarTargetPieceId]);

  useEffect(() => {
    if (selectedWolfTargetPieceId && !selectablePieceIds.includes(selectedWolfTargetPieceId)) {
      setSelectedWolfTargetPieceId(null);
    }
  }, [selectablePieceIds, selectedWolfTargetPieceId, setSelectedWolfTargetPieceId]);

  useEffect(() => {
    const spendableResources = game?.activePlayerId
      ? getWolfSpendableResourceTypes(game, game.activePlayerId)
      : [];
    const nextSelected = selectedWolfResources.filter((resource) =>
      spendableResources.includes(resource)
    );
    if (nextSelected.length !== selectedWolfResources.length) {
      setSelectedWolfResources(nextSelected);
    }
  }, [game, selectedWolfResources, setSelectedWolfResources]);

  useEffect(() => {
    const nextSelected = selectedRemovalPieceIds.filter((pieceId) =>
      selectablePieceIds.includes(pieceId)
    );
    if (nextSelected.length !== selectedRemovalPieceIds.length) {
      setSelectedRemovalPieceIds(nextSelected);
    }
  }, [selectablePieceIds, selectedRemovalPieceIds, setSelectedRemovalPieceIds]);

  useEffect(() => {
    if (!cacaIlegalPending || cacaIlegalPending.playerId !== controlledPlayerId) {
      setCacaIlegalRemovalMode(false);
    }
  }, [cacaIlegalPending, controlledPlayerId, setCacaIlegalRemovalMode]);
}
