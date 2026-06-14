import type { GameState } from "@oikos/shared";
import { describe, expect, it } from "vitest";
import {
  getTutorialProgressUpdate,
  isTutorialActionBlocked,
  type TutorialBoardAction
} from "./useTutorialController";
import {
  createCoatiTutorialRoom,
  createInitialTutorialRoom,
  type TutorialGate,
  type TutorialStepDef
} from "../ui/tutorials";

const autoStep = (
  gate: TutorialGate,
  overrides: Partial<TutorialStepDef> = {}
): TutorialStepDef => ({
  title: "Passo",
  body: "Teste",
  gate,
  autoAdvance: true,
  ...overrides
});

function progress(
  game: GameState,
  step: TutorialStepDef,
  moveLogStart: number | null = null
) {
  return getTutorialProgressUpdate({
    game,
    moveLogStart,
    step,
    tutorialId: "coati"
  });
}

describe("isTutorialActionBlocked", () => {
  it("allows all board actions outside tutorials", () => {
    expect(isTutorialActionBlocked(false, null, "setupPlace")).toBe(false);
    expect(isTutorialActionBlocked(false, null, "placeCard")).toBe(false);
    expect(isTutorialActionBlocked(false, null, "move")).toBe(false);
  });

  it.each([
    ["setup", "setupPlace"],
    ["placeCard", "placeCard"],
    ["move", "move"]
  ] as Array<[TutorialGate, TutorialBoardAction]>)(
    "allows only the %s gate action",
    (gate, allowedAction) => {
      const actions: TutorialBoardAction[] = ["setupPlace", "placeCard", "move"];
      for (const action of actions) {
        expect(isTutorialActionBlocked(true, gate, action)).toBe(action !== allowedAction);
      }
    }
  );

  it.each([
    "none",
    "removeBase",
    "score",
    "addPiece",
    "resolvePair",
    "removeCoati",
    "hidePiece"
  ] as TutorialGate[])("blocks board actions during the %s gate", (gate) => {
    expect(isTutorialActionBlocked(true, gate, "setupPlace")).toBe(true);
    expect(isTutorialActionBlocked(true, gate, "placeCard")).toBe(true);
    expect(isTutorialActionBlocked(true, gate, "move")).toBe(true);
  });
});

describe("getTutorialProgressUpdate", () => {
  const coatiGame = createCoatiTutorialRoom().game!;

  it("does not advance manual steps", () => {
    expect(progress(coatiGame, { ...autoStep("none"), autoAdvance: false })).toEqual({
      type: "none"
    });
  });

  it("advances setup when game becomes active", () => {
    expect(progress(coatiGame, autoStep("setup"))).toEqual({
      type: "advance",
      placedCard: false
    });
    expect(progress({ ...coatiGame, status: "setup" }, autoStep("setup"))).toEqual({
      type: "none"
    });
  });

  it("advances after required card reaches forest", () => {
    const requiredCardId = coatiGame.forest.cards[0]!.definitionId;
    expect(
      progress(coatiGame, autoStep("placeCard", { requiredCardId }))
    ).toEqual({ type: "advance", placedCard: true });
    expect(
      progress(coatiGame, autoStep("placeCard", { requiredCardId: "missing-card" }))
    ).toEqual({ type: "none" });
  });

  it("advances marked movement only at exact destination", () => {
    const piece = coatiGame.pieces.find((candidate) => candidate.location)!;
    const step = autoStep("move", {
      markedPieceId: piece.pieceId,
      markedMoveTarget: piece.location!
    });

    expect(progress(coatiGame, step)).toEqual({
      type: "advance",
      placedCard: false
    });
    expect(
      progress(
        {
          ...coatiGame,
          pieces: coatiGame.pieces.map((candidate) =>
            candidate.pieceId === piece.pieceId
              ? { ...candidate, location: { ...candidate.location!, x: 99, y: 99 } }
              : candidate
          )
        },
        step
      )
    ).toEqual({ type: "none" });
  });

  it("advances Coati pair, action, score and round conditions", () => {
    const playerId = coatiGame.activePlayerId!;
    const player = coatiGame.players.find((candidate) => candidate.playerId === playerId)!;

    expect(
      progress(
        {
          ...coatiGame,
          pendingCoatiPairBonus: {
            playerId,
            pairKey: "pair",
            origin: { x: 0, y: 0 }
          }
        },
        autoStep("addPiece", { completeWhenCoatiPairPending: true })
      )
    ).toEqual({ type: "advance", placedCard: false });
    expect(
      progress(
        { ...coatiGame, activeActionIndex: 2 },
        autoStep("move", { completeWhenActionIndex: 2 })
      )
    ).toEqual({ type: "advance", placedCard: false });
    expect(
      progress(
        {
          ...coatiGame,
          players: coatiGame.players.map((candidate) =>
            candidate.playerId === playerId ? { ...player, score: 3 } : candidate
          )
        },
        autoStep("score", { completeWhenScoreAtLeast: 3 })
      )
    ).toEqual({ type: "advance", placedCard: false });
    expect(
      progress(
        { ...coatiGame, round: 3 },
        autoStep("removeCoati", { completeWhenRoundAtLeast: 3 })
      )
    ).toEqual({ type: "advance", placedCard: false });
  });

  it("captures move log baseline then detects a movement entry", () => {
    const step = autoStep("move");
    expect(progress(coatiGame, step)).toEqual({
      type: "captureMoveLog",
      length: coatiGame.log.length
    });

    const gameAfterMove: GameState = {
      ...coatiGame,
      log: [
        ...coatiGame.log,
        {
          id: "tutorial-move",
          message: "Peça movida",
          createdAt: 1,
          payload: { kind: "move_piece" }
        }
      ]
    };
    expect(progress(gameAfterMove, step, coatiGame.log.length)).toEqual({
      type: "advance",
      placedCard: false
    });
  });

  it("supports basic tutorial state through same progress evaluator", () => {
    const game = createInitialTutorialRoom().game!;
    const requiredCardId = game.forest.cards[0]!.definitionId;
    expect(
      getTutorialProgressUpdate({
        game,
        moveLogStart: null,
        step: autoStep("placeCard", { requiredCardId }),
        tutorialId: "initial"
      })
    ).toEqual({ type: "advance", placedCard: true });
  });
});
