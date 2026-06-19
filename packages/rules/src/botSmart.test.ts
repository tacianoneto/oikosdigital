import { describe, expect, it } from "vitest";
import type { ForestCardState, GridPosition, Resource, RoomPlayer } from "@oikos/shared";
import { createInitialGameState } from "./createGame";
import { playBotStep, playRandomStep } from "./bots";

function player(playerId: string, speciesId: RoomPlayer["speciesId"]): RoomPlayer {
  return {
    playerId,
    name: playerId,
    speciesId,
    ready: true,
    connected: true,
    isBot: true
  };
}

interface JaguarTarget {
  definitionId: string;
  position: GridPosition;
  prey?: boolean;
}

const resourceCards: Record<Resource, string> = {
  meat: "initial_7",
  egg: "initial_2",
  fruit: "initial_5",
  seed: "initial_6"
};

function runJaguarChoice(targets: JaguarTarget[], resources: Record<Resource, number> = { meat: 0, egg: 0, fruit: 0, seed: 0 }) {
  const origin = { x: 0, y: 0 };
  const forest: ForestCardState[] = [
    { instanceId: "origin", definitionId: "initial_2", x: origin.x, y: origin.y, rotation: 0, isInitial: true },
    ...targets.map((target, index) => ({
      instanceId: `target_${index}`,
      definitionId: target.definitionId,
      x: target.position.x,
      y: target.position.y,
      rotation: 0 as const,
      isInitial: true
    }))
  ];
  const preyPieceIds = targets.map((_, index) => `prey_piece_${index + 1}`);
  const placedPreyIds = targets.flatMap((target, index) => (target.prey ? [preyPieceIds[index]!] : []));
  let game = createInitialGameState("jaguar-bot", [player("jaguar", "jaguar"), player("prey", "coati")], () => 0.999999, forest);

  game = {
    ...game,
    status: "active",
    activePlayerId: "jaguar",
    activeActionIndex: 0,
    activePlayedForestCardId: null,
    players: game.players.map((candidate) => {
      if (candidate.playerId === "jaguar") {
        return {
          ...candidate,
          resources,
          reservePieces: candidate.reservePieces.filter((pieceId) => pieceId !== "jaguar_piece_1"),
          piecesInForest: ["jaguar_piece_1"]
        };
      }

      return {
        ...candidate,
        reservePieces: candidate.reservePieces.filter((pieceId) => !placedPreyIds.includes(pieceId)),
        piecesInForest: placedPreyIds
      };
    }),
    pieces: game.pieces.map((piece) => {
      if (piece.pieceId === "jaguar_piece_1") {
        return { ...piece, location: { ...origin, siteId: "main" } };
      }

      const preyIndex = preyPieceIds.indexOf(piece.pieceId);
      if (preyIndex >= 0 && targets[preyIndex]?.prey) {
        const position = targets[preyIndex]!.position;
        return { ...piece, location: { ...position, siteId: "main" } };
      }

      return piece;
    })
  };

  return playBotStep(game, "jaguar");
}

describe("smart Jaguar bot", () => {
  it.each([
    {
      name: "prey plus meat before prey plus seed",
      targets: [
        { position: { x: 0, y: -1 }, definitionId: resourceCards.seed, prey: true },
        { position: { x: -1, y: 0 }, definitionId: resourceCards.meat, prey: true },
        { position: { x: 1, y: 0 }, definitionId: resourceCards.meat }
      ],
      resources: { meat: 0, egg: 0, fruit: 0, seed: 0 },
      expected: { x: -1, y: 0 }
    },
    {
      name: "prey plus seed before prey plus dominant resource",
      targets: [
        { position: { x: 0, y: -1 }, definitionId: resourceCards.fruit, prey: true },
        { position: { x: -1, y: 0 }, definitionId: resourceCards.seed, prey: true }
      ],
      resources: { meat: 0, egg: 0, fruit: 5, seed: 0 },
      expected: { x: -1, y: 0 }
    },
    {
      name: "prey plus dominant resource before prey plus any resource",
      targets: [
        { position: { x: 0, y: -1 }, definitionId: resourceCards.egg, prey: true },
        { position: { x: -1, y: 0 }, definitionId: resourceCards.fruit, prey: true }
      ],
      resources: { meat: 0, egg: 1, fruit: 5, seed: 0 },
      expected: { x: -1, y: 0 }
    },
    {
      name: "prey plus any resource before meat without prey",
      targets: [
        { position: { x: 0, y: -1 }, definitionId: resourceCards.meat },
        { position: { x: -1, y: 0 }, definitionId: resourceCards.egg, prey: true }
      ],
      resources: { meat: 0, egg: 0, fruit: 0, seed: 0 },
      expected: { x: -1, y: 0 }
    },
    {
      name: "meat resource when no prey is available",
      targets: [
        { position: { x: 0, y: -1 }, definitionId: resourceCards.seed },
        { position: { x: -1, y: 0 }, definitionId: resourceCards.meat }
      ],
      resources: { meat: 0, egg: 0, fruit: 0, seed: 0 },
      expected: { x: -1, y: 0 }
    }
  ])("$name", ({ targets, resources, expected }) => {
    const game = runJaguarChoice(targets, resources);

    expect(game.pieces.find((piece) => piece.pieceId === "jaguar_piece_1")?.location).toMatchObject(expected);
  });
});

describe("forest-card bot fallback", () => {
  function createBlockedExpansionGame() {
    const game = createInitialGameState("blocked-expansion", [player("capuchin", "capuchin"), player("coati", "coati")]);
    return {
      ...game,
      status: "active" as const,
      activePlayerId: "capuchin",
      activeActionIndex: 0,
      activePlayedForestCardId: null,
      mataAtlanticaPiles: null,
      players: game.players.map((candidate) =>
        candidate.playerId === "capuchin" ? { ...candidate, hand: [] } : candidate
      )
    };
  }

  it("smart bot skips action A instead of throwing when no forest card can be placed", () => {
    const game = playBotStep(createBlockedExpansionGame(), "capuchin");

    expect(game.activePlayerId).toBe("capuchin");
    expect(game.activeActionIndex).toBe(1);
    expect(game.log.some((entry) => entry.payload?.kind === "skip" && entry.payload.actionId === "A")).toBe(true);
  });

  it("random bot skips action A instead of throwing when no forest card can be placed", () => {
    const game = playRandomStep(createBlockedExpansionGame(), "capuchin");

    expect(game.activePlayerId).toBe("capuchin");
    expect(game.activeActionIndex).toBe(1);
    expect(game.log.some((entry) => entry.payload?.kind === "skip" && entry.payload.actionId === "A")).toBe(true);
  });
});
