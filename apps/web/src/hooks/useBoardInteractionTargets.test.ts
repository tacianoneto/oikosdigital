import {
  addCoatiForCurrentAction,
  getArmadilloSeedPlacementPositions,
  getAvailableForestExpansionPositionsForCard,
  getCapuchinPlacementPositions,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getCacaIlegalRemovablePieceIds,
  getGaloFieldPlacementPositions,
  getGaloInterruptPieceIds,
  getMacawActionCTargets,
  getMacawEggPlacementPositions,
  getValidPieceMovementDestinations,
  getWolfMeatPlacementPositions,
  getWolfRemovableBasePieceIds,
  placeForestCard
} from "@oikos/rules";
import { describe, expect, it } from "vitest";
import {
  getBoardPieceTargets,
  getCardPlacementTargets,
  getMovementInteractionTargets,
  getSelectablePieceIds,
  getSpeciesPlacementTargets
} from "./boardInteractionTargets";
import {
  createArmadilloTutorialRoom,
  createCapuchinTutorialRoom,
  createCoatiTutorialRoom,
  createJaguarTutorialRoom,
  createMacawTutorialRoom,
  createWolfTutorialRoom,
  getTutorialSteps,
  type TutorialStepDef
} from "../ui/tutorials";

const inactiveTutorial = { active: false, def: null, gate: null };

describe("getCardPlacementTargets", () => {
  it("matches rule targets and restricts tutorial placement to its marked slot", () => {
    const game = createCoatiTutorialRoom().game!;
    const step = getTutorialSteps("coati").find(
      (candidate) => candidate.gate === "placeCard"
    )!;
    const selectedHandCardId = step.requiredCardId!;
    const expected = getAvailableForestExpansionPositionsForCard(
      game,
      selectedHandCardId,
      0
    );

    const targets = getCardPlacementTargets({
      canPlaceSelectedForestCard: true,
      game,
      hasPendingPlacement: false,
      selectedCardRotation: 0,
      selectedHandCardId,
      tutorial: { active: true, def: step, gate: step.gate }
    });

    expect(targets.expansionTargets).toEqual(expected);
    expect(targets.tutorialMarkedSlot).toEqual(step.markedSlot);
    expect(targets.displayExpansionTargets).toEqual(
      expected.filter(
        (position) =>
          position.x === step.markedSlot?.x && position.y === step.markedSlot?.y
      )
    );
    expect(
      targets.rotateFitTargets
    ).toEqual(
      ([0, 90, 180, 270] as const).flatMap((rotation) =>
        rotation === 0
          ? []
          : getAvailableForestExpansionPositionsForCard(
              game,
              selectedHandCardId,
              rotation
            ).map((position) => ({ position, rotation }))
      ).filter(
        (target, index, all) =>
          !expected.some(
            (position) =>
              position.x === target.position.x && position.y === target.position.y
          ) &&
          all.findIndex(
            (candidate) =>
              candidate.position.x === target.position.x &&
              candidate.position.y === target.position.y
          ) === index
      )
    );
  });

  it("hides card targets while placement is pending or tutorial is read-only", () => {
    const game = createCoatiTutorialRoom().game!;
    const cardId = game.players[0]!.hand[0]!;
    const base = {
      canPlaceSelectedForestCard: true,
      game,
      selectedCardRotation: 0 as const,
      selectedHandCardId: cardId
    };

    expect(
      getCardPlacementTargets({
        ...base,
        hasPendingPlacement: true,
        tutorial: inactiveTutorial
      }).expansionTargets
    ).toEqual([]);
    expect(
      getCardPlacementTargets({
        ...base,
        hasPendingPlacement: false,
        tutorial: {
          active: true,
          def: getTutorialSteps("coati")[0]!,
          gate: "none"
        }
      }).displayExpansionTargets
    ).toEqual([]);
  });
});

