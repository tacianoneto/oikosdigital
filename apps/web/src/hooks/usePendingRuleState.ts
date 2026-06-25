import { useMemo } from "react";
import { getObjectiveCardDefinition, speciesDefinitions } from "@oikos/content";
import {
  getCacaIlegalRemovablePieceIds,
  getCacaIlegalTopResources
} from "@oikos/rules";
import type { GameState, PieceState, PlayerState } from "@oikos/shared";

type PendingCacaIlegal = NonNullable<GameState["cacaIlegalPending"]>;

interface PendingRuleStateParams {
  controlledPlayerId: string | null;
  currentGamePlayer: PlayerState | null | undefined;
  cacaIlegalPending: PendingCacaIlegal | null;
  game: GameState | null | undefined;
  isLocalRoom: boolean;
  mataAtlanticaPileTopIds: string[];
}

export function usePendingRuleState({
  controlledPlayerId,
  currentGamePlayer,
  cacaIlegalPending,
  game,
  isLocalRoom,
  mataAtlanticaPileTopIds
}: PendingRuleStateParams) {
  return useMemo(() => {
    const setupSpecies = currentGamePlayer?.speciesId ? speciesDefinitions[currentGamePlayer.speciesId] : null;
    const setupPlaced = currentGamePlayer?.piecesInForest.length ?? 0;
    const setupNeeded = setupSpecies?.initialPieces ?? 0;
    const caatingaPending = game?.caatingaPending ?? null;
    const caatingaGamePlayer = caatingaPending
      ? game?.players.find((candidate) => candidate.playerId === caatingaPending.playerId) ?? null
      : null;
    const cacaIlegalGamePlayer = cacaIlegalPending
      ? game?.players.find((candidate) => candidate.playerId === cacaIlegalPending.playerId) ?? null
      : null;
    const cacaIlegalTopResources = game && cacaIlegalPending
      ? getCacaIlegalTopResources(game, cacaIlegalPending.playerId)
      : [];
    const cacaIlegalRemovablePieceIds = game && cacaIlegalPending
      ? getCacaIlegalRemovablePieceIds(game, cacaIlegalPending.playerId)
      : [];
    const cacaIlegalRemovablePieces = game
      ? cacaIlegalRemovablePieceIds
          .map((pieceId) => game.pieces.find((piece) => piece.pieceId === pieceId) ?? null)
          .filter((piece): piece is PieceState => Boolean(piece))
      : [];
    const cerradoPending = game?.cerradoPending ?? null;
    const cerradoGamePlayer = cerradoPending
      ? game?.players.find((candidate) => candidate.playerId === cerradoPending.playerId) ?? null
      : null;
    const canResolveCacaIlegal = Boolean(cacaIlegalPending && controlledPlayerId === cacaIlegalPending.playerId);
    const canResolveCaatinga = Boolean(caatingaPending && controlledPlayerId === caatingaPending.playerId);
    const canResolveCerrado = Boolean(
      !caatingaPending &&
        !cacaIlegalPending &&
        cerradoPending &&
        controlledPlayerId === cerradoPending.playerId
    );
    const pendingExtraTurnPlayer = game?.pendingExtraTurnPlayerId
      ? game.players.find((player) => player.playerId === game.pendingExtraTurnPlayerId) ?? null
      : null;
    const canResolveExtraTurn = Boolean(
      game?.pendingExtraTurnPlayerId && (isLocalRoom || controlledPlayerId === game.pendingExtraTurnPlayerId)
    );
    const pendingSeedSpendPlayer = game?.pendingSeedSpendObjectivePlayerId
      ? game.players.find((player) => player.playerId === game.pendingSeedSpendObjectivePlayerId) ?? null
      : null;
    const pendingSeedSpendCard = pendingSeedSpendPlayer?.selectedObjectiveCardId
      ? getObjectiveCardDefinition(pendingSeedSpendPlayer.selectedObjectiveCardId)
      : null;
    const pendingSeedSpendCount = pendingSeedSpendCard?.scoring.spendSeedCount ?? 3;
    const pendingSeedSpendPoints = pendingSeedSpendCard?.scoring.points ?? 3;
    const pendingSeedSpendSeeds = pendingSeedSpendPlayer?.resources.seed ?? 0;
    const canResolveSeedSpend = Boolean(
      game?.pendingSeedSpendObjectivePlayerId &&
        !game.pendingExtraTurnPlayerId &&
        (isLocalRoom || controlledPlayerId === game.pendingSeedSpendObjectivePlayerId)
    );
    const mataAtlanticaForcedDiscard = Boolean(
      game &&
        game.status === "active" &&
        game.mataAtlanticaPiles &&
        currentGamePlayer?.speciesId &&
        !speciesDefinitions[currentGamePlayer.speciesId].usesForestCards &&
        game.activePlayerId === currentGamePlayer.playerId &&
        controlledPlayerId === currentGamePlayer.playerId &&
        (game.mataAtlanticaDiscardByPlayer ?? {})[currentGamePlayer.playerId] !== currentGamePlayer.turnsTaken &&
        mataAtlanticaPileTopIds.length > 0 &&
        !caatingaPending &&
        !cerradoPending &&
        !cacaIlegalPending
    );

    return {
      setupSpecies,
      setupPlaced,
      setupNeeded,
      caatingaPending,
      caatingaGamePlayer,
      cacaIlegalGamePlayer,
      cacaIlegalTopResources,
      cacaIlegalRemovablePieceIds,
      cacaIlegalRemovablePieces,
      cerradoPending,
      cerradoGamePlayer,
      canResolveCacaIlegal,
      canResolveCaatinga,
      canResolveCerrado,
      pendingExtraTurnPlayer,
      canResolveExtraTurn,
      pendingSeedSpendPlayer,
      pendingSeedSpendCard,
      pendingSeedSpendCount,
      pendingSeedSpendPoints,
      pendingSeedSpendSeeds,
      canResolveSeedSpend,
      mataAtlanticaForcedDiscard
    };
  }, [
    cacaIlegalPending,
    controlledPlayerId,
    currentGamePlayer,
    game,
    isLocalRoom,
    mataAtlanticaPileTopIds
  ]);
}
