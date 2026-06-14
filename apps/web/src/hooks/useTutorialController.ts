import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@oikos/shared";
import { sameGridPosition } from "../ui/geometry";
import {
  getTutorialPlayerId,
  getTutorialSteps,
  type TutorialGate,
  type TutorialId,
  type TutorialStepDef
} from "../ui/tutorials";

export type TutorialBoardAction = "setupPlace" | "placeCard" | "move";

interface TutorialProgressInput {
  game: GameState;
  moveLogStart: number | null;
  step: TutorialStepDef;
  tutorialId: TutorialId;
}

export type TutorialProgressUpdate =
  | { type: "none" }
  | { type: "captureMoveLog"; length: number }
  | { type: "advance"; placedCard: boolean };

interface UseTutorialControllerOptions {
  game: GameState | null | undefined;
  onCardPlaced: (tutorialId: TutorialId, step: TutorialStepDef) => void;
  onStepActivated: (step: TutorialStepDef) => void;
}

export function isTutorialActionBlocked(
  tutorialActive: boolean,
  tutorialGate: TutorialGate | null,
  action: TutorialBoardAction
): boolean {
  if (!tutorialActive) return false;
  if (tutorialGate === "setup") return action !== "setupPlace";
  if (tutorialGate === "placeCard") return action !== "placeCard";
  if (tutorialGate === "move") return action !== "move";
  return true;
}

export function getTutorialProgressUpdate({
  game,
  moveLogStart,
  step,
  tutorialId
}: TutorialProgressInput): TutorialProgressUpdate {
  if (!step.autoAdvance) return { type: "none" };

  const tutorialPlayerId = getTutorialPlayerId(tutorialId, game.activePlayerId);

  if (step.gate === "setup") {
    return game.status === "active" ? { type: "advance", placedCard: false } : { type: "none" };
  }

  if (
    step.gate === "placeCard" &&
    step.requiredCardId &&
    game.forest.cards.some((card) => card.definitionId === step.requiredCardId)
  ) {
    return { type: "advance", placedCard: true };
  }

  if (step.gate === "move" && step.markedPieceId && step.markedMoveTarget) {
    const piece = game.pieces.find((candidate) => candidate.pieceId === step.markedPieceId);
    return piece?.location && sameGridPosition(piece.location, step.markedMoveTarget)
      ? { type: "advance", placedCard: false }
      : { type: "none" };
  }

  if (step.completeWhenCoatiPairPending) {
    return game.activePlayerId === tutorialPlayerId &&
      game.pendingCoatiPairBonus?.playerId === tutorialPlayerId
      ? { type: "advance", placedCard: false }
      : { type: "none" };
  }

  if (typeof step.completeWhenActionIndex === "number") {
    return game.activePlayerId === tutorialPlayerId &&
      game.activeActionIndex >= step.completeWhenActionIndex
      ? { type: "advance", placedCard: false }
      : { type: "none" };
  }

  if (typeof step.completeWhenScoreAtLeast === "number") {
    const player = game.players.find((candidate) => candidate.playerId === tutorialPlayerId);
    return player && player.score >= step.completeWhenScoreAtLeast
      ? { type: "advance", placedCard: false }
      : { type: "none" };
  }

  if (typeof step.completeWhenRoundAtLeast === "number") {
    return game.round >= step.completeWhenRoundAtLeast
      ? { type: "advance", placedCard: false }
      : { type: "none" };
  }

  if (step.gate !== "move") return { type: "none" };
  if (moveLogStart === null) {
    return { type: "captureMoveLog", length: game.log.length };
  }

  return game.log
    .slice(moveLogStart)
    .some((entry) => entry.payload?.kind === "move_piece")
    ? { type: "advance", placedCard: false }
    : { type: "none" };
}

export function useTutorialController({
  game,
  onCardPlaced,
  onStepActivated
}: UseTutorialControllerOptions) {
  const [tutorialId, setTutorialId] = useState<TutorialId | null>(null);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const moveLogStartRef = useRef<number | null>(null);

  const tutorialSteps = getTutorialSteps(tutorialId);
  const tutorialActive = tutorialId !== null && tutorialStep !== null;
  const tutorialDef = tutorialActive ? tutorialSteps[tutorialStep] ?? null : null;
  const tutorialGate = tutorialDef?.gate ?? null;

  const beginTutorial = useCallback((id: TutorialId) => {
    moveLogStartRef.current = null;
    setTutorialId(id);
    setTutorialStep(0);
  }, []);

  const clearTutorial = useCallback(() => {
    moveLogStartRef.current = null;
    setTutorialId(null);
    setTutorialStep(null);
  }, []);

  const advanceTutorial = useCallback(() => {
    setTutorialStep((step) => (step === null ? step : step + 1));
  }, []);

  const tutorialBlocks = useCallback(
    (action: TutorialBoardAction) =>
      isTutorialActionBlocked(tutorialActive, tutorialGate, action),
    [tutorialActive, tutorialGate]
  );

  useEffect(() => {
    if (tutorialStep === null || !tutorialId || !game || !tutorialDef) return;

    const update = getTutorialProgressUpdate({
      game,
      moveLogStart: moveLogStartRef.current,
      step: tutorialDef,
      tutorialId
    });

    if (update.type === "captureMoveLog") {
      moveLogStartRef.current = update.length;
      return;
    }
    if (update.type !== "advance") return;

    if (update.placedCard) onCardPlaced(tutorialId, tutorialDef);
    moveLogStartRef.current = null;
    advanceTutorial();
  }, [
    advanceTutorial,
    game,
    onCardPlaced,
    tutorialDef,
    tutorialId,
    tutorialStep
  ]);

  useEffect(() => {
    if (tutorialStep === null || !tutorialDef) return;
    onStepActivated(tutorialDef);
  }, [onStepActivated, tutorialDef, tutorialId, tutorialStep]);

  return {
    advanceTutorial,
    beginTutorial,
    clearTutorial,
    highlightedMovementGuideSpecies:
      tutorialActive ? tutorialDef?.highlightMovementGuideSpecies ?? null : null,
    isBasicTutorial: tutorialId === "initial",
    tutorialActive,
    tutorialBlocks,
    tutorialDef,
    tutorialGate,
    tutorialId,
    tutorialRequiredCardId:
      tutorialActive && tutorialGate === "placeCard" ? tutorialDef?.requiredCardId ?? null : null,
    tutorialStep,
    tutorialSteps
  };
}
