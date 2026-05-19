import { describe, expect, it } from "vitest";
import { createInitialGameState, createPreviewInitialForest, placeInitialPiece } from "@oikos/rules";
import type { RoomPlayer } from "@oikos/shared";
import { playBotStep } from "./bots";

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
});
