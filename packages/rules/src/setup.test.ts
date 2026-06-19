import { describe, expect, it } from "vitest";
import { commonForestCards, initialForestCardCandidates, objectiveCardsById, speciesDefinitions } from "@oikos/content";
import { MAX_PLAYERS } from "@oikos/shared";
import type { ForestCardState, RoomPlayer, SpeciesId } from "@oikos/shared";
import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addGaloForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  completeCurrentAction,
  collectCaatingaBonus,
  collectCerradoBonus,
  discardMataAtlanticaPileCard,
  discardObjectiveForResources,
  createInitialGameState,
  createPreviewInitialForest,
  forceEndPlayerTurn,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getAvailableForestExpansionPositionsForCard,
  getArmadilloHidePieceIds,
  getArmadilloSeedPlacementPositions,
  getArmadilloSharingDetails,
  getArmadilloShareScore,
  getCapuchinHabitatScore,
  getCapuchinPlacementPositions,
  getCapuchinScoringHabitats,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getGaloFieldPlacementPositions,
  getGaloActionDScore,
  getGaloInterruptMoveTargets,
  getGaloInterruptPieceIds,
  getGaloOutOfFieldPieceCount,
  getRequiredCoatiRemovalCount,
  getForestPositionsWithResource,
  getForestSiteOccupancy,
  getForestSitesAtPosition,
  getMacawActionCTargets,
  getMacawEggPlacementPositions,
  getMacawLineScore,
  getMacawScoringLines,
  getMacawRelocatablePieceIds,
  getValidPieceMovementDestinations,
  getWolfMeatPlacementPositions,
  getWolfRemovableBasePieceIds,
  getWolfSpendableResourceTypes,
  getCacaIlegalRemovablePieceIds,
  getCacaIlegalTopResources,
  getAvailableForestExpansionPositions,
  moveJaguarForCurrentAction,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece,
  removeBasePieceForWolfAction,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus,
  resolveCacaIlegal,
  resolveGaloInterruptMove,
  selectObjectiveCard,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing,
  scoreCapuchinHabitatPresence,
  scoreGaloFieldPresence,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints
} from "./setup";
import { getObjectiveProgressPoints } from "./scoring";

function player(playerId: string, speciesId: RoomPlayer["speciesId"]): RoomPlayer {
  return {
    playerId,
    name: playerId,
    speciesId,
    ready: true,
    connected: true
  };
}

function createTestGameState(gameId: string, roomPlayers: RoomPlayer[]) {
  const game = createInitialGameState(gameId, roomPlayers, () => 0.999999, createPreviewInitialForest());
  for (const gamePlayer of game.players) {
    gamePlayer.objectiveChoices = [];
    gamePlayer.selectedObjectiveCardId = null;
  }
  return game;
}

describe("player limit", () => {
  const allSpecies: SpeciesId[] = [
    "jaguar",
    "maned_wolf",
    "armadillo",
    "macaw",
    "galo_de_campina",
    "capuchin",
    "coati"
  ];

  it("allows up to six species", () => {
    const roomPlayers = allSpecies.slice(0, MAX_PLAYERS).map((speciesId) => player(speciesId, speciesId));
    expect(() => createInitialGameState("six-player-game", roomPlayers)).not.toThrow();
  });

  it("rejects seven species", () => {
    const roomPlayers = allSpecies.map((speciesId) => player(speciesId, speciesId));
    expect(() => createInitialGameState("seven-player-game", roomPlayers)).toThrow(
      `O máximo é ${MAX_PLAYERS} jogadores por partida.`
    );
  });
  it("orders Galo-de-campina before Arara because it has more pieces", () => {
    const game = createInitialGameState(
      "turn-order-game",
      [player("galo", "galo_de_campina"), player("macaw", "macaw")],
      () => 0.999999,
      createPreviewInitialForest()
    );

    expect(speciesDefinitions.galo_de_campina.totalPieces).toBe(7);
    expect(speciesDefinitions.macaw.totalPieces).toBe(6);
    expect(game.turnOrder).toEqual(["galo", "macaw"]);
  });
});

