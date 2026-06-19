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
  addBotForSpecies,
  advanceBot,
  createRoom,
  joinRoom,
  leaveRoom,
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

  it("still limits six connected rooms for the same host", () => {
    const hostId = "host-with-active-lobbies";
    const activeRooms = Array.from({ length: 6 }, (_, index) => {
      const room = createRoom(hostId, "Host");
      joinRoom(room.roomId, `guest-${index}`, `Guest ${index}`);
      return room;
    });

    expect(() => createRoom(hostId, "Host")).toThrow("Você já tem 6 salas abertas.");

    for (const room of activeRooms) {
      quitRoom(room.roomId, hostId);
    }
  });

  it("closes a started room immediately when the last human leaves", () => {
    const hostId = "host-leaving-started-room";
    const room = createRoom(hostId, "Host");
    selectSpecies(room.roomId, hostId, "jaguar");
    addBots(room.roomId, hostId);
    setReady(room.roomId, hostId, true);
    startGame(room.roomId, hostId);

    leaveRoom(room.roomId, hostId);

    expect(deleteRoom).toHaveBeenCalledWith(room.roomId);
    expect(listOpenRooms().some((open) => open.roomId === room.roomId)).toBe(false);
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
    const guestResourcesBefore = { ...room.game!.players.find((player) => player.playerId === guestId)!.resources };
    const fieldResource = forestCardsById.get(fieldCard.definitionId)?.resource;
    expect(fieldResource).toBeTruthy();

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
    expect(room.game?.players.find((player) => player.playerId === guestId)?.resources[fieldResource!]).toBe(
      guestResourcesBefore[fieldResource!] + 1
    );

    leaveRooms(hostId);
    leaveRooms(guestId);
  });

  it("queues human Galo interrupt online after Onca removes a piece and a galo remains", () => {
    const jaguarId = "online-jaguar-host";
    const galoId = "online-galo-guest";
    let room = createRoom(jaguarId, "Onca");
    room = joinRoom(room.roomId, galoId, "Galo");
    room = selectSpecies(room.roomId, jaguarId, "jaguar");
    room = selectSpecies(room.roomId, galoId, "galo_de_campina");
    room = setReady(room.roomId, jaguarId, true);
    room = setReady(room.roomId, galoId, true);
    room = startGame(room.roomId, jaguarId);
    const setup = placeOncaBesideGaloField(room, jaguarId, galoId);
    room = setup.room;

    room.game!.activePlayerId = jaguarId;
    room.game!.activeActionIndex = 0;

    expect(() => movePiece(room.roomId, jaguarId, setup.jaguarPieceId, setup.field.x, setup.field.y)).toThrow(
      "Escolha qual peca a Onca deve remover no local de entrada."
    );

    room = movePiece(room.roomId, jaguarId, setup.jaguarPieceId, setup.field.x, setup.field.y, setup.remainingGaloId);

    expect(room.game?.pendingGaloInterrupt).toEqual({
      ownerId: galoId,
      location: setup.field,
      interruptedPlayerId: jaguarId
    });
    expect(room.game?.pendingJaguarRemoval).toBeNull();
    expect(room.game?.pieces.find((piece) => piece.pieceId === setup.remainingGaloId)?.location).toBeNull();

    const interruptTarget = getGaloInterruptMoveTargets(room.game!, galoId, setup.movingGaloId)[0]!;
    room = resolveGaloInterrupt(room.roomId, galoId, interruptTarget.x, interruptTarget.y, setup.movingGaloId);

    expect(room.game?.pendingGaloInterrupt).toBeNull();
    expect(room.game?.pendingJaguarRemoval).toBeNull();
    expect(room.game?.activePlayerId).toBe(jaguarId);
    expect(room.game?.activeActionIndex).toBe(1);

    leaveRooms(jaguarId);
    leaveRooms(galoId);
  });

  it("advances a bot Galo interrupt online after human Onca removes a piece", () => {
    const jaguarId = "online-jaguar-vs-galo-bot";
    const galoId = "bot_galo_de_campina";
    let room = createRoom(jaguarId, "Onca");
    room = selectSpecies(room.roomId, jaguarId, "jaguar");
    room = addBotForSpecies(room.roomId, jaguarId, "galo_de_campina");
    room = setReady(room.roomId, jaguarId, true);
    room = startGame(room.roomId, jaguarId);
    const setup = placeOncaBesideGaloField(room, jaguarId, galoId);
    room = setup.room;

    room.game!.activePlayerId = jaguarId;
    room.game!.activeActionIndex = 0;

    expect(() => movePiece(room.roomId, jaguarId, setup.jaguarPieceId, setup.field.x, setup.field.y)).toThrow(
      "Escolha qual peca a Onca deve remover no local de entrada."
    );

    room = movePiece(room.roomId, jaguarId, setup.jaguarPieceId, setup.field.x, setup.field.y, setup.remainingGaloId);

    expect(room.game?.pendingGaloInterrupt?.ownerId).toBe(galoId);
    expect(room.game?.pendingJaguarRemoval).toBeNull();
    expect(room.game?.pieces.find((piece) => piece.pieceId === setup.remainingGaloId)?.location).toBeNull();

    const advanced = advanceBot(room.roomId)!;

    expect(advanced.game?.pendingGaloInterrupt).toBeNull();
    expect(advanced.game?.pendingJaguarRemoval).toBeNull();
    expect(advanced.game?.activePlayerId).toBe(jaguarId);
    expect(advanced.game?.activeActionIndex).toBe(1);

    leaveRooms(jaguarId);
  });
});