describe("getSelectablePieceIds", () => {
  it("matches Jaguar pieces for actions A and B", () => {
    const game = createJaguarTutorialRoom().game!;
    const expected = game.pieces
      .filter(
        (piece) =>
          piece.ownerId === game.activePlayerId &&
          piece.speciesId === "jaguar" &&
          piece.location
      )
      .map((piece) => piece.pieceId);

    for (const activeActionId of ["A", "B"] as const) {
      expect(
        getSelectablePieceIds({
          activeActionId,
          activeSpeciesId: "jaguar",
          cacaIlegalRemovalMode: false,
          canControlActivePlayer: true,
          controlledPlayerId: game.activePlayerId,
          game,
          hasPendingCoatiPairBonus: false
        })
      ).toEqual(expected);
    }
  });

  it("blocks selection without control or while Coati bonus is pending", () => {
    const game = createJaguarTutorialRoom().game!;
    const base = {
      activeActionId: "A" as const,
      activeSpeciesId: "jaguar" as const,
      cacaIlegalRemovalMode: false,
      controlledPlayerId: game.activePlayerId,
      game
    };

    expect(
      getSelectablePieceIds({
        ...base,
        canControlActivePlayer: false,
        hasPendingCoatiPairBonus: false
      })
    ).toEqual([]);
    expect(
      getSelectablePieceIds({
        ...base,
        canControlActivePlayer: true,
        hasPendingCoatiPairBonus: true
      })
    ).toEqual([]);
  });

  it("preserves Wolf, Galo and illegal-hunting selection branches", () => {
    const wolf = createWolfTutorialRoom().game!;
    const wolfPlayerId = wolf.activePlayerId!;
    const pendingWolfPieceIds = wolf.pieces
      .filter((piece) => piece.ownerId === wolfPlayerId && piece.location)
      .slice(0, 2)
      .map((piece) => piece.pieceId);
    const wolfWithPendingMoves = {
      ...wolf,
      pendingWolfMoves: { playerId: wolfPlayerId, pieceIds: pendingWolfPieceIds }
    };
    const base = {
      cacaIlegalRemovalMode: false,
      canControlActivePlayer: true,
      controlledPlayerId: wolfPlayerId,
      hasPendingCoatiPairBonus: false
    };

    expect(
      getSelectablePieceIds({
        ...base,
        activeActionId: "A",
        activeSpeciesId: "maned_wolf",
        game: wolfWithPendingMoves
      })
    ).toEqual(pendingWolfPieceIds);
    expect(
      getSelectablePieceIds({
        ...base,
        activeActionId: "B",
        activeSpeciesId: "maned_wolf",
        game: wolf
      })
    ).toEqual(getWolfRemovableBasePieceIds(wolf, wolfPlayerId));

    const galoPlayer = {
      ...wolf.players.find((player) => player.playerId === wolfPlayerId)!,
      speciesId: "galo_de_campina" as const,
      resources: {
        ...wolf.players.find((player) => player.playerId === wolfPlayerId)!.resources,
        seed: 1
      }
    };
    const movedPieceId = wolf.pieces.find((piece) => piece.ownerId === wolfPlayerId)!.pieceId;
    const galo = {
      ...wolf,
      players: wolf.players.map((player) =>
        player.playerId === wolfPlayerId ? galoPlayer : player
      ),
      pieces: wolf.pieces.map((piece) =>
        piece.ownerId === wolfPlayerId
          ? { ...piece, speciesId: "galo_de_campina" as const }
          : piece
      )
    };
    expect(
      getSelectablePieceIds({
        ...base,
        activeActionId: "C",
        activeSpeciesId: "galo_de_campina",
        game: galo
      })
    ).toEqual(
      galo.pieces
        .filter(
          (piece) =>
            piece.ownerId === wolfPlayerId &&
            piece.speciesId === "galo_de_campina" &&
            piece.location &&
            getValidPieceMovementDestinations(galo, wolfPlayerId, piece.pieceId).length > 0
        )
        .map((piece) => piece.pieceId)
    );

    const movedPiece = galo.pieces.find((piece) => piece.pieceId === movedPieceId)!;
    const galoInterrupt = {
      ...galo,
      activePlayerId: "other-player",
      pendingGaloInterrupt: {
        ownerId: wolfPlayerId,
        location: { x: movedPiece.location!.x, y: movedPiece.location!.y },
        interruptedPlayerId: "other-player"
      }
    };
    expect(
      getSelectablePieceIds({
        ...base,
        canControlActivePlayer: false,
        activeActionId: "B",
        activeSpeciesId: "galo_de_campina",
        game: galoInterrupt
      })
    ).toEqual(getGaloInterruptPieceIds(galoInterrupt, wolfPlayerId));

    const cacaIlegal = {
      ...wolf,
      cacaIlegalPending: { playerId: wolfPlayerId }
    };
    expect(
      getSelectablePieceIds({
        ...base,
        activeActionId: "A",
        activeSpeciesId: "maned_wolf",
        cacaIlegalRemovalMode: true,
        game: cacaIlegal
      })
    ).toEqual(getCacaIlegalRemovablePieceIds(cacaIlegal, wolfPlayerId));
  });
});

