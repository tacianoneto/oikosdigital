import { speciesDefinitions } from "@oikos/content";
import type {
  PlayerState,
  PublicRoomState,
  Resource,
  RoomPlayer,
  SpeciesDefinition
} from "@oikos/shared";

const majorityResources: Resource[] = ["meat", "egg", "fruit"];

export interface PlayerInspectorEntry {
  displayIndex: number;
  gamePlayer: PlayerState | null;
  isActivePlayer: boolean;
  player: RoomPlayer;
  species: SpeciesDefinition | null;
}

export interface PlayerHudState {
  activeGamePlayer: PlayerState | null;
  activeSpecies: SpeciesDefinition | null;
  currentGamePlayer: PlayerState | null;
  currentPlayer: RoomPlayer | null;
  currentPlayerResourceMajority: Record<Resource, boolean>;
  hudGamePlayer: PlayerState | null;
  hudSpecies: SpeciesDefinition | null;
  opponentInspectorEntries: PlayerInspectorEntry[];
  playerInspectorEntries: PlayerInspectorEntry[];
  resourceLeaders: Partial<Record<Resource, Set<string>>>;
  selectedOpponentEntry: PlayerInspectorEntry | null;
  selectedOpponentRailIndex: number;
  setupActivePlayer: PlayerState | null;
}

export function getPlayerHudState(
  room: PublicRoomState | null | undefined,
  controlledPlayerId: string | null,
  selectedOpponentPlayerId: string | null
): PlayerHudState {
  const game = room?.game;
  const currentPlayer =
    room?.players.find((player) => player.playerId === controlledPlayerId) ??
    null;
  const currentGamePlayer =
    game?.players.find((player) => player.playerId === controlledPlayerId) ??
    null;
  const setupActivePlayer =
    game?.players.find(
      (player) => player.playerId === game.setupActivePlayerId
    ) ?? null;
  const activeGamePlayer =
    game?.players.find((player) => player.playerId === game.activePlayerId) ??
    null;
  const activeSpecies = activeGamePlayer?.speciesId
    ? speciesDefinitions[activeGamePlayer.speciesId]
    : null;
  const hudGamePlayer =
    currentGamePlayer ?? activeGamePlayer ?? setupActivePlayer ?? null;
  const hudSpecies = hudGamePlayer?.speciesId
    ? speciesDefinitions[hudGamePlayer.speciesId]
    : null;

  const resourceLeaders: Partial<Record<Resource, Set<string>>> = {};
  const gamePlayers = game?.players ?? [];
  for (const resource of majorityResources) {
    const top = gamePlayers.reduce(
      (highest, player) =>
        Math.max(highest, player.resources[resource] ?? 0),
      0
    );
    if (top > 0) {
      resourceLeaders[resource] = new Set(
        gamePlayers
          .filter((player) => (player.resources[resource] ?? 0) === top)
          .map((player) => player.playerId)
      );
    }
  }

  const currentPlayerResourceMajority: Record<Resource, boolean> = {
    meat: false,
    egg: false,
    fruit: false,
    seed: false
  };
  if (currentGamePlayer) {
    for (const resource of majorityResources) {
      currentPlayerResourceMajority[resource] =
        resourceLeaders[resource]?.has(currentGamePlayer.playerId) ?? false;
    }
  }

  const players = room?.players ?? [];
  let playerInspectorEntries: PlayerInspectorEntry[];
  if (!game) {
    playerInspectorEntries = players.map((player, displayIndex) => ({
      player,
      gamePlayer: null,
      species: player.speciesId
        ? speciesDefinitions[player.speciesId]
        : null,
      displayIndex,
      isActivePlayer: false
    }));
  } else {
    const order = game.status === "setup" ? game.setupOrder : game.turnOrder;
    const indexByPlayerId = new Map(
      order.map((playerId, index) => [playerId, index])
    );
    playerInspectorEntries = [...players]
      .sort((a, b) => {
        const aIndex = indexByPlayerId.get(a.playerId);
        const bIndex = indexByPlayerId.get(b.playerId);
        if (aIndex === undefined && bIndex === undefined) return 0;
        if (aIndex === undefined) return 1;
        if (bIndex === undefined) return -1;
        return aIndex - bIndex;
      })
      .map((player, displayIndex) => ({
        player,
        gamePlayer:
          game.players.find(
            (candidate) => candidate.playerId === player.playerId
          ) ?? null,
        species: player.speciesId
          ? speciesDefinitions[player.speciesId]
          : null,
        displayIndex,
        isActivePlayer:
          player.playerId === game.activePlayerId ||
          player.playerId === game.setupActivePlayerId
      }));
  }

  const opponentInspectorEntries = playerInspectorEntries.filter(
    (entry) =>
      !currentGamePlayer ||
      entry.player.playerId !== currentGamePlayer.playerId
  );
  const selectedOpponentEntry =
    opponentInspectorEntries.find(
      (entry) => entry.player.playerId === selectedOpponentPlayerId
    ) ?? null;
  const selectedOpponentRailIndex = selectedOpponentEntry
    ? Math.max(
        0,
        opponentInspectorEntries.findIndex(
          (entry) =>
            entry.player.playerId === selectedOpponentEntry.player.playerId
        )
      )
    : 0;

  return {
    activeGamePlayer,
    activeSpecies,
    currentGamePlayer,
    currentPlayer,
    currentPlayerResourceMajority,
    hudGamePlayer,
    hudSpecies,
    opponentInspectorEntries,
    playerInspectorEntries,
    resourceLeaders,
    selectedOpponentEntry,
    selectedOpponentRailIndex,
    setupActivePlayer
  };
}
