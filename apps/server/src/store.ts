import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { PublicRoomState } from "@oikos/shared";

const dbPath = process.env.DB_PATH ?? "./data/oikos.db";
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("busy_timeout = 5000");
db.pragma("temp_store = MEMORY");
db.exec(
  `CREATE TABLE IF NOT EXISTS rooms (
     roomId TEXT PRIMARY KEY,
     data TEXT NOT NULL,
     updatedAt INTEGER NOT NULL
   )`
);

const upsertStmt = db.prepare(
  `INSERT INTO rooms (roomId, data, updatedAt)
   VALUES (@roomId, @data, @updatedAt)
   ON CONFLICT(roomId) DO UPDATE SET data = @data, updatedAt = @updatedAt`
);
const selectAllStmt = db.prepare(`SELECT data FROM rooms`);
const deleteStmt = db.prepare(`DELETE FROM rooms WHERE roomId = ?`);
const deleteOlderStmt = db.prepare(`DELETE FROM rooms WHERE updatedAt < ?`);

export function saveRoom(room: PublicRoomState): void {
  upsertStmt.run({ roomId: room.roomId, data: JSON.stringify(room), updatedAt: Date.now() });
}

export function loadRooms(): PublicRoomState[] {
  const rows = selectAllStmt.all() as Array<{ data: string }>;
  const result: PublicRoomState[] = [];

  for (const row of rows) {
    try {
      result.push(JSON.parse(row.data) as PublicRoomState);
    } catch {
      // Skip corrupt rows instead of crashing the server on boot.
    }
  }

  return result;
}

export function deleteRoom(roomId: string): void {
  deleteStmt.run(roomId);
}

export function purgeRoomsOlderThan(maxAgeMs: number): number {
  return deleteOlderStmt.run(Date.now() - maxAgeMs).changes;
}
