import { objectiveCardsById, speciesDefinitions, threatCards } from "@oikos/content";
import type { GameState, PlayerState } from "@oikos/shared";
import { findPlayer, getCurrentAction, positionKey } from "./state";
import { getAvailableForestExpansionPositionsForCard, getCardDefinitionOrNull } from "./forest";
import { getMataAtlanticaPileTops } from "./scenarios";
import { applyFinalScoring, canSpeciesReceiveObjective } from "./scoring";
import { applyEndTurnRuleEffects } from "./effects";
import { getRequiredCoatiRemovalCount } from "./species/coati";
import { getValidJaguarMovementDestinations } from "./species/jaguar";
import { getWolfMeatPlacementPositions, getWolfRemovableBasePieceIds } from "./species/wolf";

/**
 * Turn engine: advances actions within a turn, rotates to the next player,
 * reveals per-round threats, queues end-of-game objective choices (extra turn /
 * seed-spend) or finalizes scoring, and auto-skips actions a player cannot take.
 *
 * It depends only on lower layers (state/forest readers, content, scenarios,
 * scoring, effects and the per-species *query* functions). It never imports the
 * mutating per-species action functions, so setup.ts can depend on it without a
 * cycle: setup.ts (actions) -> turn.ts -> queries/state/forest.
 */

export const floodThreatId = "threat_6";

export function advanceActiveAction(game: GameState): void {
  if (
    game.caatingaPending ||
    game.cerradoPending ||
    game.cacaIlegalPending ||
    game.pendingJaguarRemoval ||
    game.pendingGaloInterrupt ||
    game.pendingExtraTurnPlayerId ||
    game.pendingSeedSpendObjectivePlayerId
  ) {
    return;
  }

  if (!game.activePlayerId) {
    return;
  }

  const player = findPlayer(game, game.activePlayerId);
  if (!player.speciesId) {
    throw new Error("Jogador ativo sem especie selecionada.");
  }

  const species = speciesDefinitions[player.speciesId];
  const nextActionIndex = game.activeActionIndex + 1;

  if (nextActionIndex < species.actions.length) {
    game.activeActionIndex = nextActionIndex;
    game.log = [
      ...game.log,
      {
        id: `advance_action_${player.playerId}_${nextActionIndex}`,
        message: `${player.name} avancou para a acao ${species.actions[nextActionIndex]}.`,
        createdAt: Date.now()
      }
    ];
    skipAutomaticActionIfNeeded(game);
    return;
  }

  finishPlayerTurn(game, player);
}

export function finishPlayerTurn(game: GameState, player: PlayerState): void {
  player.turnsTaken += 1;
  if (applyEndTurnRuleEffects(game, player).paused) {
    return;
  }
  rotateToNextPlayer(game, player);
}

export function rotateToNextPlayer(game: GameState, player: PlayerState): void {
  if (game.extraTurnPlayerId === player.playerId) {
    game.activePlayerId = null;
    game.activeActionIndex = 0;
    game.activePlayedForestCardId = null;
    game.pendingCoatiPairBonus = null;
    game.pendingMacawMovedPiece = null;
    game.pendingJaguarRemoval = null;
    game.pendingGaloInterrupt = null;
    game.pendingWolfMoves = null;
    game.extraTurnPlayerId = null;
    game.log = [
      ...game.log,
      {
        id: `extra_turn_complete_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} concluiu o turno extra.`,
        createdAt: Date.now(),
        payload: { kind: "advance_turn", actorPlayerId: player.playerId }
      }
    ];
    queueEndgameChoiceOrFinalize(game);
    return;
  }

  const currentTurnIndex = game.turnOrder.indexOf(player.playerId);
  const nextTurnIndex = currentTurnIndex >= 0 ? (currentTurnIndex + 1) % game.turnOrder.length : 0;
  const nextPlayerId = game.turnOrder[nextTurnIndex] ?? null;

  game.activePlayerId = nextPlayerId;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingJaguarRemoval = null;
  game.pendingGaloInterrupt = null;
  game.pendingWolfMoves = null;
  game.cerradoPending = null;
  const startedNewRound = nextTurnIndex === 0;
  if (startedNewRound) {
    game.round += 1;
  }

  game.log = [
    ...game.log,
    {
      id: `advance_turn_${player.playerId}_${player.turnsTaken}`,
      message: `${player.name} concluiu o turno.`,
      createdAt: Date.now()
    }
  ];

  if (game.round > game.maxRounds) {
    queueEndgameChoiceOrFinalize(game);
    return;
  }

  if (startedNewRound) {
    revealThreatForRound(game);
  }
  skipAutomaticActionIfNeeded(game);
}

