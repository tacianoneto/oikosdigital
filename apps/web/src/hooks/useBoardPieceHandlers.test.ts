import { forestCardsById } from "@oikos/content";
import { createInitialGameState, createPreviewInitialForest } from "@oikos/rules";
import type { GameState, RoomPlayer } from "@oikos/shared";
import { describe, expect, it } from "vitest";
import { shouldPromptJaguarRemovalTargetBeforeMove } from "./useBoardPieceHandlers";

const players: RoomPlayer[] = [
  {
    playerId: "jaguar",
    name: "Onca",
    speciesId: "jaguar",
    ready: true,
    connected: true
  },
  {
    playerId: "galo",
    name: "Galo",
    speciesId: "galo_de_campina",
    ready: true,
    connected: true
  },
  {
    playerId: "wolf",
    name: "Lobo",
    speciesId: "maned_wolf",
    ready: true,
    connected: true
  }
];

function createJaguarMoveIntoGaloFieldGame(withAdjacentTarget: boolean): {
  field: { x: number; y: number };
  game: GameState;
  jaguarPieceId: string;
} {
  const base = createInitialGameState("jaguar-galo-ui", players, () => 0.999999, createPreviewInitialForest());
  const cards = base.forest.cards;
  const hasCardAt = (position: { x: number; y: number }) =>
    cards.some((card) => card.x === position.x && card.y === position.y);
  const adjacentPositions = (position: { x: number; y: number }) => [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y }
  ];
  const fieldCard = cards.find((card) => {
    const definition = forestCardsById.get(card.definitionId);
    return definition?.habitat === "field" && (!withAdjacentTarget || adjacentPositions(card).some(hasCardAt));
  })!;
  const adjacent = adjacentPositions(fieldCard).find(hasCardAt);
  const field = { x: fieldCard.x, y: fieldCard.y };
  const jaguarPieceId = base.pieces.find((piece) => piece.ownerId === "jaguar")!.pieceId;
  const galoPieceId = base.pieces.find((piece) => piece.ownerId === "galo")!.pieceId;
  const wolfPieceId = base.pieces.find((piece) => piece.ownerId === "wolf")!.pieceId;

  return {
    field,
    jaguarPieceId,
    game: {
      ...base,
      status: "active",
      activePlayerId: "jaguar",
      activeActionIndex: 0,
      forest: {
        ...base.forest,
        cards: withAdjacentTarget && adjacent
          ? [fieldCard, cards.find((card) => card.x === adjacent.x && card.y === adjacent.y)!]
          : [fieldCard]
      },
      pieces: base.pieces.map((piece) => {
        if (piece.pieceId === jaguarPieceId) return { ...piece, location: { x: field.x - 1, y: field.y, siteId: "main" } };
        if (piece.pieceId === galoPieceId) return { ...piece, location: { x: field.x, y: field.y, siteId: "main" } };
        if (piece.pieceId === wolfPieceId) return { ...piece, location: { x: field.x, y: field.y, siteId: "main" } };
        return piece;
      })
    }
  };
}

describe("shouldPromptJaguarRemovalTargetBeforeMove", () => {
  it("prompts before moving when a Galo is in the field but cannot interrupt", () => {
    const setup = createJaguarMoveIntoGaloFieldGame(false);

    expect(
      shouldPromptJaguarRemovalTargetBeforeMove(setup.game, "jaguar", setup.jaguarPieceId, setup.field)
    ).toBe(true);
  });

  it("lets the move proceed when the Galo can interrupt", () => {
    const setup = createJaguarMoveIntoGaloFieldGame(true);

    expect(
      shouldPromptJaguarRemovalTargetBeforeMove(setup.game, "jaguar", setup.jaguarPieceId, setup.field)
    ).toBe(false);
  });
});
