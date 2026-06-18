import { speciesDefinitions } from "@oikos/content";
import type { GameState, Resource } from "@oikos/shared";
import { getCardDefinitionOrNull } from "./forest";
import {
  getCacaIlegalTopResources,
  getMataAtlanticaPileTops,
  removeFromMataAtlanticaPile
} from "./scenarios";
import {
  canSpeciesRemovePieceForCacaIlegal,
  getSpeciesPieceLogName
} from "./speciesRules";
import { pruneResolvedCoatiPairBonuses } from "./species/coati";
import { cloneGameState, findPlayer } from "./state";
import { advanceActiveAction, rotateToNextPlayer } from "./turn";

export function resolveCacaIlegal(
  game: GameState,
  playerId: string,
  choice:
    | { kind: "remove_piece"; pieceId: string }
    | { kind: "spend_resource"; resource: Resource }
): GameState {
  if (game.status !== "active") {
    throw new Error("Caca ilegal so pode ser resolvida durante a fase ativa.");
  }
  if (!game.cacaIlegalPending || game.cacaIlegalPending.playerId !== playerId) {
    throw new Error("Nenhum efeito de Caca ilegal pendente.");
  }
  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);

  if (choice.kind === "remove_piece") {
    if (!canSpeciesRemovePieceForCacaIlegal(player.speciesId)) {
      throw new Error(
        "A Onca nao pode remover peca por Caca ilegal; gaste um recurso."
      );
    }
    const piece = next.pieces.find(
      (candidate) =>
        candidate.pieceId === choice.pieceId &&
        candidate.ownerId === playerId &&
        candidate.location
    );
    if (!piece) {
      throw new Error("Peca invalida para remocao.");
    }
    piece.location = null;
    player.piecesInForest = player.piecesInForest.filter(
      (id) => id !== choice.pieceId
    );
    player.reservePieces = [...player.reservePieces, choice.pieceId];
    if (piece.speciesId === "coati") {
      pruneResolvedCoatiPairBonuses(next, playerId);
    }
    next.log = [
      ...next.log,
      {
        id: `caca_ilegal_remove_${playerId}_${next.log.length + 1}`,
        message: `${player.name} removeu 1 ${player.speciesId ? getSpeciesPieceLogName(player.speciesId) : "peca"} (Caca ilegal).`,
        createdAt: Date.now()
      }
    ];
  } else {
    const top = getCacaIlegalTopResources(next, playerId);
    if (!top.includes(choice.resource)) {
      throw new Error(
        "Recurso invalido: escolha um dos recursos que voce mais possui."
      );
    }
    player.resources = {
      ...player.resources,
      [choice.resource]: Math.max(
        0,
        (player.resources[choice.resource] ?? 0) - 1
      )
    };
    next.log = [
      ...next.log,
      {
        id: `caca_ilegal_spend_${playerId}_${next.log.length + 1}`,
        message: `${player.name} gastou 1 ${choice.resource} (Caca ilegal).`,
        createdAt: Date.now()
      }
    ];
  }

  next.cacaIlegalPending = null;
  rotateToNextPlayer(next, player);
  return next;
}

export function discardMataAtlanticaPileCard(
  game: GameState,
  playerId: string,
  cardId: string
): GameState {
  if (game.status !== "active") {
    throw new Error(
      "Descarte da Mata Atlantica so pode acontecer durante a fase ativa."
    );
  }
  if (game.activePlayerId !== playerId) {
    throw new Error("Apenas o jogador ativo pode descartar uma carta.");
  }
  if (!game.mataAtlanticaPiles) {
    throw new Error("Mata Atlantica nao esta ativa.");
  }
  const pileTops = getMataAtlanticaPileTops(game);
  if (!pileTops.includes(cardId)) {
    throw new Error("Escolha o topo de uma das pilhas para descartar.");
  }
  const player = findPlayer(game, playerId);
  if (!player.speciesId) {
    throw new Error("Jogador sem especie selecionada.");
  }
  if (speciesDefinitions[player.speciesId].usesForestCards) {
    throw new Error(
      "Especies que usam cartas nao descartam na Mata Atlantica; joguem uma carta."
    );
  }
  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  if (
    (next.mataAtlanticaDiscardByPlayer ?? {})[playerId] ===
    nextPlayer.turnsTaken
  ) {
    throw new Error(
      "Voce ja descartou uma carta da Mata Atlantica neste turno."
    );
  }
  removeFromMataAtlanticaPile(next, cardId);
  next.mataAtlanticaDiscardByPlayer = {
    ...next.mataAtlanticaDiscardByPlayer,
    [playerId]: nextPlayer.turnsTaken
  };
  const def = getCardDefinitionOrNull(cardId);
  next.log = [
    ...next.log,
    {
      id: `mata_atlantica_discard_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} descartou ${def?.label ?? "carta"} (Mata Atlantica).`,
      createdAt: Date.now()
    }
  ];
  return next;
}