describe("getMovementInteractionTargets", () => {
  it("matches movement rules and applies exact tutorial destination", () => {
    const game = createJaguarTutorialRoom().game!;
    const pieceId = game.pieces.find(
      (piece) => piece.ownerId === game.activePlayerId && piece.speciesId === "jaguar"
    )!.pieceId;
    const expected = getValidPieceMovementDestinations(game, game.activePlayerId!, pieceId);
    const markedMoveTarget = expected[0] ?? { x: 99, y: 99 };
    const step: TutorialStepDef = {
      title: "Movimento",
      body: "Teste",
      gate: "move",
      autoAdvance: true,
      markedMoveTarget
    };

    const result = getMovementInteractionTargets({
      activeActionId: "A",
      activeSpeciesId: "jaguar",
      canControlActivePlayer: true,
      controlledPlayerId: game.activePlayerId,
      game,
      hasPendingCoatiPairBonus: false,
      selectedPieceId: pieceId,
      tutorial: { active: true, def: step, gate: "move" }
    });

    expect(result.movementTargets).toEqual(expected);
    expect(result.displayMovementTargets).toEqual(
      expected.filter(
        (position) =>
          position.x === markedMoveTarget.x && position.y === markedMoveTarget.y
      )
    );
    expect(result.canSkipJaguarMove).toBe(
      expected.length === 0
    );
  });

  it("hides movement targets while Jaguar removal is pending", () => {
    const game = createJaguarTutorialRoom().game!;
    const pieceId = game.pieces.find(
      (piece) => piece.ownerId === game.activePlayerId && piece.speciesId === "jaguar"
    )!.pieceId;
    const targetPiece = game.pieces.find((piece) => piece.ownerId !== game.activePlayerId && piece.location)!;
    const pendingGame = {
      ...game,
      pendingJaguarRemoval: {
        playerId: game.activePlayerId!,
        location: { x: targetPiece.location!.x, y: targetPiece.location!.y }
      }
    };

    const result = getMovementInteractionTargets({
      activeActionId: "A",
      activeSpeciesId: "jaguar",
      canControlActivePlayer: true,
      controlledPlayerId: game.activePlayerId,
      game: pendingGame,
      hasPendingCoatiPairBonus: false,
      selectedPieceId: pieceId,
      tutorial: inactiveTutorial
    });

    expect(result.movementTargets).toEqual([]);
    expect(result.displayMovementTargets).toEqual([]);
  });
});