describe("setup placement", () => {
  it("has habitat and resource metadata for every forest card", () => {
    expect(commonForestCards).toHaveLength(36);
    expect(initialForestCardCandidates).toHaveLength(12);
    expect(
      [...commonForestCards, ...initialForestCardCandidates].every(
        (card) =>
          card.habitat &&
          card.resources.length === 1 &&
          card.sites.length === 1 &&
          card.sites[0]?.siteId === "main" &&
          card.sites[0]?.habitat === card.habitat &&
          card.sites[0]?.resource === card.resource
      )
    ).toBe(true);

    expect(countBy(commonForestCards, (card) => card.habitat ?? "none")).toEqual({
      field: 12,
      forest: 12,
      river: 12
    });
    expect(countBy(initialForestCardCandidates, (card) => card.habitat ?? "none")).toEqual({
      field: 3,
      forest: 3,
      river: 6
    });
    expect(countResources(commonForestCards)).toEqual({
      egg: 9,
      fruit: 9,
      meat: 9,
      seed: 9
    });
    expect(countResources(initialForestCardCandidates)).toEqual({
      egg: 3,
      fruit: 2,
      meat: 3,
      seed: 4
    });
  });

  it("starts setup in species order from the lowest total piece count", () => {
    const game = createTestGameState("room", [player("quati", "coati"), player("jaguar", "jaguar"), player("wolf", "maned_wolf")]);

    expect(game.setupOrder).toEqual(["jaguar", "wolf", "quati"]);
    expect(game.setupActivePlayerId).toBe("jaguar");
  });

  it("deals six common forest cards to each species that uses cards when enough cards exist", () => {
    const game = createTestGameState("room", [player("jaguar", "jaguar"), player("wolf", "maned_wolf")]);

    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.hand).toHaveLength(0);
    expect(game.players.find((candidate) => candidate.playerId === "wolf")?.hand).toHaveLength(6);
    expect(game.deck.commonCardIds).toHaveLength(30);
  });

  it("shuffles hands without duplicating common forest cards between players", () => {
    const game = createInitialGameState(
      "random-room",
      [player("wolf", "maned_wolf"), player("coati", "coati")],
      () => 0
    );
    const dealtCards = game.players.flatMap((candidate) => candidate.hand);

    expect(dealtCards).toHaveLength(12);
    expect(new Set(dealtCards)).toHaveLength(12);
    expect(game.deck.commonCardIds).toHaveLength(24);
    expect(new Set([...dealtCards, ...game.deck.commonCardIds])).toHaveLength(commonForestCards.length);
    expect(dealtCards).not.toEqual(commonForestCards.slice(0, 12).map((card) => card.id));
  });

  it("deals full hands in the all-species local test", () => {
    const game = createTestGameState("room", [
      player("jaguar", "jaguar"),
      player("wolf", "maned_wolf"),
      player("armadillo", "armadillo"),
      player("macaw", "macaw"),
      player("capuchin", "capuchin"),
      player("coati", "coati")
    ]);
    const totalCardsInHands = game.players.reduce((total, candidate) => total + candidate.hand.length, 0);

    expect(totalCardsInHands).toBe(30);
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.hand).toHaveLength(0);
    expect(game.players.every((candidate) => candidate.hand.length === 0 || candidate.hand.length === 6)).toBe(true);
    expect(game.deck.commonCardIds).toHaveLength(6);
    expect(game.contentWarnings).toHaveLength(0);
    expect(game.contentWarnings.some((warning) => warning.includes("faltaram"))).toBe(false);
  });

  it("deals two objective cards and requires one selected before setup placement", () => {
    const game = createInitialGameState(
      "objectives",
      [player("jaguar", "jaguar"), player("wolf", "maned_wolf")],
      () => 0.999999,
      createPreviewInitialForest(),
      { enabledMiniExpansions: ["objectives"] }
    );
    const jaguar = game.players.find((candidate) => candidate.playerId === "jaguar")!;

    expect(jaguar.objectiveChoices).toHaveLength(2);
    expect(jaguar.selectedObjectiveCardId).toBeNull();
    expect(() => placeInitialPiece(game, "jaguar", { x: 0, y: 0 })).toThrow("Escolha uma carta de objetivo");

    const selected = selectObjectiveCard(game, "jaguar", jaguar.objectiveChoices[0]!);
    expect(selected.players.find((candidate) => candidate.playerId === "jaguar")?.selectedObjectiveCardId).toBe(jaguar.objectiveChoices[0]);
  });

  it("deals only objective cards eligible for each species category", () => {
    const game = createInitialGameState(
      "objectives_by_category",
      [
        player("jaguar", "jaguar"),
        player("wolf", "maned_wolf"),
        player("armadillo", "armadillo"),
        player("macaw", "macaw"),
        player("capuchin", "capuchin"),
        player("coati", "coati")
      ],
      () => 0.42,
      createPreviewInitialForest(),
      { enabledMiniExpansions: ["objectives"] }
    );

    for (const gamePlayer of game.players) {
      expect(gamePlayer.objectiveChoices).toHaveLength(2);
      expect(
        gamePlayer.objectiveChoices.every((objectiveCardId) => {
          const card = objectiveCardsById.get(objectiveCardId);
          expect(card).toBeDefined();
          const category = speciesDefinitions[gamePlayer.speciesId!].category;
          if (category === "subpredator") {
            return card!.eligibleCategories.includes("predator") || card!.eligibleCategories.includes("middle");
          }
          return card!.eligibleCategories.includes(category);
        })
      ).toBe(true);
    }
  });

  it("discards the resource objective during active play", () => {
    let game = createTestGameState("objective_discard", [player("jaguar", "jaguar"), player("wolf", "maned_wolf")]);
    const jaguar = game.players.find((candidate) => candidate.playerId === "jaguar")!;
    jaguar.selectedObjectiveCardId = "objective_18";
    game.status = "active";
    game.activePlayerId = "wolf";

    game = discardObjectiveForResources(game, "jaguar");
    const updated = game.players.find((candidate) => candidate.playerId === "jaguar")!;

    expect(updated.selectedObjectiveCardId).toBeNull();
    expect(updated.discardedObjectiveCardId).toBe("objective_18");
    expect(updated.objectiveChoices).toEqual([]);
    expect(updated.resources).toEqual({ meat: 1, egg: 1, fruit: 1, seed: 1 });
    expect(game.log.at(-1)?.payload).toMatchObject({ kind: "objective", actorPlayerId: "jaguar" });
  });

  it("skips objective cards when the objective mini-expansion is disabled", () => {
    let game = createInitialGameState(
      "no_objectives",
      [player("jaguar", "jaguar"), player("wolf", "maned_wolf")],
      () => 0.999999,
      createPreviewInitialForest(),
      { enabledMiniExpansions: [] }
    );
    const jaguar = game.players.find((candidate) => candidate.playerId === "jaguar")!;

    expect(game.enabledMiniExpansions).toEqual([]);
    expect(jaguar.objectiveChoices).toEqual([]);
    expect(jaguar.selectedObjectiveCardId).toBeNull();

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    expect(game.setupActivePlayerId).toBe("wolf");
  });

  it("places initial pieces and advances setup player when initial quota is met", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("wolf", "maned_wolf")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });

    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.piecesInForest).toHaveLength(1);
    expect(game.setupActivePlayerId).toBe("wolf");

    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    expect(game.setupActivePlayerId).toBe("wolf");

    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    expect(game.status).toBe("active");
    expect(game.setupActivePlayerId).toBeNull();
    expect(game.activePlayerId).toBe("wolf");
    expect(game.activeActionIndex).toBe(0);
  });

  it("rejects setup placement outside the active setup player", () => {
    const game = createTestGameState("room", [player("jaguar", "jaguar"), player("wolf", "maned_wolf")]);

    expect(() => placeInitialPiece(game, "wolf", { x: 0, y: 0 })).toThrow("Ainda não é a vez deste jogador");
  });

  it("lists empty adjacent positions for forest expansion", () => {
    const game = createTestGameState("room", [player("jaguar", "jaguar"), player("wolf", "maned_wolf")]);
    const positions = getAvailableForestExpansionPositions(game.forest.cards);

    expect(positions).toEqual([
      { x: -1, y: -2 },
      { x: 0, y: -2 },
      { x: 1, y: -2 },
      { x: -2, y: -1 },
      { x: 2, y: -1 },
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: -2, y: 1 },
      { x: 2, y: 1 },
      { x: -1, y: 2 },
      { x: 0, y: 2 },
      { x: 1, y: 2 }
    ]);
  });

  it("limits forest expansion to the fixed 7x7 grid", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);
    game = addTestForestCard(game, { x: 2, y: 0 });
    game = addTestForestCard(game, { x: 3, y: 0 });
    game = addTestForestCard(game, { x: -2, y: 0 });
    game = addTestForestCard(game, { x: -3, y: 0 });

    const positions = getAvailableForestExpansionPositions(game.forest.cards);

    expect(positions).not.toContainEqual({ x: 4, y: 0 });
    expect(positions).not.toContainEqual({ x: -4, y: 0 });
    expect(positions).toContainEqual({ x: 3, y: -1 });
    expect(positions).toContainEqual({ x: -3, y: -1 });
  });

  it("exposes internal forest card sites with resource and occupancy validators", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    const fruitPositions = getForestPositionsWithResource(game, "fruit");
    expect(fruitPositions.length).toBeGreaterThan(0);
    const fruitPos = fruitPositions[0];
    expect(getForestSitesAtPosition(game, fruitPos)).toEqual([
      expect.objectContaining({
        site: expect.objectContaining({ siteId: "main", resource: "fruit" }),
        pieces: [],
        isOccupied: false,
        isAtCapacity: false
      })
    ]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });

    const occupiedSite = getForestSiteOccupancy(game, { x: 0, y: 0 });
    expect(occupiedSite?.pieces.map((piece) => piece.pieceId)).toContain("jaguar_piece_1");
    expect(occupiedSite?.isOccupied).toBe(true);
  });

  it("places a selected hand card into an empty adjacent forest position", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    expect(game.activePlayerId).toBe("coati");

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    expect(cardId).toBeTruthy();

    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });

    expect(game.forest.cards.some((card) => card.definitionId === cardId && card.x === 2 && card.y === 0)).toBe(true);
    expect(game.players.find((candidate) => candidate.playerId === "coati")?.hand).not.toContain(cardId);
    expect(game.activePlayedForestCardId).toBe(cardId);
    expect(game.activeActionIndex).toBe(0);
    expect(() => placeForestCard(game, "coati", game.players.find((candidate) => candidate.playerId === "coati")!.hand[0], { x: 2, y: 1 }))
      .toThrow("ja colocou a carta");
  });

  it("adds 1 Quati to a fruit card after expanding the forest in action A", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    const reserveBefore = game.players.find((candidate) => candidate.playerId === "coati")!.reservePieces.length;
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });

    const fruitTargets = getCoatiFruitPlacementPositions(game, "coati");
    expect(fruitTargets.length).toBeGreaterThan(0);
    const target = fruitTargets[0];

    game = addCoatiForCurrentAction(game, "coati", target);

    const coati = game.players.find((candidate) => candidate.playerId === "coati");
    expect(coati?.reservePieces).toHaveLength(reserveBefore - 1);
    expect(
      game.pieces.filter(
        (piece) => piece.ownerId === "coati" && piece.location?.x === target.x && piece.location.y === target.y
      )
    ).toHaveLength(1);
    expect(game.activeActionIndex).toBe(1);
  });

  it("lets Quati skip the optional add after expanding in action A", () => {
    let game = createTestGameState("room", [player("coati", "coati"), player("capuchin", "capuchin")]);
    game = placeInitialPiece(game, "capuchin", { x: -1, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: 0, y: -1 });
    game = setActiveAction(game, "coati", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    const reserveBefore = game.players.find((candidate) => candidate.playerId === "coati")!.reservePieces.length;
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    game = completeCurrentAction(game, "coati");

    expect(game.players.find((candidate) => candidate.playerId === "coati")?.reservePieces).toHaveLength(reserveBefore);
    expect(game.activeActionIndex).toBe(1);
  });

  it("rejects placing a hand card outside an adjacent empty forest position", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];

    expect(() => placeForestCard(game, "coati", cardId!, { x: 3, y: 3 })).toThrow("posicao vazia adjacente");
  });

  it("rejects placing a forest card past the 7x7 forest limit", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);
    game = addTestForestCard(game, { x: 2, y: 0 });
    game = addTestForestCard(game, { x: 3, y: 0 });
    game = setActiveAction(game, "coati", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];

    expect(() => placeForestCard(game, "coati", cardId!, { x: 4, y: 0 })).toThrow("limite maximo de 7x7");
  });

  it("validates river exits and rotation when placing forest cards", () => {
    let game = createTestGameState("room", [player("coati", "coati"), player("wolf", "maned_wolf")]);
    game = setActiveAction(
      {
        ...game,
        forest: {
          cards: [
            {
              instanceId: "test_initial_forest",
              definitionId: "initial_2",
              x: 0,
              y: 0,
              rotation: 0,
              isInitial: true
            }
          ]
        },
        players: game.players.map((candidate) =>
          candidate.playerId === "coati" ? { ...candidate, hand: ["rio_1"] } : candidate
        )
      },
      "coati",
      0
    );

    // rio_1 is a vertical river channel (north/south). The neighbor at (0,0)
    // has no river, so its east edge must face a non-river edge.
    // Rotation 0 -> channel runs north/south, west edge has no river -> valid.
    // Rotation 90 -> channel runs east/west, west edge becomes river -> invalid.
    expect(getAvailableForestExpansionPositionsForCard(game, "rio_1", 0)).toContainEqual({ x: 1, y: 0 });
    expect(getAvailableForestExpansionPositionsForCard(game, "rio_1", 90)).not.toContainEqual({ x: 1, y: 0 });
    expect(() => placeForestCard(game, "coati", "rio_1", { x: 1, y: 0 }, 90)).toThrow("Encaixe de rio invalido");

    game = placeForestCard(game, "coati", "rio_1", { x: 1, y: 0 }, 0);

    expect(game.forest.cards.find((card) => card.definitionId === "rio_1")?.rotation).toBe(0);
  });

  it("moves 1 Quati during action B according to the played card habitat", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    game = addCoatiForCurrentAction(game, "coati", { x: 2, y: 0 });
    const pieceId = game.players.find((candidate) => candidate.playerId === "coati")?.piecesInForest[1];
    expect(pieceId).toBeTruthy();

    expect(getValidPieceMovementDestinations(game, "coati", pieceId!)).toContainEqual({ x: -1, y: 0 });

    const resourceBefore = { ...game.players.find((candidate) => candidate.playerId === "coati")!.resources };
    const destinationResource = getResourceAt(game, { x: -1, y: 0 });
    game = movePieceForCurrentAction(game, "coati", pieceId!, { x: -1, y: 0 });

    expect(game.pieces.find((piece) => piece.pieceId === pieceId)?.location).toEqual({ x: -1, y: 0, siteId: "main" });
    if (destinationResource) {
      expect(game.players.find((candidate) => candidate.playerId === "coati")?.resources[destinationResource]).toBe(
        resourceBefore[destinationResource] + 1
      );
    }
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(0);
  });

  it("resolves the Quati pair bonus before continuing the current action", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    game = addCoatiForCurrentAction(game, "coati", { x: 2, y: 0 });

    const movedPieceId = game.players.find((candidate) => candidate.playerId === "coati")?.piecesInForest[0];
    const reserveBefore = game.players.find((candidate) => candidate.playerId === "coati")!.reservePieces.length;
    game = movePieceForCurrentAction(game, "coati", movedPieceId!, { x: 2, y: 0 });

    expect(game.pendingCoatiPairBonus?.origin).toEqual({ x: 2, y: 0 });
    expect(game.activeActionIndex).toBe(1);
    expect(getValidPieceMovementDestinations(game, "coati", movedPieceId!)).toEqual([]);
    expect(getCoatiPairBonusTargets(game, "coati")).toContainEqual({ x: 1, y: 0 });
    expect(getCoatiPairBonusTargets(game, "coati")).not.toContainEqual({ x: 1, y: -1 });
    game = addTestForestCard(game, { x: 2, y: -1 });
    expect(getCoatiPairBonusTargets(game, "coati")).toContainEqual({ x: 2, y: -1 });

    game = resolveCoatiPairBonus(game, "coati", { x: 2, y: -1 });

    const coati = game.players.find((candidate) => candidate.playerId === "coati");
    expect(coati?.score).toBe(1);
    expect(coati?.reservePieces).toHaveLength(reserveBefore - 1);
    expect(game.pieces.filter((piece) => piece.ownerId === "coati" && piece.location?.x === 2 && piece.location.y === -1)).toHaveLength(1);
    expect(game.pendingCoatiPairBonus).toBeNull();
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(0);
  });

  it("allows the same Quati pair to score again only after the pair separates and reforms", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    game = addCoatiForCurrentAction(game, "coati", { x: 2, y: 0 });

    const movedPieceId = game.players.find((candidate) => candidate.playerId === "coati")?.piecesInForest[0];
    game = movePieceForCurrentAction(game, "coati", movedPieceId!, { x: 2, y: 0 });
    const firstPairKey = game.pendingCoatiPairBonus?.pairKey;
    expect(firstPairKey).toBeTruthy();

    game = addTestForestCard(game, { x: 2, y: -1 });
    game = resolveCoatiPairBonus(game, "coati", { x: 2, y: -1 });
    expect(game.pendingCoatiPairBonus).toBeNull();
    expect(game.resolvedCoatiPairBonuses).toContain(firstPairKey);

    game = {
      ...game,
      activePlayerId: "coati",
      activeActionIndex: 1,
      activePlayedForestCardId: cardId!,
      pieces: game.pieces.map((piece) => (piece.pieceId === movedPieceId ? { ...piece, location: { x: 0, y: 0, siteId: "main" } } : piece))
    };

    game = movePieceForCurrentAction(game, "coati", movedPieceId!, { x: 2, y: 0 });

    expect(game.pendingCoatiPairBonus?.pairKey).toBe(firstPairKey);
    expect(game.pendingCoatiPairBonus?.origin).toEqual({ x: 2, y: 0 });
  });

  it("does not trigger a new Quati pair bonus when a third quati enters an existing pair", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = addTestForestCard(game, { x: 2, y: 0 });

    const coati = game.players.find((candidate) => candidate.playerId === "coati")!;
    const extraPairIds = coati.reservePieces.slice(0, 2);
    const movedPieceId = game.pieces.find((piece) => piece.ownerId === "coati" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;

    game = {
      ...setActiveAction(game, "coati", 1),
      activePlayedForestCardId: "rio_1",
      players: game.players.map((candidate) =>
        candidate.playerId === "coati"
          ? {
              ...candidate,
              reservePieces: candidate.reservePieces.filter((pieceId) => !extraPairIds.includes(pieceId)),
              piecesInForest: [...candidate.piecesInForest, ...extraPairIds]
            }
          : candidate
      ),
      pieces: game.pieces.map((piece) =>
        extraPairIds.includes(piece.pieceId) ? { ...piece, location: { x: 2, y: 0, siteId: "main" } } : piece
      )
    };

    expect(getValidPieceMovementDestinations(game, "coati", movedPieceId!)).toContainEqual({ x: 2, y: 0 });

    game = movePieceForCurrentAction(game, "coati", movedPieceId!, { x: 2, y: 0 });

    expect(game.pieces.filter((piece) => piece.ownerId === "coati" && piece.location?.x === 2 && piece.location.y === 0)).toHaveLength(3);
    expect(game.pendingCoatiPairBonus).toBeNull();
    expect(game.activePlayerId).toBe("jaguar");
  });

  it("does not score a Quati pair when no piece is available in reserve", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    game = addCoatiForCurrentAction(game, "coati", { x: 2, y: 0 });

    const movedPieceId = game.players.find((candidate) => candidate.playerId === "coati")?.piecesInForest[0];
    const scoreBefore = game.players.find((candidate) => candidate.playerId === "coati")!.score;
    game = {
      ...game,
      players: game.players.map((candidate) =>
        candidate.playerId === "coati" ? { ...candidate, reservePieces: [] } : candidate
      )
    };

    game = movePieceForCurrentAction(game, "coati", movedPieceId!, { x: 2, y: 0 });

    expect(game.pendingCoatiPairBonus).toBeNull();
    expect(game.players.find((candidate) => candidate.playerId === "coati")?.score).toBe(scoreBefore);
    expect(game.activePlayerId).toBe("coati");
    expect(game.activeActionIndex).toBe(2);
  });

  it("automatically skips Quati action C when reserve has at least two pieces", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    game = addCoatiForCurrentAction(game, "coati", { x: 2, y: 0 });
    const pieceId = game.players.find((candidate) => candidate.playerId === "coati")?.piecesInForest[1];

    game = movePieceForCurrentAction(game, "coati", pieceId!, { x: -1, y: 0 });
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(0);
    expect(game.activePlayedForestCardId).toBeNull();
    expect(game.players.find((candidate) => candidate.playerId === "coati")?.turnsTaken).toBe(1);
  });

  it("does not leave Quati action C available when reserve has at least two pieces", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    const pieceId = game.players.find((candidate) => candidate.playerId === "coati")?.piecesInForest[1];
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    game = addCoatiForCurrentAction(game, "coati", { x: 2, y: 0 });
    game = movePieceForCurrentAction(game, "coati", pieceId!, { x: -1, y: 0 });

    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(0);
    expect(getRequiredCoatiRemovalCount(game, "coati")).toBe(0);
  });

  it("requires Quati to remove two pieces during action C when reserve has fewer than two pieces", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    const coati = game.players.find((candidate) => candidate.playerId === "coati");
    const extraPieceIds = coati!.reservePieces.slice(0, 5);
    const nextCards = [
      { x: -2, y: -1 },
      { x: -2, y: 0 },
      { x: -2, y: 1 },
      { x: -1, y: -2 },
      { x: 0, y: -2 }
    ];

    game = {
      ...game,
      players: game.players.map((candidate) =>
        candidate.playerId === "coati"
          ? {
              ...candidate,
              reservePieces: candidate.reservePieces.filter((pieceId) => !extraPieceIds.includes(pieceId)),
              piecesInForest: [...candidate.piecesInForest, ...extraPieceIds]
            }
          : candidate
      ),
      pieces: game.pieces.map((piece) => {
        const extraIndex = extraPieceIds.indexOf(piece.pieceId);
        return extraIndex >= 0 ? { ...piece, location: { ...nextCards[extraIndex], siteId: "main" } } : piece;
      })
    };

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    const movedPieceId = game.players.find((candidate) => candidate.playerId === "coati")?.piecesInForest[0];
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    game = addCoatiForCurrentAction(game, "coati", { x: 2, y: 0 });
    game = movePieceForCurrentAction(game, "coati", movedPieceId!, { x: 2, y: 0 });

    expect(getRequiredCoatiRemovalCount(game, "coati")).toBe(2);
    expect(() => completeCurrentAction(game, "coati")).toThrow("remover 2 quatis");

    const removalIds = game.players.find((candidate) => candidate.playerId === "coati")!.piecesInForest.slice(0, 2);
    game = removePiecesForCurrentAction(game, "coati", removalIds);

    const finalCoati = game.players.find((candidate) => candidate.playerId === "coati");
    expect(finalCoati?.reservePieces).toEqual(expect.arrayContaining(removalIds));
    expect(finalCoati?.piecesInForest).not.toContain(removalIds[0]);
    expect(finalCoati?.piecesInForest).not.toContain(removalIds[1]);
    expect(game.activePlayerId).toBe("jaguar");
  });

  it("does not allow manually completing Quati action A", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    expect(() => completeCurrentAction(game, "coati")).toThrow("colocar uma carta");
  });

  it("moves Onca adjacent in action A, removes one piece, and collects one meat", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = setActiveAction(game, "jaguar", 0);

    const jaguarPieceId = game.players.find((candidate) => candidate.playerId === "jaguar")?.piecesInForest[0];
    const removedPieceId = game.pieces.find((piece) => piece.ownerId === "coati" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;
    const resourceBefore = { ...game.players.find((candidate) => candidate.playerId === "jaguar")!.resources };
    const destinationResource = getResourceAt(game, { x: 1, y: 0 });

    expect(getValidPieceMovementDestinations(game, "jaguar", jaguarPieceId!)).toEqual(
      expect.arrayContaining([
        { x: -1, y: 0 },
        { x: 1, y: 0 }
      ])
    );

    game = moveJaguarForCurrentAction(game, "jaguar", { x: 1, y: 0 });

    expect(game.pieces.find((piece) => piece.pieceId === jaguarPieceId)?.location).toEqual({ x: 1, y: 0, siteId: "main" });
    expect(game.pieces.find((piece) => piece.pieceId === removedPieceId)?.location).toBeNull();
    expect(game.players.find((candidate) => candidate.playerId === "coati")?.reservePieces).toContain(removedPieceId);
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources.meat).toBe(
      resourceBefore.meat + 1 + (destinationResource === "meat" ? 1 : 0)
    );
    if (destinationResource && destinationResource !== "meat") {
      expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources[destinationResource]).toBe(
        resourceBefore[destinationResource] + 1
      );
    }
    expect(game.activeActionIndex).toBe(1);
  });

  it("moves Onca in action B according to the habitat where it starts", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = setActiveAction(game, "jaguar", 1);

    const jaguarPieceId = game.players.find((candidate) => candidate.playerId === "jaguar")?.piecesInForest[0];
    const removedPieceId = game.pieces.find((piece) => piece.ownerId === "coati" && piece.location?.x === 0 && piece.location.y === -1)?.pieceId;
    const resourceBefore = { ...game.players.find((candidate) => candidate.playerId === "jaguar")!.resources };
    const destinationResource = getResourceAt(game, { x: 0, y: -1 });

    expect(getValidPieceMovementDestinations(game, "jaguar", jaguarPieceId!)).toEqual(
      expect.arrayContaining([
        { x: 0, y: -1 },
        { x: 0, y: 1 }
      ])
    );

    game = movePieceForCurrentAction(game, "jaguar", jaguarPieceId!, { x: 0, y: -1 });

    expect(game.pieces.find((piece) => piece.pieceId === jaguarPieceId)?.location).toEqual({ x: 0, y: -1, siteId: "main" });
    expect(game.pieces.find((piece) => piece.pieceId === removedPieceId)?.location).toBeNull();
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources.meat).toBe(
      resourceBefore.meat + 1 + (destinationResource === "meat" ? 1 : 0)
    );
    if (destinationResource && destinationResource !== "meat") {
      expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources[destinationResource]).toBe(
        resourceBefore[destinationResource] + 1
      );
    }
    expect(game.activeActionIndex).toBe(2);
  });

  it("does not fall back to the activated card habitat during Pampa movement", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    const pieceId = game.players.find((candidate) => candidate.playerId === "coati")?.piecesInForest[0];
    game = {
      ...setActiveAction(game, "coati", 1),
      activeScenarioIds: ["pampa"],
      activePlayedForestCardId: "rio_1",
      forest: {
        cards: [
          {
            instanceId: "origin",
            definitionId: "bosque_1",
            x: 0,
            y: 0,
            rotation: 0,
            isInitial: true
          },
          {
            instanceId: "adjacent_only",
            definitionId: "campo_1",
            x: 1,
            y: 0,
            rotation: 0,
            isInitial: true
          }
        ]
      }
    };

    expect(getValidPieceMovementDestinations(game, "coati", pieceId!)).toEqual([]);
  });

  it("forces orthogonal movement for card-based animals during Enchente", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: -1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    const pieceId = game.players.find((candidate) => candidate.playerId === "coati")?.piecesInForest[0];
    game = {
      ...setActiveAction(game, "coati", 1),
      activeThreatCardId: "threat_6",
      activePlayedForestCardId: "bosque_1",
      forest: {
        cards: [
          {
            instanceId: "origin",
            definitionId: "bosque_1",
            x: 0,
            y: 0,
            rotation: 0,
            isInitial: true
          },
          {
            instanceId: "orthogonal",
            definitionId: "campo_1",
            x: 1,
            y: 0,
            rotation: 0,
            isInitial: true
          },
          {
            instanceId: "straight_jump",
            definitionId: "campo_2",
            x: 0,
            y: -2,
            rotation: 0,
            isInitial: true
          }
        ]
      }
    };

    expect(getValidPieceMovementDestinations(game, "coati", pieceId!)).toEqual([{ x: 1, y: 0 }]);
  });

  it("forces orthogonal movement for Onca during Enchente", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    const pieceId = game.players.find((candidate) => candidate.playerId === "jaguar")?.piecesInForest[0];
    game = {
      ...setActiveAction(game, "jaguar", 1),
      activeThreatCardId: "threat_6",
      forest: {
        cards: [
          {
            instanceId: "origin",
            definitionId: "bosque_1",
            x: 0,
            y: 0,
            rotation: 0,
            isInitial: true
          },
          {
            instanceId: "orthogonal",
            definitionId: "campo_1",
            x: 1,
            y: 0,
            rotation: 0,
            isInitial: true
          },
          {
            instanceId: "knight",
            definitionId: "campo_2",
            x: 1,
            y: -2,
            rotation: 0,
            isInitial: true
          }
        ]
      }
    };

    expect(getValidPieceMovementDestinations(game, "jaguar", pieceId!)).toEqual([{ x: 1, y: 0 }]);
  });

  it("moves Onca in action B to an empty destination without removing a piece", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = setActiveAction(game, "jaguar", 1);

    const jaguarPieceId = game.players.find((candidate) => candidate.playerId === "jaguar")?.piecesInForest[0];
    const coatiPieceId = game.pieces.find((piece) => piece.ownerId === "coati" && piece.location?.x === -1 && piece.location.y === 0)?.pieceId;
    const resourceBefore = { ...game.players.find((candidate) => candidate.playerId === "jaguar")!.resources };
    const destinationResource = getResourceAt(game, { x: 0, y: -1 });

    expect(getValidPieceMovementDestinations(game, "jaguar", jaguarPieceId!)).toEqual(
      expect.arrayContaining([
        { x: 0, y: -1 },
        { x: 0, y: 1 }
      ])
    );

    game = movePieceForCurrentAction(game, "jaguar", jaguarPieceId!, { x: 0, y: -1 });

    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(2);
    expect(game.pieces.find((piece) => piece.pieceId === jaguarPieceId)?.location).toEqual({ x: 0, y: -1, siteId: "main" });
    expect(game.pieces.find((piece) => piece.pieceId === coatiPieceId)?.location).toEqual({ x: -1, y: 0, siteId: "main" });
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources.meat).toBe(
      resourceBefore.meat + (destinationResource === "meat" ? 1 : 0)
    );
    if (destinationResource && destinationResource !== "meat") {
      expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources[destinationResource]).toBe(
        resourceBefore[destinationResource] + 1
      );
    }
  });

  it("requires Onca to choose a removed piece when more than one piece is in the entered location", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("wolf", "maned_wolf"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = setActiveAction(game, "jaguar", 0);

    const wolfPieceId = game.pieces.find((piece) => piece.ownerId === "wolf" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;
    const coatiPieceId = game.pieces.find((piece) => piece.ownerId === "coati" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;

    expect(() => moveJaguarForCurrentAction(game, "jaguar", { x: 1, y: 0 })).toThrow("Escolha qual peca");

    game = moveJaguarForCurrentAction(game, "jaguar", { x: 1, y: 0 }, coatiPieceId);

    expect(game.pieces.find((piece) => piece.pieceId === coatiPieceId)?.location).toBeNull();
    expect(game.pieces.find((piece) => piece.pieceId === wolfPieceId)?.location).toEqual({ x: 1, y: 0, siteId: "main" });
  });

  it("does not count the Onca itself as a removed species for objective progress", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = setActiveAction(game, "jaguar", 0);
    game.players.find((candidate) => candidate.playerId === "jaguar")!.selectedObjectiveCardId = "objective_9";

    const coatiPieceId = game.pieces.find((piece) => piece.ownerId === "coati" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;
    game = moveJaguarForCurrentAction(game, "jaguar", { x: 1, y: 0 }, coatiPieceId);

    const removalLog = [...game.log].reverse().find((entry) => entry.payload?.kind === "remove_piece");
    expect(removalLog?.payload?.pieceIds).toEqual([coatiPieceId]);
    expect(getObjectiveProgressPoints(game, "jaguar")).toBe(0);
  });

  it("spends Onca meat for points up to three times during action C", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = setActiveAction(game, "jaguar", 2);
    game = {
      ...game,
      players: game.players.map((candidate) =>
        candidate.playerId === "jaguar"
          ? { ...candidate, resources: { ...candidate.resources, meat: 3 } }
          : candidate
      )
    };

    expect(getAvailableJaguarPointSpendCount(game, "jaguar")).toBe(3);
    expect(() => spendJaguarMeatForPoints(game, "jaguar", 4)).toThrow("1 a 3 carnes");

    game = spendJaguarMeatForPoints(game, "jaguar", 3);

    const jaguar = game.players.find((candidate) => candidate.playerId === "jaguar");
    expect(jaguar?.resources.meat).toBe(0);
    expect(jaguar?.score).toBe(3);
    expect(jaguar?.turnsTaken).toBe(1);
    expect(game.activePlayerId).toBe("coati");
  });

  it("lets Onca complete action C without spending meat", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = setActiveAction(game, "jaguar", 2);

    game = completeCurrentAction(game, "jaguar");

    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.score).toBe(0);
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.turnsTaken).toBe(1);
    expect(game.activePlayerId).toBe("coati");
  });

  it("plays Macaco-prego action A by expanding and adding a monkey on the played card", () => {
    let game = createTestGameState("room", [player("capuchin", "capuchin"), player("coati", "coati")]);
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 1 });
    game = setActiveAction(game, "capuchin", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "capuchin")?.hand[0];
    const reserveBefore = game.players.find((candidate) => candidate.playerId === "capuchin")!.reservePieces.length;

    game = placeForestCard(game, "capuchin", cardId!, { x: 2, y: 0 });

    expect(getCapuchinPlacementPositions(game, "capuchin")).toEqual([{ x: 2, y: 0 }]);

    game = addCapuchinForCurrentAction(game, "capuchin", { x: 2, y: 0 });

    const capuchin = game.players.find((candidate) => candidate.playerId === "capuchin");
    expect(capuchin?.reservePieces).toHaveLength(reserveBefore - 1);
    expect(game.pieces.filter((piece) => piece.ownerId === "capuchin" && piece.location?.x === 2 && piece.location.y === 0)).toHaveLength(1);
    expect(game.activePlayerId).toBe("capuchin");
    expect(game.activeActionIndex).toBe(1);
  });

  it("moves Macaco-prego in action B according to the played card habitat", () => {
    let game = createTestGameState("room", [player("capuchin", "capuchin"), player("coati", "coati")]);
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 1 });
    game = setActiveAction(game, "capuchin", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "capuchin")?.hand[0];
    game = placeForestCard(game, "capuchin", cardId!, { x: 2, y: 0 });
    game = addCapuchinForCurrentAction(game, "capuchin", { x: 2, y: 0 });

    const movedPieceId = game.players.find((candidate) => candidate.playerId === "capuchin")?.piecesInForest[0];

    const destinations = getValidPieceMovementDestinations(game, "capuchin", movedPieceId!);
    const destination = destinations[0];
    expect(destination).toBeDefined();

    game = movePieceForCurrentAction(game, "capuchin", movedPieceId!, destination!);

    expect(game.pieces.find((piece) => piece.pieceId === movedPieceId)?.location).toEqual({ ...destination!, siteId: "main" });
    expect(game.activeActionIndex).toBe(2);
  });

  it("adds Macaco-prego in action C on a location with another monkey", () => {
    let game = createTestGameState("room", [player("capuchin", "capuchin"), player("coati", "coati")]);
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 1 });
    game = setActiveAction(game, "capuchin", 2);

    const reserveBefore = game.players.find((candidate) => candidate.playerId === "capuchin")!.reservePieces.length;

    expect(getCapuchinPlacementPositions(game, "capuchin")).toContainEqual({ x: 0, y: 0 });

    game = addCapuchinForCurrentAction(game, "capuchin", { x: 0, y: 0 });

    expect(game.players.find((candidate) => candidate.playerId === "capuchin")?.reservePieces).toHaveLength(reserveBefore - 1);
    expect(game.pieces.filter((piece) => piece.ownerId === "capuchin" && piece.location?.x === 0 && piece.location.y === 0)).toHaveLength(2);
    expect(game.activeActionIndex).toBe(3);
  });

  it("scores Macaco-prego action D by habitat types with monkeys on two or more cards", () => {
    let game = createTestGameState("room", [player("capuchin", "capuchin"), player("coati", "coati")]);
    game = placeInitialPiece(game, "capuchin", { x: -1, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = setActiveAction(game, "capuchin", 3);

    expect(getCapuchinHabitatScore(game, "capuchin")).toBe(1);
    expect(getCapuchinScoringHabitats(game, "capuchin")).toEqual([
      {
        habitat: "forest",
        positions: [
          { x: -1, y: -1, siteId: "main" },
          { x: 1, y: -1, siteId: "main" }
        ]
      }
    ]);

    game = scoreCapuchinHabitatPresence(game, "capuchin");

    expect(game.players.find((candidate) => candidate.playerId === "capuchin")?.score).toBe(1);
    expect(game.players.find((candidate) => candidate.playerId === "capuchin")?.turnsTaken).toBe(1);
    expect(game.activePlayerId).toBe("coati");
  });

  it("lets Macaco-prego skip action C without reserve and still score habitats", () => {
    let game = createTestGameState("room", [player("capuchin", "capuchin"), player("coati", "coati")]);
    game = placeInitialPiece(game, "capuchin", { x: -1, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 1 });
    game = {
      ...setActiveAction(game, "capuchin", 2),
      players: game.players.map((candidate) =>
        candidate.playerId === "capuchin" ? { ...candidate, reservePieces: [] } : candidate
      )
    };

    game = completeCurrentAction(game, "capuchin");

    expect(game.activePlayerId).toBe("capuchin");
    expect(game.activeActionIndex).toBe(3);
    expect(getCapuchinHabitatScore(game, "capuchin")).toBe(1);
    expect(getCapuchinScoringHabitats(game, "capuchin")[0]?.positions).toEqual([
      { x: -1, y: -1, siteId: "main" },
      { x: 1, y: -1, siteId: "main" }
    ]);

    game = scoreCapuchinHabitatPresence(game, "capuchin");

    expect(game.players.find((candidate) => candidate.playerId === "capuchin")?.score).toBe(1);
  });

  it("lets Macaco-prego skip optional adds in actions A and C", () => {
    let game = createTestGameState("room", [player("capuchin", "capuchin"), player("coati", "coati")]);
    game = placeInitialPiece(game, "capuchin", { x: -1, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "capuchin", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "capuchin")?.hand[0];
    const reserveBefore = game.players.find((candidate) => candidate.playerId === "capuchin")!.reservePieces.length;
    game = placeForestCard(game, "capuchin", cardId!, { x: 2, y: 0 });
    game = completeCurrentAction(game, "capuchin");

    expect(game.players.find((candidate) => candidate.playerId === "capuchin")?.reservePieces).toHaveLength(reserveBefore);
    expect(game.activeActionIndex).toBe(1);

    game = setActiveAction(game, "capuchin", 2);
    game = completeCurrentAction(game, "capuchin");

    expect(game.players.find((candidate) => candidate.playerId === "capuchin")?.reservePieces).toHaveLength(reserveBefore);
    expect(game.activeActionIndex).toBe(3);
  });

  it("lets the Macaco-prego tutorial score all three habitats in one turn", () => {
    const tutorialForest: ForestCardState[] = [
      { instanceId: "cap_tut_0", definitionId: "initial_5", x: -1, y: -1, rotation: 0, isInitial: true },
      { instanceId: "cap_tut_1", definitionId: "initial_2", x: 0, y: -1, rotation: 0, isInitial: true },
      { instanceId: "cap_tut_2", definitionId: "initial_3", x: 1, y: -1, rotation: 0, isInitial: true },
      { instanceId: "cap_tut_3", definitionId: "initial_4", x: -1, y: 0, rotation: 0, isInitial: true },
      { instanceId: "cap_tut_4", definitionId: "initial_6", x: 0, y: 0, rotation: 0, isInitial: true },
      { instanceId: "cap_tut_5", definitionId: "initial_7", x: 1, y: 0, rotation: 0, isInitial: true },
      { instanceId: "cap_tut_6", definitionId: "initial_9", x: -1, y: 1, rotation: 90, isInitial: true },
      { instanceId: "cap_tut_7", definitionId: "initial_1", x: 0, y: 1, rotation: 90, isInitial: true },
      { instanceId: "cap_tut_8", definitionId: "initial_8_v", x: 1, y: 1, rotation: 270, isInitial: true }
    ];
    let game = createInitialGameState("room", [player("capuchin", "capuchin")], () => 0.999999, tutorialForest);
    game.players[0]!.objectiveChoices = [];

    game = placeInitialPiece(game, "capuchin", { x: -1, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: -1 });
    game = {
      ...game,
      players: game.players.map((candidate) =>
        candidate.playerId === "capuchin"
          ? {
              ...candidate,
              hand: ["campo_2_copy"],
              reservePieces: candidate.reservePieces.filter(
                (pieceId) => pieceId !== "capuchin_piece_4" && pieceId !== "capuchin_piece_5"
              ),
              piecesInForest: [...candidate.piecesInForest, "capuchin_piece_4", "capuchin_piece_5"]
            }
          : candidate
      ),
      pieces: game.pieces.map((piece) =>
        piece.pieceId === "capuchin_piece_4"
          ? { ...piece, location: { x: 0, y: 0, siteId: "main" } }
          : piece.pieceId === "capuchin_piece_5"
            ? { ...piece, location: { x: 0, y: 1, siteId: "main" } }
            : piece
      )
    };

    game = placeForestCard(game, "capuchin", "campo_2_copy", { x: 2, y: 0 });
    expect(getCapuchinPlacementPositions(game, "capuchin")).toEqual([{ x: 2, y: 0 }]);

    game = addCapuchinForCurrentAction(game, "capuchin", { x: 2, y: 0 });
    expect(getValidPieceMovementDestinations(game, "capuchin", "capuchin_piece_1")).toContainEqual({ x: 1, y: 1 });

    game = movePieceForCurrentAction(game, "capuchin", "capuchin_piece_1", { x: 1, y: 1 });
    expect(getCapuchinPlacementPositions(game, "capuchin")).toContainEqual({ x: 1, y: 1 });

    game = addCapuchinForCurrentAction(game, "capuchin", { x: 1, y: 1 });

    expect(getCapuchinHabitatScore(game, "capuchin")).toBe(3);
    expect(getCapuchinScoringHabitats(game, "capuchin").map((group) => group.habitat).sort()).toEqual([
      "field",
      "forest",
      "river"
    ]);

    game = scoreCapuchinHabitatPresence(game, "capuchin");
    expect(game.players.find((candidate) => candidate.playerId === "capuchin")?.score).toBe(3);
  });

  it("plays Arara-azul action A by expanding and adding a macaw on an egg card", () => {
    let game = createTestGameState("room", [player("macaw", "macaw"), player("coati", "coati")]);
    game = placeInitialPiece(game, "macaw", { x: -1, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 0, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "macaw", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "macaw")?.hand[0];
    const reserveBefore = game.players.find((candidate) => candidate.playerId === "macaw")!.reservePieces.length;

    game = placeForestCard(game, "macaw", cardId!, { x: 2, y: 0 });

    expect(getMacawEggPlacementPositions(game, "macaw")).toContainEqual({ x: -1, y: -1 });

    game = addMacawForCurrentAction(game, "macaw", { x: -1, y: -1 });

    const macaw = game.players.find((candidate) => candidate.playerId === "macaw");
    expect(macaw?.reservePieces).toHaveLength(reserveBefore - 1);
    expect(game.pieces.filter((piece) => piece.ownerId === "macaw" && piece.location?.x === -1 && piece.location.y === -1)).toHaveLength(2);
    expect(game.activePlayerId).toBe("macaw");
    expect(game.activeActionIndex).toBe(1);
  });

  it("lets Arara-azul skip adding in action A", () => {
    let game = createTestGameState("room", [player("macaw", "macaw"), player("coati", "coati")]);
    game = placeInitialPiece(game, "macaw", { x: -1, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 0, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "macaw", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "macaw")?.hand[0];
    const reserveBefore = game.players.find((candidate) => candidate.playerId === "macaw")!.reservePieces.length;
    game = placeForestCard(game, "macaw", cardId!, { x: 2, y: 0 });
    game = completeCurrentAction(game, "macaw");

    expect(game.players.find((candidate) => candidate.playerId === "macaw")?.reservePieces).toHaveLength(reserveBefore);
    expect(game.activeActionIndex).toBe(1);
  });

  it("moves Arara-azul in action B and opens action C around the moved macaw", () => {
    let game = createTestGameState("room", [player("macaw", "macaw"), player("coati", "coati")]);
    game = placeInitialPiece(game, "macaw", { x: -1, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 0, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "macaw", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "macaw")?.hand[0];
    game = placeForestCard(game, "macaw", cardId!, { x: 2, y: 0 });
    game = addMacawForCurrentAction(game, "macaw", { x: -1, y: -1 });

    const movedPieceId = game.players.find((candidate) => candidate.playerId === "macaw")?.piecesInForest[0];
    const destination = getValidPieceMovementDestinations(game, "macaw", movedPieceId!)[0];
    expect(destination).toBeDefined();

    game = movePieceForCurrentAction(game, "macaw", movedPieceId!, destination!);

    expect(game.pendingMacawMovedPiece).toEqual({ playerId: "macaw", pieceId: movedPieceId, location: destination });
    expect(game.activeActionIndex).toBe(2);
    expect(getMacawActionCTargets(game, "macaw").length).toBeGreaterThan(0);
  });

  it("adds another Arara-azul around the moved macaw during action C", () => {
    let game = createTestGameState("room", [player("macaw", "macaw"), player("coati", "coati")]);
    game = placeInitialPiece(game, "macaw", { x: -1, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 0, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "macaw", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "macaw")?.hand[0];
    game = placeForestCard(game, "macaw", cardId!, { x: 2, y: 0 });
    game = addMacawForCurrentAction(game, "macaw", { x: -1, y: -1 });

    const movedPieceId = game.players.find((candidate) => candidate.playerId === "macaw")?.piecesInForest[0];
    const destination = getValidPieceMovementDestinations(game, "macaw", movedPieceId!)[0];
    game = movePieceForCurrentAction(game, "macaw", movedPieceId!, destination!);

    const reserveBefore = game.players.find((candidate) => candidate.playerId === "macaw")!.reservePieces.length;
    const addTarget = getMacawActionCTargets(game, "macaw")[0];
    const resourcesBefore = { ...game.players.find((candidate) => candidate.playerId === "macaw")!.resources };

    game = addMacawForCurrentAction(game, "macaw", addTarget);

    expect(game.players.find((candidate) => candidate.playerId === "macaw")?.reservePieces).toHaveLength(reserveBefore - 1);
    expect(game.players.find((candidate) => candidate.playerId === "macaw")?.resources).toEqual(resourcesBefore);
    expect(game.pendingMacawMovedPiece).toBeNull();
    expect(game.activeActionIndex).toBe(3);
  });

  it("relocates another Arara-azul around the moved macaw during action C", () => {
    let game = createTestGameState("room", [player("macaw", "macaw"), player("coati", "coati")]);
    game = placeInitialPiece(game, "macaw", { x: -1, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 0, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "macaw", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "macaw")?.hand[0];
    game = placeForestCard(game, "macaw", cardId!, { x: 2, y: 0 });
    game = addMacawForCurrentAction(game, "macaw", { x: -1, y: -1 });

    const movedPieceId = game.players.find((candidate) => candidate.playerId === "macaw")?.piecesInForest[0];
    const destination = getValidPieceMovementDestinations(game, "macaw", movedPieceId!)[0];
    game = movePieceForCurrentAction(game, "macaw", movedPieceId!, destination!);

    const relocatedPieceId = getMacawRelocatablePieceIds(game, "macaw")[0];
    const relocationTarget = getValidPieceMovementDestinations(game, "macaw", relocatedPieceId)[0];
    const resourcesBefore = { ...game.players.find((candidate) => candidate.playerId === "macaw")!.resources };

    game = movePieceForCurrentAction(game, "macaw", relocatedPieceId, relocationTarget);

    expect(game.pieces.find((piece) => piece.pieceId === relocatedPieceId)?.location).toEqual({ ...relocationTarget, siteId: "main" });
    // Realocacao (acao C) NAO coleta recurso do destino; so o movimento (acao B) coleta.
    expect(game.players.find((candidate) => candidate.playerId === "macaw")?.resources).toEqual(resourcesBefore);
    expect(game.pendingMacawMovedPiece).toBeNull();
    expect(game.activeActionIndex).toBe(3);
  });

  it("lets Arara-azul skip the action C add or relocation choice", () => {
    let game = createTestGameState("room", [player("macaw", "macaw"), player("coati", "coati")]);
    game = placeInitialPiece(game, "macaw", { x: -1, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 0, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = {
      ...setActiveAction(game, "macaw", 2),
      pendingMacawMovedPiece: {
        playerId: "macaw",
        pieceId: game.players.find((candidate) => candidate.playerId === "macaw")!.piecesInForest[0]!,
        location: { x: -1, y: -1 }
      }
    };

    game = completeCurrentAction(game, "macaw");

    expect(game.pendingMacawMovedPiece).toBeNull();
    expect(game.activeActionIndex).toBe(3);
  });

  it("scores Arara-azul action D by straight lines of three macaws", () => {
    let game = createTestGameState("room", [player("macaw", "macaw"), player("coati", "coati")]);
    game = placeInitialPiece(game, "macaw", { x: -1, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 0, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "macaw", 3);

    expect(getMacawLineScore(game, "macaw")).toBe(1);
    expect(getMacawScoringLines(game, "macaw")).toEqual([
      {
        origin: { x: -1, y: -1 },
        direction: { x: 1, y: 0 },
        positions: [
          { x: -1, y: -1 },
          { x: 0, y: -1 },
          { x: 1, y: -1 }
        ]
      }
    ]);

    game = scoreMacawLines(game, "macaw");

    expect(game.players.find((candidate) => candidate.playerId === "macaw")?.score).toBe(1);
    expect(game.players.find((candidate) => candidate.playerId === "macaw")?.turnsTaken).toBe(1);
    expect(game.activePlayerId).toBe("coati");
  });

  it("lets the Arara-azul tutorial score three lines in one turn", () => {
    const tutorialForest: ForestCardState[] = [
      { instanceId: "mac_tut_0", definitionId: "bosque_2", x: -2, y: -1, rotation: 0, isInitial: true },
      { instanceId: "mac_tut_1", definitionId: "campo_4", x: -1, y: -1, rotation: 0, isInitial: true },
      { instanceId: "mac_tut_2", definitionId: "bosque_3", x: 0, y: -1, rotation: 0, isInitial: true },
      { instanceId: "mac_tut_3", definitionId: "campo_3", x: 1, y: -1, rotation: 0, isInitial: true },
      { instanceId: "mac_tut_4", definitionId: "bosque_4", x: -2, y: 0, rotation: 0, isInitial: true },
      { instanceId: "mac_tut_5", definitionId: "bosque_1", x: -1, y: 0, rotation: 0, isInitial: true },
      { instanceId: "mac_tut_6", definitionId: "campo_1", x: 0, y: 0, rotation: 0, isInitial: true },
      { instanceId: "mac_tut_7", definitionId: "bosque_2_copy", x: 1, y: 0, rotation: 0, isInitial: true },
      { instanceId: "mac_tut_8", definitionId: "campo_4_copy", x: -1, y: 1, rotation: 0, isInitial: true },
      { instanceId: "mac_tut_9", definitionId: "bosque_3_copy", x: 0, y: 1, rotation: 0, isInitial: true },
      { instanceId: "mac_tut_10", definitionId: "campo_2", x: 1, y: 1, rotation: 0, isInitial: true }
    ];
    let game = createInitialGameState("room", [player("macaw", "macaw")], () => 0.999999, tutorialForest);
    game.players[0]!.objectiveChoices = [];

    game = placeInitialPiece(game, "macaw", { x: -1, y: 0 });
    game = placeInitialPiece(game, "macaw", { x: 0, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 1, y: -1 });
    game = {
      ...game,
      players: game.players.map((candidate) =>
        candidate.playerId === "macaw"
          ? {
              ...candidate,
              hand: ["campo_2_copy"],
              reservePieces: candidate.reservePieces.filter((pieceId) => pieceId !== "macaw_piece_4"),
              piecesInForest: [...candidate.piecesInForest, "macaw_piece_4"]
            }
          : candidate
      ),
      pieces: game.pieces.map((piece) =>
        piece.pieceId === "macaw_piece_4" ? { ...piece, location: { x: 1, y: 1, siteId: "main" } } : piece
      )
    };

    game = placeForestCard(game, "macaw", "campo_2_copy", { x: 2, y: 0 });
    expect(getMacawEggPlacementPositions(game, "macaw")).toContainEqual({ x: -1, y: -1 });

    game = addMacawForCurrentAction(game, "macaw", { x: -1, y: -1 });
    expect(getValidPieceMovementDestinations(game, "macaw", "macaw_piece_1")).toContainEqual({ x: 0, y: 0 });

    game = movePieceForCurrentAction(game, "macaw", "macaw_piece_1", { x: 0, y: 0 });
    expect(getMacawActionCTargets(game, "macaw")).toContainEqual({ x: 0, y: 1 });

    game = addMacawForCurrentAction(game, "macaw", { x: 0, y: 1 });

    expect(getMacawLineScore(game, "macaw")).toBe(3);
    expect(getMacawScoringLines(game, "macaw").map((line) => line.positions)).toEqual([
      [
        { x: 0, y: -1 },
        { x: 0, y: 0 },
        { x: 0, y: 1 }
      ],
      [
        { x: -1, y: -1 },
        { x: 0, y: -1 },
        { x: 1, y: -1 }
      ],
      [
        { x: -1, y: -1 },
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ]
    ]);

    game = scoreMacawLines(game, "macaw");

    expect(game.players.find((candidate) => candidate.playerId === "macaw")?.score).toBe(3);
  });

  it("plays Galo-de-campina action A by expanding and adding a galo on a field card", () => {
    let game = createTestGameState("room", [player("galo", "galo_de_campina"), player("coati", "coati")]);
    game = placeInitialPiece(game, "galo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "galo", { x: 0, y: -1 });
    game = placeInitialPiece(game, "galo", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 1 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 1 });
    game = {
      ...setActiveAction(game, "galo", 0),
      players: game.players.map((candidate) => (candidate.playerId === "galo" ? { ...candidate, hand: ["campo_2"] } : candidate))
    };

    const reserveBefore = game.players.find((candidate) => candidate.playerId === "galo")!.reservePieces.length;
    game = placeForestCard(game, "galo", "campo_2", { x: 2, y: 0 });

    const fieldTargets = getGaloFieldPlacementPositions(game, "galo");
    expect(fieldTargets).toContainEqual({ x: 2, y: 0 });

    game = addGaloForCurrentAction(game, "galo", { x: 2, y: 0 });

    const galo = game.players.find((candidate) => candidate.playerId === "galo");
    expect(galo?.reservePieces).toHaveLength(reserveBefore - 1);
    expect(game.pieces.filter((piece) => piece.ownerId === "galo" && piece.location?.x === 2 && piece.location.y === 0)).toHaveLength(1);
    expect(game.activePlayerId).toBe("galo");
    expect(game.activeActionIndex).toBe(1);
  });

  it("lets the first galo entering an empty field collect the normal resource plus the action-B seed", () => {
    let game = createTestGameState("room", [player("galo", "galo_de_campina"), player("coati", "coati")]);
    game = placeInitialPiece(game, "galo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "galo", { x: 0, y: -1 });
    game = placeInitialPiece(game, "galo", { x: 1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 1 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 1 });
    game = {
      ...setActiveAction(game, "galo", 1),
      activePlayedForestCardId: "campo_2"
    };

    const galoPieceId = game.pieces.find((piece) => piece.ownerId === "galo" && piece.location?.x === 1 && piece.location.y === -1)?.pieceId;

    expect(getValidPieceMovementDestinations(game, "galo", galoPieceId!)).toContainEqual({ x: 1, y: 0 });
    game = movePieceForCurrentAction(game, "galo", galoPieceId!, { x: 1, y: 0 });

    const galo = game.players.find((candidate) => candidate.playerId === "galo");
    expect(galo?.resources.fruit).toBe(2);
    expect(galo?.resources.seed).toBe(1);
    expect(game.pendingGaloInterrupt).toBeNull();
    expect(game.activeActionIndex).toBe(2);
  });

  it("turns a galo-occupied field resource into seed and lets the galo owner move between turns", () => {
    let game = createTestGameState("room", [player("galo", "galo_de_campina"), player("coati", "coati")]);
    game = placeInitialPiece(game, "galo", { x: 1, y: 0 });
    game = placeInitialPiece(game, "galo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "galo", { x: 0, y: -1 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 1 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 1 });
    game = {
      ...setActiveAction(game, "coati", 1),
      activePlayedForestCardId: "campo_2"
    };

    const coatiPieceId = game.pieces.find((piece) => piece.ownerId === "coati" && piece.location?.x === 0 && piece.location.y === 1)?.pieceId;
    const galoPieceId = game.pieces.find((piece) => piece.ownerId === "galo" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;

    expect(getValidPieceMovementDestinations(game, "coati", coatiPieceId!)).toContainEqual({ x: 1, y: 0 });
    game = movePieceForCurrentAction(game, "coati", coatiPieceId!, { x: 1, y: 0 });

    const coati = game.players.find((candidate) => candidate.playerId === "coati");
    expect(coati?.resources.seed).toBe(2);
    expect(coati?.resources.fruit).toBe(0);
    expect(game.pendingGaloInterrupt).toEqual({
      ownerId: "galo",
      location: { x: 1, y: 0 },
      interruptedPlayerId: "coati"
    });
    expect(getGaloInterruptPieceIds(game, "galo")).toContain(galoPieceId);
    expect(getGaloInterruptMoveTargets(game, "galo", galoPieceId)).toContainEqual({ x: 0, y: 0 });

    game = resolveGaloInterruptMove(game, "galo", { x: 0, y: 0 }, galoPieceId);

    expect(game.pendingGaloInterrupt).toBeNull();
    expect(game.pieces.find((piece) => piece.pieceId === galoPieceId)?.location).toMatchObject({ x: 0, y: 0 });
    expect(game.players.find((candidate) => candidate.playerId === "galo")?.resources.meat).toBe(0);
    expect(game.activePlayerId).toBe("galo");
    expect(game.activeActionIndex).toBe(0);
  });

  it("pauses Onca removal for the Galo-de-campina between-turn move before choosing a removed piece", () => {
    let game = createTestGameState("room", [
      player("jaguar", "jaguar"),
      player("galo", "galo_de_campina"),
      player("wolf", "maned_wolf"),
      player("coati", "coati")
    ]);
    const placeFor = (playerId: string, location: { x: number; y: number }) => {
      game = placeInitialPiece({ ...game, setupActivePlayerId: playerId }, playerId, location);
    };
    placeFor("jaguar", { x: 0, y: 0 });
    placeFor("galo", { x: 1, y: 0 });
    placeFor("wolf", { x: 1, y: 0 });
    placeFor("coati", { x: 1, y: 0 });
    placeFor("galo", { x: -1, y: -1 });
    placeFor("wolf", { x: -1, y: 0 });
    placeFor("coati", { x: 0, y: 1 });
    game = setActiveAction(game, "jaguar", 0);

    const galoPieceId = game.pieces.find((piece) => piece.ownerId === "galo" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;
    const coatiPieceId = game.pieces.find((piece) => piece.ownerId === "coati" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;
    const jaguarMeatBeforeRemoval = game.players.find((candidate) => candidate.playerId === "jaguar")!.resources.meat;

    game = moveJaguarForCurrentAction(game, "jaguar", { x: 1, y: 0 });

    expect(game.pendingGaloInterrupt).toEqual({
      ownerId: "galo",
      location: { x: 1, y: 0 },
      interruptedPlayerId: "jaguar"
    });
    expect(game.pendingJaguarRemoval).toEqual({
      playerId: "jaguar",
      location: { x: 1, y: 0 }
    });
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(0);

    game = resolveGaloInterruptMove(game, "galo", { x: 0, y: 0 }, galoPieceId);

    expect(game.pendingGaloInterrupt).toBeNull();
    expect(game.pendingJaguarRemoval).toEqual({
      playerId: "jaguar",
      location: { x: 1, y: 0 }
    });
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(0);

    game = moveJaguarForCurrentAction(game, "jaguar", { x: -1, y: -1 }, coatiPieceId);

    expect(game.pendingJaguarRemoval).toBeNull();
    expect(game.pieces.find((piece) => piece.pieceId === coatiPieceId)?.location).toBeNull();
    expect(game.pieces.find((piece) => piece.pieceId === galoPieceId)?.location).toMatchObject({ x: 0, y: 0 });
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources.meat).toBe(jaguarMeatBeforeRemoval + 1);
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(1);
  });

  it("does not queue Onca removal when the only piece in the field is the interrupting galo", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("galo", "galo_de_campina")]);
    const placeFor = (playerId: string, location: { x: number; y: number }) => {
      game = placeInitialPiece({ ...game, setupActivePlayerId: playerId }, playerId, location);
    };
    placeFor("jaguar", { x: 0, y: 0 });
    placeFor("galo", { x: 1, y: 0 });
    game = setActiveAction(game, "jaguar", 0);

    const galoPieceId = game.pieces.find((piece) => piece.ownerId === "galo" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;
    const jaguarMeatBefore = game.players.find((candidate) => candidate.playerId === "jaguar")!.resources.meat;

    game = moveJaguarForCurrentAction(game, "jaguar", { x: 1, y: 0 });

    expect(game.pendingGaloInterrupt).toEqual({
      ownerId: "galo",
      location: { x: 1, y: 0 },
      interruptedPlayerId: "jaguar"
    });
    expect(game.pendingJaguarRemoval).toBeNull();

    const target = getGaloInterruptMoveTargets(game, "galo", galoPieceId)[0];
    game = resolveGaloInterruptMove(game, "galo", target, galoPieceId);

    expect(game.pendingGaloInterrupt).toBeNull();
    expect(game.pendingJaguarRemoval).toBeNull();
    expect(game.pieces.find((piece) => piece.pieceId === galoPieceId)?.location).toMatchObject(target);
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources.meat).toBe(jaguarMeatBefore);
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(1);
  });

  it("automatically removes the remaining galo after the interrupt when Onca entered a field with two galos", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("galo", "galo_de_campina")]);
    const placeFor = (playerId: string, location: { x: number; y: number }) => {
      game = placeInitialPiece({ ...game, setupActivePlayerId: playerId }, playerId, location);
    };
    placeFor("jaguar", { x: 0, y: 0 });
    placeFor("galo", { x: 1, y: 0 });
    placeFor("galo", { x: 1, y: 0 });
    game = setActiveAction(game, "jaguar", 0);

    const galoPieces = game.pieces
      .filter((piece) => piece.ownerId === "galo" && piece.location?.x === 1 && piece.location.y === 0)
      .sort((a, b) => a.pieceId.localeCompare(b.pieceId));
    const movingGaloId = galoPieces[0]?.pieceId;
    const remainingGaloId = galoPieces[1]?.pieceId;
    const jaguarMeatBefore = game.players.find((candidate) => candidate.playerId === "jaguar")!.resources.meat;

    game = moveJaguarForCurrentAction(game, "jaguar", { x: 1, y: 0 });

    expect(game.pendingGaloInterrupt).not.toBeNull();
    expect(game.pendingJaguarRemoval).toEqual({
      playerId: "jaguar",
      location: { x: 1, y: 0 }
    });

    const target = getGaloInterruptMoveTargets(game, "galo", movingGaloId)[0];
    game = resolveGaloInterruptMove(game, "galo", target, movingGaloId);

    expect(game.pendingJaguarRemoval).toBeNull();
    expect(game.pieces.find((piece) => piece.pieceId === movingGaloId)?.location).toMatchObject(target);
    expect(game.pieces.find((piece) => piece.pieceId === remainingGaloId)?.location).toBeNull();
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources.meat).toBe(jaguarMeatBefore + 1);
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(1);
  });

  it("still pauses Onca removal for Galo interrupt when seed collection is blocked", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("galo", "galo_de_campina")]);
    const placeFor = (playerId: string, location: { x: number; y: number }) => {
      game = placeInitialPiece({ ...game, setupActivePlayerId: playerId }, playerId, location);
    };
    placeFor("jaguar", { x: 0, y: 0 });
    placeFor("galo", { x: 1, y: 0 });
    placeFor("galo", { x: 1, y: 0 });
    game = { ...setActiveAction(game, "jaguar", 0), activeThreatCardId: "threat_5" };

    const galoPieces = game.pieces
      .filter((piece) => piece.ownerId === "galo" && piece.location?.x === 1 && piece.location.y === 0)
      .sort((a, b) => a.pieceId.localeCompare(b.pieceId));
    const movingGaloId = galoPieces[0]?.pieceId;
    const remainingGaloId = galoPieces[1]?.pieceId;

    game = moveJaguarForCurrentAction(game, "jaguar", { x: 1, y: 0 });

    expect(game.pendingGaloInterrupt).toEqual({
      ownerId: "galo",
      location: { x: 1, y: 0 },
      interruptedPlayerId: "jaguar"
    });
    expect(game.pendingJaguarRemoval).toEqual({
      playerId: "jaguar",
      location: { x: 1, y: 0 }
    });

    const target = getGaloInterruptMoveTargets(game, "galo", movingGaloId)[0];
    game = resolveGaloInterruptMove(game, "galo", target, movingGaloId);

    expect(game.pendingGaloInterrupt).toBeNull();
    expect(game.pendingJaguarRemoval).toBeNull();
    expect(game.pieces.find((piece) => piece.pieceId === movingGaloId)?.location).toMatchObject(target);
    expect(game.pieces.find((piece) => piece.pieceId === remainingGaloId)?.location).toBeNull();
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(1);
  });

  it("lets Onca choose among remaining pieces after the interrupt when more than one target stays", () => {
    let game = createTestGameState("room", [
      player("jaguar", "jaguar"),
      player("galo", "galo_de_campina"),
      player("wolf", "maned_wolf")
    ]);
    const placeFor = (playerId: string, location: { x: number; y: number }) => {
      game = placeInitialPiece({ ...game, setupActivePlayerId: playerId }, playerId, location);
    };
    placeFor("jaguar", { x: 0, y: 0 });
    placeFor("galo", { x: 1, y: 0 });
    placeFor("galo", { x: 1, y: 0 });
    placeFor("wolf", { x: 1, y: 0 });
    game = setActiveAction(game, "jaguar", 0);

    const galoPieces = game.pieces
      .filter((piece) => piece.ownerId === "galo" && piece.location?.x === 1 && piece.location.y === 0)
      .sort((a, b) => a.pieceId.localeCompare(b.pieceId));
    const movingGaloId = galoPieces[0]?.pieceId;
    const remainingGaloId = galoPieces[1]?.pieceId;
    const wolfPieceId = game.pieces.find((piece) => piece.ownerId === "wolf" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;

    game = moveJaguarForCurrentAction(game, "jaguar", { x: 1, y: 0 });
    const target = getGaloInterruptMoveTargets(game, "galo", movingGaloId)[0];
    game = resolveGaloInterruptMove(game, "galo", target, movingGaloId);

    const jaguarPieceId = game.pieces.find(
      (piece) => piece.ownerId === "jaguar" && piece.speciesId === "jaguar" && piece.location
    )?.pieceId;

    expect(() => moveJaguarForCurrentAction(game, "jaguar", { x: 0, y: 0 })).toThrow(
      "Escolha qual peca a Onca deve remover no local de entrada."
    );
    expect(getValidPieceMovementDestinations(game, "jaguar", jaguarPieceId!)).toEqual([]);

    game = moveJaguarForCurrentAction(game, "jaguar", { x: 0, y: 0 }, wolfPieceId);

    expect(game.pendingJaguarRemoval).toBeNull();
    expect(game.pieces.find((piece) => piece.pieceId === wolfPieceId)?.location).toBeNull();
    expect(game.pieces.find((piece) => piece.pieceId === remainingGaloId)?.location).toMatchObject({ x: 1, y: 0 });
    expect(game.pieces.find((piece) => piece.pieceId === movingGaloId)?.location).toMatchObject(target);
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(1);
  });

  it("plays Galo-de-campina action C by attracting an own piece to a location with galo", () => {
    let game = createTestGameState("room", [player("galo", "galo_de_campina"), player("coati", "coati")]);
    game = placeInitialPiece(game, "galo", { x: 1, y: 0 });
    game = placeInitialPiece(game, "galo", { x: 1, y: -1 });
    game = placeInitialPiece(game, "galo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 1 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 1 });
    game = {
      ...setActiveAction(game, "galo", 2),
      activePlayedForestCardId: "campo_2"
    };

    const movingGaloId = game.pieces.find((piece) => piece.ownerId === "galo" && piece.location?.x === 1 && piece.location.y === -1)?.pieceId;

    expect(getValidPieceMovementDestinations(game, "galo", movingGaloId!)).toContainEqual({ x: 1, y: 0 });
    game = movePieceForCurrentAction(game, "galo", movingGaloId!, { x: 1, y: 0 });

    expect(game.players.find((candidate) => candidate.playerId === "galo")?.resources.seed).toBe(1);
    expect(game.activeActionIndex).toBe(3);
  });

  it("scores Galo-de-campina action D as 3 minus one point per galo outside field", () => {
    let game = createTestGameState("room", [player("galo", "galo_de_campina"), player("coati", "coati")]);
    game = placeInitialPiece(game, "galo", { x: 1, y: 0 });
    game = placeInitialPiece(game, "galo", { x: -1, y: 1 });
    game = placeInitialPiece(game, "galo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 1 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 1 });
    game = setActiveAction(game, "galo", 3);

    expect(getGaloOutOfFieldPieceCount(game, "galo")).toBe(1);
    expect(getGaloActionDScore(game, "galo")).toBe(2);

    game = scoreGaloFieldPresence(game, "galo");

    expect(game.players.find((candidate) => candidate.playerId === "galo")?.score).toBe(2);
    expect(game.players.find((candidate) => candidate.playerId === "galo")?.turnsTaken).toBe(1);
    expect(game.activePlayerId).toBe("coati");
  });

  it("plays Tatu-bola action A by expanding and adding an armadillo on a seed card", () => {
    let game = createTestGameState("room", [player("armadillo", "armadillo"), player("coati", "coati")]);
    game = placeInitialPiece(game, "armadillo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "armadillo", { x: 0, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "armadillo", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "armadillo")?.hand[0];
    const reserveBefore = game.players.find((candidate) => candidate.playerId === "armadillo")!.reservePieces.length;

    game = placeForestCard(game, "armadillo", cardId!, { x: 2, y: 0 });

    const seedTargets = getArmadilloSeedPlacementPositions(game, "armadillo");
    expect(seedTargets.length).toBeGreaterThan(0);
    const seedTarget = seedTargets[0];

    game = addArmadilloForCurrentAction(game, "armadillo", seedTarget);

    const armadillo = game.players.find((candidate) => candidate.playerId === "armadillo");
    expect(armadillo?.reservePieces).toHaveLength(reserveBefore - 1);
    expect(
      game.pieces.filter(
        (piece) =>
          piece.ownerId === "armadillo" && piece.location?.x === seedTarget.x && piece.location.y === seedTarget.y
      )
    ).toHaveLength(1);
    expect(game.activePlayerId).toBe("armadillo");
    expect(game.activeActionIndex).toBe(1);
  });

  it("lets Tatu-bola skip adding in action A", () => {
    let game = createTestGameState("room", [player("armadillo", "armadillo"), player("coati", "coati")]);
    game = placeInitialPiece(game, "armadillo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "armadillo", { x: 0, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "armadillo", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "armadillo")?.hand[0];
    const reserveBefore = game.players.find((candidate) => candidate.playerId === "armadillo")!.reservePieces.length;
    game = placeForestCard(game, "armadillo", cardId!, { x: 2, y: 0 });
    game = completeCurrentAction(game, "armadillo");

    expect(game.players.find((candidate) => candidate.playerId === "armadillo")?.reservePieces).toHaveLength(reserveBefore);
    expect(game.activeActionIndex).toBe(1);
  });

  it("moves Tatu-bola in action B and reveals it if hidden", () => {
    let game = createTestGameState("room", [player("armadillo", "armadillo"), player("coati", "coati")]);
    game = placeInitialPiece(game, "armadillo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "armadillo", { x: 0, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });

    const movedPieceId = game.players.find((candidate) => candidate.playerId === "armadillo")?.piecesInForest[0];
    game = {
      ...setActiveAction(game, "armadillo", 1),
      activePlayedForestCardId: game.players.find((candidate) => candidate.playerId === "armadillo")?.hand[0] ?? null,
      pieces: game.pieces.map((piece) =>
        piece.pieceId === movedPieceId ? { ...piece, state: { ...piece.state, hidden: true } } : piece
      )
    };

    const destination = getValidPieceMovementDestinations(game, "armadillo", movedPieceId!)[0];
    expect(destination).toBeDefined();

    game = movePieceForCurrentAction(game, "armadillo", movedPieceId!, destination!);

    expect(game.pieces.find((piece) => piece.pieceId === movedPieceId)?.location).toEqual({ ...destination!, siteId: "main" });
    expect(game.pieces.find((piece) => piece.pieceId === movedPieceId)?.state.hidden).toBe(false);
    expect(game.activeActionIndex).toBe(2);
  });

  it("hides a visible own Tatu-bola during action C", () => {
    let game = createTestGameState("room", [player("armadillo", "armadillo"), player("coati", "coati")]);
    game = placeInitialPiece(game, "armadillo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "armadillo", { x: 0, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "armadillo", 2);

    const pieceId = getArmadilloHidePieceIds(game, "armadillo")[0];
    expect(pieceId).toBeDefined();

    game = hideArmadilloForCurrentAction(game, "armadillo", pieceId);

    expect(game.pieces.find((piece) => piece.pieceId === pieceId)?.state.hidden).toBe(true);
    expect(game.activeActionIndex).toBe(3);
  });

  it("scores Tatu-bola action D from opponent species not sharing locations", () => {
    let game = createTestGameState("room", [
      player("armadillo", "armadillo"),
      player("coati", "coati"),
      player("capuchin", "capuchin")
    ]);
    game = placeInitialPiece(game, "armadillo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "armadillo", { x: 0, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: -1, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "armadillo", 3);

    expect(getArmadilloShareScore(game, "armadillo")).toBe(2);

    game = scoreArmadilloSharing(game, "armadillo");

    expect(game.players.find((candidate) => candidate.playerId === "armadillo")?.score).toBe(2);
    expect(game.players.find((candidate) => candidate.playerId === "armadillo")?.turnsTaken).toBe(1);
    expect(game.activePlayerId).toBe("coati");
  });

  it("counts a hidden Tatu-bola when sharing with four rival species", () => {
    let game = createTestGameState("room", [
      player("jaguar", "jaguar"),
      player("armadillo", "armadillo"),
      player("capuchin", "capuchin"),
      player("coati", "coati"),
      player("macaw", "macaw")
    ]);
    game = placeInitialPiece(game, "jaguar", { x: -1, y: -1 });
    game = placeInitialPiece(game, "armadillo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "armadillo", { x: 0, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 0, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 1, y: -1 });
    game = placeInitialPiece(game, "macaw", { x: 1, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: -1, y: -1 });
    game = placeInitialPiece(game, "capuchin", { x: -1, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: -1 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 1 });
    game = setActiveAction(game, "armadillo", 2);

    const hiddenPieceId = game.pieces.find(
      (piece) => piece.ownerId === "armadillo" && piece.location?.x === -1 && piece.location.y === -1
    )?.pieceId;
    game = hideArmadilloForCurrentAction(game, "armadillo", hiddenPieceId!);

    expect(game.pieces.find((piece) => piece.pieceId === hiddenPieceId)?.state.hidden).toBe(true);
    expect(getArmadilloShareScore(game, "armadillo")).toBe(3);
    expect(getArmadilloSharingDetails(game, "armadillo")).toMatchObject({
      points: 3,
      sharedSpecies: expect.arrayContaining(["jaguar", "capuchin", "coati", "macaw"]),
      missingSpecies: []
    });

    game = scoreArmadilloSharing(game, "armadillo");
    expect(game.players.find((candidate) => candidate.playerId === "armadillo")?.score).toBe(3);
  });

  it("scores zero for Tatu-bola only when it shares no location with another species", () => {
    let game = createTestGameState("room", [player("armadillo", "armadillo"), player("coati", "coati")]);
    game = placeInitialPiece(game, "armadillo", { x: -1, y: -1 });
    game = placeInitialPiece(game, "armadillo", { x: 0, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "armadillo", 3);

    expect(getArmadilloShareScore(game, "armadillo")).toBe(0);

    game = scoreArmadilloSharing(game, "armadillo");

    expect(game.players.find((candidate) => candidate.playerId === "armadillo")?.score).toBe(0);
    expect(game.players.find((candidate) => candidate.playerId === "armadillo")?.turnsTaken).toBe(1);
  });

  it("does not let Onca remove hidden Tatu-bola pieces", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("armadillo", "armadillo")]);
    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "armadillo", { x: 1, y: 0 });
    game = placeInitialPiece(game, "armadillo", { x: -1, y: 0 });

    const hiddenPieceId = game.pieces.find((piece) => piece.ownerId === "armadillo" && piece.location?.x === 1 && piece.location.y === 0)?.pieceId;
    game = {
      ...setActiveAction(game, "jaguar", 0),
      pieces: game.pieces.map((piece) =>
        piece.pieceId === hiddenPieceId ? { ...piece, state: { ...piece.state, hidden: true } } : piece
      )
    };

    const jaguarPieceId = game.players.find((candidate) => candidate.playerId === "jaguar")!.piecesInForest[0];
    const resourceBefore = { ...game.players.find((candidate) => candidate.playerId === "jaguar")!.resources };
    const destinationResource = getResourceAt(game, { x: 1, y: 0 });

    expect(getValidPieceMovementDestinations(game, "jaguar", jaguarPieceId)).toContainEqual({ x: 1, y: 0 });

    game = movePieceForCurrentAction(game, "jaguar", jaguarPieceId, { x: 1, y: 0 });

    expect(game.pieces.find((piece) => piece.pieceId === hiddenPieceId)?.location).toEqual({ x: 1, y: 0, siteId: "main" });
    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources.meat).toBe(
      resourceBefore.meat + (destinationResource === "meat" ? 1 : 0)
    );
  });

  it("plays Lobo-guara action A by expanding and moving every wolf with legal movement", () => {
    let game = createTestGameState("room", [player("wolf", "maned_wolf"), player("coati", "coati")]);
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: -1 });
    game = setActiveAction(game, "wolf", 0);

    const cardId = game.players.find((candidate) => candidate.playerId === "wolf")?.hand[0];
    game = placeForestCard(game, "wolf", cardId!, { x: 2, y: 0 });

    expect(game.pendingWolfMoves?.pieceIds.length).toBeGreaterThan(0);
    while (game.pendingWolfMoves?.pieceIds.length) {
      const pieceId = game.pendingWolfMoves.pieceIds[0];
      const destination = getValidPieceMovementDestinations(game, "wolf", pieceId)[0];
      expect(destination).toBeTruthy();
      game = movePieceForCurrentAction(game, "wolf", pieceId, destination!);
    }

    expect(game.activePlayerId).toBe("wolf");
    expect(game.activeActionIndex).toBe(1);
  });

  it("plays Lobo-guara action B by removing a base species piece and sharing the local resource", () => {
    let game = createTestGameState("room", [player("wolf", "maned_wolf"), player("coati", "coati")]);
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = setActiveAction(game, "wolf", 1);

    const targetPieceId = game.pieces.find((piece) => piece.ownerId === "coati" && piece.location?.x === 0 && piece.location.y === 0)?.pieceId;
    expect(getWolfRemovableBasePieceIds(game, "wolf")).toContain(targetPieceId);
    const wolfResourceBefore = { ...game.players.find((candidate) => candidate.playerId === "wolf")!.resources };
    const coatiResourceBefore = { ...game.players.find((candidate) => candidate.playerId === "coati")!.resources };
    const targetCard = game.forest.cards.find((card) => card.x === 0 && card.y === 0);
    const cardResource = initialForestCardCandidates.find((card) => card.id === targetCard?.definitionId)?.resource;

    game = removeBasePieceForWolfAction(game, "wolf", targetPieceId!);

    expect(game.pieces.find((piece) => piece.pieceId === targetPieceId)?.location).toBeNull();
    expect(game.players.find((candidate) => candidate.playerId === "coati")?.reservePieces).toContain(targetPieceId);
    if (cardResource) {
      expect(game.players.find((candidate) => candidate.playerId === "wolf")?.resources[cardResource]).toBe(wolfResourceBefore[cardResource] + 1);
      expect(game.players.find((candidate) => candidate.playerId === "coati")?.resources[cardResource]).toBe(coatiResourceBefore[cardResource] + 1);
    }
    expect(game.activeActionIndex).toBe(2);
  });

  it("automatically skips Lobo-guara action B when no base species piece shares a location with a wolf", () => {
    let game = createTestGameState("room", [player("wolf", "maned_wolf"), player("coati", "coati")]);
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });

    const movedPieceId = game.players.find((candidate) => candidate.playerId === "wolf")!.piecesInForest[0];
    game = {
      ...setActiveAction(game, "wolf", 0),
      activePlayedForestCardId: "campo_1",
      pendingWolfMoves: { playerId: "wolf", pieceIds: [movedPieceId] }
    };

    const destination = getValidPieceMovementDestinations(game, "wolf", movedPieceId)[0];
    game = movePieceForCurrentAction(game, "wolf", movedPieceId, destination!);

    expect(game.activePlayerId).toBe("wolf");
    expect(game.activeActionIndex).toBe(2);
    expect(game.log.some((entry) => entry.message.includes("pulou automaticamente a acao B do Lobo-guara"))).toBe(true);
  });

  it("plays Lobo-guara action C by spending different resources up to wolves in forest", () => {
    let game = createTestGameState("room", [player("wolf", "maned_wolf"), player("coati", "coati")]);
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: -1 });
    game = {
      ...setActiveAction(game, "wolf", 2),
      players: game.players.map((candidate) =>
        candidate.playerId === "wolf"
          ? { ...candidate, resources: { meat: 1, egg: 1, fruit: 1, seed: 0 } }
          : candidate
      )
    };

    expect(getAvailableWolfPointSpendCount(game, "wolf")).toBe(2);
    expect(getWolfSpendableResourceTypes(game, "wolf")).toEqual(["meat", "egg", "fruit"]);

    game = spendWolfResourcesForPoints(game, "wolf", ["meat", "egg"]);

    const wolf = game.players.find((candidate) => candidate.playerId === "wolf");
    expect(wolf?.score).toBe(2);
    expect(wolf?.resources.meat).toBe(0);
    expect(wolf?.resources.egg).toBe(0);
    expect(game.activeActionIndex).toBe(3);
  });

  it("plays Lobo-guara action D by adding a wolf on a meat card", () => {
    let game = createTestGameState("room", [player("wolf", "maned_wolf"), player("coati", "coati")]);
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: -1 });
    game = setActiveAction(game, "wolf", 3);

    const target = getWolfMeatPlacementPositions(game, "wolf")[0];
    const reserveBefore = game.players.find((candidate) => candidate.playerId === "wolf")!.reservePieces.length;
    const wolvesAtTargetBefore = game.pieces.filter(
      (piece) => piece.ownerId === "wolf" && piece.location?.x === target.x && piece.location.y === target.y
    ).length;
    game = addWolfForCurrentAction(game, "wolf", target);

    const wolf = game.players.find((candidate) => candidate.playerId === "wolf");
    expect(wolf?.reservePieces).toHaveLength(reserveBefore - 1);
    expect(
      game.pieces.filter((piece) => piece.ownerId === "wolf" && piece.location?.x === target.x && piece.location.y === target.y)
    ).toHaveLength(wolvesAtTargetBefore + 1);
    expect(game.activePlayerId).toBe("coati");
  });

  it("lets Lobo-guara skip adding in action D even with a valid meat location", () => {
    let game = createTestGameState("room", [player("wolf", "maned_wolf"), player("coati", "coati")]);
    game = placeInitialPiece(game, "wolf", { x: -1, y: -1 });
    game = placeInitialPiece(game, "wolf", { x: 0, y: -1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = setActiveAction(game, "wolf", 3);

    const reserveBefore = game.players.find((candidate) => candidate.playerId === "wolf")!.reservePieces.length;
    expect(getWolfMeatPlacementPositions(game, "wolf").length).toBeGreaterThan(0);

    game = completeCurrentAction(game, "wolf");

    expect(game.players.find((candidate) => candidate.playerId === "wolf")?.reservePieces).toHaveLength(reserveBefore);
    expect(game.activePlayerId).toBe("coati");
  });

  it("auto-skips Lobo-guara action D when there are no wolves in reserve", () => {
    let game = createTestGameState("room", [player("wolf", "maned_wolf"), player("coati", "coati")]);
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: -1 });
    game = {
      ...setActiveAction(game, "wolf", 2),
      players: game.players.map((candidate) =>
        candidate.playerId === "wolf" ? { ...candidate, reservePieces: [] } : candidate
      )
    };

    game = completeCurrentAction(game, "wolf");

    expect(game.activePlayerId).toBe("coati");
    expect(game.log.some((entry) => entry.message.includes("pulou automaticamente a acao D do Lobo-guara"))).toBe(true);
  });
});

