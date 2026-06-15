import {
  getArmadilloSharingDetails,
  getCapuchinScoringHabitats,
  getGaloFieldCardPositions,
  getGaloSeedCardPositions,
  getMacawScoringLines
} from "@oikos/rules";
import type {
  ActionId,
  GameState,
  GridPosition,
  Habitat,
  SpeciesId
} from "@oikos/shared";
import { gridPositionKey } from "@oikos/shared";
import type {
  ScoringCardHighlight,
  ScoringLineHighlight
} from "../game/ForestPhaserScene";
import {
  HABITAT_SCORE_COLORS,
  habitatShortLabel
} from "../ui/gameConstants";

type ArmadilloSharingDetails = ReturnType<typeof getArmadilloSharingDetails>;
type CapuchinScoringHabitats = ReturnType<typeof getCapuchinScoringHabitats>;

export interface ScoringPreview {
  armadillo: ArmadilloSharingDetails | null;
  cardHighlights: ScoringCardHighlight[];
  habitats: CapuchinScoringHabitats;
  lineHighlights: ScoringLineHighlight[];
  lines: number;
}

const EMPTY_SCORING_PREVIEW: ScoringPreview = {
  armadillo: null,
  cardHighlights: [],
  habitats: [],
  lineHighlights: [],
  lines: 0
};

export function getScoringPreview(
  game: GameState | null | undefined,
  activeActionId: ActionId | null,
  activeSpeciesId: SpeciesId | null
): ScoringPreview {
  if (
    !game ||
    game.status !== "active" ||
    !game.activePlayerId ||
    activeActionId !== "D"
  ) {
    return EMPTY_SCORING_PREVIEW;
  }

  if (activeSpeciesId === "macaw") {
    const lines = getMacawScoringLines(game, game.activePlayerId);
    return {
      ...EMPTY_SCORING_PREVIEW,
      lineHighlights: lines.map((line) => ({
        positions: line.positions,
        label: "+1",
        color: 0x3a7fc4
      })),
      lines: lines.length
    };
  }

  if (activeSpeciesId === "capuchin") {
    const habitats = getCapuchinScoringHabitats(game, game.activePlayerId);
    return {
      ...EMPTY_SCORING_PREVIEW,
      cardHighlights: habitats.flatMap((group) =>
        group.positions.map((position) => {
          const habitat = group.habitat as Habitat;
          return {
            position,
            label: `${habitatShortLabel[habitat]} +1`,
            color: HABITAT_SCORE_COLORS[habitat]
          };
        })
      ),
      habitats
    };
  }

  if (activeSpeciesId === "galo_de_campina") {
    const seedPositions = getGaloSeedCardPositions(game, game.activePlayerId);
    const fieldPositions = getGaloFieldCardPositions(game, game.activePlayerId);
    const seedKeys = new Set(seedPositions.map(gridPositionKey));
    return {
      ...EMPTY_SCORING_PREVIEW,
      cardHighlights: [
        ...fieldPositions.map((position) => ({
          position,
          label: seedKeys.has(gridPositionKey(position)) ? "campina +" : "campina",
          resource: seedKeys.has(gridPositionKey(position)) ? "seed" as const : undefined,
          color: 0x6fae46
        })),
        ...seedPositions
          .filter(
            (position) =>
              !fieldPositions.some(
                (field) => field.x === position.x && field.y === position.y
              )
          )
          .map((position) => ({
            position,
            label: "",
            resource: "seed" as const,
            color: 0xd94b3f
          }))
      ]
    };
  }

  if (activeSpeciesId === "armadillo") {
    const armadillo = getArmadilloSharingDetails(game, game.activePlayerId);
    const rivalSpeciesByTile = new Map<string, SpeciesId[]>();
    for (const piece of game.pieces) {
      if (!piece.location || piece.speciesId === "armadillo") continue;
      const key = gridPositionKey(piece.location);
      const speciesIds = rivalSpeciesByTile.get(key) ?? [];
      if (!speciesIds.includes(piece.speciesId)) {
        speciesIds.push(piece.speciesId);
        rivalSpeciesByTile.set(key, speciesIds);
      }
    }
    return {
      ...EMPTY_SCORING_PREVIEW,
      armadillo,
      cardHighlights: armadillo.sharedPositions.map((position) => ({
        position,
        label: "compartilha",
        color: 0xf2c14e,
        speciesIds: rivalSpeciesByTile.get(gridPositionKey(position)) ?? []
      }))
    };
  }

  return EMPTY_SCORING_PREVIEW;
}
