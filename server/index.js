import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { rooms, reports, loadStore, scheduleSave, saveNow } from "./store.js";
import { filterText } from "./filter.js";
import { aiEnabled, askTutor, generateTest } from "./ai.js";
import { accountFromToken, consume, createAccountRouter, isPro, refund } from "./accounts.js";
import { accounts } from "./store.js";
import { callUrl, callsEnabled, createCallToken, muteAllMics, setCanPublish } from "./call.js";

const PORT = process.env.PORT || 3001;
const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000; // empty rooms are deleted after a week of inactivity
const REACTIONS = ["👍", "❤️", "😂", "🔥"];
const LIMITS = {
  name: 30, avatar: 8, roomName: 40, message: 500, task: 120, notes: 20000, title: 80, url: 500,
  messages: 200, tasks: 100, resources: 50,
  strokes: 1500, strokePoints: 1000, pollQuestion: 150, pollOption: 60, password: 64, exam: 40, reports: 500,
  tests: 20, testQuestions: 50, question: 600, option: 250, explanation: 1000, testTitle: 80, notesText: 30000,
  fileBytes: 5 * 1024 * 1024,
};
const TEST_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
const DEFAULT_SETTINGS = { focus: 25, short: 5, long: 15, rounds: 4 };

// Browsers on other origins that may call this server: the Android app (Capacitor serves it from
// https://localhost) plus anything listed in CLIENT_ORIGIN (e.g. a separately hosted website).
const APP_ORIGINS = ["https://localhost", "capacitor://localhost", "http://localhost"];
const EXTRA_ORIGINS = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim()) : [];
const ALLOWED_ORIGINS = [...APP_ORIGINS, ...EXTRA_ORIGINS];

const app = express();
app.set("trust proxy", 1); // behind the hosting provider's HTTPS proxy, so req.ip is the real visitor
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: EXTRA_ORIGINS.length ? ALLOWED_ORIGINS : true },
  maxHttpBufferSize: 8e6, // room for a 5 MB notes PDF/photo (base64) when generating a test
});

// ================= HELPERS =================
const clean = (value, max, { trim = true } = {}) => {
  if (typeof value !== "string") return "";
  const text = trim ? value.trim() : value;
  return text.slice(0, max);
};
const cleanFiltered = (value, max) => filterText(clean(value, max));

const generateCode = () => {
  let code;
  do {
    code = "STUDY-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  } while (rooms.has(code));
  return code;
};

// Monday of the current week (server local time), used for weekly challenges
const weekKey = (date = new Date()) => {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: scryptSync(password, salt, 32).toString("hex") };
};
const checkPassword = (password, stored) =>
  timingSafeEqual(scryptSync(password, stored.salt, 32), Buffer.from(stored.hash, "hex"));

const youtubeId = (input) => {
  const text = clean(input, LIMITS.url);
  if (/^[\w-]{11}$/.test(text)) return text;
  const match = text.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/live\/|\/shorts\/)([\w-]{11})/);
  return match?.[1] || null;
};

const phaseSeconds = (room, phase) => room.settings[phase] * 60;

function createRoom({ hostId, hostName, roomName, isPublic, password }) {
  const code = generateCode();
  const room = {
    code,
    createdAt: Date.now(),
    lastActive: Date.now(),
    meta: {
      name: roomName || `${hostName}'s Study Room`,
      emoji: "📚",
      isPublic: !!isPublic,
      hostId,
      hostOnlyTimer: false,
      examName: "",
      examDate: "",
      schedule: "",
      challengeGoal: 0,
    },
    password: password ? hashPassword(password) : null,
    banned: [],
    members: new Map(), // socket.id -> { clientId, name, avatar, away }
    messages: [],
    pinnedId: null,
    tasks: [],
    notes: "",
    resources: [],
    tests: [],
    sharedNotes: [], // personal notes a member chose to share with the room
    // Video call: lecture mode lets only the host (teacher) and allowed speakers talk
    call: { lectureMode: false, speakers: [], inCall: {} },
    // Shared workspace: which tab everyone sees and whether it's full screen
    stage: { tab: "board", full: false, by: null, at: 0 },
    strokes: [],
    hands: [],
    video: null,
    leaderboard: {}, // clientId -> { name, minutes }
    challenge: { weekKey: weekKey(), minutes: 0 },
    settings: { ...DEFAULT_SETTINGS },
    timer: { phase: "focus", round: 1, running: false, endsAt: null, remaining: DEFAULT_SETTINGS.focus * 60 },
    timeout: null,
  };
  rooms.set(code, room);
  return room;
}

const serializers = {
  members: (room) => [...room.members.entries()].map(([id, m]) => ({ id, ...m })),
  meta: (room) => ({ ...room.meta, hasPassword: !!room.password, aiEnabled }),
  challenge: (room) => (room.challenge.weekKey === weekKey() ? room.challenge : { weekKey: weekKey(), minutes: 0 }),
  tests: (room) => room.tests.map(publicTest),
  // Old rooms may still point at the removed flashcards tab
  stage: (room) => {
    const stage = room.stage || { tab: "board", full: false, by: null, at: 0 };
    return ["board", "tests", "watch"].includes(stage.tab) ? stage : { ...stage, tab: "board" };
  },
  sharedNotes: (room) => room.sharedNotes || [],
  call: (room) => {
    const call = room.call || { lectureMode: false, speakers: [], inCall: {} };
    return {
      enabled: callsEnabled,
      lectureMode: call.lectureMode,
      speakers: call.speakers,
      inCall: Object.entries(call.inCall).map(([clientId, m]) => ({ clientId, ...m })),
    };
  },
};

function snapshot(room, keys) {
  const data = { serverNow: Date.now() };
  for (const key of keys) data[key] = serializers[key] ? serializers[key](room) : room[key];
  return data;
}

