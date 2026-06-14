import type { PlayerState } from "@oikos/shared";

export function renderReserveMeeples(player: Pick<PlayerState, "playerId" | "reservePieces">, meepleAsset: string) {
  return player.reservePieces.map((pieceId, index) => (
    <img
      key={`${player.playerId}_reserve_${pieceId}_${index}`}
      className="is-in-reserve"
      src={encodeURI(meepleAsset)}
      alt="Na reserva"
    />
  ));
}
