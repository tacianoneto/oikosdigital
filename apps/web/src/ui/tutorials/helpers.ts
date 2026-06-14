import type { GameState, GridPosition } from "@oikos/shared";

export function placeTutorialPiece(game: GameState, playerId: string, pieceNumber: number, location: GridPosition): void {
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const pieceId = `${playerId}_piece_${pieceNumber}`;
  const piece = game.pieces.find((candidate) => candidate.pieceId === pieceId);
  if (!player || !piece) {
    return;
  }

  piece.location = { ...location, siteId: "main" };
  player.reservePieces = player.reservePieces.filter((candidate) => candidate !== pieceId);
  if (!player.piecesInForest.includes(pieceId)) {
    player.piecesInForest = [...player.piecesInForest, pieceId];
  }
}