const ALL_KEYS = [
  "code", "members", "meta", "messages", "pinnedId", "tasks", "notes", "resources", "tests", "stage", "sharedNotes", "call",
  "strokes", "hands", "video", "leaderboard", "challenge", "settings", "timer",
];
const broadcast = (room, ...keys) => io.to(room.code).emit("room:update", snapshot(room, keys));

function pushMessage(room, message) {
  room.messages.push({ reactions: {}, time: Date.now(), id: randomUUID(), ...message });
  if (room.messages.length > LIMITS.messages) room.messages.shift();
  io.to(room.code).emit("chat:message", room.messages.at(-1));
}

const systemMessage = (room, text) => pushMessage(room, { senderId: "system", sender: "System", text });
const updateMessage = (room, msg) => io.to(room.code).emit("chat:update", msg);

// ================= SHARED TIMER =================
function scheduleCompletion(room) {
  clearTimeout(room.timeout);
  room.timeout = setTimeout(() => completePhase(room), Math.max(0, room.timer.endsAt - Date.now()));
}

function startTimer(room) {
  const t = room.timer;
  if (t.running) return;
  if (t.remaining <= 0) t.remaining = phaseSeconds(room, t.phase);
  t.running = true;
  t.endsAt = Date.now() + t.remaining * 1000;
  scheduleCompletion(room);
}

function pauseTimer(room) {
  const t = room.timer;
  if (!t.running) return;
  clearTimeout(room.timeout);
  t.remaining = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
  t.running = false;
  t.endsAt = null;
}

function resetTimer(room) {
  clearTimeout(room.timeout);
  Object.assign(room.timer, { running: false, endsAt: null, remaining: phaseSeconds(room, room.timer.phase) });
}

// focus -> short break (or long break after the last round) -> focus ...
function advancePhase(room) {
  const t = room.timer;
  if (t.phase === "focus") {
    t.phase = t.round >= room.settings.rounds ? "long" : "short";
  } else {
    t.round = t.phase === "long" ? 1 : t.round + 1;
    t.phase = "focus";
  }
  resetTimer(room);
}

function completePhase(room) {
  const finished = room.timer.phase;
  if (finished === "focus") {
    if (room.challenge.weekKey !== weekKey()) room.challenge = { weekKey: weekKey(), minutes: 0 };
    // Only members actually present (tab visible) get credit
    for (const m of room.members.values()) {
      if (m.away) continue;
      const entry = (room.leaderboard[m.clientId] ||= { name: m.name, minutes: 0 });
      entry.name = m.name;
      entry.minutes += room.settings.focus;
      room.challenge.minutes += room.settings.focus;
    }
  }
  advancePhase(room);
  io.to(room.code).emit("timer:complete", { phase: finished, minutes: room.settings[finished] });
  broadcast(room, "timer", "leaderboard", "challenge");
  scheduleSave();
}

// ================= GROUP TESTS =================
// Questions stay hidden until the test starts, and answers until it ends, so nobody can peek.
const testTimers = new Map(); // "CODE:testId" -> [timeouts]

function sanitizeQuestions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, LIMITS.testQuestions)
    .map((q) => {
      const options = (Array.isArray(q?.options) ? q.options : [])
        .map((o) => clean(String(o ?? ""), LIMITS.option))
        .filter(Boolean)
        .slice(0, 6);
      const answer = Number(q?.answer);
      return {
        question: clean(q?.question, LIMITS.question),
        options,
        answer: Number.isInteger(answer) && answer >= 0 && answer < options.length ? answer : -1,
        explanation: clean(q?.explanation, LIMITS.explanation),
        topic: clean(q?.topic, 60),
      };
    })
    .filter((q) => q.question && q.options.length >= 2 && q.answer >= 0);
}

// Time in the creator's timezone for the chat message; falls back to server time for unknown zones
function formatClockTime(ts, timeZone) {
  const options = { hour: "numeric", minute: "2-digit" };
  try {
    return new Date(ts).toLocaleTimeString("en-IN", { ...options, timeZone: typeof timeZone === "string" ? timeZone : undefined });
  } catch {
    return new Date(ts).toLocaleTimeString("en-IN", options);
  }
}

const isEnded = (test) => test.finalized || Date.now() >= test.endsAt;

function scoreSubmission(test, sub) {
  let correct = 0;
  let wrong = 0;
  test.questions.forEach((q, i) => {
    const choice = sub.answers[i];
    if (choice === null || choice === undefined) return;
    if (choice === q.answer) correct++;
    else wrong++;
  });
  Object.assign(sub, {
    correct,
    wrong,
    skipped: test.questions.length - correct - wrong,
    score: correct * test.marking.correct + wrong * test.marking.wrong,
  });
}

function publicTest(test) {
  const started = Date.now() >= test.startsAt;
  const ended = isEnded(test);
  return {
    id: test.id,
    title: test.title,
    createdBy: test.createdBy,
    creatorId: test.creatorId,
    source: test.source,
    durationMin: test.durationMin,
    marking: test.marking,
    startsAt: test.startsAt,
    endsAt: test.endsAt,
    createdAt: test.createdAt,
    questionCount: test.questions.length,
    ended,
    questions: !started ? null : ended ? test.questions : test.questions.map(({ question, options, topic }) => ({ question, options, topic })),
    participants: Object.entries(test.submissions).map(([clientId, sub]) => ({
      clientId,
      name: sub.name,
      avatar: sub.avatar,
      submitted: !!sub.submittedAt,
      ...(ended && {
        score: sub.score,
        correct: sub.correct,
        wrong: sub.wrong,
        skipped: sub.skipped,
        timeTaken: Math.max(0, Math.round(((sub.submittedAt || test.endsAt) - Math.max(sub.startedAt, test.startsAt)) / 1000)),
      }),
    })),
  };
}

