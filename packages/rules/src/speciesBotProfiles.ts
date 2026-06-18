import type { Resource, SpeciesId } from "@oikos/shared";

export type SpeciesPlanScoringKind =
  | "armadillo_sharing"
  | "capuchin_habitat"
  | "coati_pair"
  | "galo_field"
  | "jaguar_capture"
  | "macaw_line"
  | "wolf_pack";

export type SpeciesMoveScoringKind = "armadillo" | "capuchin" | "jaguar" | "macaw" | "wolf";

export interface SpeciesBotScoringProfile {
  resourcePreference: Resource[];
  setupAdjacencyWeight: number;
  preserveRankedCandidateOrder: boolean;
  cardPlacementScoring: SpeciesPlanScoringKind[];
  crowding: {
    ownPiecePenalty: number;
    ignoreSingleOwnPieceDuringActive: boolean;
  };
  planScoring: SpeciesPlanScoringKind | null;
  moveScoring: SpeciesMoveScoringKind[];
}

export const speciesBotScoringProfiles = {
  jaguar: {
    resourcePreference: ["meat", "meat", "egg", "fruit", "seed"],
    setupAdjacencyWeight: 2,
    preserveRankedCandidateOrder: false,
    cardPlacementScoring: [],
    crowding: { ownPiecePenalty: 8, ignoreSingleOwnPieceDuringActive: false },
    planScoring: "jaguar_capture",
    moveScoring: ["jaguar"]
  },
  maned_wolf: {
    resourcePreference: ["meat", "fruit", "egg", "seed"],
    setupAdjacencyWeight: 2,
    preserveRankedCandidateOrder: false,
    cardPlacementScoring: [],
    crowding: { ownPiecePenalty: 8, ignoreSingleOwnPieceDuringActive: false },
    planScoring: "wolf_pack",
    moveScoring: ["wolf"]
  },
  armadillo: {
    resourcePreference: ["seed", "fruit", "egg", "meat"],
    setupAdjacencyWeight: 2,
    preserveRankedCandidateOrder: false,
    cardPlacementScoring: [],
    crowding: { ownPiecePenalty: 8, ignoreSingleOwnPieceDuringActive: false },
    planScoring: "armadillo_sharing",
    moveScoring: ["armadillo"]
  },
  macaw: {
    resourcePreference: ["egg", "fruit", "seed", "meat"],
    setupAdjacencyWeight: 3,
    preserveRankedCandidateOrder: false,
    cardPlacementScoring: ["macaw_line"],
    crowding: { ownPiecePenalty: 16, ignoreSingleOwnPieceDuringActive: false },
    planScoring: "macaw_line",
    moveScoring: ["macaw"]
  },
  galo_de_campina: {
    resourcePreference: ["seed", "fruit", "egg", "meat"],
    setupAdjacencyWeight: 2,
    preserveRankedCandidateOrder: false,
    cardPlacementScoring: [],
    crowding: { ownPiecePenalty: 8, ignoreSingleOwnPieceDuringActive: false },
    planScoring: "galo_field",
    moveScoring: []
  },
  capuchin: {
    resourcePreference: ["fruit", "egg", "seed", "meat"],
    setupAdjacencyWeight: 1,
    preserveRankedCandidateOrder: true,
    cardPlacementScoring: ["capuchin_habitat"],
    crowding: { ownPiecePenalty: 8, ignoreSingleOwnPieceDuringActive: false },
    planScoring: "capuchin_habitat",
    moveScoring: ["capuchin"]
  },
  coati: {
    resourcePreference: ["fruit", "seed", "egg", "meat"],
    setupAdjacencyWeight: 5,
    preserveRankedCandidateOrder: false,
    cardPlacementScoring: [],
    crowding: { ownPiecePenalty: 8, ignoreSingleOwnPieceDuringActive: true },
    planScoring: "coati_pair",
    moveScoring: []
  }
} satisfies Record<SpeciesId, SpeciesBotScoringProfile>;

export function getSpeciesBotScoringProfile(speciesId: SpeciesId): SpeciesBotScoringProfile {
  return speciesBotScoringProfiles[speciesId];
}
