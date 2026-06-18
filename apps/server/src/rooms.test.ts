import { beforeEach, describe, expect, it, vi } from "vitest";
import { forestCardsById } from "@oikos/content";
import { getGaloInterruptMoveTargets } from "@oikos/rules";

vi.mock("./store", () => ({
  deleteRoom: vi.fn(),
  loadRooms: () => []
}));

import { deleteRoom } from "./store";
import {
  addBots,
  createRoom,
  joinRoom,
  leaveRooms,
  listOpenRooms,
  movePiece,
  placeSetupPiece,
  quitRoom,
  resolveGaloInterrupt,
  selectSpecies,
  setScenarioCount,
  setReady,
  startGame
} from "./rooms";

describe("room lifecycle", () => {
  beforeEach(() => {
    vi.mocked(deleteRoom).mockClear();
  });

  it("removes abandoned hosted lobbies before enforcing the room limit", () => {
    const hostId = "host-with-abandoned-lobbies";
    const abandonedRooms = Array.from({ length: 4 }, () => createRoom(hostId, "Host"));

    leaveRooms(hostId);

    expect(listOpenRooms().filter((room) => abandonedRooms.some((abandoned) => abandoned.roomId === room.roomId))).toEqual([]);

    const replacement = createRoom(hostId, "Host");

    expect(vi.mocked(deleteRoom).mock.calls.map(([roomId]) => roomId)).toEqual(
      expect.arrayContaining(abandonedRooms.map((room) => room.roomId))
    );

    quitRoom(replacement.roomId, hostId);
  });

  it("replaces an empty hosted lobby even while another socket keeps the host connected", () => {
    const hostId = "host-replacing-empty-lobby";
    const first = createRoom(hostId, "Host");
    const replacement = createRoom(hostId, "Host");

    expect(listOpenRooms().some((room) => room.roomId === first.roomId)).toBe(false);
    expect(listOpenRooms().some((room) => room.roomId === replacement.roomId)).toBe(true);
    expect(deleteRoom).toHaveBeenCalledWith(first.roomId);

    quitRoom(replacement.roomId, hostId);
  });

  it("removes a disconnected bot setup before any piece was placed", () => {
    const hostId = "host-with-pristine-setup";
    const setupRoom = createRoom(hostId, "Host");
    selectSpecies(setupRoom.roomId, hostId, "jaguar");
    addBots(setupRoom.roomId, hostId);
    setReady(setupRoom.roomId, hostId, true);
    startGame(setupRoom.roomId, hostId);
    leaveRooms(hostId);

    const replacement = createRoom(hostId, "Host");

    expect(deleteRoom).toHaveBeenCalledWith(setupRoom.roomId);
    quitRoom(replacement.roomId, hostId);
  });

  it("still limits four connected rooms for the same host", () => {
    const hostId = "host-with-active-lobbies";
    const activeRooms = Array.from({ length: 4 }, (_, index) => {
      const room = createRoom(hostId, "Host");
      joinRoom(room.roomId, `guest-${index}`, `Guest ${index}`);
      return room;
    });

    expect(() => createRoom(hostId, "Host")).toThrow("Você já tem 4 salas abertas.");

    for (const room of activeRooms) {
      quitRoom(room.roomId, hostId);
    }
  });

  it("deletes the persisted lobby when its last human quits", () => {
    const hostId = "host-quitting-lobby";
    const room = createRoom(hostId, "Host");

    expect(quitRoom(room.roomId.toLowerCase(), hostId)).toBeNull();
    expect(deleteRoom).toHaveBeenCalledWith(room.roomId);
  });

  it("allows the host to configure two scenarios", () => {
    const hostId = "host-with-two-scenarios";
    const room = createRoom(hostId, "Host");

    const updated = setScenarioCount(room.roomId, hostId, 2);

    expect(updated.scenarioCount).toBe(2);
    quitRoom(room.roomId, hostId);
  });

  it("resolves the Galo-de-campina between-turn move through the online room API", () => {
    const hostId = "online-galo-host";
    const guestId = "online-coati-guest";
    let room = createRoom(hostId, "Galo");
    room = joinRoom(room.roomId, guestId, "Coati");
    room = selectSpecies(room.roomId, hostId, "galo_de_campina");
    room = selectSpecies(room.roomId, guestId, "coati");
    room = setReady(room.roomId, hostId, true);
    room = setReady(room.roomId, guestId, true);
    room = startGame(room.roomId, hostId);

    const cards = room.game!.forest.cards;
    const hasCardAt = (position: { x: number; y: number }) =>
      cards.some((card) => card.x === position.x && card.y === position.y);
    const diagonalPositions = (position: { x: number; y: number }) => [
      { x: position.x - 1, y: position.y - 1 },
      { x: position.x + 1, y: position.y - 1 },
      { x: position.x - 1, y: position.y + 1 },
      { x: position.x + 1, y: position.y + 1 }
    ];
    const adjacentPositions = (position: { x: number; y: number }) => [
      { x: position.x, y: position.y - 1 },
      { x: position.x + 1, y: position.y },
      { x: position.x, y: position.y + 1 },
      { x: position.x - 1, y: position.y }
    ];
    const fieldCard = cards.find((card) => {
      const definition = forestCardsById.get(card.definitionId);
      const position = { x: card.x, y: card.y };
      return (
        definition?.habitat === "field" &&
        diagonalPositions(position).some(hasCardAt) &&
        adjacentPositions(position).some(hasCardAt)
      );
    })!;
    const fieldPosition = { x: fieldCard.x, y: fieldCard.y };
    const coatiOrigin = diagonalPositions(fieldPosition).find(hasCardAt)!;
    const usedPositions = new Set([`${fieldPosition.x}:${fieldPosition.y}`, `${coatiOrigin.x}:${coatiOrigin.y}`]);
    const takeUnusedPosition = () => {
      const card = cards.find((candidate) => !usedPositions.has(`${candidate.x}:${candidate.y}`))!;
      usedPositions.add(`${card.x}:${card.y}`);
      return { x: card.x, y: card.y };
    };
    const setupPositions: Record<string, Array<{ x: number; y: number }>> = {
      [hostId]: [
        fieldPosition,
        takeUnusedPosition(),
        takeUnusedPosition()
      ],
      [guestId]: [
        coatiOrigin,
        takeUnusedPosition()
      ]
    };

    while (room.game?.status === "setup") {
      const playerId = room.game.setupActivePlayerId!;
      const position = setupPositions[playerId]!.shift()!;
      room = placeSetupPiece(room.roomId, playerId, position.x, position.y);
    }

    room.game!.activePlayerId = guestId;
    room.game!.activeActionIndex = 1;
    room.game!.activePlayedForestCardId = "campo_2";

    const coatiPieceId = room.game!.pieces.find(
      (piece) => piece.ownerId === guestId && piece.location?.x === coatiOrigin.x && piece.location.y === coatiOrigin.y
    )!.pieceId;
    const galoPieceId = room.game!.pieces.find(
      (piece) => piece.ownerId === hostId && piece.location?.x === fieldPosition.x && piece.location.y === fieldPosition.y
    )!.pieceId;
    const seedBefore = room.game!.players.find((player) => player.playerId === guestId)!.resources.seed;

    room = movePiece(room.roomId, guestId, coatiPieceId, fieldPosition.x, fieldPosition.y);

    expect(room.game?.pendingGaloInterrupt).toEqual({
      ownerId: hostId,
      location: fieldPosition,
      interruptedPlayerId: guestId
    });

    const interruptTarget = getGaloInterruptMoveTargets(room.game!, hostId, galoPieceId)[0]!;
    room = resolveGaloInterrupt(room.roomId, hostId, interruptTarget.x, interruptTarget.y, galoPieceId);

    expect(room.game?.pendingGaloInterrupt).toBeNull();
    expect(room.game?.pieces.find((piece) => piece.pieceId === galoPieceId)?.location).toMatchObject(interruptTarget);
    expect(room.game?.players.find((player) => player.playerId === guestId)?.resources.seed).toBe(seedBefore + 1);

    leaveRooms(hostId);
    leaveRooms(guestId);
  });
});
