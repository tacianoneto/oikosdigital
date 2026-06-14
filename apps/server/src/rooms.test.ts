import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./store", () => ({
  deleteRoom: vi.fn(),
  loadRooms: () => []
}));

import { deleteRoom } from "./store";
import { createRoom, leaveRooms, listOpenRooms, quitRoom } from "./rooms";

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

  it("still limits four connected rooms for the same host", () => {
    const hostId = "host-with-active-lobbies";
    const activeRooms = Array.from({ length: 4 }, () => createRoom(hostId, "Host"));

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
});
