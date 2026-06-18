import {
  createInitialGameState,
  createPreviewInitialForest,
  getArmadilloSharingDetails,
  getCapuchinScoringHabitats,
  getGaloFieldCardPositions,
  getGaloOutOfFieldPositions,
  getMacawScoringLines
} from "@oikos/rules";
import type { GameState, RoomPlayer } from "@oikos/shared";
import { describe, expect, it } from "vitest";
import { getScoringPreview } from "./scoringPreview";
import {
  createArmadilloTutorialRoom,
  createCapuchinTutorialRoom,
  createMacawTutorialRoom
} from "../ui/tutorials";
import {
  HABITAT_SCORE_COLORS,
  habitatShortLabel
} from "../ui/gameConstants";

function actionD(game: GameState): GameState {
  return { ...game, activeActionIndex: 3, status: "active" };
}

describe("getScoringPreview", () => {
  it("returns empty preview outside action D", () => {
    const game = createMacawTutorialRoom().game!;

    expect(getScoringPreview(game, "C", "macaw")).toEqual({
      armadillo: null,
      cardHighlights: [],
      habitats: [],
      lineHighlights: [],
      lines: 0
    });
    expect(getScoringPreview(null, "D", "macaw").lineHighlights).toEqual([]);
  });

  it("maps Macaw scoring lines without changing order", () => {
    const game = actionD(createMacawTutorialRoom().game!);
    const lines = getMacawScoringLines(game, game.activePlayerId!);
    const preview = getScoringPreview(game, "D", "macaw");

    expect(preview.lines).toBe(lines.length);
    expect(preview.lineHighlights).toEqual(
      lines.map((line) => ({
        positions: line.positions,
        label: "+1",
        color: 0x3a7fc4
      }))
    );
  });

  it("maps Capuchin habitats to labels and colors", () => {
    const game = actionD(createCapuchinTutorialRoom().game!);
    const habitats = getCapuchinScoringHabitats(game, game.activePlayerId!);
    const preview = getScoringPreview(game, "D", "capuchin");

    expect(preview.habitats).toEqual(habitats);
    expect(preview.cardHighlights).toEqual(
      habitats.flatMap((group) =>
        group.positions.map((position) => ({
          position,
          label: `${habitatShortLabel[group.habitat as keyof typeof habitatShortLabel]} +1`,
          color:
            HABITAT_SCORE_COLORS[
              group.habitat as keyof typeof HABITAT_SCORE_COLORS
            ]
        }))
      )
    );
  });

  it("maps Galo field and off-field highlights", () => {
    const players: RoomPlayer[] = [
      {
        playerId: "galo",
        name: "Galo",
        speciesId: "galo_de_campina",
        ready: true,
        connected: true
      },
      {
        playerId: "coati",
        name: "Quati",
        speciesId: "coati",
        ready: true,
        connected: true
      }
    ];
    const base = createInitialGameState(
      "scoring-preview",
      players,
      () => 0.999999,
      createPreviewInitialForest()
    );
    const positions = [
      { x: -1, y: 0, siteId: "main" },
      { x: -1, y: 1, siteId: "main" },
      { x: 0, y: 1, siteId: "main" },
      { x: 1, y: 0, siteId: "main" },
      { x: 1, y: 1, siteId: "main" }
    ];
    const galoPieceIds = base.pieces
      .filter((piece) => piece.ownerId === "galo")
      .slice(0, positions.length)
      .map((piece) => piece.pieceId);
    const game: GameState = {
      ...base,
      status: "active",
      activePlayerId: "galo",
      activeActionIndex: 3,
      pieces: base.pieces.map((piece) => {
        const index = galoPieceIds.indexOf(piece.pieceId);
        return index >= 0 ? { ...piece, location: positions[index]! } : piece;
      })
    };
    const outOfFieldPositions = getGaloOutOfFieldPositions(game, "galo");
    const fieldPositions = getGaloFieldCardPositions(game, "galo");
    const preview = getScoringPreview(game, "D", "galo_de_campina");

    expect(preview.cardHighlights).toHaveLength(fieldPositions.length + outOfFieldPositions.length);
    expect(
      preview.cardHighlights.filter((highlight) => highlight.label === "-1")
    ).toHaveLength(outOfFieldPositions.length);
    expect(
      preview.cardHighlights.filter((highlight) => highlight.label === "campo")
    ).toHaveLength(fieldPositions.length);
  });

  it("maps Armadillo sharing to unique rival species icons", () => {
    const base = actionD(createArmadilloTutorialRoom().game!);
    const armadilloPiece = base.pieces.find(
      (piece) => piece.speciesId === "armadillo" && piece.location
    )!;
    const rivalPieces = base.pieces.filter(
      (piece) => piece.speciesId !== "armadillo"
    );
    const game: GameState = {
      ...base,
      pieces: base.pieces.map((piece) => {
        const rivalIndex = rivalPieces.findIndex(
          (candidate) => candidate.pieceId === piece.pieceId
        );
        return rivalIndex >= 0 && rivalIndex < 2
          ? { ...piece, location: { ...armadilloPiece.location! } }
          : piece;
      })
    };
    const details = getArmadilloSharingDetails(game, game.activePlayerId!);
    const preview = getScoringPreview(game, "D", "armadillo");

    expect(preview.armadillo).toEqual(details);
    expect(preview.cardHighlights).toEqual(
      details.sharedPositions.map((position) => {
        const speciesIds = game.pieces
          .filter(
            (piece) =>
              piece.speciesId !== "armadillo" &&
              piece.location?.x === position.x &&
              piece.location.y === position.y
          )
          .map((piece) => piece.speciesId)
          .filter((speciesId, index, all) => all.indexOf(speciesId) === index);
        return {
          position,
          label: "compartilha",
          color: 0xf2c14e,
          speciesIds
        };
      })
    );
  });
});