describe("getSpeciesPlacementTargets", () => {
  it("matches rule targets for every extracted species path", () => {
    const coati = createCoatiTutorialRoom().game!;
    const capuchin = createCapuchinTutorialRoom().game!;
    const macaw = createMacawTutorialRoom().game!;
    const armadillo = createArmadilloTutorialRoom().game!;
    const wolf = createWolfTutorialRoom().game!;

    const getTargets = (
      game: typeof coati,
      activeSpeciesId: "coati" | "capuchin" | "macaw" | "armadillo" | "maned_wolf",
      activeActionId: "A" | "C" = "A",
      selectedPieceId: string | null = null
    ) =>
      getSpeciesPlacementTargets({
        activeActionId,
        activeSpeciesId,
        canControlActivePlayer: true,
        game,
        hasPendingCoatiPairBonus: false,
        selectedPieceId,
        tutorial: inactiveTutorial
      });

    expect(getTargets(coati, "coati").coatiFruitTargets).toEqual(
      getCoatiFruitPlacementPositions(coati, coati.activePlayerId!)
    );
    expect(getTargets(coati, "coati").coatiPairBonusTargets).toEqual(
      getCoatiPairBonusTargets(coati, coati.activePlayerId!)
    );
    expect(getTargets(capuchin, "capuchin").capuchinPlacementTargets).toEqual(
      getCapuchinPlacementPositions(capuchin, capuchin.activePlayerId!)
    );
    expect(getTargets(macaw, "macaw").macawEggTargets).toEqual(
      getMacawEggPlacementPositions(macaw, macaw.activePlayerId!)
    );
    expect(getTargets(macaw, "macaw", "C").macawActionCTargets).toEqual(
      getMacawActionCTargets(macaw, macaw.activePlayerId!)
    );
    expect(getTargets(armadillo, "armadillo").armadilloSeedTargets).toEqual(
      getArmadilloSeedPlacementPositions(armadillo, armadillo.activePlayerId!)
    );
    expect(getTargets(wolf, "maned_wolf").wolfMeatTargets).toEqual(
      getWolfMeatPlacementPositions(wolf, wolf.activePlayerId!)
    );

    const galoPlayerId = coati.activePlayerId!;
    const galo = {
      ...coati,
      players: coati.players.map((player) =>
        player.playerId === galoPlayerId
          ? { ...player, speciesId: "galo_de_campina" as const }
          : player
      ),
      pieces: coati.pieces.map((piece) =>
        piece.ownerId === galoPlayerId
          ? { ...piece, speciesId: "galo_de_campina" as const }
          : piece
      ),
      activePlayedForestCardId: "played-card"
    };
    const galoTargets = getSpeciesPlacementTargets({
      activeActionId: "A",
      activeSpeciesId: "galo_de_campina",
      canControlActivePlayer: true,
      game: galo,
      hasPendingCoatiPairBonus: false,
      selectedPieceId: null,
      tutorial: inactiveTutorial
    });
    expect(galoTargets.galoFieldTargets).toEqual(
      getGaloFieldPlacementPositions(galo, galoPlayerId)
    );
    expect(galoTargets.galoAddTargets).toEqual(galoTargets.galoFieldTargets);
  });

  it("locks add and pair targets to tutorial gate and marker", () => {
    const initialGame = createCoatiTutorialRoom().game!;
    let game = placeForestCard(
      initialGame,
      initialGame.activePlayerId!,
      "bosque_1_copy",
      { x: 2, y: 0 }
    );
    game = addCoatiForCurrentAction(
      game,
      game.activePlayerId!,
      { x: -1, y: -1 }
    );
    const addStep = getTutorialSteps("coati").find(
      (step) => step.gate === "addPiece"
    )!;
    const pairStep = getTutorialSteps("coati").find(
      (step) => step.gate === "resolvePair"
    )!;
    const blocked = getSpeciesPlacementTargets({
      activeActionId: "A",
      activeSpeciesId: "coati",
      canControlActivePlayer: true,
      game,
      hasPendingCoatiPairBonus: false,
      selectedPieceId: null,
      tutorial: { active: true, def: addStep, gate: "none" }
    });
    const marked = getSpeciesPlacementTargets({
      activeActionId: "A",
      activeSpeciesId: "coati",
      canControlActivePlayer: true,
      game,
      hasPendingCoatiPairBonus: false,
      selectedPieceId: null,
      tutorial: { active: true, def: addStep, gate: "addPiece" }
    });
    const pair = getSpeciesPlacementTargets({
      activeActionId: "A",
      activeSpeciesId: "coati",
      canControlActivePlayer: true,
      game,
      hasPendingCoatiPairBonus: true,
      selectedPieceId: null,
      tutorial: { active: true, def: pairStep, gate: "resolvePair" }
    });

    expect(blocked.displayAddPieceTargets).toEqual([]);
    expect(blocked.displayCoatiPairBonusTargets).toEqual([]);
    expect(marked.displayAddPieceTargets).toEqual(
      marked.addPieceTargets.filter(
        (position) =>
          position.x === addStep.markedAddPieceTarget?.x &&
          position.y === addStep.markedAddPieceTarget?.y
      )
    );
    expect(pair.displayCoatiPairBonusTargets).toEqual(
      pair.coatiPairBonusTargets.filter(
        (position) =>
          position.x === pairStep.markedPairTarget?.x &&
          position.y === pairStep.markedPairTarget?.y
      )
    );
    expect(pair.displayCoatiPairBonusTargets.length).toBeGreaterThan(0);
  });
});

