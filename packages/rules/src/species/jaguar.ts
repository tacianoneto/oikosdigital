import type { ActionId, GameState, GridPosition, Habitat, PieceState, Resource } from "@oikos/shared";
import { cloneGameState, findPlayer, getCurrentAction, positionKey } from "../state";
import { getCardDefinitionOrNull, getForestCardAtPosition } from "../forest";
import { getMovementKindForSpecies, getPotentialDestinations } from "../movement";
import { getMovementKindOverride } from "../effects";
import { assertMataAtlanticaDiscarded } from "../scenarios";
import { advanceActiveAction } from "../turn";

/**
 * Side-effect-free queries for the Jaguar (onça): locating its single forest
 * piece, how much meat it may spend for points (action C), and its valid
 * movement destinations (action A adjacent step, action B habitat run, with
 * scenario/effect overrides such as Pampa).
 *
 * These only read game state (via the shared state/forest/movement/effects
 * helpers), so they live here independently of setup.ts. The cross-species
 * movement dispatcher (getValidPieceMovementDestinations) and the mutating
 * action functions stay in setup.ts because they drive the turn loop.
 */

export function getJaguarPieceInForest(game: GameState, playerId: string): PieceState | null {
  return game.pieces.find((piece) => piece.ownerId === playerId && piece.speciesId === "jaguar" && piece.location) ?? null;
}

export function getAvailableJaguarPointSpendCount(game: GameState, playerId: string): number {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return 0;
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  if (player?.speciesId !== "jaguar" || getCurrentAction(game) !== "C") {
    return 0;
  }

  return Math.min(3, player.resources.meat);
}

export function getValidJaguarMovementDestinations(game: GameState, playerId: string, pieceId?: string): GridPosition[] {
  if (game.status !== "active" || game.activePlayerId !== playerId) {
    return [];
  }

  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const action = getCurrentAction(game);
  if (player?.speciesId !== "jaguar" || (action !== "A" && action !== "B")) {
    return [];
  }

  const jaguarPiece = getJaguarPieceInForest(game, playerId);
  if (!jaguarPiece?.location || (pieceId && jaguarPiece.pieceId !== pieceId)) {
    return [];
  }

  const forestPositions = new Set(game.forest.cards.map((card) => positionKey(card)));
  const movementOverride = getMovementKindOverride(game, {
    playerId,
    speciesId: "jaguar",
    origin: jaguarPiece.location,
    actionId: (action as ActionId | null) ?? null
  });
  if (movementOverride) {
    return getPotentialDestinations(jaguarPiece.location, movementOverride)
      .filter((position) => forestPositions.has(positionKey(position)))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }

  if (action === "A") {
    return getPotentialDestinations(jaguarPiece.location, "adjacent")
      .filter((position) => forestPositions.has(positionKey(position)))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }

  const currentCard = getForestCardAtPosition(game, jaguarPiece.location);
  const currentDef = currentCard ? getCardDefinitionOrNull(currentCard.definitionId) : null;
  const currentHabitat = currentDef?.habitat ?? null;
  if (!currentHabitat) {
    return [];
  }

  const pampaActive = (game.activeScenarioIds ?? []).includes("pampa");
  const allHabitats: Habitat[] = ["forest", "field", "river"];
  const habitatPool = pampaActive
    ? allHabitats.filter((habitat) => habitat !== currentHabitat)
    : [currentHabitat];

  const collected = new Map<string, GridPosition>();
  for (const habitat of habitatPool) {
    const kind = getMovementKindForSpecies("jaguar", habitat);
    for (const position of getPotentialDestinations(jaguarPiece.location, kind)) {
      const key = positionKey(position);
      if (forestPositions.has(key) && !collected.has(key)) {
        collected.set(key, position);
      }
    }
  }

  return Array.from(collected.values()).sort((a, b) => a.y - b.y || a.x - b.x);
}

export function spendJaguarMeatForPoints(game: GameState, playerId: string, count: number): GameState {
  if (game.status !== "active") {
    throw new Error("Acoes so podem acontecer durante a fase ativa.");
  }

  if (game.activePlayerId !== playerId) {
    throw new Error("Ainda nao e a vez deste jogador.");
  }

  assertMataAtlanticaDiscarded(game, playerId);

  const player = findPlayer(game, playerId);
  if (player.speciesId !== "jaguar") {
    throw new Error("Pontuacao por carne implementada apenas para a Onca nesta etapa.");
  }

  if (getCurrentAction(game) !== "C") {
    throw new Error("A Onca so gasta carne para pontuar durante a acao C.");
  }

  if (!Number.isInteger(count) || count < 1 || count > 3) {
    throw new Error("A Onca pode gastar de 1 a 3 carnes na acao C.");
  }

  if (player.resources.meat < count) {
    throw new Error("A Onca nao tem carne suficiente para esta pontuacao.");
  }

  const next = cloneGameState(game);
  const nextPlayer = findPlayer(next, playerId);
  nextPlayer.resources.meat -= count;
  nextPlayer.score += count;
  next.log = [
    ...next.log,
    {
      id: `jaguar_spend_meat_${playerId}_${next.log.length + 1}`,
      message: `${nextPlayer.name} gastou ${count} carne(s) e marcou ${count} ponto(s).`,
      createdAt: Date.now(),
      payload: {
        kind: "spend",
        actorPlayerId: playerId,
        points: count,
        actionId: "C",
        resources: Array.from({ length: count }, () => "meat" as Resource),
        count
      }
    }
  ];

  advanceActiveAction(next);
  return next;
}
