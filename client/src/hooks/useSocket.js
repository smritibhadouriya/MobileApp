import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getClientId } from "../lib/storage";
import { SERVER_URL } from "../lib/native";

// Server timestamps are converted to a client clock offset so shared timers stay in sync
const withOffset = (prev, patch) => ({
  ...prev,
  ...patch,
  clockOffset: patch.serverNow ? patch.serverNow - Date.now() : prev?.clockOffset ?? 0,
});

export default function useSocket({ onTimerComplete, onNudge, onRoomLost, onMessage, onKicked, onTestStart, onAccountChanged } = {}) {
  const [socket] = useState(() => io(SERVER_URL, { autoConnect: false }));
  const [clientId] = useState(getClientId);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [typing, setTyping] = useState({});
  const [connectError, setConnectError] = useState(null);
  const sessionRef = useRef(null);
  const handlersRef = useRef({});

  useEffect(() => {
    handlersRef.current = { onTimerComplete, onNudge, onRoomLost, onMessage, onKicked, onTestStart, onAccountChanged };
  });

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setConnectError(null);
      // Reconnected after a drop: rejoin the same room silently
      const session = sessionRef.current;
      if (!session) return;
      socket.emit("room:join", { ...session, clientId }, (res) => {
        if (res?.ok) {
          setRoom((prev) => withOffset(prev, res.state));
        } else {
          sessionRef.current = null;
          setRoom(null);
          handlersRef.current.onRoomLost?.(res?.error);
        }
      });
    };
    const onDisconnect = () => {
      setConnected(false);
      setTyping({});
    };
    const onUpdate = (patch) => setRoom((prev) => prev && withOffset(prev, patch));
    const onChatMessage = (msg) => {
      setRoom((prev) => prev && { ...prev, messages: [...prev.messages, msg].slice(-200) });
      handlersRef.current.onMessage?.(msg);
    };
    const onChatUpdate = (msg) =>
      setRoom((prev) => prev && { ...prev, messages: prev.messages.map((m) => (m.id === msg.id ? msg : m)) });
    const onStroke = (stroke) =>
      setRoom((prev) => prev && { ...prev, strokes: [...prev.strokes, stroke].slice(-1500) });
    const onTyping = ({ id, name, isTyping }) =>
      setTyping((prev) => {
        const next = { ...prev };
        if (isTyping) next[id] = name;
        else delete next[id];
        return next;
      });
    const onComplete = (data) => handlersRef.current.onTimerComplete?.(data);
    const onNudgeEvent = (data) => handlersRef.current.onNudge?.(data);
    const onTestStartEvent = (data) => handlersRef.current.onTestStart?.(data);
    const onAccountChangedEvent = () => handlersRef.current.onAccountChanged?.();
    const onKickedEvent = (data) => {
      sessionRef.current = null;
      setRoom(null);
      setTyping({});
      handlersRef.current.onKicked?.(data);
    };

    const onConnectError = (err) => setConnectError(err?.message || "Connection failed");
    const listeners = {
      connect: onConnect,
      connect_error: onConnectError,
      disconnect: onDisconnect,
      "room:update": onUpdate,
      "chat:message": onChatMessage,
      "chat:update": onChatUpdate,
      "wb:stroke": onStroke,
      typing: onTyping,
      "timer:complete": onComplete,
      nudge: onNudgeEvent,
      kicked: onKickedEvent,
      "test:start": onTestStartEvent,
      "account:changed": onAccountChangedEvent,
    };
    for (const [event, fn] of Object.entries(listeners)) socket.on(event, fn);
    socket.connect();
    return () => {
      for (const [event, fn] of Object.entries(listeners)) socket.off(event, fn);
      socket.disconnect();
    };
  }, [socket, clientId]);

  const request = useCallback(
    (event, payload, timeoutMs = 6000) =>
      new Promise((resolve) => {
        const done = (err, res) =>
          resolve(err ? { ok: false, error: "Can't reach the server. Check your internet connection and try again." } : res);
        if (payload === undefined) socket.timeout(timeoutMs).emit(event, done);
        else socket.timeout(timeoutMs).emit(event, payload, done);
      }),
    [socket]
  );

  const enter = useCallback(
    async (event, payload) => {
      const res = await request(event, { ...payload, clientId });
      if (res.ok) {
        // Remember enough to rejoin silently after a dropped connection
        sessionRef.current = { name: payload.name, avatar: payload.avatar, code: res.state.code, password: payload.password, token: payload.token };
        setRoom(withOffset(null, res.state));
      }
      return res;
    },
    [request, clientId]
  );

  const actions = useMemo(() => {
    const emit = (event) => (payload) => socket.emit(event, payload);
    return {
      createRoom: (options) => enter("room:create", options),
      joinRoom: (options) => enter("room:join", options),
      listRooms: async () => {
        const res = await request("rooms:list");
        return Array.isArray(res) ? res : [];
      },
      leaveRoom: () => {
        socket.emit("room:leave");
        sessionRef.current = null;
        setRoom(null);
        setTyping({});
      },

      // Presence
      setAway: emit("status:away"),
      updateStatus: emit("status:update"),
      nudge: emit("nudge"),
      toggleHand: () => socket.emit("hand:toggle"),
      lowerHand: emit("hand:lower"),

      // Chat
      sendMessage: (text, replyTo) => socket.emit("chat:send", { text, replyTo }),
      react: (messageId, emoji) => socket.emit("chat:react", { messageId, emoji }),
      pin: emit("chat:pin"),
      createPoll: (question, options) => socket.emit("chat:poll", { question, options }),
      vote: (messageId, index) => socket.emit("poll:vote", { messageId, index }),
      setTyping: emit("typing"),
      report: emit("report"),

      // Shared workspace
      addTask: emit("task:add"),
      toggleTask: emit("task:toggle"),
      deleteTask: emit("task:delete"),
      updateNotes: (notes) => {
        setRoom((prev) => prev && { ...prev, notes });
        socket.emit("notes:update", notes);
      },
      addResource: (title, url) => socket.emit("resource:add", { title, url }),
      removeResource: emit("resource:remove"),
      addStroke: (stroke) => {
        setRoom((prev) => prev && { ...prev, strokes: [...prev.strokes, { ...stroke, by: clientId }] });
        socket.emit("wb:stroke", stroke);
      },
      undoStroke: () => socket.emit("wb:undo"),
      clearBoard: () => socket.emit("wb:clear"),
      setVideo: emit("video:set"),
      controlVideo: (playing, time) => {
        setRoom((prev) =>
          prev?.video ? { ...prev, video: { ...prev.video, playing, time, updatedAt: Date.now() + (prev.clockOffset || 0) } } : prev
        );
        socket.emit("video:control", { playing, time });
      },
      clearVideo: () => socket.emit("video:clear"),

      // Room timer
      startTimer: () => socket.emit("timer:start"),
      pauseTimer: () => socket.emit("timer:pause"),
      resetTimer: () => socket.emit("timer:reset"),
      skipTimer: () => socket.emit("timer:skip"),
      updateSettings: emit("timer:settings"),

      // Video call
      joinCall: () => request("call:join", undefined, 15000),
      leaveCall: () => socket.emit("call:leave"),
      setLecture: emit("call:lecture"),
      allowSpeak: (clientId, allow) => socket.emit("call:allowSpeak", { clientId, allow }),
      muteAll: () => socket.emit("call:muteAll"),

      // Personal notes shared with the room
      shareNote: (title, text) => socket.emit("note:share", { title, text }),
      unshareNote: emit("note:unshare"),

      // Shared workspace: switch everyone's tab / full screen
      setStage: (tab, full) => socket.emit("stage:set", { tab, full }),

      // Group tests
      // AI generation can take a minute for a long test or a big PDF
      generateTest: (payload) => request("test:generate", payload, 180000),
      createTest: (payload) => request("test:create", payload),
      getTestState: (testId) => request("test:state", testId),
      answerTest: (testId, index, choice) => socket.emit("test:answer", { testId, index, choice }),
      submitTest: emit("test:submit"),
      cancelTest: emit("test:cancel"),

      // Login changed while in a room (Pro badge + limits follow the account)
      updateAuth: (token) => {
        if (sessionRef.current) sessionRef.current.token = token;
        socket.emit("auth:update", token);
      },

      // Host
      updateRoom: emit("host:settings"),
      kick: emit("host:kick"),
      makeHost: emit("host:transfer"),
    };
  }, [socket, enter, request, clientId]);

  // Manual retry from the error screen (socket.io also keeps retrying on its own)
  const retry = useCallback(() => {
    setConnectError(null);
    socket.disconnect();
    socket.connect();
  }, [socket]);

  return { clientId, connected, connectError, retry, room, typing, actions };
}
