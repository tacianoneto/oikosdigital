import { speciesDefinitions } from "@oikos/content";
import { getAvailableForestExpansionPositionsForCard } from "@oikos/rules";
import type {
  ActionId,
  GameState,
  PlayerState,
  RoomPlayer,
  SpeciesDefinition
} from "@oikos/shared";

const cardRotations = [0, 90, 180, 270] as const;

export interface ActiveActionStateOptions {
  activeSpecies: SpeciesDefinition | null;
  currentGamePlayer: PlayerState | null;
  currentPlayer: RoomPlayer | null;
  game: GameState | null | undefined;
  hasPendingCoatiPairBonus: boolean;
  isLocalRoom: boolean;
  localPlayerId: string | null;
  selectedHandCardId: string | null;
}

export interface ActiveActionState {
  activeActionId: ActionId | null;
  activeIsLocalBot: boolean;
  canControlActivePlayer: boolean;
  canPlaceSelectedForestCard: boolean;
  canPlaceSetupPiece: boolean;
  canSelectHandCards: boolean;
  canSkipExtraTurnNoCardAction: boolean;
  handPlayableThisAction: boolean;
  hasPlayableForestCardThisAction: boolean;
  mataAtlanticaBlocksTurn: boolean;
  needsEndgameOverflowRepair: boolean;
  ownActiveActionId: ActionId | null;
  playableCardIds: Set<string>;
}

export function getActiveActionState({
  activeSpecies,
  currentGamePlayer,
  currentPlayer,
  game,
  hasPendingCoatiPairBonus,
  isLocalRoom,
  localPlayerId,
  selectedHandCardId
}: ActiveActionStateOptions): ActiveActionState {
  const activeActionId =
    activeSpecies && game
      ? activeSpecies.actions[game.activeActionIndex] ?? null
      : null;
  const activeIsLocalBot = Boolean(isLocalRoom && currentPlayer?.isBot);
  const mataAtlanticaBlocksTurn = Boolean(
    game?.mataAtlanticaPiles &&
      currentGamePlayer?.speciesId &&
      !speciesDefinitions[currentGamePlayer.speciesId].usesForestCards &&
      game.activePlayerId === currentGamePlayer.playerId &&
      (game.mataAtlanticaDiscardByPlayer ?? {})[
        currentGamePlayer.playerId
      ] !== currentGamePlayer.turnsTaken &&
      game.mataAtlanticaPiles.some((pile) => pile.length > 0)
  );
  const canControlActivePlayer = Boolean(
    game?.activePlayerId &&
      currentGamePlayer?.playerId === game.activePlayerId &&
      !activeIsLocalBot &&
      !game.caatingaPending &&
      !game.cerradoPending &&
      !mataAtlanticaBlocksTurn
  );
  const ownActiveActionId =
    game?.activePlayerId &&
    currentGamePlayer?.playerId === game.activePlayerId
      ? activeActionId
      : null;
  const canPlaceSetupPiece = Boolean(
    game?.status === "setup" &&
      !activeIsLocalBot &&
      (isLocalRoom || game.setupActivePlayerId === localPlayerId)
  );
  const pileTopIds =
    game?.mataAtlanticaPiles
      ?.map((pile) => pile[0])
      .filter((id): id is string => Boolean(id)) ?? [];
  const playableCardIds = new Set<string>([
    ...(currentGamePlayer?.hand ?? []),
    ...pileTopIds
  ]);
  const handPlayableThisAction = Boolean(
    game?.status === "active" &&
      !hasPendingCoatiPairBonus &&
      !game.activePlayedForestCardId &&
      canControlActivePlayer &&
      activeActionId === "A" &&
      activeSpecies?.usesForestCards
  );
  const canPlaceSelectedForestCard = Boolean(
    handPlayableThisAction &&
      selectedHandCardId &&
      playableCardIds.has(selectedHandCardId)
  );
  const hasPlayableForestCardThisAction = Boolean(
    game &&
      handPlayableThisAction &&
      [...playableCardIds].some((cardId) =>
        cardRotations.some(
          (rotation) =>
            getAvailableForestExpansionPositionsForCard(
              game,
              cardId,
              rotation
            ).length > 0
        )
      )
  );

  return {
    activeActionId,
    activeIsLocalBot,
    canControlActivePlayer,
    canPlaceSelectedForestCard,
    canPlaceSetupPiece,
    canSelectHandCards: game?.status === "active",
    canSkipExtraTurnNoCardAction: Boolean(
      game?.extraTurnPlayerId === game?.activePlayerId &&
        handPlayableThisAction &&
        !hasPlayableForestCardThisAction
    ),
    handPlayableThisAction,
    hasPlayableForestCardThisAction,
    mataAtlanticaBlocksTurn,
    needsEndgameOverflowRepair: Boolean(
      game?.status === "active" &&
        game.round > game.maxRounds &&
        game.activePlayerId &&
        !game.extraTurnPlayerId &&
        !game.pendingExtraTurnPlayerId
    ),
    ownActiveActionId,
    playableCardIds
  };
}
