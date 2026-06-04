import { describe, expect, it } from "vitest";
import type { RoomPlayer } from "@oikos/shared";
import {
  createInitialGameState,
  createPreviewInitialForest,
  completeCurrentAction,
  finalizeGame,
  forceEndPlayerTurn,
  resolveExtraTurnObjective,
  resolveSeedSpendObjective
} from "./setup";

function player(playerId: string, speciesId: RoomPlayer["speciesId"]): RoomPlayer {
  return { playerId, name: playerId, speciesId, ready: true, connected: true };
}

function activeGame(roomPlayers: RoomPlayer[] = [player("p1", "coati"), player("p2", "macaw")]) {
  const game = createInitialGameState("g1", roomPlayers, () => 0.999999, createPreviewInitialForest());
  game.status = "active";
  game.activePlayerId = game.turnOrder[0];
  game.activeActionIndex = 0;
  return game;
}

describe("end game scoring", () => {
  it("majority of meat/egg/fruit gives +1 and spends the resource; seeds give 1 per 2", () => {
    const game = activeGame();
    const a = game.players.find((p) => p.playerId === "p1")!;
    const b = game.players.find((p) => p.playerId === "p2")!;
    a.score = 5;
    b.score = 5;
    a.resources = { meat: 3, egg: 0, fruit: 1, seed: 5 };
    b.resources = { meat: 1, egg: 4, fruit: 1, seed: 0 };

    const finished = finalizeGame(game);
    const entryA = finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p1")!;
    const entryB = finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p2")!;

    // meat -> a (+1); egg -> b (+1); fruit tie -> both (+1)
    expect(entryA.resourceMajorityPoints).toBe(2);
    expect(entryB.resourceMajorityPoints).toBe(2);
    expect(entryA.objectivePoints).toBe(0);
    expect(entryB.objectivePoints).toBe(0);
    expect(entryA.scenarioPoints).toBe(0);
    expect(entryB.scenarioPoints).toBe(0);
    // a has 5 seeds -> floor(5/2)=2 points
    expect(entryA.seedPoints).toBe(2);
    expect(entryB.seedPoints).toBe(0);
    expect(entryA.totalScore).toBe(9); // 5 + 2 + 2
    expect(entryB.totalScore).toBe(7); // 5 + 2 + 0
    expect(finished.winnerPlayerIds).toEqual(["p1"]);

    // spent resources: a meat/fruit -> 0, seed remainder 1; b egg/fruit -> 0, meat kept
    const finishedA = finished.players.find((p) => p.playerId === "p1")!;
    const finishedB = finished.players.find((p) => p.playerId === "p2")!;
    expect(finishedA.resources).toEqual({ meat: 0, egg: 0, fruit: 0, seed: 1 });
    expect(finishedB.resources).toEqual({ meat: 1, egg: 0, fruit: 0, seed: 0 });
    expect(entryA.remainingResources).toBe(1);
    expect(entryB.remainingResources).toBe(1);
  });

  it("separates final scenario points from base majority points", () => {
    const game = activeGame();
    game.activeScenarioIds = ["amazonia"];
    const a = game.players.find((p) => p.playerId === "p1")!;
    const b = game.players.find((p) => p.playerId === "p2")!;
    a.score = 5;
    b.score = 5;
    a.resources = { meat: 3, egg: 0, fruit: 1, seed: 0 };
    b.resources = { meat: 1, egg: 4, fruit: 1, seed: 0 };

    const finished = finalizeGame(game);
    const entryA = finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p1")!;
    const entryB = finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p2")!;

    expect(entryA.resourceMajorityPoints).toBe(2); // meat + tied fruit base points
    expect(entryB.resourceMajorityPoints).toBe(2); // egg + tied fruit base points
    expect(entryA.scenarioPoints).toBe(1); // solo meat majority gets Amazonia bonus
    expect(entryB.scenarioPoints).toBe(1); // solo egg majority gets Amazonia bonus
    expect(entryA.totalScore).toBe(8);
    expect(entryB.totalScore).toBe(8);
  });

  it("scores selected objective only in final scoring", () => {
    let game = activeGame([player("p1", "coati"), player("p2", "macaw")]);
    const a = game.players.find((p) => p.playerId === "p1")!;
    a.score = 4;
    a.selectedObjectiveCardId = "objective_11";
    a.piecesInForest = ["a", "b", "c", "d", "e"]; // Quati has 8 pieces: more than half = +1 objective point.

    game = forceEndPlayerTurn(game, "p1", "end turn");
    const afterTurn = game.players.find((p) => p.playerId === "p1")!;
    expect(afterTurn.score).toBe(4);
    expect(game.log.some((entry) => entry.payload?.kind === "objective")).toBe(false);

    const finished = finalizeGame(game);
    const entryA = finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p1")!;
    expect(entryA.baseScore).toBe(4);
    expect(entryA.objectivePoints).toBe(1);
    expect(entryA.totalScore).toBe(5);
    expect(finished.players.find((p) => p.playerId === "p1")!.score).toBe(5);
  });

  it("scores resource-majority objectives from the pre-spend final resources", () => {
    const game = activeGame([player("p1", "coati"), player("p2", "macaw")]);
    const a = game.players.find((p) => p.playerId === "p1")!;
    const b = game.players.find((p) => p.playerId === "p2")!;
    a.selectedObjectiveCardId = "objective_2";
    a.resources = { meat: 0, egg: 0, fruit: 3, seed: 0 };
    b.resources = { meat: 0, egg: 0, fruit: 1, seed: 0 };

    const finished = finalizeGame(game);
    const entryA = finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p1")!;

    expect(entryA.resourceMajorityPoints).toBe(1);
    expect(entryA.objectivePoints).toBe(2);
    expect(finished.players.find((p) => p.playerId === "p1")!.resources.fruit).toBe(0);
  });

  it("spends 3 seeds for the predator seed objective before normal seed conversion", () => {
    const game = activeGame([player("p1", "jaguar"), player("p2", "macaw")]);
    const a = game.players.find((p) => p.playerId === "p1")!;
    a.selectedObjectiveCardId = "objective_3";
    a.resources = { meat: 0, egg: 0, fruit: 0, seed: 5 };
    game.acceptedSeedSpendObjectivePlayerIds = ["p1"];

    const finished = finalizeGame(game);
    const entryA = finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p1")!;

    expect(entryA.objectivePoints).toBe(3);
    expect(entryA.seedPoints).toBe(1);
    expect(finished.players.find((p) => p.playerId === "p1")!.resources.seed).toBe(0);
  });

  it("does not spend seeds for the predator seed objective unless accepted", () => {
    const game = activeGame([player("p1", "jaguar"), player("p2", "macaw")]);
    const a = game.players.find((p) => p.playerId === "p1")!;
    a.selectedObjectiveCardId = "objective_3";
    a.resources = { meat: 0, egg: 0, fruit: 0, seed: 5 };

    const finished = finalizeGame(game);
    const entryA = finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p1")!;

    expect(entryA.objectivePoints).toBe(0);
    expect(entryA.seedPoints).toBe(2);
    expect(finished.players.find((p) => p.playerId === "p1")!.resources.seed).toBe(1);
  });

  it("scores missing-resource objectives for predator and middle categories", () => {
    const game = activeGame([player("p1", "jaguar"), player("p2", "macaw")]);
    const a = game.players.find((p) => p.playerId === "p1")!;
    a.selectedObjectiveCardId = "objective_14";
    a.resources = { meat: 0, egg: 1, fruit: 0, seed: 0 };

    const finished = finalizeGame(game);
    const entryA = finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p1")!;

    expect(entryA.objectivePoints).toBe(2);
  });

  it("tiebreak falls back to higher population value", () => {
    const game = activeGame();
    const a = game.players.find((p) => p.playerId === "p1")!; // coati, pop 8
    const b = game.players.find((p) => p.playerId === "p2")!; // macaw, pop 6
    a.score = 4;
    b.score = 4;
    a.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
    b.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };

    const finished = finalizeGame(game);
    expect(finished.winnerPlayerIds).toEqual(["p1"]); // coati higher population
  });

  it("applies point cap of 21 for 2-3 players", () => {
    const game = activeGame();
    const a = game.players.find((p) => p.playerId === "p1")!;
    a.score = 30;
    const finished = finalizeGame(game);
    expect(finished.finalScoreBreakdown!.pointCap).toBe(21);
    expect(finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p1")!.totalScore).toBe(21);
  });

  it("applies point cap of 20 for 4+ players", () => {
    const game = activeGame([
      player("p1", "coati"),
      player("p2", "macaw"),
      player("p3", "armadillo"),
      player("p4", "jaguar")
    ]);
    const a = game.players.find((p) => p.playerId === "p1")!;
    a.score = 50;
    const finished = finalizeGame(game);
    expect(finished.finalScoreBreakdown!.pointCap).toBe(20);
    expect(finished.finalScoreBreakdown!.entries.find((e) => e.playerId === "p1")!.totalScore).toBe(20);
  });
});

