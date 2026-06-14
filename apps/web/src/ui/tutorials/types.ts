import type { GridPosition, Resource, SpeciesId } from "@oikos/shared";

export type TutorialId = "initial" | "jaguar" | "wolf" | "armadillo" | "macaw" | "capuchin" | "coati";

// Each scripted step locks the board to a single taught interaction:
//   none      -> read-only, advance with the coach button
//   setup     -> place the starting meeples
//   placeCard -> play a card (and add the piece that action A grants)
//   move      -> move a meeple
//   removeBase -> select a base species piece and confirm removal
//   score      -> use a modal/side action while the board stays read-only
//   addPiece   -> add a species piece to a highlighted card
//   resolvePair -> resolve the Coati pair passive on an adjacent highlighted card
//   removeCoati -> select own Coatis and confirm the action-C removal
//   hidePiece -> select an Armadillo and confirm hiding it
export type TutorialGate = "none" | "setup" | "placeCard" | "move" | "removeBase" | "score" | "addPiece" | "resolvePair" | "removeCoati" | "hidePiece";

// A small icon + caption shown under the coach text, used to teach resources
// and scoring visually instead of with a wall of text.
export interface TutorialResourceIcon {
  resource: Resource | "point";
  caption: string;
}

// A species-type card shown with the colored population-pyramid icon from the
// "tipos de espécie" page of the rulebook.
export interface TutorialCategoryCard {
  label: string;
  color: string; // hex accent (border + label) tuned for the dark coach panel
  iconAsset: string;
  body: string;
}

// A bolded term plus its definition, used for the "termos importantes" step.
export interface TutorialTerm {
  term: string;
  body: string;
}

export interface TutorialStepDef {
  title: string;
  body: string;
  gate: TutorialGate;
  autoAdvance: boolean;
  resourceIcons?: TutorialResourceIcon[];
  categoryCards?: TutorialCategoryCard[];
  terms?: TutorialTerm[];
  requiredCardId?: string; // the only hand card the player may place this step
  markedSlot?: GridPosition; // the only slot where the card may be placed
  markedMoveTarget?: GridPosition; // the only board destination taught this step
  markedAddPieceTarget?: GridPosition;
  markedPairTarget?: GridPosition; // the only adjacent cell taught for the Coati pair bonus
  markedPieceId?: string;
  highlightMovementGuideSpecies?: SpeciesId;
  requiresRiver?: boolean; // the marked slot continues an existing river
  openBoard?: SpeciesId; // open this species board when the step starts
  completeWhenActionIndex?: number;
  completeWhenScoreAtLeast?: number;
  completeWhenRoundAtLeast?: number;
  completeWhenCoatiPairPending?: boolean; // advance once the pair passive is queued
  requiredSpendCount?: number;
}
