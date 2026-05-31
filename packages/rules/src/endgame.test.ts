import { describe, expect, it } from "vitest";
import type { RoomPlayer } from "@oikos/shared";
import { createInitialGameState, createPreviewInitialForest, finalizeGame, forceEndPlayerTurn } from "./setup";

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
    a.selectedObjectiveCardId = "objective_12";
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
});