function finalizeTest(room, test) {
  if (test.finalized) return;
  test.finalized = true;
  for (const sub of Object.values(test.submissions)) {
    sub.submittedAt ||= test.endsAt;
    scoreSubmission(test, sub);
  }
  const ranked = Object.values(test.submissions).sort((a, b) => b.score - a.score);
  const podium = ranked.slice(0, 3).map((sub, i) => `${["🥇", "🥈", "🥉"][i]} ${sub.name} (${sub.score})`).join("  ");
  systemMessage(room, `🏁 Test "${test.title}" is over! ${podium || "Nobody attempted it."}`);
  broadcast(room, "tests");
  scheduleSave();
}

function clearTestTimers(room, test) {
  const key = `${room.code}:${test.id}`;
  for (const t of testTimers.get(key) || []) clearTimeout(t);
  testTimers.delete(key);
}

function scheduleTestTimers(room, test) {
  clearTestTimers(room, test);
  if (test.finalized) return;
  const now = Date.now();
  const timers = [];
  if (now < test.startsAt) {
    timers.push(setTimeout(() => {
      systemMessage(room, `🟢 Test "${test.title}" is LIVE — ${test.durationMin} min on the clock. All the best! 🍀`);
      broadcast(room, "tests");
      io.to(room.code).emit("test:start", { id: test.id, title: test.title });
    }, test.startsAt - now));
  }
  // Small grace period so answers sent in the last second still count
  timers.push(setTimeout(() => finalizeTest(room, test), Math.max(0, test.endsAt - now) + 2000));
  testTimers.set(`${room.code}:${test.id}`, timers);
}

// ================= LOAD SAVED ROOMS =================
loadStore((room) => {
  // A timer that was running when the server stopped resumes paused
  const t = room.timer;
  if (t.running) {
    t.remaining = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000)) || phaseSeconds(room, t.phase);
    t.running = false;
    t.endsAt = null;
  }
  room.hands = [];
  delete room.cards;
  room.tests ||= [];
  for (const test of room.tests) scheduleTestTimers(room, test);
  room.call = { lectureMode: room.call?.lectureMode || false, speakers: [], inCall: {} };
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.members.size === 0 && now - room.lastActive > ROOM_TTL_MS) {
      clearTimeout(room.timeout);
      rooms.delete(room.code);
      scheduleSave();
    }
  }
}, 60 * 60 * 1000);

// socket.id -> leave function, so a host can remove another member
const leaveHandlers = new Map();

// A refresh or a dropped connection looks like leave + join. "left" is announced only if the
// person stays away for a while; coming back in time cancels both messages.
const REJOIN_GRACE_MS = 15000;
const pendingLeaves = new Map(); // "CODE:clientId" -> timeout

