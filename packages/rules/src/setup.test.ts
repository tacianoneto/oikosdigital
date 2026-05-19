import { describe, expect, it } from "vitest";
import { commonForestCards, initialForestCardCandidates } from "@oikos/content";
import type { RoomPlayer } from "@oikos/shared";
import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  completeCurrentAction,
  createInitialGameState,
  createPreviewInitialForest,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getAvailableForestExpansionPositionsForCard,
  getArmadilloHidePieceIds,
  getArmadilloSeedPlacementPositions,
  getArmadilloShareScore,
  getCapuchinHabitatScore,
  getCapuchinPlacementPositions,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getRequiredCoatiRemovalCount,
  getForestPositionsWithResource,
  getForestSiteOccupancy,
  getForestSitesAtPosition,
  getMacawActionCTargets,
  getMacawEggPlacementPositions,
  getMacawLineScore,
  getMacawRelocatablePieceIds,
  getValidPieceMovementDestinations,
  getWolfMeatPlacementPositions,
  getWolfRemovableBasePieceIds,
  getWolfSpendableResourceTypes,
  getAvailableForestExpansionPositions,
  moveJaguarForCurrentAction,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece,
  removeBasePieceForWolfAction,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing,
  scoreCapuchinHabitatPresence,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints
} from "./setup";

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
  return createInitialGameState(gameId, roomPlayers, () => 0.999999, createPreviewInitialForest());
}

describe("setup placement", () => {
  it("has habitat and resource metadata for every forest card", () => {
    expect(commonForestCards).toHaveLength(36);
    expect(initialForestCardCandidates).toHaveLength(14);
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
      river: 8
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
      meat: 4,
      seed: 5
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

    game = scoreCapuchinHabitatPresence(game, "capuchin");

    expect(game.players.find((candidate) => candidate.playerId === "capuchin")?.score).toBe(1);
    expect(game.players.find((candidate) => candidate.playerId === "capuchin")?.turnsTaken).toBe(1);
    expect(game.activePlayerId).toBe("coati");
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

    game = addMacawForCurrentAction(game, "macaw", addTarget);

    expect(game.players.find((candidate) => candidate.playerId === "macaw")?.reservePieces).toHaveLength(reserveBefore - 1);
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

    game = movePieceForCurrentAction(game, "macaw", relocatedPieceId, relocationTarget);

    expect(game.pieces.find((piece) => piece.pieceId === relocatedPieceId)?.location).toEqual({ ...relocationTarget, siteId: "main" });
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

    game = scoreMacawLines(game, "macaw");

    expect(game.players.find((candidate) => candidate.playerId === "macaw")?.score).toBe(1);
    expect(game.players.find((candidate) => candidate.playerId === "macaw")?.turnsTaken).toBe(1);
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
    game = addWolfForCurrentAction(game, "wolf", target);

    const wolf = game.players.find((candidate) => candidate.playerId === "wolf");
    expect(wolf?.reservePieces).toHaveLength(reserveBefore - 1);
    expect(game.pieces.filter((piece) => piece.ownerId === "wolf" && piece.location?.x === target.x && piece.location.y === target.y)).toHaveLength(1);
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

function setActiveAction(game: ReturnType<typeof createInitialGameState>, playerId: string, actionIndex: number) {
  return {
    ...game,
    status: "active" as const,
    activePlayerId: playerId,
    activeActionIndex: actionIndex,
    activePlayedForestCardId: null,
    pendingCoatiPairBonus: null,
    pendingMacawMovedPiece: null,
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
