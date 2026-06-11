import type { GameState, PlayerState, PublicRoomState } from "@oikos/shared";

// Per-viewer projection of the room state. The server keeps the full state in
// memory and on disk; clients must only ever receive what their player is
// allowed to see (GDD principle: private info such as card hands never reaches
// other players). Once the game is finished there is nothing left to hide, so
// the full state is revealed for the final ceremony/audit.
export function projectRoomForViewer(room: PublicRoomState, viewerPlayerId: string | null): PublicRoomState {
  if (!room.game || room.game.status === "finished") {
    return room;
  }

  return {
    ...room,
    game: projectGameForViewer(room.game, viewerPlayerId)
  };
}

// The in-game history panel only needs recent events; the full log keeps
// growing server-side and is revealed whole when the game finishes. Capping
// what travels on every broadcast keeps payloads flat over a long match.
const MAX_LOG_ENTRIES = 200;

function projectGameForViewer(game: GameState, viewerPlayerId: string | null): GameState {
  return {
    ...game,
    log: game.log.length > MAX_LOG_ENTRIES ? game.log.slice(-MAX_LOG_ENTRIES) : game.log,
    players: game.players.map((player) => projectPlayerForViewer(player, viewerPlayerId)),
    deck: {
      commonCardIds: [],
      initialCandidateIds: [],
      commonCardCount: game.deck.commonCardIds.length
    },
    threatDeckIds: [],
    threatDeckCount: game.threatDeckIds.length,
    // Only the top of each shared pile is public; the rest of the pile order
    // stays hidden. Counts let the UI show how many cards remain.
    mataAtlanticaPiles: game.mataAtlanticaPiles
      ? game.mataAtlanticaPiles.map((pile) => pile.slice(0, 1))
      : null,
    mataAtlanticaPileCounts: game.mataAtlanticaPiles
      ? game.mataAtlanticaPiles.map((pile) => pile.length)
      : null
  };
}

function projectPlayerForViewer(player: PlayerState, viewerPlayerId: string | null): PlayerState {
  if (player.playerId === viewerPlayerId) {
    return player;
  }

  return {
    ...player,
    hand: [],
    handCount: player.hand.length,
    objectiveChoices: [],
    selectedObjectiveCardId: null,
    hasSelectedObjective: Boolean(player.selectedObjectiveCardId),
    discardedObjectiveCardId: null
  };
}