describe("mata atlantica scenario", () => {
  it("refills the drained pile from the deck so the 3 piles keep top cards", () => {
    const base = createInitialGameState(
      "ma-room",
      [player("jaguar", "jaguar"), player("wolf", "maned_wolf")],
      () => 0.42,
      createPreviewInitialForest(),
      { activeScenarioIds: ["mata_atlantica"] }
    );
    const game = { ...base, status: "active" as const, activePlayerId: "jaguar", activeActionIndex: 0 };
    expect(game.mataAtlanticaPiles!.map((pile) => pile.length)).toEqual([6, 6, 6]);
    const deckBefore = game.deck.commonCardIds.length;
    expect(deckBefore).toBeGreaterThan(0);

    const next = discardMataAtlanticaPileCard(game, "jaguar", game.mataAtlanticaPiles![0][0]);
    expect(next.mataAtlanticaPiles!.map((pile) => pile.length)).toEqual([6, 6, 6]);
    expect(next.deck.commonCardIds.length).toBe(deckBefore - 1);
  });
});

describe("cerrado scenario", () => {
  function createCerradoMovementGame() {
    let game = createTestGameState("room", [player("capuchin", "capuchin"), player("coati", "coati")]);
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 1 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 1 });
    game = {
      ...setActiveAction(game, "capuchin", 0),
      activeScenarioIds: ["cerrado"],
      players: game.players.map((candidate) =>
        candidate.playerId === "capuchin"
          ? { ...candidate, resources: { meat: 0, egg: 0, fruit: 0, seed: 0 } }
          : candidate
      )
    };

    const cardId = game.players.find((candidate) => candidate.playerId === "capuchin")?.hand[0];
    game = placeForestCard(game, "capuchin", cardId!, { x: 2, y: 0 });
    game = addCapuchinForCurrentAction(game, "capuchin", { x: 2, y: 0 });

    const movedPieceId = game.players.find((candidate) => candidate.playerId === "capuchin")?.piecesInForest[0]!;
    const destination = getValidPieceMovementDestinations(game, "capuchin", movedPieceId)[0]!;
    return { game, movedPieceId, destination };
  }

  it("lets the player collect 2 with Cerrado instead of auto-triggering it", () => {
    const setup = createCerradoMovementGame();
    let game = movePieceForCurrentAction(setup.game, "capuchin", setup.movedPieceId, setup.destination);

    expect(game.cerradoPending).toMatchObject({
      playerId: "capuchin",
      round: 1
    });
    expect(game.activePlayerId).toBe("capuchin");
    expect(game.activeActionIndex).toBe(1);

    const resource = game.cerradoPending!.resource;
    expect(game.players.find((candidate) => candidate.playerId === "capuchin")!.resources[resource]).toBe(0);

    game = collectCerradoBonus(game, "capuchin", "collect");

    expect(game.players.find((candidate) => candidate.playerId === "capuchin")!.resources[resource]).toBe(2);
    expect(game.cerradoPending).toBeNull();
    expect(game.cerradoTriggeredByPlayer.capuchin).toBe(1);
    expect(game.activeActionIndex).toBe(2);
  });

  it("lets the player skip Cerrado now and keep it available this round", () => {
    const setup = createCerradoMovementGame();
    let game = movePieceForCurrentAction(setup.game, "capuchin", setup.movedPieceId, setup.destination);
    const resource = game.cerradoPending!.resource;

    game = collectCerradoBonus(game, "capuchin", "skip");

    expect(game.players.find((candidate) => candidate.playerId === "capuchin")!.resources[resource]).toBe(1);
    expect(game.cerradoPending).toBeNull();
    expect(game.cerradoTriggeredByPlayer.capuchin).toBeUndefined();
    expect(game.activeActionIndex).toBe(2);
  });
});