describe("getBoardPieceTargets", () => {
  it("preserves selection order and tutorial marked-piece lock", () => {
    const game = createJaguarTutorialRoom().game!;
    const ownPieceId = game.pieces.find(
      (piece) => piece.ownerId === game.activePlayerId
    )!.pieceId;
    const markedStep: TutorialStepDef = {
      title: "Peça marcada",
      body: "Teste",
      gate: "move",
      autoAdvance: true,
      markedPieceId: ownPieceId
    };

    const result = getBoardPieceTargets({
      activeSpeciesId: "jaguar",
      game,
      movementTargetCount: 0,
      selectablePieceIds: [ownPieceId, "other"],
      selectedJaguarDestination: null,
      selectedJaguarTargetPieceId: "jaguar-target",
      selectedPieceId: ownPieceId,
      selectedRemovalPieceIds: ["removed-a", "removed-b"],
      selectedWolfTargetPieceId: "wolf-target",
      tutorial: { active: true, def: markedStep, gate: "move" }
    });

    expect(result.boardSelectablePieceIds).toEqual([ownPieceId]);
    expect(result.highlightedPieceIds).toEqual([
      ownPieceId,
      "removed-a",
      "removed-b",
      "jaguar-target",
      "wolf-target"
    ]);
  });

  it("adds visible Jaguar targets at selected destination", () => {
    const game = createJaguarTutorialRoom().game!;
    const ownPieceId = game.pieces.find(
      (piece) => piece.ownerId === game.activePlayerId
    )!.pieceId;
    const targetPiece = game.pieces.find(
      (piece) => piece.ownerId !== game.activePlayerId && piece.location
    )!;
    const destination = {
      x: targetPiece.location!.x,
      y: targetPiece.location!.y
    };

    const result = getBoardPieceTargets({
      activeSpeciesId: "jaguar",
      game,
      movementTargetCount: 1,
      selectablePieceIds: [ownPieceId],
      selectedJaguarDestination: destination,
      selectedJaguarTargetPieceId: null,
      selectedPieceId: ownPieceId,
      selectedRemovalPieceIds: [],
      selectedWolfTargetPieceId: null,
      tutorial: inactiveTutorial
    });
    const expectedTargets = game.pieces
      .filter(
        (piece) =>
          piece.ownerId !== game.activePlayerId &&
          piece.location?.x === destination.x &&
          piece.location.y === destination.y &&
          !piece.state.hidden
      )
      .map((piece) => piece.pieceId);

    expect(result.jaguarTargetPieceIds).toEqual(expectedTargets);
    expect(result.boardSelectablePieceIds).toEqual([ownPieceId, ...expectedTargets]);
  });

  it("prioritizes Galo interrupt pieces over pending Jaguar removal targets", () => {
    const game = createJaguarTutorialRoom().game!;
    const galoOwnerId = "galo-player";
    const pendingLocation = { x: 1, y: 0 };
    const galoPieceId = "galo-piece";
    const removablePieceId = "wolf-piece";
    const pendingGame = {
      ...game,
      pendingGaloInterrupt: {
        ownerId: galoOwnerId,
        interruptedPlayerId: game.activePlayerId!,
        location: pendingLocation
      },
      pendingJaguarRemoval: {
        playerId: game.activePlayerId!,
        location: pendingLocation
      },
      pieces: [
        ...game.pieces,
        {
          pieceId: galoPieceId,
          ownerId: galoOwnerId,
          speciesId: "galo_de_campina" as const,
          location: { ...pendingLocation, siteId: "main" },
          state: { hidden: false }
        },
        {
          pieceId: removablePieceId,
          ownerId: "wolf-player",
          speciesId: "maned_wolf" as const,
          location: { ...pendingLocation, siteId: "main" },
          state: { hidden: false }
        }
      ]
    };

    const result = getBoardPieceTargets({
      activeSpeciesId: "jaguar",
      game: pendingGame,
      movementTargetCount: 0,
      selectablePieceIds: [galoPieceId],
      selectedJaguarDestination: null,
      selectedJaguarTargetPieceId: null,
      selectedPieceId: null,
      selectedRemovalPieceIds: [],
      selectedWolfTargetPieceId: null,
      tutorial: inactiveTutorial
    });

    expect(result.jaguarTargetPieceIds).toEqual([]);
    expect(result.boardSelectablePieceIds).toEqual([galoPieceId]);
  });
});
