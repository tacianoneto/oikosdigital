import {
  getForestCardDefinition,
  getObjectiveCardDefinition,
  objectiveCardsById
} from "@oikos/content";
import {
  getObjectiveProgressPoints,
  isObjectiveCompleted
} from "@oikos/rules";
import type {
  ForestCardDefinition,
  GameState,
  Habitat,
  ObjectiveCardDefinition,
  PlayerState,
  Resource
} from "@oikos/shared";
import { resourceOrder } from "../ui/gameConstants";

export type HandSortMode = "habitat" | "resource";

export interface SortedHandCard {
  card: ForestCardDefinition;
  index: number;
}

export interface PlayerCardState {
  canDiscardSelectedObjective: boolean;
  discardedObjectiveCard: ObjectiveCardDefinition | null;
  handCards: ForestCardDefinition[];
  handSortLabel: string;
  mataAtlanticaPileIndexByCardId: Map<string, number>;
  mataAtlanticaPileTopIds: string[];
  needsObjectiveChoice: boolean;
  nextHandSortLabel: string;
  nextHandSortMode: HandSortMode;
  objectiveChoices: ObjectiveCardDefinition[];
  objectivePreviewCard: ObjectiveCardDefinition | null;
  objectiveWasDiscarded: boolean;
  selectedObjectiveCard: ObjectiveCardDefinition | null;
  selectedObjectiveCompleted: boolean;
  selectedObjectiveProgress: number;
  selectedObjectiveScoresPoints: boolean;
  sortedHandCards: SortedHandCard[];
}

const handHabitatOrder: Habitat[] = ["forest", "field", "river"];

export function getPlayerCardState(
  game: GameState | null | undefined,
  player: PlayerState | null | undefined,
  handSortMode: HandSortMode,
  isSpectator: boolean,
  pendingObjectiveCardId: string | null
): PlayerCardState {
  const mataAtlanticaPileTopIds =
    game?.mataAtlanticaPiles
      ?.map((pile) => pile[0])
      .filter((id): id is string => Boolean(id)) ?? [];
  const mataAtlanticaPileIndexByCardId = new Map<string, number>();
  mataAtlanticaPileTopIds.forEach((id, index) => {
    mataAtlanticaPileIndexByCardId.set(id, index);
  });

  const handCards = [
    ...(player?.hand ?? []).map((cardId) => getForestCardDefinition(cardId)),
    ...mataAtlanticaPileTopIds.map((cardId) => getForestCardDefinition(cardId))
  ];
  const habitatRank = new Map(
    handHabitatOrder.map((habitat, index) => [habitat, index])
  );
  const resourceRank = new Map(
    resourceOrder.map((resource, index) => [resource, index])
  );
  const sortedHandCards = handCards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      if (handSortMode === "habitat") {
        return (
          (habitatRank.get(a.card.habitat as Habitat) ?? 99) -
            (habitatRank.get(b.card.habitat as Habitat) ?? 99) ||
          a.index - b.index
        );
      }
      return (
        (resourceRank.get(a.card.resource as Resource) ?? 99) -
          (resourceRank.get(b.card.resource as Resource) ?? 99) ||
        a.index - b.index
      );
    });

  const objectiveChoices = (player?.objectiveChoices ?? [])
    .map((cardId) => objectiveCardsById.get(cardId))
    .filter((card): card is ObjectiveCardDefinition => Boolean(card));
  const selectedObjectiveCard = player?.selectedObjectiveCardId
    ? getObjectiveCardDefinition(player.selectedObjectiveCardId)
    : null;
  const discardedObjectiveCard = player?.discardedObjectiveCardId
    ? getObjectiveCardDefinition(player.discardedObjectiveCardId)
    : null;
  const objectiveWasDiscarded = Boolean(discardedObjectiveCard);
  const objectivePreviewCard = selectedObjectiveCard ?? discardedObjectiveCard;
  const selectedObjectiveCompleted = Boolean(
    game &&
      player?.selectedObjectiveCardId &&
      isObjectiveCompleted(game, player.playerId)
  );
  const selectedObjectiveScoresPoints = Boolean(
    selectedObjectiveCard &&
      selectedObjectiveCard.scoring.kind !== "discard_for_resources" &&
      selectedObjectiveCard.scoring.kind !== "extra_turn"
  );
  const selectedObjectiveProgress =
    game && player?.selectedObjectiveCardId && selectedObjectiveScoresPoints
      ? getObjectiveProgressPoints(game, player.playerId)
      : 0;
  const nextHandSortMode: HandSortMode =
    handSortMode === "habitat" ? "resource" : "habitat";

  return {
    canDiscardSelectedObjective: Boolean(
      !isSpectator &&
        player &&
        game?.status === "active" &&
        selectedObjectiveCard?.scoring.kind === "discard_for_resources"
    ),
    discardedObjectiveCard,
    handCards,
    handSortLabel: handSortMode === "habitat" ? "Habitat" : "Recurso",
    mataAtlanticaPileIndexByCardId,
    mataAtlanticaPileTopIds,
    needsObjectiveChoice: Boolean(
      player &&
        objectiveChoices.length > 0 &&
        !player.selectedObjectiveCardId &&
        !pendingObjectiveCardId
    ),
    nextHandSortLabel:
      nextHandSortMode === "habitat" ? "habitat" : "recurso",
    nextHandSortMode,
    objectiveChoices,
    objectivePreviewCard,
    objectiveWasDiscarded,
    selectedObjectiveCard,
    selectedObjectiveCompleted,
    selectedObjectiveProgress,
    selectedObjectiveScoresPoints,
    sortedHandCards
  };
}
