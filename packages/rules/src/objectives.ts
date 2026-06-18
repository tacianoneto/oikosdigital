import { objectiveCards, objectiveCardsById } from "@oikos/content";
import type { GameState, PlayerState, RoomPlayer } from "@oikos/shared";
import { canSpeciesReceiveObjective } from "./scoring";
import { cloneGameState, findPlayer } from "./state";
import {
  queueEndgameChoiceOrFinalize,
  skipAutomaticActionIfNeeded
} from "./turn";

export function dealObjectiveChoices(
  players: PlayerState[],
  roomPlayers: RoomPlayer[],
  random: () => number
): void {
  const objectiveDeck = shuffle(objectiveCards.map((card) => card.id), random);

  for (const player of players) {
    if (!player.speciesId) {
      player.objectiveChoices = [];
      continue;
    }

    const objectiveChoices = objectiveDeck
      .filter((objectiveCardId) => {
        const card = objectiveCardsById.get(objectiveCardId);
        return card ? canSpeciesReceiveObjective(player.speciesId!, card) : false;
      })
      .slice(0, 2);

    for (const objectiveCardId of objectiveChoices) {
      const deckIndex = objectiveDeck.indexOf(objectiveCardId);
      if (deckIndex >= 0) {
        objectiveDeck.splice(deckIndex, 1);
      }
    }

    player.objectiveChoices = objectiveChoices;
    const roomPlayer = roomPlayers.find(
      (candidate) => candidate.playerId === player.playerId
    );
    player.selectedObjectiveCardId = roomPlayer?.isBot
      ? (player.objectiveChoices[0] ?? null)
      : null;
  }
}