describe("caatinga scenario", () => {
  it("lets a predator skip Caatinga and trigger it again later in the same round", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);
    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = {
      ...setActiveAction(game, "jaguar", 0),
      activeScenarioIds: ["caatinga"]
    };

    const jaguarPieceId = game.players.find((candidate) => candidate.playerId === "jaguar")!.piecesInForest[0]!;
    const firstRemovedPieceId = game.pieces.find(
      (piece) => piece.ownerId === "coati" && piece.location?.x === 1 && piece.location.y === 0
    )!.pieceId;

    game = moveJaguarForCurrentAction(game, "jaguar", { x: 1, y: 0 }, firstRemovedPieceId);

    expect(game.caatingaPending).toMatchObject({
      playerId: "jaguar",
      trigger: "remove",
      round: 1
    });
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(0);

    game = collectCaatingaBonus(game, "jaguar", "skip");

    expect(game.caatingaPending).toBeNull();
    expect(game.caatingaUsedByPlayer.jaguar).toBeUndefined();
    expect(game.activePlayerId).toBe("jaguar");
    expect(game.activeActionIndex).toBe(1);

    const nextTarget = getValidPieceMovementDestinations(game, "jaguar", jaguarPieceId)[0]!;
    game = {
      ...game,
      pieces: game.pieces.map((piece) =>
        piece.pieceId === firstRemovedPieceId
          ? { ...piece, location: { ...nextTarget, siteId: "main" as const } }
          : piece
      ),
      players: game.players.map((candidate) =>
        candidate.playerId === "coati"
          ? {
              ...candidate,
              piecesInForest: [...candidate.piecesInForest, firstRemovedPieceId],
              reservePieces: candidate.reservePieces.filter((pieceId) => pieceId !== firstRemovedPieceId)
            }
          : candidate
      )
    };

    game = movePieceForCurrentAction(game, "jaguar", jaguarPieceId, nextTarget, firstRemovedPieceId);

    expect(game.caatingaPending).toMatchObject({
      playerId: "jaguar",
      trigger: "remove",
      round: 1
    });

    const pendingResource = game.caatingaPending!.resource;
    const before = game.players.find((candidate) => candidate.playerId === "jaguar")!.resources[pendingResource];
    game = collectCaatingaBonus(game, "jaguar", "gain");

    expect(game.players.find((candidate) => candidate.playerId === "jaguar")!.resources[pendingResource]).toBe(before + 1);
    expect(game.caatingaUsedByPlayer.jaguar).toBe(1);
  });

  it("keeps Caatinga available after Lobo-guara adds on action D", () => {
    let game = createTestGameState("room", [player("wolf", "maned_wolf"), player("coati", "coati")]);
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: -1, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: -1 });
    game = {
      ...setActiveAction(game, "wolf", 3),
      activeScenarioIds: ["caatinga"]
    };

    const target = getWolfMeatPlacementPositions(game, "wolf")[0]!;
    game = addWolfForCurrentAction(game, "wolf", target);

    expect(game.activePlayerId).toBe("wolf");
    expect(game.activeActionIndex).toBe(3);
    expect(game.caatingaPending).toMatchObject({
      playerId: "wolf",
      trigger: "add",
      round: 1
    });

    const pendingResource = game.caatingaPending!.resource;
    game = {
      ...game,
      players: game.players.map((candidate) =>
        candidate.playerId === "wolf"
          ? { ...candidate, resources: { ...candidate.resources, [pendingResource]: Math.max(candidate.resources[pendingResource], 1) } }
          : candidate
      )
    };
    const before = game.players.find((candidate) => candidate.playerId === "wolf")!.resources[pendingResource];
    game = collectCaatingaBonus(game, "wolf", "lose");

    expect(game.players.find((candidate) => candidate.playerId === "wolf")!.resources[pendingResource]).toBe(before - 1);
    expect(game.caatingaPending).toBeNull();
    expect(game.caatingaUsedByPlayer.wolf).toBe(1);
    expect(game.activePlayerId).toBe("coati");
  });

  it("triggers Caatinga when a base species adds a piece", () => {
    let game = createTestGameState("room", [player("capuchin", "capuchin"), player("coati", "coati")]);
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 1, y: 0 });
    game = placeInitialPiece(game, "capuchin", { x: 0, y: 1 });
    game = {
      ...setActiveAction(game, "capuchin", 0),
      activeScenarioIds: ["caatinga"]
    };

    const cardId = game.players.find((candidate) => candidate.playerId === "capuchin")?.hand[0];
    game = placeForestCard(game, "capuchin", cardId!, { x: 2, y: 0 });
    game = addCapuchinForCurrentAction(game, "capuchin", { x: 2, y: 0 });

    expect(game.caatingaPending).toMatchObject({
      playerId: "capuchin",
      trigger: "add",
      round: 1
    });
    expect(game.activePlayerId).toBe("capuchin");
    expect(game.activeActionIndex).toBe(0);

    game = collectCaatingaBonus(game, "capuchin", "skip");

    expect(game.caatingaPending).toBeNull();
    expect(game.activePlayerId).toBe("capuchin");
    expect(game.activeActionIndex).toBe(1);
  });

  it("triggers Caatinga when Quati adds a piece", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);
    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = {
      ...game,
      activeScenarioIds: ["caatinga"]
    };

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    const target = getCoatiFruitPlacementPositions(game, "coati").find(
      (position) =>
        !game.pieces.some(
          (piece) => piece.ownerId === "coati" && piece.location?.x === position.x && piece.location.y === position.y
        )
    );
    expect(target).toBeTruthy();

    game = addCoatiForCurrentAction(game, "coati", target!);

    expect(game.caatingaPending).toMatchObject({
      playerId: "coati",
      trigger: "add",
      round: 1
    });
    expect(game.activePlayerId).toBe("coati");
    expect(game.activeActionIndex).toBe(0);

    game = collectCaatingaBonus(game, "coati", "skip");

    expect(game.caatingaPending).toBeNull();
    expect(game.activePlayerId).toBe("coati");
    expect(game.activeActionIndex).toBe(1);
  });

  it("keeps Quati pair bonus pending after resolving Caatinga from an add", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);
    const fruitTarget = getForestPositionsWithResource(game, "fruit")[0]!;
    const secondCoatiTarget = getForestPositionsWithResource(game, "fruit").find(
      (position) => position.x !== fruitTarget.x || position.y !== fruitTarget.y
    )!;

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", fruitTarget);
    game = placeInitialPiece(game, "coati", secondCoatiTarget);
    game = {
      ...game,
      activeScenarioIds: ["caatinga"]
    };

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    expect(getCoatiFruitPlacementPositions(game, "coati")).toContainEqual(fruitTarget);

    game = addCoatiForCurrentAction(game, "coati", fruitTarget);

    expect(game.caatingaPending).toMatchObject({
      playerId: "coati",
      trigger: "add",
      round: 1
    });
    expect(game.pendingCoatiPairBonus).toMatchObject({
      playerId: "coati"
    });
    expect(game.activeActionIndex).toBe(0);

    game = collectCaatingaBonus(game, "coati", "gain");

    expect(game.caatingaPending).toBeNull();
    expect(game.pendingCoatiPairBonus).toMatchObject({
      playerId: "coati"
    });
    expect(game.activePlayerId).toBe("coati");
    expect(game.activeActionIndex).toBe(0);
  });

  it("triggers Caatinga when a base species removes a piece", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);
    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });

    const coati = game.players.find((candidate) => candidate.playerId === "coati");
    const extraPieceIds = coati!.reservePieces.slice(0, 5);
    const nextCards = [
      { x: -2, y: -1 },
      { x: -2, y: 0 },
      { x: -2, y: 1 },
      { x: -1, y: -2 },
      { x: 0, y: -2 }
    ];

    game = {
      ...game,
      players: game.players.map((candidate) =>
        candidate.playerId === "coati"
          ? {
              ...candidate,
              reservePieces: candidate.reservePieces.filter((pieceId) => !extraPieceIds.includes(pieceId)),
              piecesInForest: [...candidate.piecesInForest, ...extraPieceIds]
            }
          : candidate
      ),
      pieces: game.pieces.map((piece) => {
        const extraIndex = extraPieceIds.indexOf(piece.pieceId);
        return extraIndex >= 0 ? { ...piece, location: { ...nextCards[extraIndex], siteId: "main" as const } } : piece;
      })
    };

    const cardId = game.players.find((candidate) => candidate.playerId === "coati")?.hand[0];
    const movedPieceId = game.players.find((candidate) => candidate.playerId === "coati")?.piecesInForest[0];
    game = placeForestCard(game, "coati", cardId!, { x: 2, y: 0 });
    game = addCoatiForCurrentAction(game, "coati", { x: 2, y: 0 });
    game = movePieceForCurrentAction(game, "coati", movedPieceId!, { x: 2, y: 0 });
    game = {
      ...game,
      activeScenarioIds: ["caatinga"]
    };

    const removalIds = game.players.find((candidate) => candidate.playerId === "coati")!.piecesInForest.slice(0, 2);
    game = removePiecesForCurrentAction(game, "coati", removalIds);

    expect(game.caatingaPending).toMatchObject({
      playerId: "coati",
      trigger: "remove",
      round: 1
    });
    expect(game.activePlayerId).toBe("coati");
    expect(game.activeActionIndex).toBe(2);

    game = collectCaatingaBonus(game, "coati", "skip");

    expect(game.caatingaPending).toBeNull();
    expect(game.activePlayerId).toBe("jaguar");
  });
});

