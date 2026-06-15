import {
  createInitialGameState,
  createPreviewInitialForest,
  getArmadilloShareScore,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getCapuchinHabitatScore,
  getGaloSeedCardScore,
  getMacawLineScore,
  getRequiredCoatiRemovalCount,
  getWolfRemovableBasePieceIds,
  getWolfSpendableResourceTypes
} from "@oikos/rules";
import type {
  GameState,
  RoomPlayer,
  SpeciesId
} from "@oikos/shared";
import { describe, expect, it } from "vitest";
import {
  createArmadilloTutorialRoom,
  createCapuchinTutorialRoom,
  createCoatiTutorialRoom,
  createJaguarTutorialRoom,
  createMacawTutorialRoom,
  createWolfTutorialRoom
} from "../ui/tutorials";
import {
  getActiveScoringState,
  type ActiveScoringStateOptions
} from "./activeScoringState";

function options(
  game: GameState | null,
  activeSpeciesId: SpeciesId | null,
  overrides: Partial<ActiveScoringStateOptions> = {}
): ActiveScoringStateOptions {
  return {
    activeActionId: "D",
    activeSpeciesId,
    canControlActivePlayer: true,
    game,
    hasPendingCoatiPairBonus: false,
    tutorialActive: false,
    tutorialGate: null,
    tutorialId: null,
    ...overrides
  };
}

describe("getActiveScoringState", () => {
  it("returns empty scoring state without a game", () => {
    const state = getActiveScoringState(options(null, null));

    expect(state).toEqual({
      armadilloShareScore: 0,
      availableJaguarPointSpendCount: 0,
      availableWolfPointSpendCount: 0,
      cacaIlegalPending: null,
      capuchinHabitatScore: 0,
      capuchinReserveCount: 0,
      galoSeedCardScore: 0,
      macawLineScore: 0,
      requiredCoatiRemovalCount: 0,
      shouldShowJaguarScoreModal: false,
      wolfRemovableBasePieceIds: [],
      wolfSpendableResources: []
    });
  });

  it("derives species scoring values from the active player", () => {
    const capuchin = createCapuchinTutorialRoom().game!;
    const macaw = createMacawTutorialRoom().game!;
    const armadillo = createArmadilloTutorialRoom().game!;

    expect(
      getActiveScoringState(options(capuchin, "capuchin"))
    ).toMatchObject({
      capuchinHabitatScore: getCapuchinHabitatScore(
        capuchin,
        capuchin.activePlayerId!
      ),
      capuchinReserveCount: capuchin.players.find(
        (player) => player.playerId === capuchin.activePlayerId
      )!.reservePieces.length
    });
    expect(getActiveScoringState(options(macaw, "macaw")).macawLineScore)
      .toBe(getMacawLineScore(macaw, macaw.activePlayerId!));
    expect(
      getActiveScoringState(options(armadillo, "armadillo"))
        .armadilloShareScore
    ).toBe(getArmadilloShareScore(armadillo, armadillo.activePlayerId!));
  });

  it("derives Coati, Jaguar and Wolf action resources", () => {
    const coati = createCoatiTutorialRoom().game!;
    const jaguar = createJaguarTutorialRoom().game!;
    const wolf = createWolfTutorialRoom().game!;

    expect(
      getActiveScoringState(options(coati, "coati"))
        .requiredCoatiRemovalCount
    ).toBe(getRequiredCoatiRemovalCount(coati, coati.activePlayerId!));
    expect(
      getActiveScoringState(options(jaguar, "jaguar"))
        .availableJaguarPointSpendCount
    ).toBe(
      getAvailableJaguarPointSpendCount(jaguar, jaguar.activePlayerId!)
    );

    const wolfState = getActiveScoringState(options(wolf, "maned_wolf"));
    expect(wolfState.wolfRemovableBasePieceIds).toEqual(
      getWolfRemovableBasePieceIds(wolf, wolf.activePlayerId!)
    );
    expect(wolfState.wolfSpendableResources).toEqual(
      getWolfSpendableResourceTypes(wolf, wolf.activePlayerId!)
    );
    expect(wolfState.availableWolfPointSpendCount).toBe(
      getAvailableWolfPointSpendCount(wolf, wolf.activePlayerId!)
    );
  });

  it("derives Galo score and threat pending state", () => {
    const players: RoomPlayer[] = [
      {
        playerId: "galo",
        name: "Galo",
        speciesId: "galo_de_campina",
        ready: true,
        connected: true
      }
    ];
    const base = createInitialGameState(
      "active-scoring-state",
      players,
      () => 0.999999,
      createPreviewInitialForest()
    );
    const game: GameState = {
      ...base,
      status: "active",
      activePlayerId: "galo",
      cacaIlegalPending: { playerId: "galo" }
    };
    const state = getActiveScoringState(
      options(game, "galo_de_campina")
    );

    expect(state.galoSeedCardScore).toBe(
      getGaloSeedCardScore(game, "galo")
    );
    expect(state.cacaIlegalPending).toEqual({ playerId: "galo" });
  });

  it("shows Jaguar scoring only when every gate allows it", () => {
    const base = createJaguarTutorialRoom().game!;
    const game: GameState = {
      ...base,
      status: "active",
      activeActionIndex: 2
    };
    const allowed = options(game, "jaguar", {
      activeActionId: "C"
    });

    expect(
      getActiveScoringState(allowed).shouldShowJaguarScoreModal
    ).toBe(true);
    expect(
      getActiveScoringState({
        ...allowed,
        hasPendingCoatiPairBonus: true
      }).shouldShowJaguarScoreModal
    ).toBe(false);
    expect(
      getActiveScoringState({
        ...allowed,
        canControlActivePlayer: false
      }).shouldShowJaguarScoreModal
    ).toBe(false);
    expect(
      getActiveScoringState({
        ...allowed,
        tutorialActive: true,
        tutorialId: "jaguar",
        tutorialGate: "move"
      }).shouldShowJaguarScoreModal
    ).toBe(false);
    expect(
      getActiveScoringState({
        ...allowed,
        tutorialActive: true,
        tutorialId: "jaguar",
        tutorialGate: "score"
      }).shouldShowJaguarScoreModal
    ).toBe(true);
  });
});