export function collectCaatingaBonus(
  game: GameState,
  playerId: string,
  mode: "gain" | "lose" | "skip" = "gain"
): GameState {
  if (game.status !== "active") {
    throw new Error(
      "Bonus de Caatinga so pode ser coletado durante a fase ativa."
    );
  }
  if (!game.caatingaPending || game.caatingaPending.playerId !== playerId) {
    throw new Error("Nenhum efeito de Caatinga disponivel.");
  }

  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);
  const pending = next.caatingaPending!;
  if (mode === "skip") {
    next.caatingaPending = null;
    next.log = [
      ...next.log,
      {
        id: `caatinga_skip_${playerId}_${next.log.length + 1}`,
        message: `${player.name} adiou o efeito da Caatinga.`,
        createdAt: Date.now()
      }
    ];
    if (shouldAdvanceAfterScenarioChoice(next, playerId)) {
      advanceActiveAction(next);
    }
    return next;
  }
  const current = player.resources[pending.resource] ?? 0;
  if (mode === "lose" && current <= 0) {
    throw new Error("Sem recurso suficiente para perder em Caatinga.");
  }
  const delta = mode === "gain" ? 1 : -1;
  player.resources = {
    ...player.resources,
    [pending.resource]: current + delta
  };
  next.caatingaUsedByPlayer = {
    ...next.caatingaUsedByPlayer,
    [playerId]: pending.round
  };
  next.caatingaPending = null;
  next.log = [
    ...next.log,
    {
      id: `caatinga_resolve_${playerId}_${next.log.length + 1}`,
      message:
        mode === "gain"
          ? `${player.name} coletou +1 ${pending.resource} (Caatinga).`
          : `${player.name} perdeu 1 ${pending.resource} (Caatinga).`,
      createdAt: Date.now()
    }
  ];
  if (shouldAdvanceAfterScenarioChoice(next, playerId)) {
    advanceActiveAction(next);
  }
  return next;
}

export function collectCerradoBonus(
  game: GameState,
  playerId: string,
  mode: "collect" | "skip" = "collect"
): GameState {
  if (game.status !== "active") {
    throw new Error(
      "Bonus de Cerrado so pode ser resolvido durante a fase ativa."
    );
  }
  if (!game.cerradoPending || game.cerradoPending.playerId !== playerId) {
    throw new Error("Nenhum efeito de Cerrado disponivel.");
  }

  const next = cloneGameState(game);
  const player = findPlayer(next, playerId);
  const pending = next.cerradoPending!;
  const gain = mode === "collect" ? 2 : 1;
  player.resources = {
    ...player.resources,
    [pending.resource]: (player.resources[pending.resource] ?? 0) + gain
  };

  if (mode === "collect") {
    next.cerradoTriggeredByPlayer = {
      ...(next.cerradoTriggeredByPlayer ?? {}),
      [playerId]: pending.round
    };
  }

  next.cerradoPending = null;
  next.log = [
    ...next.log,
    {
      id: `cerrado_${mode}_${playerId}_${next.log.length + 1}`,
      message:
        mode === "collect"
          ? `${player.name} coletou +2 ${pending.resource} (Cerrado).`
          : `${player.name} guardou o Cerrado para depois e coletou +1 ${pending.resource}.`,
      createdAt: Date.now()
    }
  ];

  if (shouldAdvanceAfterScenarioChoice(next, playerId)) {
    advanceActiveAction(next);
  }
  return next;
}

function shouldAdvanceAfterScenarioChoice(
  game: GameState,
  playerId: string
): boolean {
  if (game.caatingaPending || game.cerradoPending || game.pendingCoatiPairBonus || game.pendingGaloInterrupt) {
    return false;
  }
  return !(
    game.pendingWolfMoves?.playerId === playerId &&
    game.pendingWolfMoves.pieceIds.length > 0
  );
}