describe("threat mini expansion", () => {
  it("reveals one threat when round one starts", () => {
    let game = createInitialGameState(
      "threats",
      [player("jaguar", "jaguar"), player("wolf", "maned_wolf")],
      () => 0,
      createPreviewInitialForest(),
      { enabledMiniExpansions: ["threats"] }
    );

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });

    expect(game.status).toBe("active");
    expect(game.activeThreatCardId).not.toBeNull();
    expect(game.threatDeckIds).toHaveLength(7);
    expect(game.threatDiscardIds).toHaveLength(0);
  });

  it("keeps the same threat during a round and draws a fresh one for the next round", () => {
    let game = createInitialGameState(
      "threats",
      [player("jaguar", "jaguar"), player("wolf", "maned_wolf")],
      () => 0,
      createPreviewInitialForest(),
      { enabledMiniExpansions: ["threats"] }
    );

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });

    const roundOneThreat = game.activeThreatCardId;
    expect(roundOneThreat).not.toBeNull();
    expect(game.round).toBe(1);

    game = forceEndPlayerTurn(game, game.activePlayerId!, "teste");

    expect(game.round).toBe(1);
    expect(game.activeThreatCardId).toBe(roundOneThreat);
    expect(game.threatDeckIds).toHaveLength(7);
    expect(game.threatDiscardIds).toHaveLength(0);

    game = forceEndPlayerTurn(game, game.activePlayerId!, "teste");

    expect(game.round).toBe(2);
    expect(game.activeThreatCardId).not.toBe(roundOneThreat);
    expect(game.threatDeckIds).toHaveLength(6);
    expect(game.threatDiscardIds).toEqual([roundOneThreat]);
  });

  it("uses at most one unique threat per round", () => {
    let game = createInitialGameState(
      "threats",
      [player("jaguar", "jaguar"), player("wolf", "maned_wolf")],
      () => 0,
      createPreviewInitialForest(),
      { enabledMiniExpansions: ["threats"] }
    );

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });

    const seen = new Set<string>();
    while (game.status === "active" && game.round <= game.maxRounds) {
      if (game.activeThreatCardId) {
        seen.add(game.activeThreatCardId);
      }
      game = forceEndPlayerTurn(game, game.activePlayerId!, "teste");
      if (game.cacaIlegalPending) {
        const pendingPlayerId = game.cacaIlegalPending.playerId;
        const topResources = getCacaIlegalTopResources(game, pendingPlayerId);
        if (topResources.length > 0) {
          game = resolveCacaIlegal(game, pendingPlayerId, { kind: "spend_resource", resource: topResources[0] });
        } else {
          game = resolveCacaIlegal(game, pendingPlayerId, {
            kind: "remove_piece",
            pieceId: getCacaIlegalRemovablePieceIds(game, pendingPlayerId)[0]!
          });
        }
      }
    }

    expect(seen.size).toBe(5);
    expect(game.status).toBe("finished");
    expect(game.threatDeckIds).toHaveLength(3);
  });

  it("removes Enchente from the threat deck when Pampa is active", () => {
    let game = createInitialGameState(
      "pampa-threats",
      [player("jaguar", "jaguar"), player("wolf", "maned_wolf")],
      () => 0,
      createPreviewInitialForest(),
      { enabledMiniExpansions: ["threats", "scenarios"], activeScenarioIds: ["pampa"] }
    );

    expect(game.threatDeckIds).not.toContain("threat_6");
    expect(game.threatDeckIds).toHaveLength(7);

    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });

    const revealed = new Set<string>();
    while (game.status === "active" && game.round <= game.maxRounds) {
      if (game.activeThreatCardId) {
        revealed.add(game.activeThreatCardId);
      }
      game = forceEndPlayerTurn(game, game.activePlayerId!, "teste");
      if (game.cacaIlegalPending) {
        const pendingPlayerId = game.cacaIlegalPending.playerId;
        const removablePieceId = getCacaIlegalRemovablePieceIds(game, pendingPlayerId)[0];
        game = removablePieceId
          ? resolveCacaIlegal(game, pendingPlayerId, { kind: "remove_piece", pieceId: removablePieceId })
          : resolveCacaIlegal(game, pendingPlayerId, {
              kind: "spend_resource",
              resource: getCacaIlegalTopResources(game, pendingPlayerId)[0]!
            });
      }
    }

    expect(revealed).not.toContain("threat_6");
  });

  it("pauses at end of turn for Caca ilegal and lets tied top resources be chosen", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("wolf", "maned_wolf")]);
    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = {
      ...setActiveAction(game, "wolf", 3),
      activeThreatCardId: "threat_4",
      players: game.players.map((candidate) =>
        candidate.playerId === "wolf"
          ? { ...candidate, resources: { meat: 2, egg: 2, fruit: 1, seed: 0 } }
          : candidate
      )
    };

    game = forceEndPlayerTurn(game, "wolf", "teste");

    expect(game.activePlayerId).toBe("wolf");
    expect(game.cacaIlegalPending).toEqual({ playerId: "wolf" });
    expect(getCacaIlegalTopResources(game, "wolf")).toEqual(["meat", "egg"]);

    game = resolveCacaIlegal(game, "wolf", { kind: "spend_resource", resource: "egg" });

    expect(game.players.find((candidate) => candidate.playerId === "wolf")?.resources).toEqual({
      meat: 2,
      egg: 1,
      fruit: 1,
      seed: 0
    });
    expect(game.cacaIlegalPending).toBeNull();
    expect(game.activePlayerId).toBe("jaguar");
  });

  it("lets Caca ilegal remove one own piece from the board", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("wolf", "maned_wolf")]);
    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = {
      ...setActiveAction(game, "wolf", 3),
      activeThreatCardId: "threat_4",
      players: game.players.map((candidate) =>
        candidate.playerId === "wolf"
          ? { ...candidate, resources: { meat: 0, egg: 0, fruit: 0, seed: 0 } }
          : candidate
      )
    };
    game = forceEndPlayerTurn(game, "wolf", "teste");
    const removable = getCacaIlegalRemovablePieceIds(game, "wolf");

    expect(removable).toHaveLength(2);

    game = resolveCacaIlegal(game, "wolf", { kind: "remove_piece", pieceId: removable[0] });

    expect(game.pieces.find((piece) => piece.pieceId === removable[0])?.location).toBeNull();
    expect(game.players.find((candidate) => candidate.playerId === "wolf")?.piecesInForest).not.toContain(removable[0]);
    expect(game.players.find((candidate) => candidate.playerId === "wolf")?.reservePieces).toContain(removable[0]);
    expect(game.activePlayerId).toBe("jaguar");
  });

  it("does not let the Jaguar remove its only piece for Caca ilegal", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("wolf", "maned_wolf")]);
    game = placeInitialPiece(game, "jaguar", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 0, y: 0 });
    game = placeInitialPiece(game, "wolf", { x: 1, y: 0 });
    game = {
      ...setActiveAction(game, "jaguar", 1),
      activeThreatCardId: "threat_4",
      players: game.players.map((candidate) =>
        candidate.playerId === "jaguar"
          ? { ...candidate, resources: { meat: 1, egg: 0, fruit: 0, seed: 0 } }
          : candidate
      )
    };

    game = forceEndPlayerTurn(game, "jaguar", "teste");

    expect(game.cacaIlegalPending).toEqual({ playerId: "jaguar" });
    expect(getCacaIlegalRemovablePieceIds(game, "jaguar")).toEqual([]);
    expect(() =>
      resolveCacaIlegal(game, "jaguar", { kind: "remove_piece", pieceId: "jaguar_piece_1" })
    ).toThrow("Onca");

    game = resolveCacaIlegal(game, "jaguar", { kind: "spend_resource", resource: "meat" });

    expect(game.players.find((candidate) => candidate.playerId === "jaguar")?.resources.meat).toBe(0);
    expect(game.activePlayerId).toBe("wolf");
  });

  it("makes Desmatamento replace an existing forest card instead of expanding", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);
    game = placeInitialPiece(game, "jaguar", { x: -1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = {
      ...game,
      activeThreatCardId: "threat_2",
      players: game.players.map((candidate) =>
        candidate.playerId === "coati" ? { ...candidate, hand: ["bosque_1"] } : candidate
      )
    };

    const beforeCount = game.forest.cards.length;
    expect(getAvailableForestExpansionPositionsForCard(game, "bosque_1")).toContainEqual({ x: -1, y: -1 });

    game = placeForestCard(game, "coati", "bosque_1", { x: -1, y: -1 });

    expect(game.forest.cards).toHaveLength(beforeCount);
    expect(game.forest.cards.find((card) => card.x === -1 && card.y === -1)?.definitionId).toBe("bosque_1");
    expect(game.pieces.find((piece) => piece.pieceId === "jaguar_piece_1")?.location).toEqual({
      x: -1,
      y: -1,
      siteId: "main"
    });
    expect(game.players.find((candidate) => candidate.playerId === "coati")?.hand).not.toContain("bosque_1");
    expect(game.log.at(-1)?.message).toContain("Desmatamento");
  });

  it("does not let Desmatamento place into an empty expansion slot", () => {
    let game = createTestGameState("room", [player("jaguar", "jaguar"), player("coati", "coati")]);
    game = placeInitialPiece(game, "jaguar", { x: -1, y: -1 });
    game = placeInitialPiece(game, "coati", { x: 0, y: 0 });
    game = placeInitialPiece(game, "coati", { x: 1, y: 0 });
    game = {
      ...game,
      activeThreatCardId: "threat_2",
      players: game.players.map((candidate) =>
        candidate.playerId === "coati" ? { ...candidate, hand: ["bosque_1"] } : candidate
      )
    };

    expect(() => placeForestCard(game, "coati", "bosque_1", { x: -2, y: -1 })).toThrow("Desmatamento");
  });
});

