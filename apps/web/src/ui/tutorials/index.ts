import { isTutorialProgressDone, markTutorialProgressDone } from "../../auth/tutorialProgress";
import { ARMADILLO_TUTORIAL_PLAYER_ID, ARMADILLO_TUTORIAL_STEPS } from "./armadillo";
import { CAPUCHIN_TUTORIAL_PLAYER_ID, CAPUCHIN_TUTORIAL_STEPS } from "./capuchin";
import { COATI_TUTORIAL_PLAYER_ID, COATI_TUTORIAL_STEPS } from "./coati";
import { INITIAL_TUTORIAL_PLAYER_ID, INITIAL_TUTORIAL_STEPS } from "./initial";
import { JAGUAR_TUTORIAL_PLAYER_ID, JAGUAR_TUTORIAL_STEPS } from "./jaguar";
import { MACAW_TUTORIAL_PLAYER_ID, MACAW_TUTORIAL_STEPS } from "./macaw";
import type { TutorialId, TutorialStepDef } from "./types";
import { WOLF_TUTORIAL_PLAYER_ID, WOLF_TUTORIAL_STEPS } from "./wolf";

export type {
  TutorialCategoryCard,
  TutorialGate,
  TutorialId,
  TutorialResourceIcon,
  TutorialStepDef,
  TutorialTerm
} from "./types";
export { createInitialTutorialRoom, TUTORIAL_NONRIVER_CARD } from "./initial";
export { createJaguarTutorialRoom } from "./jaguar";
export { createWolfTutorialRoom } from "./wolf";
export { createArmadilloTutorialRoom } from "./armadillo";
export { createMacawTutorialRoom } from "./macaw";
export { createCapuchinTutorialRoom } from "./capuchin";
export { createCoatiTutorialRoom } from "./coati";

function getTutorialDoneKey(tutorialId: TutorialId): string {
  return `oikos-tutorial-${tutorialId}`;
}

export function isTutorialDone(tutorialId: TutorialId): boolean {
  if (isTutorialProgressDone(tutorialId)) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getTutorialDoneKey(tutorialId)) === "1";
  } catch {
    return false;
  }
}

export function markTutorialDone(tutorialId: TutorialId): void {
  try {
    window.localStorage.setItem(getTutorialDoneKey(tutorialId), "1");
  } catch {
    // ignore
  }
  void markTutorialProgressDone(tutorialId);
}

export const isTutorialInitialDone = (): boolean => isTutorialDone("initial");
export const isTutorialJaguarDone = (): boolean => isTutorialDone("jaguar");
export const isTutorialWolfDone = (): boolean => isTutorialDone("wolf");
export const isTutorialArmadilloDone = (): boolean => isTutorialDone("armadillo");
export const isTutorialMacawDone = (): boolean => isTutorialDone("macaw");
export const isTutorialCapuchinDone = (): boolean => isTutorialDone("capuchin");
export const isTutorialCoatiDone = (): boolean => isTutorialDone("coati");

const TUTORIAL_DEFS: Record<TutorialId, { steps: TutorialStepDef[]; playerId: string }> = {
  initial: { steps: INITIAL_TUTORIAL_STEPS, playerId: INITIAL_TUTORIAL_PLAYER_ID },
  jaguar: { steps: JAGUAR_TUTORIAL_STEPS, playerId: JAGUAR_TUTORIAL_PLAYER_ID },
  wolf: { steps: WOLF_TUTORIAL_STEPS, playerId: WOLF_TUTORIAL_PLAYER_ID },
  armadillo: { steps: ARMADILLO_TUTORIAL_STEPS, playerId: ARMADILLO_TUTORIAL_PLAYER_ID },
  macaw: { steps: MACAW_TUTORIAL_STEPS, playerId: MACAW_TUTORIAL_PLAYER_ID },
  capuchin: { steps: CAPUCHIN_TUTORIAL_STEPS, playerId: CAPUCHIN_TUTORIAL_PLAYER_ID },
  coati: { steps: COATI_TUTORIAL_STEPS, playerId: COATI_TUTORIAL_PLAYER_ID }
};

export function getTutorialSteps(tutorialId: TutorialId | null): TutorialStepDef[] {
  return tutorialId ? TUTORIAL_DEFS[tutorialId].steps : INITIAL_TUTORIAL_STEPS;
}

export function getTutorialPlayerId(tutorialId: TutorialId | null, fallback: string | null): string | null {
  return tutorialId ? TUTORIAL_DEFS[tutorialId].playerId : fallback;
}
