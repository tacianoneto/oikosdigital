import { describe, expect, it } from "vitest";
import {
  createInitialGameState,
  createPreviewInitialForest,
  forceEndPlayerTurn,
  getCapuchinHabitatScore,
  placeInitialPiece
} from "@oikos/rules";
import type { RoomPlayer } from "@oikos/shared";
import { playBotStep, playRandomStep } from "./bots";

function player(playerId: string, speciesId: RoomPlayer["speciesId"], isBot = true): RoomPlayer {
  return {
    playerId,
    name: playerId,
    speciesId,
    ready: true,
    connected: true,
    isBot
  };
}

function createTestGameState(gameId: string, roomPlayers: RoomPlayer[]) {
  return createInitialGameState(gameId, roomPlayers, () => 0.999999, createPreviewInitialForest());
}

describe("bot decisions", () => {
  it("moves a stacked Macaco-prego to create a new habitat pair without breaking an existing pair", () => {
    let game = createTestGameState("room", [player("capuchin", "capuchin"), player("coati", "coati")]);
    const capuchin = game.players.find((candidate) => candidate.playerId === "capuchin")!;
    const [firstPieceId, secondPieceId, thirdPieceId, fourthPieceId] = capuchin.reservePieces;
    const placedPieceIds = [firstPieceId!, secondPieceId!, thirdPieceId!, fourthPieceId!];

    game = {
      ...game,
      status: "active",
      activePlayerId: "capuchin",
      activeActionIndex: 1,
      activePlayedForestCardId: "bosque_1",
      players: game.players.map((candidate) =>
        candidate.playerId === "capuchin"
          ? {
              ...candidate,
              reservePieces: candidate.reservePieces.filter((pieceId) => !placedPieceIds.includes(pieceId)),
              piecesInForest: placedPieceIds
            }
          : candidate
      ),
      pieces: game.pieces.map((piece) => {
        if (piece.pieceId === firstPieceId || piece.pieceId === secondPieceId) {
          return { ...piece, location: { x: -1, y: -1, siteId: "main" } };
        }
        if (piece.pieceId === thirdPieceId) {
          return { ...piece, location: { x: 1, y: -1, siteId: "main" } };
        }
        if (piece.pieceId === fourthPieceId) {
          return { ...piece, location: { x: 1, y: 1, siteId: "main" } };
        }
        return piece;
      })
    };

    game = playBotStep(game, "capuchin");

    const movedToFieldPair = game.pieces.some(
      (piece) => piece.ownerId === "capuchin" && piece.location?.x === -1 && piece.location.y === 1
    );
    const scoreCheckGame = { ...game, activeActionIndex: 3 };

    expect(movedToFieldPair).toBe(true);
    expect(getCapuchinHabitatScore(scoreCheckGame, "capuchin")).toBe(2);
  });

  it("always spends all available different resources when Lobo-guara can score", () => {
    let game = createTestGameState("room", [player("wolf", "maned_wolf"), player("coati", "coati")]);
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: -1 });

    const extraWolfId = game.players.find((candidate) => candidate.playerId === "wolf")!.reservePieces[0]!;
    game = {
      ...game,
      status: "active",
      activePlayerId: "wolf",
      activeActionIndex: 2,
      activePlayedForestCardId: null,
      players: game.players.map((candidate) =>
        candidate.playerId === "wolf"
          ? {
              ...candidate,
              resources: { meat: 1, egg: 1, fruit: 1, seed: 0 },
              reservePieces: candidate.reservePieces.filter((pieceId) => pieceId !== extraWolfId),
              piecesInForest: [...candidate.piecesInForest, extraWolfId]
            }
          : candidate
      ),
      pieces: game.pieces.map((piece) =>
        piece.pieceId === extraWolfId ? { ...piece, location: { x: -1, y: -1, siteId: "main" } } : piece
      )
    };

    game = playBotStep(game, "wolf");

    const wolf = game.players.find((candidate) => candidate.playerId === "wolf");
    expect(wolf?.score).toBe(3);
    expect(wolf?.resources).toEqual({ meat: 0, egg: 0, fruit: 0, seed: 0 });
    expect(game.activePlayerId).toBe("coati");
  });

  it("random takeover resolves a full game for every species without getting stuck", () => {
    // Mirrors the server's turn-timeout takeover: drive every turn with the
    // random bot (with the same forced-end fallback) and confirm the game runs
    // to completion for all six species.
    const players = [
      player("p_jaguar", "jaguar"),
      player("p_wolf", "maned_wolf"),
      player("p_armadillo", "armadillo"),
      player("p_macaw", "macaw"),
      player("p_capuchin", "capuchin"),
      player("p_coati", "coati")
    ];

    let game = createInitialGameState("room", players);

    let guard = 0;
    while (game.status === "setup" && guard < 500) {
      guard += 1;
      const pid = game.setupActivePlayerId!;
      try {
        game = playRandomStep(game, pid);
      } catch {
        game = forceEndPlayerTurn(game, pid, "timeout");
      }
    }
    expect(game.status).toBe("active");

    guard = 0;
    while (game.status === "active" && guard < 10000) {
      guard += 1;
      const pid = game.activePlayerId!;
      try {
        game = playRandomStep(game, pid);
      } catch {
        game = forceEndPlayerTurn(game, pid, "timeout");
      }
    }

    expect(game.status).toBe("finished");
    expect(game.winnerPlayerIds.length).toBeGreaterThan(0);
  });
});
