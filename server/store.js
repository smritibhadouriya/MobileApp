import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Simple JSON-file persistence so rooms survive server restarts.
// Swap this module for a real database (MongoDB / Postgres) when you outgrow it.
const DATA_DIR = process.env.DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

export const rooms = new Map();
export const reports = [];
export const accounts = new Map(); // accountId -> account
export const sessions = new Map(); // login token -> { accountId, expiresAt }
export const usage = new Map(); // "acct:<id>" | "client:<id>" -> { day, counts }

// Live-only fields that must not be written to disk
const TRANSIENT = new Set(["members", "timeout"]);

export function loadStore(onRoomLoaded) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const saved of data.rooms || []) {
      const room = { ...saved, members: new Map(), timeout: null };
      onRoomLoaded?.(room);
      rooms.set(room.code, room);
    }
    reports.push(...(data.reports || []));
    for (const account of data.accounts || []) accounts.set(account.id, account);
    for (const [token, session] of data.sessions || []) if (session.expiresAt > Date.now()) sessions.set(token, session);
    for (const [key, value] of data.usage || []) usage.set(key, value);
    console.log(`Loaded ${rooms.size} saved room(s)`);
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Could not load saved data:", err.message);
  }
}

let saveTimer = null;

// Debounced: many quick edits (typing in the scratchpad) cause one write
export function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveNow, 2000);
}

export function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const data = {
    rooms: [...rooms.values()].map((room) =>
      Object.fromEntries(Object.entries(room).filter(([key]) => !TRANSIENT.has(key)))
    ),
    reports,
    accounts: [...accounts.values()],
    sessions: [...sessions.entries()],
    usage: [...usage.entries()],
  };
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error("Could not save data:", err.message);
  }
}