function setActiveAction(game: ReturnType<typeof createInitialGameState>, playerId: string, actionIndex: number) {
  return {
    ...game,
    status: "active" as const,
    activePlayerId: playerId,
    activeActionIndex: actionIndex,
    activePlayedForestCardId: null,
    pendingCoatiPairBonus: null,
    pendingMacawMovedPiece: null,
    pendingJaguarRemoval: null,
    pendingGaloInterrupt: null,
    pendingWolfMoves: null
  };
}

function addTestForestCard(game: ReturnType<typeof createInitialGameState>, location: { x: number; y: number }) {
  return {
    ...game,
    forest: {
      cards: [
        ...game.forest.cards,
        {
          instanceId: `test_card_${location.x}_${location.y}`,
          definitionId: "bosque_1",
          x: location.x,
          y: location.y,
          rotation: 0 as const,
          isInitial: false
        }
      ]
    }
  };
}

function getResourceAt(game: ReturnType<typeof createInitialGameState>, location: { x: number; y: number }) {
  const card = game.forest.cards.find((candidate) => candidate.x === location.x && candidate.y === location.y);
  return [...commonForestCards, ...initialForestCardCandidates].find((candidate) => candidate.id === card?.definitionId)?.resource ?? null;
}

function countBy<T>(items: T[], getKey: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((totals, item) => {
    const key = getKey(item);
    totals[key] = (totals[key] ?? 0) + 1;
    return totals;
  }, {});
}

function countResources(cards: typeof commonForestCards): Record<string, number> {
  return cards.reduce<Record<string, number>>((totals, card) => {
    for (const resource of card.resources) {
      totals[resource] = (totals[resource] ?? 0) + 1;
    }

    return totals;
  }, {});
}
