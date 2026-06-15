import { describe, expect, it } from "vitest";
import { getCardDefinitionOrNull, getRotatedConnections } from "./forest";
import { createPreviewInitialForest, pickInitialForest } from "./initialForest";

const riverCardIds = new Set([
  "initial_1",
  "initial_1_v",
  "initial_8",
  "initial_8_v",
  "initial_9",
  "initial_9_v"
]);

describe("initial forest", () => {
  it("keeps preview deterministic with nine unique positions", () => {
    const first = createPreviewInitialForest();
    const second = createPreviewInitialForest();

    expect(first).toEqual(second);
    expect(first).toHaveLength(9);
    expect(new Set(first.map((card) => `${card.x}:${card.y}`)).size).toBe(9);
    expect(first.filter((card) => riverCardIds.has(card.definitionId))).toHaveLength(3);
  });

  it("keeps every internal river edge matched", () => {
    const cards = pickInitialForest(() => 0.73);
    const byPosition = new Map(cards.map((card) => [`${card.x}:${card.y}`, card]));
    const directions = [
      ["north", 0, -1, "south"],
      ["east", 1, 0, "west"],
      ["south", 0, 1, "north"],
      ["west", -1, 0, "east"]
    ] as const;

    for (const card of cards) {
      const definition = getCardDefinitionOrNull(card.definitionId);
      expect(definition).not.toBeNull();
      const connections = getRotatedConnections(definition!, card.rotation);

      for (const [direction, x, y, opposite] of directions) {
        const neighbor = byPosition.get(`${card.x + x}:${card.y + y}`);
        if (!neighbor) {
          continue;
        }
        const neighborDefinition = getCardDefinitionOrNull(neighbor.definitionId);
        expect(neighborDefinition).not.toBeNull();
        const neighborConnections = getRotatedConnections(neighborDefinition!, neighbor.rotation);
        expect(connections[direction] === "river").toBe(neighborConnections[opposite] === "river");
      }
    }
  });

  it("varies templates and land order with the random source", () => {
    expect(pickInitialForest(() => 0)).not.toEqual(pickInitialForest(() => 0.99));
  });
});
