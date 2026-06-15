import type { ForestCardState } from "@oikos/shared";
import { gridPositionKey } from "@oikos/shared";
import {
  connectionDirections,
  directionOffsets,
  getCardDefinitionOrNull,
  getRotatedConnections,
  oppositeDirection
} from "./forest";

interface RiverCardSpec {
  definitionId: string;
  x: number;
  y: number;
  rotation: ForestCardState["rotation"];
}

interface ForestTemplate {
  name: string;
  river: RiverCardSpec[];
}

const RIVER_EGG_CHANNEL = "initial_1";
const RIVER_EGG_BEND = "initial_1_v";
const RIVER_SEED_BEND = "initial_8";
const RIVER_SEED_END = "initial_8_v";
const RIVER_MEAT_CHANNEL = "initial_9";
const RIVER_MEAT_END = "initial_9_v";

const RIVER_FACE_PAIRS: Array<[string, string]> = [
  [RIVER_EGG_CHANNEL, RIVER_EGG_BEND],
  [RIVER_SEED_BEND, RIVER_SEED_END],
  [RIVER_MEAT_CHANNEL, RIVER_MEAT_END]
];

const RIVER_CARD_IDS = new Set(RIVER_FACE_PAIRS.flat());
const LAND_CARD_IDS = ["initial_2", "initial_3", "initial_4", "initial_5", "initial_6", "initial_7"];
const GRID_RANGE = [-1, 0, 1];

// Predefined 3x3 boards keep every river connection valid. Land cards are
// shuffled independently, preserving river topology while varying each game.
const FOREST_TEMPLATES: ForestTemplate[] = [
  {
    name: "rio-coluna-central-lago",
    river: [
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_MEAT_CHANNEL, x: 0, y: 0, rotation: 0 },
      { definitionId: RIVER_SEED_END, x: 0, y: 1, rotation: 0 }
    ]
  },
  {
    name: "rio-coluna-esq-lago",
    river: [
      { definitionId: RIVER_EGG_CHANNEL, x: -1, y: -1, rotation: 0 },
      { definitionId: RIVER_MEAT_CHANNEL, x: -1, y: 0, rotation: 0 },
      { definitionId: RIVER_SEED_END, x: -1, y: 1, rotation: 0 }
    ]
  },
  {
    name: "rio-coluna-dir-lago",
    river: [
      { definitionId: RIVER_EGG_CHANNEL, x: 1, y: -1, rotation: 0 },
      { definitionId: RIVER_MEAT_CHANNEL, x: 1, y: 0, rotation: 0 },
      { definitionId: RIVER_SEED_END, x: 1, y: 1, rotation: 0 }
    ]
  },
  {
    name: "rio-linha-topo-lago",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: -1, y: -1, rotation: 90 },
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: -1, rotation: 90 },
      { definitionId: RIVER_SEED_END, x: 1, y: -1, rotation: 270 }
    ]
  },
  {
    name: "rio-linha-central-lago",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: -1, y: 0, rotation: 90 },
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: 0, rotation: 90 },
      { definitionId: RIVER_SEED_END, x: 1, y: 0, rotation: 270 }
    ]
  },
  {
    name: "rio-linha-base-lago",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: -1, y: 1, rotation: 90 },
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: 1, rotation: 90 },
      { definitionId: RIVER_SEED_END, x: 1, y: 1, rotation: 270 }
    ]
  },
  {
    name: "rio-L-centro-leste",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: 0, rotation: 0 },
      { definitionId: RIVER_SEED_END, x: 1, y: 0, rotation: 270 }
    ]
  },
  {
    name: "rio-L-centro-oeste",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: 0, rotation: 270 },
      { definitionId: RIVER_SEED_END, x: -1, y: 0, rotation: 90 }
    ]
  },
  {
    name: "rio-tres-nascentes",
    river: [
      { definitionId: RIVER_EGG_BEND, x: -1, y: -1, rotation: 270 },
      { definitionId: RIVER_SEED_BEND, x: 1, y: -1, rotation: 0 },
      { definitionId: RIVER_MEAT_END, x: 0, y: 1, rotation: 180 }
    ]
  },
  {
    name: "rio-tres-nascentes-2",
    river: [
      { definitionId: RIVER_EGG_BEND, x: -1, y: 1, rotation: 180 },
      { definitionId: RIVER_SEED_END, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_MEAT_END, x: 1, y: 0, rotation: 90 }
    ]
  },
  {
    name: "rio-L-base-leste",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: 0, y: 1, rotation: 0 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: 0, rotation: 90 },
      { definitionId: RIVER_SEED_END, x: 1, y: 0, rotation: 270 }
    ]
  },
  {
    name: "rio-L-base-oeste",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: 0, y: 1, rotation: 0 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: 0, rotation: 180 },
      { definitionId: RIVER_SEED_END, x: -1, y: 0, rotation: 90 }
    ]
  },
  {
    name: "rio-curva-topo-esq",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: -1, y: -1, rotation: 90 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: -1, rotation: 180 },
      { definitionId: RIVER_SEED_END, x: 0, y: 0, rotation: 0 }
    ]
  },
  {
    name: "rio-curva-topo-dir",
    river: [
      { definitionId: RIVER_MEAT_CHANNEL, x: 1, y: -1, rotation: 90 },
      { definitionId: RIVER_EGG_BEND, x: 0, y: -1, rotation: 90 },
      { definitionId: RIVER_SEED_END, x: 0, y: 0, rotation: 0 }
    ]
  },
  {
    name: "rio-zigue-leste",
    river: [
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_SEED_BEND, x: 0, y: 0, rotation: 0 },
      { definitionId: RIVER_MEAT_END, x: 1, y: 0, rotation: 270 }
    ]
  },
  {
    name: "rio-zigue-oeste",
    river: [
      { definitionId: RIVER_EGG_CHANNEL, x: 0, y: -1, rotation: 0 },
      { definitionId: RIVER_SEED_BEND, x: 0, y: 0, rotation: 270 },
      { definitionId: RIVER_MEAT_END, x: -1, y: 0, rotation: 90 }
    ]
  },
  {
    name: "rio-tres-nascentes-3",
    river: [
      { definitionId: RIVER_EGG_BEND, x: 1, y: 1, rotation: 90 },
      { definitionId: RIVER_SEED_BEND, x: -1, y: -1, rotation: 270 },
      { definitionId: RIVER_MEAT_END, x: 0, y: -1, rotation: 0 }
    ]
  },
  {
    name: "rio-tres-nascentes-4",
    river: [
      { definitionId: RIVER_EGG_BEND, x: 1, y: -1, rotation: 0 },
      { definitionId: RIVER_SEED_END, x: -1, y: 0, rotation: 270 },
      { definitionId: RIVER_MEAT_END, x: 0, y: 1, rotation: 180 }
    ]
  }
];