describe("end game flow", () => {
  it("forceEndPlayerTurn advances to the next player", () => {
    const game = activeGame();
    const first = game.activePlayerId;
    const next = forceEndPlayerTurn(game, first!, "jogador desconectado");
    expect(next.activePlayerId).not.toBe(first);
    expect(next.log.some((entry) => entry.message.includes("teve o turno pulado"))).toBe(true);
  });

  it("forceEndPlayerTurn rejects non-active player", () => {
    const game = activeGame();
    const other = game.turnOrder[1];
    expect(() => forceEndPlayerTurn(game, other!, "x")).toThrow();
  });

  it("game ends after maxRounds via forced skips", () => {
    let game = activeGame();
    let guard = 0;
    while (game.status === "active" && guard < 100) {
      game = forceEndPlayerTurn(game, game.activePlayerId!, "timeout");
      guard += 1;
    }
    expect(game.status).toBe("finished");
    expect(game.round).toBeGreaterThan(game.maxRounds);
    expect(game.activePlayerId).toBeNull();
  });

  it("queues the extra-turn objective after the last normal turn and finalizes after that extra turn", () => {
    let game = activeGame([player("jaguar", "jaguar"), player("coati", "coati")]);
    const jaguar = game.players.find((candidate) => candidate.playerId === "jaguar")!;
    jaguar.score = 3;
    jaguar.selectedObjectiveCardId = "objective_20";
    game.round = game.maxRounds;
    game.activePlayerId = "jaguar";

    game = forceEndPlayerTurn(game, "jaguar", "end turn");

    expect(game.status).toBe("active");
    expect(game.pendingExtraTurnPlayerId).toBe("jaguar");
    expect(game.activePlayerId).toBeNull();
    expect(game.finalScoreBreakdown).toBeNull();

    game = resolveExtraTurnObjective(game, "jaguar", true);

    expect(game.activePlayerId).toBe("jaguar");
    expect(game.extraTurnPlayerId).toBe("jaguar");
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")!.score).toBe(2);

    game = forceEndPlayerTurn(game, "jaguar", "extra done");

    expect(game.status).toBe("finished");
    expect(game.activePlayerId).toBeNull();
    expect(game.finalScoreBreakdown?.entries.find((entry) => entry.playerId === "jaguar")?.baseScore).toBe(2);
  });

  it("lets a card-using extra-turn player skip action A when no forest card is playable", () => {
    let game = activeGame([player("p1", "maned_wolf"), player("p2", "coati")]);
    const wolf = game.players.find((candidate) => candidate.playerId === "p1")!;
    wolf.hand = [];
    wolf.score = 3;
    wolf.selectedObjectiveCardId = "objective_20";
    game.extraTurnPlayerId = "p1";
    game.activePlayerId = "p1";
    game.activeActionIndex = 0;
    game.activePlayedForestCardId = null;

    game = completeCurrentAction(game, "p1");

    expect(game.activePlayerId).toBe("p1");
    expect(game.activeActionIndex).toBeGreaterThan(0);
    expect(game.log.some((entry) => entry.id.startsWith("extra_turn_skip_no_card"))).toBe(true);
  });

  it("repairs an active round 6 state by queueing the extra-turn objective", () => {
    let game = activeGame([player("jaguar", "jaguar"), player("coati", "coati")]);
    const jaguar = game.players.find((candidate) => candidate.playerId === "jaguar")!;
    jaguar.score = 2;
    jaguar.selectedObjectiveCardId = "objective_20";
    game.round = 6;
    game.activePlayerId = "coati";
    game.activeActionIndex = 0;

    game = completeCurrentAction(game, "coati");

    expect(game.pendingExtraTurnPlayerId).toBe("jaguar");
    expect(game.activePlayerId).toBeNull();
    expect(game.status).toBe("active");
  });

  it("queues the seed-spend objective before final scoring and applies accepted choice before seed points", () => {
    let game = activeGame([player("jaguar", "jaguar"), player("coati", "coati")]);
    const jaguar = game.players.find((candidate) => candidate.playerId === "jaguar")!;
    jaguar.score = 10;
    jaguar.resources = { meat: 0, egg: 0, fruit: 0, seed: 5 };
    jaguar.selectedObjectiveCardId = "objective_3";
    game.round = game.maxRounds;
    game.activePlayerId = "jaguar";

    game = forceEndPlayerTurn(game, "jaguar", "end turn");

    expect(game.status).toBe("active");
    expect(game.pendingSeedSpendObjectivePlayerId).toBe("jaguar");
    expect(game.finalScoreBreakdown).toBeNull();

    game = resolveSeedSpendObjective(game, "jaguar", true);
    const entry = game.finalScoreBreakdown!.entries.find((candidate) => candidate.playerId === "jaguar")!;

    expect(game.status).toBe("finished");
    expect(entry.objectivePoints).toBe(3);
    expect(entry.seedPoints).toBe(1);
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")!.resources.seed).toBe(0);
  });

  it("keeps all seeds for normal seed scoring when seed-spend objective is declined", () => {
    let game = activeGame([player("jaguar", "jaguar"), player("coati", "coati")]);
    const jaguar = game.players.find((candidate) => candidate.playerId === "jaguar")!;
    jaguar.score = 10;
    jaguar.resources = { meat: 0, egg: 0, fruit: 0, seed: 5 };
    jaguar.selectedObjectiveCardId = "objective_3";
    game.round = game.maxRounds;
    game.activePlayerId = "jaguar";

    game = forceEndPlayerTurn(game, "jaguar", "end turn");
    game = resolveSeedSpendObjective(game, "jaguar", false);
    const entry = game.finalScoreBreakdown!.entries.find((candidate) => candidate.playerId === "jaguar")!;

    expect(entry.objectivePoints).toBe(0);
    expect(entry.seedPoints).toBe(2);
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")!.resources.seed).toBe(1);
  });
});