// ================= SOCKET EVENTS =================
io.on("connection", (socket) => {
  let room = null;
  const lastAt = {};

  const me = () => room?.members.get(socket.id);
  const ack = (cb) => (typeof cb === "function" ? cb : () => {});
  const tooSoon = (key, ms) => {
    const now = Date.now();
    if (now - (lastAt[key] || 0) < ms) return true;
    lastAt[key] = now;
    return false;
  };
  const isHost = () => me()?.clientId === room.meta.hostId;
  const hostPresent = () => [...room.members.values()].some((m) => m.clientId === room.meta.hostId);
  // If the host is offline, nobody gets locked out of the timer
  const canControlTimer = () => !room.meta.hostOnlyTimer || isHost() || !hostPresent();

  // Wrap handlers so they only run once the socket is in a room, and persist afterwards
  const on = (event, handler, { hostOnly = false } = {}) =>
    socket.on(event, (...args) => {
      if (!room || !me()) return;
      if (hostOnly && !isHost()) return;
      handler(...args);
      if (room) {
        room.lastActive = Date.now();
        scheduleSave();
      }
    });

  function leaveRoom() {
    if (!room) return;
    const current = room;
    const member = me();
    current.members.delete(socket.id);
    socket.leave(current.code);
    socket.to(current.code).emit("typing", { id: socket.id, isTyping: false });
    room = null;

    if (member && current.call?.inCall[member.clientId]) {
      const stillHere = [...current.members.values()].some((m) => m.clientId === member.clientId);
      if (!stillHere) {
        delete current.call.inCall[member.clientId];
        broadcast(current, "call");
      }
    }
    if (member) {
      const hadHand = current.hands.some((h) => h.clientId === member.clientId);
      const stillHere = [...current.members.values()].some((m) => m.clientId === member.clientId);
      if (hadHand && !stillHere) {
        current.hands = current.hands.filter((h) => h.clientId !== member.clientId);
        broadcast(current, "hands");
      }
      if (!stillHere) {
        const key = `${current.code}:${member.clientId}`;
        clearTimeout(pendingLeaves.get(key));
        pendingLeaves.set(key, setTimeout(() => {
          pendingLeaves.delete(key);
          if (![...current.members.values()].some((m) => m.clientId === member.clientId)) {
            systemMessage(current, `${member.name} left the room`);
            scheduleSave();
          }
        }, REJOIN_GRACE_MS));
      }
    }
    broadcast(current, "members");
    current.lastActive = Date.now();
    scheduleSave();
  }
  leaveHandlers.set(socket.id, leaveRoom);

  function joinRoom(target, identity) {
    leaveRoom();
    room = target;
    room.members.set(socket.id, { ...identity, away: false });
    socket.join(room.code);
    const leaveKey = `${room.code}:${identity.clientId}`;
    const alreadyHere = [...room.members.values()].filter((m) => m.clientId === identity.clientId).length > 1;
    if (pendingLeaves.has(leaveKey)) {
      // Back within the grace period: no "left", no "joined"
      clearTimeout(pendingLeaves.get(leaveKey));
      pendingLeaves.delete(leaveKey);
    } else if (!alreadyHere) {
      systemMessage(room, `${identity.name} joined the room`);
    }
    broadcast(room, "members");
    room.lastActive = Date.now();
    scheduleSave();
    return snapshot(room, ALL_KEYS);
  }

  const parseIdentity = (payload) => {
    const account = accountFromToken(payload?.token);
    return {
      name: cleanFiltered(payload?.name, LIMITS.name),
      avatar: clean(payload?.avatar, LIMITS.avatar) || "🙂",
      clientId: clean(payload?.clientId, 64) || socket.id,
      accountId: account?.id || null,
      pro: isPro(account),
    };
  };
  // The member's account, re-read so an expired plan stops counting immediately
  const myAccount = () => (me()?.accountId ? accounts.get(me().accountId) : null);

  socket.on("room:create", (payload, cb) => {
    const identity = parseIdentity(payload);
    if (!identity.name) return ack(cb)({ ok: false, error: "Please enter your name!" });
    if (clean(payload?.password, LIMITS.password) && !identity.pro) {
      return ack(cb)({ ok: false, upgrade: true, error: "Password-protected private rooms are a Pro feature ✨" });
    }
    const created = createRoom({
      hostId: identity.clientId,
      hostName: identity.name,
      roomName: cleanFiltered(payload?.roomName, LIMITS.roomName),
      isPublic: payload?.isPublic,
      password: clean(payload?.password, LIMITS.password),
    });
    ack(cb)({ ok: true, state: joinRoom(created, identity) });
  });

  socket.on("room:join", (payload, cb) => {
    const identity = parseIdentity(payload);
    const code = clean(payload?.code, 20).toUpperCase();
    if (!identity.name || !code) return ack(cb)({ ok: false, error: "Please enter both Name and Room Code!" });
    const target = rooms.get(code);
    if (!target) return ack(cb)({ ok: false, error: `Room ${code} not found. Check the code or create a new room.` });
    if (target.banned.includes(identity.clientId)) {
      return ack(cb)({ ok: false, error: "You were removed from this room by the host." });
    }
    const isTargetHost = target.meta.hostId === identity.clientId;
    if (target.password && !isTargetHost) {
      const password = clean(payload?.password, LIMITS.password);
      if (!password) return ack(cb)({ ok: false, needsPassword: true, error: "This room is private. Enter the password." });
      if (tooSoon("password", 1000) || !checkPassword(password, target.password)) {
        return ack(cb)({ ok: false, needsPassword: true, error: "Wrong password." });
      }
    }
    ack(cb)({ ok: true, state: joinRoom(target, identity) });
  });

  socket.on("rooms:list", (cb) => {
    const list = [...rooms.values()]
      .filter((r) => r.meta.isPublic)
      .map((r) => ({
        code: r.code,
        name: r.meta.name,
        emoji: r.meta.emoji,
        examName: r.meta.examName,
        members: r.members.size,
        hasPassword: !!r.password,
      }))
      .sort((a, b) => b.members - a.members)
      .slice(0, 50);
    ack(cb)(list);
  });

  on("auth:update", (token) => {
    const account = accountFromToken(token);
    Object.assign(me(), { accountId: account?.id || null, pro: isPro(account) });
    broadcast(room, "members");
  });

  socket.on("room:leave", leaveRoom);
  socket.on("disconnect", () => {
    leaveRoom();
    leaveHandlers.delete(socket.id);
  });

  // --- Presence ---
  on("status:away", (away) => {
    const member = me();
    const wasAway = member.away;
    member.away = !!away;
    broadcast(room, "members");
    // Focus lock: let the room know when someone leaves mid-focus
    if (member.away && !wasAway && room.timer.running && room.timer.phase === "focus" && !tooSoon("distracted", 60000)) {
      systemMessage(room, `${member.name} got distracted 👀`);
    }
  });

  // Solo-timer users report their own activity; subject shows next to their status
  on("status:update", (payload) => {
    const member = me();
    if (payload?.activity !== undefined) {
      member.activity = ["focus", "break", "idle"].includes(payload.activity) ? payload.activity : null;
    }
    if (payload?.subject !== undefined) member.subject = cleanFiltered(payload.subject, 30);
    broadcast(room, "members");
  });

  on("nudge", (targetId) => {
    if (targetId === socket.id || !room.members.has(targetId) || tooSoon("nudge", 10000)) return;
    io.to(targetId).emit("nudge", { from: me().name });
  });

  on("hand:toggle", () => {
    const { clientId, name, avatar } = me();
    const raised = room.hands.some((h) => h.clientId === clientId);
    room.hands = raised ? room.hands.filter((h) => h.clientId !== clientId) : [...room.hands, { clientId, name, avatar, at: Date.now() }];
    broadcast(room, "hands");
  });

  on("hand:lower", (clientId) => {
    if (clientId !== me().clientId && !isHost()) return;
    room.hands = room.hands.filter((h) => h.clientId !== clientId);
    broadcast(room, "hands");
  });

  // --- Chat ---
  on("chat:send", (payload) => {
    if (tooSoon("chat", 300)) return;
    const raw = typeof payload === "string" ? payload : payload?.text;
    const text = cleanFiltered(raw, LIMITS.message);
    if (!text) return;
    const { clientId, name, avatar } = me();
    const replied = room.messages.find((m) => m.id === payload?.replyTo);
    pushMessage(room, {
      senderId: clientId,
      sender: name,
      avatar,
      text,
      replyTo: replied ? { id: replied.id, sender: replied.sender, text: replied.text.slice(0, 80) } : null,
    });

    // "/ask <question>" -> AI tutor answers in the room
    const ask = text.match(/^\/ask\s+([\s\S]+)/i);
    if (ask) {
      const current = room;
      if (!aiEnabled) {
        socket.emit("chat:message", {
          id: randomUUID(), senderId: "system", sender: "System", time: Date.now(), reactions: {},
          text: "AI Tutor is not set up on this server (ANTHROPIC_API_KEY missing).",
        });
        return;
      }
      if (tooSoon("ask", 5000)) return;
      const account = myAccount();
      const limited = consume(account, clientId, "aiAsks");
      if (limited) {
        socket.emit("chat:message", {
          id: randomUUID(), senderId: "system", sender: "System", time: Date.now(), reactions: {},
          text: limited.error, upgrade: !!limited.upgrade,
        });
        return;
      }
      io.to(current.code).emit("typing", { id: "ai", name: "AI Tutor", isTyping: true });
      const recent = current.messages.slice(-8, -1).filter((m) => m.senderId !== "system");
      askTutor(ask[1], recent).then((res) => {
        io.to(current.code).emit("typing", { id: "ai", isTyping: false });
        if (!res.ok) refund(account, clientId, "aiAsks");
        if (!rooms.has(current.code)) return;
        if (res.ok) pushMessage(current, { senderId: "ai", sender: "AI Tutor", avatar: "🤖", text: res.text.slice(0, 4000) });
        else systemMessage(current, res.error);
        scheduleSave();
      });
    }
  });

  on("chat:react", (payload) => {
    const msg = room.messages.find((m) => m.id === payload?.messageId);
    if (!msg || !REACTIONS.includes(payload?.emoji)) return;
    const { clientId } = me();
    const users = msg.reactions[payload.emoji] || [];
    const next = users.includes(clientId) ? users.filter((id) => id !== clientId) : [...users, clientId];
    if (next.length) msg.reactions[payload.emoji] = next;
    else delete msg.reactions[payload.emoji];
    updateMessage(room, msg);
  });

  on("chat:pin", (messageId) => {
    room.pinnedId = room.messages.some((m) => m.id === messageId) ? messageId : null;
    broadcast(room, "pinnedId");
  });

  on("chat:poll", (payload) => {
    const question = cleanFiltered(payload?.question, LIMITS.pollQuestion);
    const options = (Array.isArray(payload?.options) ? payload.options : [])
      .map((o) => cleanFiltered(o, LIMITS.pollOption))
      .filter(Boolean)
      .slice(0, 5);
    if (!question || options.length < 2) return;
    const { clientId, name, avatar } = me();
    pushMessage(room, {
      type: "poll", senderId: clientId, sender: name, avatar, text: question,
      poll: { options: options.map((text) => ({ text, votes: [] })) },
    });
  });

  on("poll:vote", (payload) => {
    const msg = room.messages.find((m) => m.id === payload?.messageId && m.type === "poll");
    const index = Number(payload?.index);
    if (!msg || !msg.poll.options[index]) return;
    const { clientId } = me();
    const already = msg.poll.options[index].votes.includes(clientId);
    for (const option of msg.poll.options) option.votes = option.votes.filter((id) => id !== clientId);
    if (!already) msg.poll.options[index].votes.push(clientId);
    updateMessage(room, msg);
  });

  on("typing", (isTyping) => {
    socket.to(room.code).emit("typing", { id: socket.id, name: me().name, isTyping: !!isTyping });
  });

  on("report", (payload) => {
    const target = [...room.members.values()].find((m) => m.clientId === payload?.clientId);
    reports.push({
      id: randomUUID(), room: room.code, time: Date.now(),
      reporter: me().name, target: target?.name || clean(payload?.name, LIMITS.name),
      reason: clean(payload?.reason, 300),
    });
    if (reports.length > LIMITS.reports) reports.shift();
    socket.emit("chat:message", {
      id: randomUUID(), senderId: "system", sender: "System", time: Date.now(), reactions: {},
      text: "Thanks — your report was sent to the admins.",
    });
  });

  // --- Session goals ---
  on("task:add", (rawText) => {
    const text = cleanFiltered(rawText, LIMITS.task);
    if (!text || room.tasks.length >= LIMITS.tasks) return;
    room.tasks.push({ id: randomUUID(), text, done: false, by: me().name });
    broadcast(room, "tasks");
  });

  on("task:toggle", (id) => {
    const task = room.tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    broadcast(room, "tasks");
  });

  on("task:delete", (id) => {
    room.tasks = room.tasks.filter((t) => t.id !== id);
    broadcast(room, "tasks");
  });

  // --- Scratchpad (last write wins; not echoed back to the writer) ---
  on("notes:update", (text) => {
    room.notes = clean(text, LIMITS.notes, { trim: false });
    socket.to(room.code).emit("room:update", { notes: room.notes });
  });

  // --- Resources ---
  on("resource:add", (payload) => {
    if (room.resources.length >= LIMITS.resources) return;
    let url;
    try {
      url = new URL(clean(payload?.url, LIMITS.url));
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return; // blocks javascript: and other schemes
    const title = cleanFiltered(payload?.title, LIMITS.title) || url.hostname;
    room.resources.push({ id: randomUUID(), title, url: url.href, by: me().name });
    broadcast(room, "resources");
  });

  on("resource:remove", (id) => {
    room.resources = room.resources.filter((r) => r.id !== id);
    broadcast(room, "resources");
  });

  // --- Group tests ---
  // AI draft: returned only to the creator, who reviews/edits it before sending
  socket.on("test:generate", async (payload, cb) => {
    const reply = ack(cb);
    if (!room || !me()) return reply({ ok: false, error: "Join a room first." });
    if (!aiEnabled) return reply({ ok: false, error: "AI is not set up on this server (ANTHROPIC_API_KEY missing). You can still write the questions yourself." });
    if (lastAt.generating) return reply({ ok: false, error: "Already generating a test — hang on." });
    if (tooSoon("generate", 10000)) return reply({ ok: false, error: "Slow down a bit — try again in a few seconds." });

    const mode = payload?.mode === "topic" ? "topic" : "notes";
    const source = { mode };
    if (mode === "topic") {
      source.topic = clean(payload?.topic, 200);
      source.exam = clean(payload?.exam, 40);
      if (!source.topic) return reply({ ok: false, error: "Enter a topic." });
    } else {
      source.text = clean(payload?.text, LIMITS.notesText);
      const file = payload?.file;
      if (file?.data) {
        if (!TEST_FILE_TYPES.includes(file.mediaType)) return reply({ ok: false, error: "Upload a PDF or an image (PNG/JPG/WEBP)." });
        const data = String(file.data);
        if (data.length * 0.75 > LIMITS.fileBytes || !/^[A-Za-z0-9+/=]+$/.test(data)) return reply({ ok: false, error: "File is too big — keep it under 5 MB." });
        source.file = { data, mediaType: file.mediaType };
      }
      if (!source.text && !source.file) return reply({ ok: false, error: "Paste your notes or upload a PDF/photo first." });
    }
    const count = Math.min(30, Math.max(3, Math.round(Number(payload?.count)) || 10));
    const difficulty = ["easy", "medium", "hard"].includes(payload?.difficulty) ? payload.difficulty : "medium";

    const account = myAccount();
    const { clientId } = me();
    const limited = consume(account, clientId, "aiTests");
    if (limited) return reply(limited);

    lastAt.generating = true;
    try {
      const res = await generateTest({ source, count, difficulty });
      if (!res.ok) {
        refund(account, clientId, "aiTests");
        return reply(res);
      }
      const questions = sanitizeQuestions(res.questions);
      if (!questions.length) return reply({ ok: false, error: "AI didn't return usable questions. Try again." });
      reply({ ok: true, title: clean(res.title, LIMITS.testTitle), questions });
    } finally {
      lastAt.generating = false;
    }
  });

  on("test:create", (payload, cb) => {
    const reply = ack(cb);
    const questions = sanitizeQuestions(payload?.questions);
    if (!questions.length) return reply({ ok: false, error: "Add at least one complete question (with the correct option marked)." });
    const limited = consume(myAccount(), me().clientId, "testsCreated");
    if (limited) return reply(limited);
    const durationMin = Math.min(180, Math.max(1, Math.round(Number(payload?.durationMin)) || 10));
    const now = Date.now();
    const requested = Number(payload?.startsAt);
    // Start between now and 24h ahead; anything in the past means "now"
    const startsAt = Number.isFinite(requested) && requested > now ? Math.min(requested, now + 24 * 60 * 60 * 1000) : now;
    const marking = payload?.marking === "jee" ? { correct: 4, wrong: -1 } : { correct: 1, wrong: 0 };
    const { clientId, name } = me();
    const test = {
      id: randomUUID(),
      title: cleanFiltered(payload?.title, LIMITS.testTitle) || "Squad test",
      createdBy: name,
      creatorId: clientId,
      source: ["notes", "topic", "manual"].includes(payload?.source) ? payload.source : "manual",
      durationMin,
      marking,
      startsAt,
      endsAt: startsAt + durationMin * 60 * 1000,
      createdAt: now,
      questions,
      submissions: {},
      finalized: false,
    };
    room.tests.push(test);
    // Drop the oldest finished tests beyond the limit
    while (room.tests.length > LIMITS.tests) {
      const old = room.tests.shift();
      clearTestTimers(room, old);
    }
    scheduleTestTimers(room, test);
    const when = startsAt <= now ? "starts NOW" : `starts at ${formatClockTime(startsAt, payload?.timeZone)}`;
    systemMessage(room, `📝 ${name} sent a test: "${test.title}" — ${questions.length} Qs, ${durationMin} min, ${when}. Everyone has to take it! 👀`);
    broadcast(room, "tests");
    if (startsAt <= now) io.to(room.code).emit("test:start", { id: test.id, title: test.title });
    reply({ ok: true, id: test.id });
  });

  // Your own answers (e.g. after a refresh mid-test, or for the review screen)
  on("test:state", (testId, cb) => {
    const test = room.tests.find((t) => t.id === testId);
    const sub = test?.submissions[me().clientId];
    ack(cb)({ answers: sub?.answers || [], submitted: !!sub?.submittedAt });
  });

  on("test:answer", (payload) => {
    const test = room.tests.find((t) => t.id === payload?.testId);
    if (!test || test.finalized) return;
    const now = Date.now();
    if (now < test.startsAt || now > test.endsAt + 2000) return;
    const index = Number(payload?.index);
    const question = test.questions[index];
    if (!question) return;
    const choice = payload?.choice === null ? null : Number(payload?.choice);
    if (choice !== null && !(Number.isInteger(choice) && choice >= 0 && choice < question.options.length)) return;

    const { clientId, name, avatar } = me();
    let sub = test.submissions[clientId];
    if (sub?.submittedAt) return;
    const isNew = !sub;
    sub ||= test.submissions[clientId] = { name, avatar, startedAt: now, answers: Array(test.questions.length).fill(null), submittedAt: null };
    sub.answers[index] = choice;
    if (isNew) broadcast(room, "tests"); // shows "taking the test" to others
  });

  on("test:submit", (testId) => {
    const test = room.tests.find((t) => t.id === testId);
    if (!test || isEnded(test) || Date.now() < test.startsAt) return;
    const { clientId, name, avatar } = me();
    const sub = (test.submissions[clientId] ||= { name, avatar, startedAt: Date.now(), answers: Array(test.questions.length).fill(null), submittedAt: null });
    if (sub.submittedAt) return;
    sub.submittedAt = Date.now();
    scoreSubmission(test, sub);
    broadcast(room, "tests");
    // Everyone online has submitted: no need to wait for the clock
    const online = new Set([...room.members.values()].map((m) => m.clientId));
    const allDone = [...online].every((id) => test.submissions[id]?.submittedAt);
    if (allDone) {
      clearTestTimers(room, test);
      test.endsAt = Math.min(test.endsAt, Date.now());
      finalizeTest(room, test);
    }
  });

  on("test:cancel", (testId) => {
    const test = room.tests.find((t) => t.id === testId);
    if (!test || isEnded(test)) return;
    if (test.creatorId !== me().clientId && !isHost()) return;
    clearTestTimers(room, test);
    room.tests = room.tests.filter((t) => t.id !== testId);
    systemMessage(room, `❌ Test "${test.title}" was cancelled`);
    broadcast(room, "tests");
  });

  // --- Shared notes: copy of a personal note that the whole room can read ---
  on("note:share", (payload) => {
    if (tooSoon("noteShare", 3000)) return;
    const title = cleanFiltered(payload?.title, 60) || "Untitled notes";
    const text = clean(payload?.text, LIMITS.notes, { trim: false }).trim();
    if (!text) return;
    const { clientId, name, avatar } = me();
    room.sharedNotes ||= [];
    const note = { id: randomUUID(), title, text, by: name, byId: clientId, avatar, at: Date.now() };
    room.sharedNotes.push(note);
    if (room.sharedNotes.length > 50) room.sharedNotes.shift();
    pushMessage(room, { type: "note", senderId: clientId, sender: name, avatar, text: `📒 shared notes: ${title}`, noteId: note.id });
    broadcast(room, "sharedNotes");
  });

  on("note:unshare", (noteId) => {
    const note = room.sharedNotes?.find((n) => n.id === noteId);
    if (!note || (note.byId !== me().clientId && !isHost())) return;
    room.sharedNotes = room.sharedNotes.filter((n) => n.id !== noteId);
    broadcast(room, "sharedNotes");
  });

  // --- Video call (LiveKit) ---
  const callState = () => (room.call ||= { lectureMode: false, speakers: [], inCall: {} });
  const mayPublish = (clientId) => {
    const call = callState();
    return !call.lectureMode || clientId === room.meta.hostId || call.speakers.includes(clientId);
  };

  socket.on("call:join", async (cb) => {
    const reply = ack(cb);
    if (!room || !me()) return reply({ ok: false, error: "Join a room first." });
    if (!callsEnabled) return reply({ ok: false, error: "Video calls aren't set up on this server yet (LIVEKIT_* keys missing)." });
    const { clientId, name, avatar } = me();
    const current = room;
    try {
      const token = await createCallToken({
        code: current.code,
        identity: clientId,
        name,
        metadata: JSON.stringify({ avatar }),
        canPublish: mayPublish(clientId),
      });
      const call = callState();
      const first = Object.keys(call.inCall).length === 0;
      call.inCall[clientId] = { name, avatar };
      if (first) systemMessage(current, `📹 ${name} started a video call — tap "join call" at the top to hop in`);
      broadcast(current, "call");
      reply({ ok: true, url: callUrl, token });
    } catch (err) {
      console.error("Call token failed:", err.message);
      reply({ ok: false, error: "Couldn't start the call. Please try again." });
    }
  });

  on("call:leave", () => {
    delete callState().inCall[me().clientId];
    broadcast(room, "call");
  });

  on("call:lecture", (enabled) => {
    const call = callState();
    call.lectureMode = !!enabled;
    call.speakers = [];
    for (const clientId of Object.keys(call.inCall)) {
      if (clientId !== room.meta.hostId) setCanPublish(room.code, clientId, !call.lectureMode);
    }
    systemMessage(room, call.lectureMode
      ? "🎓 Lecture mode on — only the teacher can talk & share video. Raise ✋ to ask a doubt."
      : "🎙️ Lecture mode off — everyone can talk again.");
    broadcast(room, "call");
  }, { hostOnly: true });

  on("call:allowSpeak", (payload) => {
    const clientId = clean(payload?.clientId, 64);
    if (!clientId || clientId === room.meta.hostId) return;
    const call = callState();
    const allow = !!payload?.allow;
    call.speakers = allow ? [...new Set([...call.speakers, clientId])] : call.speakers.filter((id) => id !== clientId);
    if (allow) room.hands = room.hands.filter((h) => h.clientId !== clientId);
    setCanPublish(room.code, clientId, allow || !call.lectureMode);
    broadcast(room, "call", "hands");
  }, { hostOnly: true });

  on("call:muteAll", async () => {
    if (tooSoon("muteAll", 3000)) return;
    const current = room;
    if (await muteAllMics(current.code, current.meta.hostId)) systemMessage(current, "🔇 The teacher muted everyone");
  }, { hostOnly: true });

  // --- Shared stage: one person opens a tool, everyone sees it ---
  on("stage:set", (payload) => {
    const tab = ["board", "tests", "watch"].includes(payload?.tab) ? payload.tab : null;
    if (!tab || tooSoon("stage", 300)) return;
    room.stage = { tab, full: !!payload?.full, by: me().name, at: Date.now() };
    broadcast(room, "stage");
  });

  // --- Whiteboard ---
  on("wb:stroke", (payload) => {
    const color = /^#[0-9a-f]{6}$/i.test(payload?.color) ? payload.color : "#e2e8f0";
    const size = Math.min(40, Math.max(1, Number(payload?.size) || 3));
    // v2 strokes measure both x and y in board widths, so the board can be any height without stretching;
    // y can go past 1 on tall boards. v1 (old) strokes used 0..1 of a 16:10 board.
    const v = payload?.v === 2 ? 2 : 1;
    const maxY = v === 2 ? 10 : 1;
    const points = (Array.isArray(payload?.points) ? payload.points : [])
      .slice(0, LIMITS.strokePoints)
      .filter((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= maxY)
      .map(([x, y]) => [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000]);
    if (points.length === 0) return;
    const stroke = { id: clean(payload?.id, 64) || randomUUID(), by: me().clientId, color, size, points, erase: !!payload?.erase, v };
    room.strokes.push(stroke);
    if (room.strokes.length > LIMITS.strokes) room.strokes.shift();
    socket.to(room.code).emit("wb:stroke", stroke);
  });

  on("wb:undo", () => {
    const { clientId } = me();
    const index = room.strokes.findLastIndex((s) => s.by === clientId);
    if (index === -1) return;
    room.strokes.splice(index, 1);
    broadcast(room, "strokes");
  });

  on("wb:clear", () => {
    room.strokes = [];
    broadcast(room, "strokes");
  });

  // --- Watch party (YouTube) ---
  on("video:set", (url) => {
    const id = youtubeId(url);
    if (!id) return;
    room.video = { id, playing: false, time: 0, updatedAt: Date.now(), by: me().name };
    broadcast(room, "video");
  });

  on("video:control", (payload) => {
    if (!room.video || tooSoon("video", 250)) return;
    const time = Math.max(0, Number(payload?.time) || 0);
    room.video = { ...room.video, playing: !!payload?.playing, time, updatedAt: Date.now() };
    socket.to(room.code).emit("room:update", snapshot(room, ["video"]));
  });

  on("video:clear", () => {
    room.video = null;
    broadcast(room, "video");
  });

  // --- Timer controls ---
  const timerAction = (fn) => () => {
    if (!canControlTimer()) return;
    fn(room);
    broadcast(room, "timer");
  };
  on("timer:start", timerAction(startTimer));
  on("timer:pause", timerAction(pauseTimer));
  on("timer:reset", timerAction(resetTimer));
  on("timer:skip", timerAction(advancePhase));

  on("timer:settings", (payload) => {
    if (!canControlTimer()) return;
    for (const key of ["focus", "short", "long"]) {
      const value = Math.round(Number(payload?.[key]));
      if (value >= 1 && value <= 180) room.settings[key] = value;
    }
    const rounds = Math.round(Number(payload?.rounds));
    if (rounds >= 1 && rounds <= 10) room.settings.rounds = rounds;
    if (room.timer.round > room.settings.rounds) room.timer.round = 1;
    if (!room.timer.running) resetTimer(room);
    broadcast(room, "settings", "timer");
  });

  // --- Host controls ---
  on("host:settings", (payload) => {
    const m = room.meta;
    if (payload?.name !== undefined) m.name = cleanFiltered(payload.name, LIMITS.roomName) || m.name;
    if (payload?.emoji !== undefined) m.emoji = clean(payload.emoji, LIMITS.avatar) || m.emoji;
    if (payload?.isPublic !== undefined) m.isPublic = !!payload.isPublic;
    if (payload?.hostOnlyTimer !== undefined) m.hostOnlyTimer = !!payload.hostOnlyTimer;
    if (payload?.examName !== undefined) m.examName = cleanFiltered(payload.examName, LIMITS.exam);
    if (payload?.examDate !== undefined) m.examDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.examDate) ? payload.examDate : "";
    if (payload?.schedule !== undefined) m.schedule = /^\d{2}:\d{2}$/.test(payload.schedule) ? payload.schedule : "";
    if (payload?.challengeGoal !== undefined) m.challengeGoal = Math.min(1000, Math.max(0, Math.round(Number(payload.challengeGoal)) || 0));
    if (payload?.password !== undefined) {
      const password = clean(payload.password, LIMITS.password);
      if (password && !isPro(myAccount())) {
        socket.emit("chat:message", {
          id: randomUUID(), senderId: "system", sender: "System", time: Date.now(), reactions: {},
          text: "Setting a room password is a Pro feature ✨ — other settings were saved.",
        });
      } else {
        room.password = password ? hashPassword(password) : null;
      }
    }
    broadcast(room, "meta");
  }, { hostOnly: true });

  on("host:kick", (targetId) => {
    const target = room.members.get(targetId);
    if (!target || targetId === socket.id) return;
    if (!room.banned.includes(target.clientId)) room.banned.push(target.clientId);
    io.to(targetId).emit("kicked", { room: room.meta.name });
    leaveHandlers.get(targetId)?.();
    systemMessage(room, `${target.name} was removed by the host`);
  }, { hostOnly: true });

  on("host:transfer", (targetId) => {
    const target = room.members.get(targetId);
    if (!target) return;
    room.meta.hostId = target.clientId;
    systemMessage(room, `${target.name} is now the host 👑`);
    broadcast(room, "meta");
  }, { hostOnly: true });
});

// ================= HTTP =================
// When an account buys / gets Pro, update its badge in every room and tell its devices to refresh
function onAccountChanged(account) {
  const pro = isPro(account);
  for (const room of rooms.values()) {
    let changed = false;
    for (const [socketId, member] of room.members) {
      if (member.accountId !== account.id) continue;
      member.pro = pro;
      changed = true;
      io.to(socketId).emit("account:changed");
    }
    if (changed) broadcast(room, "members");
  }
}
// CORS for the REST API (login, Pro, billing) so the Android app can call it
app.use("/api", (req, res, next) => {
  const origin = req.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set({
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      Vary: "Origin",
    });
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use("/api", createAccountRouter({ onAccountChanged }));

app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));

// Admin overview: GET /api/admin?key=<ADMIN_KEY>
app.get("/api/admin", (req, res) => {
  const key = String(req.query.key || "");
  const expected = process.env.ADMIN_KEY || "";
  const valid = expected && key.length === expected.length && timingSafeEqual(Buffer.from(key), Buffer.from(expected));
  if (!valid) return res.status(403).json({ error: "Forbidden" });
  const list = [...rooms.values()].map((r) => ({
    code: r.code,
    name: r.meta.name,
    public: r.meta.isPublic,
    private: !!r.password,
    online: r.members.size,
    messages: r.messages.length,
    focusMinutes: Object.values(r.leaderboard).reduce((sum, e) => sum + e.minutes, 0),
    lastActive: new Date(r.lastActive).toISOString(),
  }));
  res.json({
    totals: {
      rooms: list.length,
      online: list.reduce((s, r) => s + r.online, 0),
      focusMinutes: list.reduce((s, r) => s + r.focusMinutes, 0),
      reports: reports.length,
    },
    rooms: list.sort((a, b) => b.online - a.online),
    reports: [...reports].reverse(),
  });
});

// In production, serve the built client from the same origin
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!socket\.io|api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// Save on shutdown so nothing from the last couple of seconds is lost
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    saveNow();
    process.exit(0);
  });
}

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is already in use — the StudyGroup server is probably already running in another terminal.`);
    console.error(`Stop that one first (Ctrl + C there), or start this one on another port: PORT=3002 npm run dev\n`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => {
  console.log(`StudyGroup server running on http://localhost:${PORT}`);
  console.log(aiEnabled ? "AI Tutor: enabled" : "AI Tutor: disabled (set ANTHROPIC_API_KEY to enable)");
});