function assertForestRiverComposition(cards: ForestCardState[], templateName: string): void {
  const riverCards = cards.filter((card) => RIVER_CARD_IDS.has(card.definitionId));
  if (riverCards.length !== 3) {
    throw new Error(`Mesa inicial "${templateName}" precisa de exatamente 3 rios, tem ${riverCards.length}.`);
  }

  const riverIds = riverCards.map((card) => card.definitionId);
  for (const [front, back] of RIVER_FACE_PAIRS) {
    const usedFaces = riverIds.filter((id) => id === front || id === back).length;
    if (usedFaces !== 1) {
      throw new Error(
        `Mesa inicial "${templateName}" deve usar exatamente uma face do rio ${front}/${back}, usou ${usedFaces}.`
      );
    }
  }

  const landCards = cards.filter((card) => LAND_CARD_IDS.includes(card.definitionId));
  if (landCards.length !== LAND_CARD_IDS.length) {
    throw new Error(`Mesa inicial "${templateName}" precisa das ${LAND_CARD_IDS.length} cartas de terra.`);
  }
}

function buildForestFromTemplate(
  template: ForestTemplate,
  landOrder: readonly string[] = LAND_CARD_IDS
): ForestCardState[] {
  const riverByPos = new Map(template.river.map((spec) => [gridPositionKey(spec), spec]));
  const cards: ForestCardState[] = [];
  let landIndex = 0;

  for (const y of GRID_RANGE) {
    for (const x of GRID_RANGE) {
      const river = riverByPos.get(`${x}:${y}`);
      const definitionId = river?.definitionId ?? landOrder[landIndex++];
      cards.push({
        instanceId: `setup_${definitionId}`,
        definitionId,
        x,
        y,
        rotation: river?.rotation ?? 0,
        isInitial: true
      });
    }
  }

  return cards;
}

function assertForestRiverConsistency(cards: ForestCardState[], templateName: string): void {
  const byPos = new Map(cards.map((card) => [gridPositionKey(card), card]));

  for (const card of cards) {
    const definition = getCardDefinitionOrNull(card.definitionId);
    if (!definition) {
      throw new Error(`Mesa inicial "${templateName}" usa carta desconhecida: ${card.definitionId}`);
    }

    const connections = getRotatedConnections(definition, card.rotation);
    for (const direction of connectionDirections) {
      const offset = directionOffsets[direction];
      const neighbor = byPos.get(gridPositionKey({ x: card.x + offset.x, y: card.y + offset.y }));
      if (!neighbor) {
        continue;
      }

      const neighborDefinition = getCardDefinitionOrNull(neighbor.definitionId);
      if (!neighborDefinition) {
        throw new Error(`Mesa inicial "${templateName}" usa carta desconhecida: ${neighbor.definitionId}`);
      }

      const neighborConnections = getRotatedConnections(neighborDefinition, neighbor.rotation);
      const here = connections[direction] === "river";
      const there = neighborConnections[oppositeDirection[direction]] === "river";
      if (here !== there) {
        throw new Error(
          `Mesa inicial "${templateName}" tem rio mal encaixado entre (${card.x},${card.y}) e (${neighbor.x},${neighbor.y}).`
        );
      }
    }
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [shuffled[targetIndex], shuffled[index]];
  }
  return shuffled;
}

const VALIDATED_FOREST_TEMPLATES = FOREST_TEMPLATES.map((template) => {
  const cards = buildForestFromTemplate(template);
  assertForestRiverConsistency(cards, template.name);
  assertForestRiverComposition(cards, template.name);
  return template;
});

export function pickInitialForest(random: () => number = Math.random): ForestCardState[] {
  const index = Math.min(
    VALIDATED_FOREST_TEMPLATES.length - 1,
    Math.floor(random() * VALIDATED_FOREST_TEMPLATES.length)
  );
  return buildForestFromTemplate(VALIDATED_FOREST_TEMPLATES[index], shuffle([...LAND_CARD_IDS], random));
}

export function createPreviewInitialForest(): ForestCardState[] {
  return buildForestFromTemplate(VALIDATED_FOREST_TEMPLATES[0]);
}