export function selectObjectiveCard(
  game: GameState,
  playerId: string,
  objectiveCardId: string
): GameState {
  if (game.status !== "setup") {
    throw new Error("Objetivo so pode ser escolhido no inicio da partida.");
  }

  const player = findPlayer(game, playerId);
  if (player.selectedObjectiveCardId) {
    throw new Error("Objetivo ja escolhido.");
  }

  if (!player.objectiveChoices.includes(objectiveCardId)) {
    throw new Error("Escolha uma das 2 cartas de objetivo recebidas.");
  }

  if (player.speciesId) {
    const card = objectiveCardsById.get(objectiveCardId);
    if (!card || !canSpeciesReceiveObjective(player.speciesId, card)) {
      throw new Error("Esta especie nao pode receber este objetivo.");
    }
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.selectedObjectiveCardId = objectiveCardId;
  nextPlayer.discardedObjectiveCardId = null;
  next.log = [
    ...next.log,
    {
      id: `objective_select_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} escolheu uma carta de objetivo.`,
      createdAt: Date.now()
    }
  ];

  return next;
}

export function discardObjectiveForResources(
  game: GameState,
  playerId: string
): GameState {
  if (game.status !== "active") {
    throw new Error("Objetivo so pode ser descartado durante a partida.");
  }

  const player = findPlayer(game, playerId);
  if (!player.selectedObjectiveCardId) {
    throw new Error("Jogador nao possui objetivo selecionado.");
  }

  const card = objectiveCardsById.get(player.selectedObjectiveCardId);
  if (card?.scoring.kind !== "discard_for_resources") {
    throw new Error("Este objetivo nao pode ser descartado por recursos.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  const discardedObjectiveCardId = nextPlayer.selectedObjectiveCardId;
  nextPlayer.resources = {
    meat: (nextPlayer.resources.meat ?? 0) + 1,
    egg: (nextPlayer.resources.egg ?? 0) + 1,
    fruit: (nextPlayer.resources.fruit ?? 0) + 1,
    seed: (nextPlayer.resources.seed ?? 0) + 1
  };
  nextPlayer.selectedObjectiveCardId = null;
  nextPlayer.discardedObjectiveCardId = discardedObjectiveCardId;
  nextPlayer.objectiveChoices = [];
  next.log = [
    ...next.log,
    {
      id: `objective_discard_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} descartou o objetivo para ganhar 1 recurso de cada.`,
      createdAt: Date.now(),
      payload: {
        kind: "objective",
        actorPlayerId: playerId,
        resources: ["meat", "egg", "fruit", "seed"]
      }
    }
  ];

  return next;
}

export function resolveExtraTurnObjective(
  game: GameState,
  playerId: string,
  accept: boolean
): GameState {
  if (game.status !== "active") {
    throw new Error("Turno extra so pode ser resolvido durante a partida.");
  }

  if (game.pendingExtraTurnPlayerId !== playerId) {
    throw new Error("Nenhum turno extra pendente para este jogador.");
  }

  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);
  next.pendingExtraTurnPlayerId = null;
  next.resolvedExtraTurnPlayerIds = [
    ...new Set([...(next.resolvedExtraTurnPlayerIds ?? []), playerId])
  ];

  if (!accept) {
    next.log = [
      ...next.log,
      {
        id: `extra_turn_declined_${playerId}_${next.log.length + 1}`,
        message: `${player.name} recusou o turno extra.`,
        createdAt: Date.now(),
        payload: { kind: "objective", actorPlayerId: playerId }
      }
    ];
    queueEndgameChoiceOrFinalize(next);
    return next;
  }

  if (player.score < 1) {
    throw new Error(
      "E preciso ter ao menos 1 ponto para comprar o turno extra."
    );
  }

  player.score -= 1;
  next.extraTurnPlayerId = playerId;
  next.activePlayerId = playerId;
  next.activeActionIndex = 0;
  next.activePlayedForestCardId = null;
  next.pendingCoatiPairBonus = null;
  next.pendingMacawMovedPiece = null;
  next.pendingGaloInterrupt = null;
  next.pendingWolfMoves = null;
  next.log = [
    ...next.log,
    {
      id: `extra_turn_accept_${playerId}_${next.log.length + 1}`,
      message: `${player.name} perdeu 1 ponto para jogar 1 turno extra.`,
      createdAt: Date.now(),
      payload: { kind: "objective", actorPlayerId: playerId, points: -1 }
    }
  ];
  skipAutomaticActionIfNeeded(next);
  return next;
}

export function resolveSeedSpendObjective(
  game: GameState,
  playerId: string,
  accept: boolean
): GameState {
  if (game.status !== "active") {
    throw new Error(
      "Objetivo de sementes so pode ser resolvido durante a partida."
    );
  }

  if (game.pendingSeedSpendObjectivePlayerId !== playerId) {
    throw new Error(
      "Nenhum objetivo de sementes pendente para este jogador."
    );
  }

  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);
  const card = player.selectedObjectiveCardId
    ? objectiveCardsById.get(player.selectedObjectiveCardId)
    : null;
  if (card?.scoring.kind !== "seed_spend") {
    throw new Error("Objetivo de sementes invalido para este jogador.");
  }

  const spendSeedCount = card.scoring.spendSeedCount ?? 3;
  if (accept && (player.resources.seed ?? 0) < spendSeedCount) {
    throw new Error("Sementes insuficientes para ativar este objetivo.");
  }

  next.pendingSeedSpendObjectivePlayerId = null;
  next.resolvedSeedSpendObjectivePlayerIds = [
    ...new Set([...(next.resolvedSeedSpendObjectivePlayerIds ?? []), playerId])
  ];
  if (accept) {
    next.acceptedSeedSpendObjectivePlayerIds = [
      ...new Set([...(next.acceptedSeedSpendObjectivePlayerIds ?? []), playerId])
    ];
  }

  next.log = [
    ...next.log,
    {
      id: `seed_spend_${accept ? "accepted" : "declined"}_${playerId}_${next.log.length + 1}`,
      message: accept
        ? `${player.name} escolheu gastar ${spendSeedCount} sementes no objetivo final.`
        : `${player.name} recusou gastar sementes no objetivo final.`,
      createdAt: Date.now(),
      payload: { kind: "objective", actorPlayerId: playerId }
    }
  ];

  queueEndgameChoiceOrFinalize(next);
  return next;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [
      shuffled[targetIndex],
      shuffled[index]
    ];
  }

  return shuffled;
}