export function queueEndgameChoiceOrFinalize(game: GameState): void {
  const candidate = findNextExtraTurnCandidate(game);
  if (candidate) {
    game.pendingExtraTurnPlayerId = candidate.playerId;
    game.activePlayerId = null;
    game.activeActionIndex = 0;
    game.activePlayedForestCardId = null;
    game.log = [
      ...game.log,
      {
        id: `extra_turn_pending_${candidate.playerId}_${game.log.length + 1}`,
        message: `${candidate.name} pode perder 1 ponto para jogar 1 turno extra.`,
        createdAt: Date.now(),
        payload: { kind: "objective", actorPlayerId: candidate.playerId }
      }
    ];
    return;
  }

  const seedSpendCandidate = findNextSeedSpendObjectiveCandidate(game);
  if (seedSpendCandidate) {
    game.pendingSeedSpendObjectivePlayerId = seedSpendCandidate.player.playerId;
    game.activePlayerId = null;
    game.activeActionIndex = 0;
    game.activePlayedForestCardId = null;
    game.log = [
      ...game.log,
      {
        id: `seed_spend_pending_${seedSpendCandidate.player.playerId}_${game.log.length + 1}`,
        message: `${seedSpendCandidate.player.name} pode gastar ${seedSpendCandidate.spendSeedCount} sementes para ganhar ${seedSpendCandidate.points} pontos.`,
        createdAt: Date.now(),
        payload: { kind: "objective", actorPlayerId: seedSpendCandidate.player.playerId }
      }
    ];
    return;
  }

  applyFinalScoring(game, {
    findPlayer,
    getCardDefinitionOrNull,
    positionKey
  });
}

function findNextSeedSpendObjectiveCandidate(
  game: GameState
): { player: PlayerState; spendSeedCount: number; points: number } | null {
  const resolved = new Set(game.resolvedSeedSpendObjectivePlayerIds ?? []);
  for (const playerId of game.turnOrder) {
    if (resolved.has(playerId)) {
      continue;
    }

    const player = game.players.find((candidate) => candidate.playerId === playerId);
    if (!player?.selectedObjectiveCardId) {
      continue;
    }

    const card = objectiveCardsById.get(player.selectedObjectiveCardId);
    if (!player.speciesId || !card || !canSpeciesReceiveObjective(player.speciesId, card) || card.scoring.kind !== "seed_spend") {
      continue;
    }

    const spendSeedCount = card.scoring.spendSeedCount ?? 3;
    if ((player.resources.seed ?? 0) < spendSeedCount) {
      continue;
    }

    return { player, spendSeedCount, points: card.scoring.points ?? 3 };
  }

  return null;
}

function findNextExtraTurnCandidate(game: GameState): PlayerState | null {
  const resolved = new Set(game.resolvedExtraTurnPlayerIds ?? []);
  for (const playerId of game.turnOrder) {
    if (resolved.has(playerId)) {
      continue;
    }

    const player = game.players.find((candidate) => candidate.playerId === playerId);
    if (!player?.selectedObjectiveCardId || player.score < 1) {
      continue;
    }

    const card = objectiveCardsById.get(player.selectedObjectiveCardId);
    if (card?.scoring.kind === "extra_turn") {
      return player;
    }
  }

  return null;
}

export function revealThreatForRound(game: GameState): void {
  if (!(game.enabledMiniExpansions ?? []).includes("threats") || game.status !== "active" || !game.activePlayerId) {
    return;
  }

  if (game.activeThreatCardId) {
    game.threatDiscardIds = [...(game.threatDiscardIds ?? []), game.activeThreatCardId];
  }

  const availableThreatDeckIds = (game.threatDeckIds ?? []).filter(
    (id) => !(game.activeScenarioIds ?? []).includes("pampa") || id !== floodThreatId
  );
  const [nextThreatId, ...remainingThreatIds] = availableThreatDeckIds;
  game.threatDeckIds = remainingThreatIds;
  game.activeThreatCardId = nextThreatId ?? null;

  if (nextThreatId) {
    const threat = threatCards.find((card) => card.id === nextThreatId);
    game.log = [
      ...game.log,
      {
        id: `threat_reveal_${nextThreatId}_round_${game.round}`,
        message: `${threat?.label ?? "Ameaca"} revelada para a rodada ${game.round}.`,
        createdAt: Date.now()
      }
    ];
    return;
  }

  game.log = [
    ...game.log,
    {
      id: `threat_deck_empty_round_${game.round}`,
      message: "Pilha de ameacas esgotada. Nenhuma ameaca sera repetida nesta partida.",
      createdAt: Date.now()
    }
  ];
}

