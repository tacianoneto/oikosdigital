import type { ActionId, SpeciesId } from "@oikos/shared";

export type MovementRuleKind = "jaguar" | "played_card" | "pending_all_by_played_card" | "relocate";

export interface SpeciesMovementRule {
  kind: MovementRuleKind;
  actions: ActionId[];
}

export interface SpeciesCacaIlegalRule {
  canRemoveOwnPiece: boolean;
}

export interface SpeciesRuleDefinition {
  speciesId: SpeciesId;
  implemented: boolean;
  pieceLogName: string;
  movementRules: SpeciesMovementRule[];
  cacaIlegal: SpeciesCacaIlegalRule;
}

export const speciesRules = {
  jaguar: {
    speciesId: "jaguar",
    implemented: true,
    pieceLogName: "onca",
    movementRules: [{ kind: "jaguar", actions: ["A", "B"] }],
    cacaIlegal: { canRemoveOwnPiece: false }
  },
  maned_wolf: {
    speciesId: "maned_wolf",
    implemented: true,
    pieceLogName: "lobo-guara",
    movementRules: [{ kind: "pending_all_by_played_card", actions: ["A"] }],
    cacaIlegal: { canRemoveOwnPiece: true }
  },
  armadillo: {
    speciesId: "armadillo",
    implemented: true,
    pieceLogName: "tatu",
    movementRules: [{ kind: "played_card", actions: ["B"] }],
    cacaIlegal: { canRemoveOwnPiece: true }
  },
  macaw: {
    speciesId: "macaw",
    implemented: true,
    pieceLogName: "arara",
    movementRules: [
      { kind: "played_card", actions: ["B"] },
      { kind: "relocate", actions: ["C"] }
    ],
    cacaIlegal: { canRemoveOwnPiece: true }
  },
  galo_de_campina: {
    speciesId: "galo_de_campina",
    implemented: true,
    pieceLogName: "galo-de-campina",
    movementRules: [{ kind: "played_card", actions: ["B", "C"] }],
    cacaIlegal: { canRemoveOwnPiece: true }
  },
  capuchin: {
    speciesId: "capuchin",
    implemented: true,
    pieceLogName: "macaco-prego",
    movementRules: [{ kind: "played_card", actions: ["B"] }],
    cacaIlegal: { canRemoveOwnPiece: true }
  },
  coati: {
    speciesId: "coati",
    implemented: true,
    pieceLogName: "quati",
    movementRules: [{ kind: "played_card", actions: ["B"] }],
    cacaIlegal: { canRemoveOwnPiece: true }
  }
} satisfies Record<SpeciesId, SpeciesRuleDefinition>;

export function getSpeciesRule(speciesId: SpeciesId): SpeciesRuleDefinition {
  return speciesRules[speciesId];
}

export function isImplementedSpecies(speciesId: SpeciesId): boolean {
  return getSpeciesRule(speciesId).implemented;
}

export function getSpeciesPieceLogName(speciesId: SpeciesId): string {
  return getSpeciesRule(speciesId).pieceLogName;
}

export function canSpeciesRemovePieceForCacaIlegal(speciesId: SpeciesId | null): boolean {
  return Boolean(speciesId && getSpeciesRule(speciesId).cacaIlegal.canRemoveOwnPiece);
}

export function hasSpeciesMovementRule(speciesId: SpeciesId, kind: MovementRuleKind, action: ActionId | null): boolean {
  if (!action) return false;
  return getSpeciesRule(speciesId).movementRules.some((rule) => rule.kind === kind && rule.actions.includes(action));
}