function placeOncaBesideGaloField(
  room: ReturnType<typeof createRoom>,
  jaguarId: string,
  galoId: string
): {
  field: { x: number; y: number };
  jaguarOrigin: { x: number; y: number };
  jaguarPieceId: string;
  movingGaloId: string;
  remainingGaloId: string;
  room: ReturnType<typeof createRoom>;
} {
  const cards = room.game!.forest.cards;
  const hasCardAt = (position: { x: number; y: number }) =>
    cards.some((card) => card.x === position.x && card.y === position.y);
  const adjacentPositions = (position: { x: number; y: number }) => [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y }
  ];
  const fieldCard = cards.find((card) => {
    const definition = forestCardsById.get(card.definitionId);
    return definition?.habitat === "field" && adjacentPositions(card).some(hasCardAt);
  })!;
  const field = { x: fieldCard.x, y: fieldCard.y };
  const jaguarOrigin = adjacentPositions(field).find(hasCardAt)!;
  const usedPositions = new Set([`${field.x}:${field.y}`, `${jaguarOrigin.x}:${jaguarOrigin.y}`]);
  const takeUnusedPosition = () => {
    const card = cards.find((candidate) => !usedPositions.has(`${candidate.x}:${candidate.y}`))!;
    usedPositions.add(`${card.x}:${card.y}`);
    return { x: card.x, y: card.y };
  };
  const setupPositions: Record<string, Array<{ x: number; y: number }>> = {
    [jaguarId]: [jaguarOrigin],
    [galoId]: [field, field, takeUnusedPosition()]
  };
  let nextRoom = room;

  while (nextRoom.game?.status === "setup") {
    const playerId = nextRoom.game.setupActivePlayerId!;
    const position = setupPositions[playerId]!.shift()!;
    nextRoom = placeSetupPiece(nextRoom.roomId, playerId, position.x, position.y);
  }

  const jaguarPieceId = nextRoom.game!.pieces.find(
    (piece) => piece.ownerId === jaguarId && piece.speciesId === "jaguar" && piece.location
  )!.pieceId;
  const galoPieces = nextRoom.game!.pieces
    .filter((piece) => piece.ownerId === galoId && piece.location?.x === field.x && piece.location.y === field.y)
    .sort((a, b) => a.pieceId.localeCompare(b.pieceId));

  return {
    field,
    jaguarOrigin,
    jaguarPieceId,
    movingGaloId: galoPieces[0]!.pieceId,
    remainingGaloId: galoPieces[1]!.pieceId,
    room: nextRoom
  };
}