export function skipAutomaticActionIfNeeded(game: GameState): void {
  if (!game.activePlayerId) {
    return;
  }

  const player = findPlayer(game, game.activePlayerId);
  const action = getCurrentAction(game);
  if (game.extraTurnPlayerId === player.playerId && shouldSkipExtraTurnCardAction(game, player.playerId)) {
    game.log = [
      ...game.log,
      {
        id: `auto_skip_extra_turn_card_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} pulou automaticamente a acao ${action} do turno extra porque nao havia carta de floresta para jogar.`,
        createdAt: Date.now(),
        payload: { kind: "skip", actorPlayerId: player.playerId, actionId: action ?? undefined }
      }
    ];
    advanceActiveAction(game);
    return;
  }

  if (player.speciesId === "coati" && action === "C" && getRequiredCoatiRemovalCount(game, player.playerId) === 0) {
    game.log = [
      ...game.log,
      {
        id: `auto_skip_coati_C_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} pulou automaticamente a acao C do Quati porque havia 2 ou mais quatis na reserva.`,
        createdAt: Date.now()
      }
    ];
    advanceActiveAction(game);
    return;
  }

  if (player.speciesId === "jaguar" && shouldSkipJaguarMoveAction(game, player.playerId)) {
    game.log = [
      ...game.log,
      {
        id: `auto_skip_jaguar_${action}_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} pulou automaticamente a acao ${action} da Onca porque nao havia destino valido para mover.`,
        createdAt: Date.now()
      }
    ];
    advanceActiveAction(game);
    return;
  }

  if (player.speciesId === "maned_wolf" && shouldSkipWolfBaseAction(game, player.playerId)) {
    game.log = [
      ...game.log,
      {
        id: `auto_skip_wolf_B_${player.playerId}_${game.log.length + 1}`,
        message: `${player.name} pulou automaticamente a acao B do Lobo-guara porque nao havia peca de especie de base em local com lobo.`,
        createdAt: Date.now()
      }
    ];
    advanceActiveAction(game);
    return;
  }

  if (player.speciesId === "maned_wolf" && shouldSkipWolfMeatAction(game, player.playerId)) {
    const hasReserveWolves = player.reservePieces.length > 0;
    game.log = [
      ...game.log,
      {
        id: `auto_skip_wolf_D_${player.playerId}_${game.log.length + 1}`,
        message: hasReserveWolves
          ? `${player.name} pulou automaticamente a acao D do Lobo-guara porque nao havia local de carne disponivel.`
          : `${player.name} pulou automaticamente a acao D do Lobo-guara porque nao havia lobos na reserva.`,
        createdAt: Date.now()
      }
    ];
    advanceActiveAction(game);
  }
}

export function shouldSkipExtraTurnCardAction(game: GameState, playerId: string): boolean {
  if (getCurrentAction(game) !== "A" || game.activePlayedForestCardId) {
    return false;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (!player?.speciesId || !speciesDefinitions[player.speciesId].usesForestCards) {
    return false;
  }

  const playableCards = game.mataAtlanticaPiles ? getMataAtlanticaPileTops(game) : player.hand;
  return !playableCards.some((cardId) => getAvailableForestExpansionPositionsForCard(game, cardId).length > 0);
}

export function shouldSkipJaguarMoveAction(game: GameState, playerId: string): boolean {
  const action = getCurrentAction(game);
  return (action === "A" || action === "B") && getValidJaguarMovementDestinations(game, playerId).length === 0;
}

function shouldSkipWolfBaseAction(game: GameState, playerId: string): boolean {
  return getCurrentAction(game) === "B" && getWolfRemovableBasePieceIds(game, playerId).length === 0;
}

function shouldSkipWolfMeatAction(game: GameState, playerId: string): boolean {
  return getCurrentAction(game) === "D" && getWolfMeatPlacementPositions(game, playerId).length === 0;
}
