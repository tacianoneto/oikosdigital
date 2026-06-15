import { speciesDefinitions } from "@oikos/content";
export { gridPositionKey as positionKey } from "@oikos/shared";
import type { ActionId, GameState, GridPosition, PlayerState } from "@oikos/shared";

/**
 * Shared, side-effect-free helpers for reading and copying game state.
 *
 * These were previously defined privately inside setup.ts. They are pure leaves
 * (they only depend on the game state plus species content), so they live here
 * as the common toolbox that setup.ts and the per-species modules can both use
 * without creating circular imports.
 *
 */

export function findPlayer(game: GameState, playerId: string): PlayerState {
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player) {
    throw new Error("Jogador não encontrado.");
  }

  return player;
}

export function getCurrentAction(game: GameState): ActionId | null {
  if (!game.activePlayerId) {
    return null;
  }

  const player = findPlayer(game, game.activePlayerId);
  if (!player.speciesId) {
    return null;
  }

  return speciesDefinitions[player.speciesId].actions[game.activeActionIndex] ?? null;
}

export function toGridPosition(location: GridPosition): GridPosition {
  return {
    x: location.x,
    y: location.y
  };
}

export function pushUniqueWarning(game: GameState, warning: string): void {
  if (!game.contentWarnings.includes(warning)) {
    game.contentWarnings = [...game.contentWarnings, warning];
  }
}

export function cloneGameState(game: GameState): GameState {
  return {
    ...game,
    enabledMiniExpansions: [...(game.enabledMiniExpansions ?? [])],
    activeScenarioIds: [...(game.activeScenarioIds ?? [])],
    activeThreatCardId: game.activeThreatCardId ?? null,
    threatDeckIds: [...(game.threatDeckIds ?? [])],
    threatDiscardIds: [...(game.threatDiscardIds ?? [])],
    cerradoTriggeredByPlayer: { ...(game.cerradoTriggeredByPlayer ?? {}) },
    cerradoPending: game.cerradoPending
      ? {
          ...game.cerradoPending,
          location: { ...game.cerradoPending.location }
        }
      : null,
    caatingaUsedByPlayer: { ...(game.caatingaUsedByPlayer ?? {}) },
    caatingaPending: game.caatingaPending
      ? {
          ...game.caatingaPending,
          location: { ...game.caatingaPending.location }
        }
      : null,
    mataAtlanticaPiles: game.mataAtlanticaPiles
      ? game.mataAtlanticaPiles.map((pile) => [...pile])
      : null,
    mataAtlanticaDiscardByPlayer: { ...(game.mataAtlanticaDiscardByPlayer ?? {}) },
    cacaIlegalPending: game.cacaIlegalPending ? { ...game.cacaIlegalPending } : null,
    pendingCoatiPairBonus: game.pendingCoatiPairBonus
      ? {
          ...game.pendingCoatiPairBonus,
          origin: { ...game.pendingCoatiPairBonus.origin }
        }
      : null,
    pendingMacawMovedPiece: game.pendingMacawMovedPiece
      ? {
          ...game.pendingMacawMovedPiece,
          location: { ...game.pendingMacawMovedPiece.location }
        }
      : null,
    pendingGaloMovedPiece: game.pendingGaloMovedPiece ? { ...game.pendingGaloMovedPiece } : null,
    pendingGaloAdjacentAdd: game.pendingGaloAdjacentAdd
      ? {
          ...game.pendingGaloAdjacentAdd,
          location: { ...game.pendingGaloAdjacentAdd.location }
        }
      : null,
    pendingWolfMoves: game.pendingWolfMoves
      ? {
          ...game.pendingWolfMoves,
          pieceIds: [...game.pendingWolfMoves.pieceIds]
        }
      : null,
    pendingExtraTurnPlayerId: game.pendingExtraTurnPlayerId ?? null,
    extraTurnPlayerId: game.extraTurnPlayerId ?? null,
    resolvedExtraTurnPlayerIds: [...(game.resolvedExtraTurnPlayerIds ?? [])],
    pendingSeedSpendObjectivePlayerId: game.pendingSeedSpendObjectivePlayerId ?? null,
    acceptedSeedSpendObjectivePlayerIds: [...(game.acceptedSeedSpendObjectivePlayerIds ?? [])],
    resolvedSeedSpendObjectivePlayerIds: [...(game.resolvedSeedSpendObjectivePlayerIds ?? [])],
    resolvedCoatiPairBonuses: [...game.resolvedCoatiPairBonuses],
    players: game.players.map((player) => ({
      ...player,
      resources: { ...player.resources },
      hand: [...player.hand],
      objectiveChoices: [...(player.objectiveChoices ?? [])],
      discardedObjectiveCardId: player.discardedObjectiveCardId ?? null,
      reservePieces: [...player.reservePieces],
      piecesInForest: [...player.piecesInForest]
    })),
    pieces: game.pieces.map((piece) => ({
      ...piece,
      location: piece.location ? { ...piece.location } : null,
      state: { ...piece.state }
    })),
    forest: {
      cards: game.forest.cards.map((card) => ({ ...card }))
    },
    deck: {
      commonCardIds: [...game.deck.commonCardIds],
      initialCandidateIds: [...game.deck.initialCandidateIds]
    },
    log: [...game.log],
    contentWarnings: [...game.contentWarnings],
    finalScoreBreakdown: game.finalScoreBreakdown
      ? {
          resourceMajorities: game.finalScoreBreakdown.resourceMajorities.map((entry) => ({
            ...entry,
            winnerPlayerIds: [...entry.winnerPlayerIds]
          })),
          entries: game.finalScoreBreakdown.entries.map((entry) => ({ ...entry })),
          pointCap: game.finalScoreBreakdown.pointCap
        }
      : null,
    winnerPlayerIds: [...game.winnerPlayerIds]
  };
}
