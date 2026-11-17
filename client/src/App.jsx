import { Suspense, lazy, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, MessageSquare, Timer, Users } from "lucide-react";
import useSocket from "./hooks/useSocket";
import usePersonalTimer from "./hooks/usePersonalTimer";
import useLocalState from "./hooks/useLocalState";
import useNow from "./hooks/useNow";
import useAccount from "./hooks/useAccount";
import { FREE_ACCENTS, FREE_BACKGROUNDS } from "./lib/pro";
import { loadProfile, loadSession, saveProfile, saveSession } from "./lib/storage";
import { notify, playChime } from "./lib/sound";
import { getStats, recordSession, updateSession } from "./lib/stats";
import { dueRevisions, loadSyllabus, saveSyllabus } from "./lib/syllabus";
import { STARTER_FORMULAS } from "./lib/formulas";
import { mentionsName } from "./lib/chat";
import {
  TEST_NOTIFICATION_ID, applyStatusBar, cancelNotification, cancelTimerNotification, minimizeApp, onBackButton,
  scheduleNotificationAt, scheduleTimerNotification, setKeepAwake,
} from "./lib/native";
import { testStatus } from "./lib/tests";
import LobbyModal from "./components/LobbyModal";
import TopHeader from "./components/TopHeader";
import MembersList from "./components/MembersList";
import RoomGoals from "./components/RoomGoals";
import MyStats from "./components/MyStats";
import GoalChecklist from "./components/GoalChecklist";
import PomodoroTimer from "./components/PomodoroTimer";
import Whiteboard from "./components/Whiteboard";
import WatchParty from "./components/WatchParty";
import RoomChat from "./components/RoomChat";
import ResourcesPanel from "./components/ResourcesPanel";
import Leaderboard from "./components/Leaderboard";
import Toasts from "./components/Toasts";
import ConnectionErrorPage from "./components/ConnectionErrorPage";
import { serverMissing } from "./lib/native";
import TestsPanel from "./components/TestsPanel";
import TestBanner from "./components/TestBanner";
import TestTaker from "./components/TestTaker";
import Workspace from "./components/Workspace";
import NotesDrawer from "./components/NotesDrawer";
import { newPage, notebookText } from "./lib/notebook";

// Dialogs load on first open to keep the initial bundle small
const RoomSettingsModal = lazy(() => import("./components/modals/RoomSettingsModal"));
const ProfileModal = lazy(() => import("./components/modals/ProfileModal"));
const ShortcutsModal = lazy(() => import("./components/modals/ShortcutsModal"));
const TourModal = lazy(() => import("./components/modals/TourModal"));
const SyllabusModal = lazy(() => import("./components/modals/SyllabusModal"));
const PlannerModal = lazy(() => import("./components/modals/PlannerModal"));
const FormulaBankModal = lazy(() => import("./components/modals/FormulaBankModal"));
const InsightsModal = lazy(() => import("./components/modals/InsightsModal"));
const SessionCompleteModal = lazy(() => import("./components/modals/SessionCompleteModal"));
const CreateTestModal = lazy(() => import("./components/modals/CreateTestModal"));
const TestResultsModal = lazy(() => import("./components/modals/TestResultsModal"));
const ProModal = lazy(() => import("./components/modals/ProModal"));
const AccountModal = lazy(() => import("./components/modals/AccountModal"));
const NoteViewerModal = lazy(() => import("./components/modals/NoteViewerModal"));
// The call UI pulls in LiveKit, so it loads only when someone joins a call
const CallView = lazy(() => import("./components/CallView"));

// Invite links look like /room/STUDY-9X2K
const codeFromPath = () => window.location.pathname.match(/^\/room\/([\w-]+)/i)?.[1]?.toUpperCase() || "";

const tabletQuery = window.matchMedia("(min-width: 768px)");
const desktopQuery = window.matchMedia("(min-width: 1280px)");
const subscribeScreen = (cb) => {
  tabletQuery.addEventListener("change", cb);
  desktopQuery.addEventListener("change", cb);
  return () => {
    tabletQuery.removeEventListener("change", cb);
    desktopQuery.removeEventListener("change", cb);
  };
};
// "phone" | "tablet" | "desktop"
const getScreen = () => (desktopQuery.matches ? "desktop" : tabletQuery.matches ? "tablet" : "phone");

const isTypingTarget = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

function TabButton({ active, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 py-3 text-[11px] font-semibold uppercase tracking-wider transition ${
        active ? "text-indigo-300 border-b-2 border-indigo-500" : "text-slate-500 hover:text-slate-300 border-b-2 border-transparent"
      }`}
    >
      {children}
      {badge > 0 && (
        <span className="ml-1.5 inline-flex min-w-4 h-4 px-1 items-center justify-center rounded-full bg-rose-500 text-white text-[9px]">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

export default function App() {
  const [saved] = useState(loadSession);
  const [profile, setProfile] = useState(loadProfile);
  const [lobby, setLobby] = useState(() => ({ code: codeFromPath(), error: "" }));
  const [rejoining, setRejoining] = useState(() => Boolean(saved?.name && (lobby.code || saved?.code)));
  const [stats, setStats] = useState(getStats);
  const [toasts, setToasts] = useState([]);
  const [mobileTab, setMobileTab] = useState("focus");
  const [rightTab, setRightTab] = useState("chat");
  const [centerTab, setCenterTab] = useState("board");
  const [workspaceFull, setWorkspaceFull] = useState(false);
  const [seenStageAt, setSeenStageAt] = useState(-1);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notebook, setNotebook] = useLocalState("fs:notebook", { pages: [newPage()], activeId: null });
  const [seenTime, setSeenTime] = useState(0);
  const [modal, setModal] = useState(() => (new URLSearchParams(window.location.search).has("pro") ? "pro" : null));
  const [proReason, setProReason] = useState("");
  const [sessionResult, setSessionResult] = useState(null);
  const [subjectOverride, setSubjectOverride] = useState(null);
  const [takingTestId, setTakingTestId] = useState(null);
  const [resultsTestId, setResultsTestId] = useState(null);
  const [timerSource, setTimerSource] = useLocalState("fs:timerSource", "room");
  const [planner, setPlanner] = useLocalState("fs:planner", []);
  const [formulas, setFormulas] = useLocalState("fs:formulas", STARTER_FORMULAS);
  const [syllabus, setSyllabus] = useState(loadSyllabus);
  const screen = useSyncExternalStore(subscribeScreen, getScreen);
  // Tablet sidebar shows chat or the squad panel
  const [sideTab, setSideTab] = useState("chat");
  const [noteViewId, setNoteViewId] = useState(null);
  const [callCreds, setCallCreds] = useState(null); // { url, token } while you're in the video call
  const [joiningCall, setJoiningCall] = useState(false);
  const now = useNow(30000);
  const autoJoinStarted = useRef(false);
  // Tab switches during the current focus interval, for the focus score
  const trackRef = useRef({ key: null, switches: 0, hiddenMs: 0, hiddenSince: null });

  const accountState = useAccount();
  const { pro, account } = accountState;
  const openPro = useCallback((reason = "") => {
    setProReason(typeof reason === "string" ? reason : "");
    setModal("pro");
  }, []);

  const updateProfile = useCallback((patch) => {
    setProfile((p) => {
      const next = { ...p, ...patch };
      saveProfile(next);
      return next;
    });
  }, []);

  const updateSyllabus = (next) => {
    setSyllabus(next);
    saveSyllabus(next);
  };

  // Apply theme, accent and background to the document
  const accent = pro || FREE_ACCENTS.includes(profile.accent) ? profile.accent : FREE_ACCENTS[0];
  const background = pro || FREE_BACKGROUNDS.includes(profile.background) ? profile.background : FREE_BACKGROUNDS[0];
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = profile.theme;
    root.dataset.accent = accent;
    root.dataset.bg = background;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", profile.theme === "light" ? "#f8fafc" : "#020617");
  }, [profile.theme, accent, background]);

  const pushToast = useCallback((text) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  // Current planner block decides the subject unless the user picked one
  const hm = new Date(now).toTimeString().slice(0, 5);
  const activeBlock = planner.find((b) => b.start <= hm && hm < b.end) || null;
  const subject = subjectOverride || activeBlock?.subject || "General";

  const handleComplete = ({ phase, minutes, exam }) => {
    playChime();
    if (phase !== "focus") {
      notify("break's over ⏰", "back to the grind 💪", { scheduled: true });
      pushToast("⏰ break's over — back to the grind 💪");
      return;
    }
    const t = trackRef.current;
    const hiddenMs = t.hiddenMs + (t.hiddenSince ? Date.now() - t.hiddenSince : 0);
    const score = Math.round(Math.min(100, Math.max(0, 100 - t.switches * 10 - (hiddenMs / (minutes * 60000)) * 100)));
    const result = recordSession({ minutes, subject, score });
    setSessionResult({ ...result, distractions: t.switches });
    trackRef.current = { key: null, switches: 0, hiddenMs: 0, hiddenSince: null };
    setStats(getStats());
    notify(exam ? "mock test done! 📝" : "W session! 🎉", "you ate that. take a break ☕", { scheduled: true });
    pushToast(exam ? "📝 mock test done!" : "🎉 W session! take a break ☕");
  };

  const solo = usePersonalTimer(handleComplete);

  const { clientId, connected, connectError, retry, room, typing, actions } = useSocket({
    // Room timer completions only count when you're following the room timer
    onTimerComplete: (data) => {
      if (timerSource === "room") handleComplete(data);
    },
    onNudge: ({ from }) => {
      playChime();
      notify(`${from} nudged you 👋`, "lock back in!");
      pushToast(`👋 ${from} nudged you — lock back in!`);
    },
    onMessage: (msg) => {
      if (!myName || msg.senderId === clientId || profile.blocked.includes(msg.senderId)) return;
      if (msg.senderId !== "system" && mentionsName(msg.text, myName)) {
        notify(`${msg.sender} mentioned you`, msg.text);
        pushToast(`💬 ${msg.sender} mentioned you: ${msg.text.slice(0, 60)}`);
      }
    },
    onRoomLost: (error) => {
      setLobby((l) => ({ ...l, error: error || "This room is no longer available." }));
      saveSession(saved?.name ? { name: saved.name } : null);
    },
    // A group test just started: open it for everyone who hasn't submitted yet
    onTestStart: ({ id, title }) => {
      playChime();
      notify("📝 test is LIVE!", `${title} — lock in 🔒`);
      pushToast(`📝 "${title}" is live — good luck! 🍀`);
      setModal(null);
      setTakingTestId(id);
    },
    onAccountChanged: () => accountState.refresh(),
    onKicked: ({ room: roomName }) => {
      setLobby({ code: "", error: `You were removed from "${roomName}" by the host.` });
      saveSession(myName ? { name: myName } : null);
    },
  });

  const me = room?.members.find((m) => m.clientId === clientId);
  const myName = me?.name || saved?.name || "";
  const isHost = !!room && room.meta.hostId === clientId;
  const hostPresent = !!room && room.members.some((m) => m.clientId === room.meta.hostId);
  const canControlRoomTimer = !!room && (!room.meta.hostOnlyTimer || isHost || !hostPresent);

  const usingSolo = timerSource === "solo";
  const current = usingSolo
    ? { timer: solo.timer, settings: solo.settings, offset: 0, controls: solo.controls, canControl: true }
    : room && { timer: room.timer, settings: room.settings, offset: room.clockOffset, controls: actions, canControl: canControlRoomTimer };
  const focusRunning = !!current?.timer.running && (current.timer.phase === "focus" || (usingSolo && solo.timer.mode === "exam"));
  const focusKey = focusRunning ? `${timerSource}-${current.timer.mode || "room"}-${current.timer.phase}-${current.timer.round}` : null;

  // Focus score: count tab switches while a focus interval runs
  useEffect(() => {
    if (!focusKey) return;
    if (trackRef.current.key !== focusKey) trackRef.current = { key: focusKey, switches: 0, hiddenMs: 0, hiddenSince: null };
    const onVisibility = () => {
      const t = trackRef.current;
      if (document.hidden) {
        t.switches += 1;
        t.hiddenSince = Date.now();
      } else if (t.hiddenSince) {
        t.hiddenMs += Date.now() - t.hiddenSince;
        t.hiddenSince = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [focusKey]);

  // Android app: the OS delivers the "time's up" notification (Android may pause the app in the background),
  // the screen stays on while focusing, and the status bar follows the theme
  const notifyAt = current?.timer.running ? current.timer.endsAt - current.offset : null;
  const notifyIsFocus = current?.timer.phase === "focus" || (usingSolo && solo.timer.mode === "exam");
  useEffect(() => {
    if (notifyAt) {
      scheduleTimerNotification(
        notifyAt,
        notifyIsFocus ? "W session! 🎉" : "break's over ⏰",
        notifyIsFocus ? "you ate that. take a break ☕" : "back to the grind 💪"
      );
    } else {
      cancelTimerNotification();
    }
  }, [notifyAt, notifyIsFocus]);

  useEffect(() => {
    setKeepAwake(focusRunning);
  }, [focusRunning]);

  useEffect(() => {
    applyStatusBar(profile.theme);
  }, [profile.theme]);

  // Android back button: close the top dialog first, then go back to the timer, then minimise
  const backRef = useRef({});
  useEffect(() => {
    backRef.current = { modal, sessionResult, mobileTab, takingTestId, resultsTestId, notesOpen, workspaceFull };
  });
  useEffect(
    () =>
      onBackButton(() => {
        const s = backRef.current;
        if (s.takingTestId) setTakingTestId(null);
        else if (s.notesOpen) setNotesOpen(false);
        else if (s.workspaceFull) setWorkspaceFull(false);
        else if (s.resultsTestId) setResultsTestId(null);
        else if (s.modal) setModal(null);
        else if (s.sessionResult) setSessionResult(null);
        else if (s.mobileTab !== "focus") setMobileTab("focus");
        else minimizeApp();
      }),
    []
  );

  // Refresh / invite link: rejoin automatically when we already know the user's name
  useEffect(() => {
    if (autoJoinStarted.current || !rejoining) return;
    autoJoinStarted.current = true;
    const code = lobby.code || saved.code;
    actions.joinRoom({ name: saved.name, code, avatar: profile.avatar, token: accountState.token }).then((res) => {
      if (!res.ok) setLobby({ code, error: res.error, needsPassword: res.needsPassword });
      else saveSession({ name: saved.name, code: res.state.code });
      setRejoining(false);
    });
  }, [actions, rejoining, saved, lobby.code, profile.avatar, accountState.token]);

  // Logging in/out while in a room updates your badge and limits there
  const authToken = accountState.token;
  const roomCodeForAuth = room?.code;
  useEffect(() => {
    if (roomCodeForAuth) actions.updateAuth(authToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  // Keep the URL in sync with the current room so it can be shared.
  // An invite link stays in the address bar until the user actually leaves a room.
  const roomCode = room?.code;
  const lastRoomRef = useRef(null);
  useEffect(() => {
    if (roomCode) {
      lastRoomRef.current = roomCode;
      if (window.location.pathname !== `/room/${roomCode}`) window.history.replaceState(null, "", `/room/${roomCode}`);
    } else if (lastRoomRef.current) {
      lastRoomRef.current = null;
      window.history.replaceState(null, "", "/");
    }
  }, [roomCode]);

  // Presence: mark as "Away" while the tab is hidden
  useEffect(() => {
    if (!roomCode) return;
    const update = () => actions.setAway(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [roomCode, actions, connected]);

  // Tell the room what you're doing when you use the solo timer, and which subject
  const soloActivity = usingSolo
    ? solo.timer.running ? (solo.timer.phase === "focus" || solo.timer.mode === "exam" ? "focus" : "break") : "idle"
    : null;
  useEffect(() => {
    if (!roomCode) return;
    actions.updateStatus({ activity: soloActivity, subject });
  }, [roomCode, connected, soloActivity, subject, actions]);

  // Shared workspace: picking a tool or going full screen shows it to everyone; leaving full screen is personal
  const selectTab = (tab) => {
    setCenterTab(tab);
    actions.setStage(tab, workspaceFull);
  };
  const enterFull = () => {
    setWorkspaceFull(true);
    actions.setStage(centerTab, true);
  };
  const exitFull = useCallback(() => setWorkspaceFull(false), []);

  // Keyboard shortcuts
  const shortcutState = useRef({});
  useEffect(() => {
    shortcutState.current = { current, modal: modal || takingTestId || resultsTestId, actions, selectTab };
  });
  useEffect(() => {
    if (!roomCode) return;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const { current: timer, modal: openModal, actions: act, selectTab: pickTab } = shortcutState.current;
      if (e.key === "?") {
        e.preventDefault();
        setModal("shortcuts");
        return;
      }
      if (openModal) return;
      const key = e.key.toLowerCase();
      if (e.key === " " && timer?.canControl) {
        e.preventDefault();
        if (timer.timer.running) timer.controls.pauseTimer();
        else timer.controls.startTimer();
      } else if (key === "c") {
        setRightTab("chat");
        setSideTab("chat");
        setMobileTab("chat");
      } else if (key === "n") {
        setNotesOpen((open) => !open);
      } else if (key === "w") {
        pickTab("board");
        setMobileTab("focus");
      } else if (key === "h") {
        act.toggleHand();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [roomCode]);

  // Group tests: tick every second while any test is upcoming or live
  const openTests = (room?.tests || []).filter((t) => !t.ended);
  const testNow = useNow(1000, openTests.length > 0);
  const nextTestStart = openTests.filter((t) => t.startsAt > testNow + (room?.clockOffset || 0)).sort((a, b) => a.startsAt - b.startsAt)[0];
  const nextTestKey = nextTestStart ? `${nextTestStart.id}:${nextTestStart.startsAt - (room?.clockOffset || 0)}` : null;
  useEffect(() => {
    // Android: remind everyone when the next test starts, even if the app is closed
    if (!nextTestKey) return void cancelNotification(TEST_NOTIFICATION_ID);
    const [, at] = nextTestKey.split(":");
    scheduleNotificationAt(TEST_NOTIFICATION_ID, Number(at), "📝 test is starting!", "open StudyGroup and lock in 🔒");
  }, [nextTestKey]);
  const finishTaking = useCallback(() => {
    setResultsTestId(takingTestId);
    setTakingTestId(null);
  }, [takingTestId]);

  const enterRoom = async (promise, name) => {
    const res = await promise;
    if (res.ok) {
      saveSession({ name, code: res.state.code });
      setLobby({ code: "", error: "" });
      if (!profile.onboarded) setModal("tour");
    }
    return res;
  };

  const joinCall = async () => {
    setJoiningCall(true);
    const res = await actions.joinCall();
    setJoiningCall(false);
    if (!res.ok) return pushToast(`📹 ${res.error}`);
    setCallCreds({ url: res.url, token: res.token });
  };
  const leaveCall = () => {
    setCallCreds(null);
    actions.leaveCall();
  };

  const leaveRoom = () => {
    if (callCreds) leaveCall();
    actions.leaveRoom();
    saveSession(myName ? { name: myName } : null);
    setMobileTab("focus");
    setModal(null);
  };

  const toggleBlock = (id) =>
    updateProfile({ blocked: profile.blocked.includes(id) ? profile.blocked.filter((x) => x !== id) : [...profile.blocked, id] });

  // Paywall + account dialogs work in the lobby and in a room
  const accountModals = (
    <>
      {modal === "pro" && (
        <ProModal
          account={account}
          token={accountState.token}
          billing={accountState.billing}
          clientId={clientId}
          reason={proReason}
          onNeedLogin={() => setModal("account")}
          onActivated={(next) => { accountState.setAccount(next); pushToast("✨ you're Pro now — everything's unlocked!"); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "account" && <AccountModal accountState={accountState} onGetPro={() => openPro()} onClose={() => setModal(null)} />}
    </>
  );

  if (!room) {
    // Can't reach the server (or this app build has no server address): show a proper error page
    if (serverMissing || (!connected && connectError)) {
      return <ConnectionErrorPage serverMissing={serverMissing} detail={connectError} onRetry={retry} />;
    }
    if (rejoining) {
      return (
        <div className="min-h-dvh text-slate-400 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Joining room…
        </div>
      );
    }
    return (
      <>
        <LobbyModal
          key={`${lobby.code}-${lobby.error}`}
          initialName={myName}
          initialCode={lobby.code}
          initialError={lobby.error}
          avatar={profile.avatar}
          onAvatarChange={(avatar) => updateProfile({ avatar })}
          connected={connected}
          listRooms={actions.listRooms}
          onCreate={(options) => enterRoom(actions.createRoom({ ...options, avatar: profile.avatar, token: accountState.token }), options.name)}
          onJoin={(options) => enterRoom(actions.joinRoom({ ...options, avatar: profile.avatar, token: accountState.token }), options.name)}
          pro={pro}
          account={account}
          onUpgrade={() => openPro("Private rooms with a password are part of Pro.")}
          onAccount={() => setModal("account")}
        />
        <Suspense fallback={null}>{accountModals}</Suspense>
        <Toasts toasts={toasts} />
      </>
    );
  }

  // Unread chat badge: anything from others newer than what was on screen
  const chatVisible = rightTab === "chat" && (screen === "desktop" || (screen === "tablet" ? sideTab === "chat" : mobileTab === "chat"));
  const lastMessageTime = room.messages.at(-1)?.time ?? 0;
  if (chatVisible && seenTime !== lastMessageTime) setSeenTime(lastMessageTime);
  const unread = chatVisible
    ? 0
    : room.messages.filter((m) => m.time > seenTime && m.senderId !== clientId && m.senderId !== "system" && !profile.blocked.includes(m.senderId)).length;

  // Follow the room's stage when someone else switches tools
  const stage = room.stage;
  if (stage && stage.at !== seenStageAt) {
    setSeenStageAt(stage.at);
    setCenterTab(stage.tab);
    if (stage.full) setWorkspaceFull(true);
  }

  const renderTool = (tab, fill) => {
    // The board always fits its card: the inline card is a full screen tall too
    if (tab === "board") return <Whiteboard strokes={room.strokes} actions={actions} fill />;
    if (tab === "watch") return <WatchParty video={room.video} clockOffset={room.clockOffset} actions={actions} fill={fill} />;
    return (
      <TestsPanel
        tests={room.tests}
        now={testNow + room.clockOffset}
        clientId={clientId}
        isHost={isHost}
        onCreate={() => setModal("createTest")}
        onTake={setTakingTestId}
        onResults={setResultsTestId}
        onCancel={actions.cancelTest}
      />
    );
  };

  const revisionsDue = dueRevisions(syllabus, now).length;
  // Phone: the bottom-nav tab. Tablet: the main area plus whichever sidebar tab is picked. Desktop: everything.
  const panelClass = (tab) => {
    const phone = mobileTab === tab ? "flex" : "hidden";
    const tablet = tab === "focus" || sideTab === (tab === "room" ? "squad" : "chat") ? "md:flex" : "md:hidden";
    return `${phone} ${tablet} xl:flex flex-col min-h-0`;
  };
  const sideTabClass = (active) =>
    `relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold transition ${active ? "bg-slate-100 text-slate-950" : "text-slate-400 hover:text-slate-100"}`;
  const sideTabs = (
    <div className="hidden md:flex xl:hidden shrink-0 gap-1 p-1 rounded-full bg-slate-900 border border-slate-800">
      <button onClick={() => setSideTab("chat")} className={sideTabClass(sideTab === "chat")}>
        <MessageSquare className="w-4 h-4" /> Chat
        {unread > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center">{unread > 99 ? "99+" : unread}</span>}
      </button>
      <button onClick={() => setSideTab("squad")} className={sideTabClass(sideTab === "squad")}>
        <Users className="w-4 h-4" /> Squad
        {room.hands.length > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] flex items-center justify-center">✋{room.hands.length}</span>}
      </button>
    </div>
  );

  return (
    <div className="h-dvh w-full text-slate-100 flex flex-col font-sans overflow-hidden">
      <TopHeader
        room={room} isHost={isHost} revisionsDue={revisionsDue} pro={pro} account={account}
        inCall={!!callCreds} joiningCall={joiningCall} onJoinCall={joinCall} onOpen={setModal} onLeave={leaveRoom}
      />
      {!connected && (
        <div className="shrink-0 w-full flex items-center justify-center gap-3 px-4 py-2 bg-amber-400 text-[oklch(17%_0.03_285)] text-sm font-bold">
          <span className="w-2 h-2 rounded-full bg-[oklch(17%_0.03_285)] animate-pulse" /> Connection lost — reconnecting…
          <button onClick={retry} className="px-3 py-0.5 rounded-full bg-white/80 text-xs">Retry now</button>
        </div>
      )}
      {!callCreds && room.call?.inCall?.length > 0 && (
        <button onClick={joinCall} disabled={joiningCall} className="shrink-0 w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-bold">
          📹 live call — {room.call.inCall.map((m) => m.name).slice(0, 3).join(", ")}{room.call.inCall.length > 3 && ` +${room.call.inCall.length - 3}`} {room.call.inCall.length === 1 ? "is" : "are"} in
          <span className="ml-1 px-2.5 py-0.5 rounded-full bg-white text-emerald-600 text-xs">{joiningCall ? "joining…" : "join →"}</span>
        </button>
      )}
      <TestBanner
        tests={room.tests}
        now={testNow + room.clockOffset}
        clientId={clientId}
        onTake={setTakingTestId}
        onOpenTests={() => { setCenterTab("tests"); setMobileTab("focus"); }}
      />

      {/* Phone: one panel at a time. Tablet: main area + sidebar (chat / squad). Desktop: 3 / 6 / 3 columns. */}
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-rows-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-12">
        {/* Squad panel: members, goals, progress */}
        <aside className={`${panelClass("room")} md:col-start-2 md:row-start-1 xl:col-start-1 xl:col-span-3 flex-1 md:flex-none md:h-full md:border-l xl:border-l-0 xl:border-r border-slate-800/80 bg-slate-900/30 p-4 space-y-6 overflow-y-auto`}>
          {sideTabs}
          <MembersList
            members={room.members}
            timer={room.timer}
            hands={room.hands}
            hostId={room.meta.hostId}
            clientId={clientId}
            isHost={isHost}
            blocked={profile.blocked}
            actions={actions}
            onBlock={toggleBlock}
          />
          <RoomGoals meta={room.meta} challenge={room.challenge} code={room.code} now={now} />
          <MyStats stats={stats} dailyGoal={profile.dailyGoal} onOpenInsights={() => setModal("insights")} />
          <GoalChecklist tasks={room.tasks} onAdd={actions.addTask} onToggle={actions.toggleTask} onDelete={actions.deleteTask} />
        </aside>

        {/* Center panel: timer & shared workspace */}
        <main className={`${panelClass("focus")} md:col-start-1 md:row-start-1 xl:col-start-4 xl:col-span-6 flex-1 md:flex-none md:h-full p-4 md:p-5 lg:p-6 space-y-6 overflow-y-auto`}>
          <PomodoroTimer
            source={timerSource}
            onSourceChange={setTimerSource}
            timer={current.timer}
            settings={current.settings}
            clockOffset={current.offset}
            controls={current.controls}
            canControl={current.canControl}
            soloMode={solo.timer.mode}
            onSoloModeChange={solo.controls.setMode}
            subject={subject}
            subjectOverride={subjectOverride}
            onSubjectChange={setSubjectOverride}
            activeBlock={activeBlock}
          />

          <Workspace
            tab={centerTab}
            onTab={selectTab}
            full={workspaceFull}
            onEnterFull={enterFull}
            onExitFull={exitFull}
            stage={room.stage}
            myName={myName}
            dots={{ watch: !!room.video, tests: openTests.length > 0 }}
            render={renderTool}
          />
        </main>

        {/* Right panel: chat, resources, leaderboard */}
        <aside className={`${panelClass("chat")} md:col-start-2 md:row-start-1 xl:col-start-10 xl:col-span-3 flex-1 md:flex-none md:h-full border-l border-slate-800/80 bg-slate-900/30 overflow-hidden`}>
          <div className="hidden md:block xl:hidden shrink-0 p-3 pb-0">{sideTabs}</div>
          <div className="flex border-b border-slate-800/80 shrink-0">
            <TabButton active={rightTab === "chat"} onClick={() => setRightTab("chat")} badge={unread}>Chat</TabButton>
            <TabButton active={rightTab === "resources"} onClick={() => setRightTab("resources")}>
              Links{room.resources.length > 0 && <span className="text-slate-600"> {room.resources.length}</span>}
            </TabButton>
            <TabButton active={rightTab === "leaders"} onClick={() => setRightTab("leaders")}>Leaders</TabButton>
          </div>
          <div className="flex-1 min-h-0">
            {rightTab === "chat" && (
              <RoomChat
                messages={room.messages}
                pinnedId={room.pinnedId}
                clientId={clientId}
                myName={myName}
                typingNames={Object.values(typing)}
                blocked={profile.blocked}
                aiEnabled={room.meta.aiEnabled}
                actions={actions}
                onUpgrade={() => openPro("More AI Tutor questions every day with Pro.")}
                onOpenNote={setNoteViewId}
              />
            )}
            {rightTab === "resources" && (
              <ResourcesPanel resources={room.resources} onAdd={actions.addResource} onRemove={actions.removeResource} />
            )}
            {rightTab === "leaders" && <Leaderboard leaderboard={room.leaderboard} clientId={clientId} />}
          </div>
        </aside>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden shrink-0 grid grid-cols-3 border-t border-slate-800/80 bg-slate-900/90 backdrop-blur-md safe-bottom">
        {[
          { id: "focus", label: "Focus", Icon: Timer },
          { id: "chat", label: "Chat", Icon: MessageSquare, badge: unread },
          { id: "room", label: "Room", Icon: Users, badge: room.hands.length },
        ].map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            className={`relative flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium ${
              mobileTab === id ? "text-indigo-300" : "text-slate-500"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
            {badge > 0 && (
              <span className="absolute top-1 left-1/2 ml-2 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <Suspense fallback={null}>
      {accountModals}
      {modal === "room" && isHost && <RoomSettingsModal meta={room.meta} pro={pro} onUpgrade={() => openPro("Private rooms with a password are part of Pro.")} onSave={actions.updateRoom} onClose={() => setModal(null)} />}
      {modal === "profile" && <ProfileModal profile={profile} pro={pro} onUpgrade={() => openPro("Every accent colour and background scene comes with Pro.")} onChange={updateProfile} onClose={() => setModal(null)} />}
      {modal === "shortcuts" && <ShortcutsModal onClose={() => setModal(null)} />}
      {modal === "tour" && <TourModal onClose={() => { setModal(null); updateProfile({ onboarded: true }); }} />}
      {modal === "syllabus" && <SyllabusModal syllabus={syllabus} now={now} onChange={updateSyllabus} onClose={() => setModal(null)} />}
      {modal === "planner" && <PlannerModal blocks={planner} activeBlockId={activeBlock?.id} onChange={setPlanner} onClose={() => setModal(null)} />}
      {modal === "formulas" && (
        <FormulaBankModal
          formulas={formulas}
          onChange={setFormulas}
          onShare={(text) => { actions.sendMessage(text); pushToast("📤 Formula shared to room chat"); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "insights" && <InsightsModal stats={stats} name={myName} pro={pro} onUpgrade={() => openPro("Heatmap, weekly report, best focus time and recap cards are Pro.")} onClose={() => setModal(null)} />}
      {modal === "createTest" && (
        <CreateTestModal
          notes={notebookText(notebook)}
          aiEnabled={room.meta.aiEnabled}
          pro={pro}
          account={account}
          onUpgrade={() => openPro("5 AI tests a day and unlimited group tests with Pro.")}
          onUsageChanged={accountState.refresh}
          actions={actions}
          onCreated={() => { setCenterTab("tests"); pushToast("🚀 test sent to the squad!"); }}
          onClose={() => setModal(null)}
        />
      )}
      {resultsTestId && room.tests.some((t) => t.id === resultsTestId) && (
        <TestResultsModal
          test={room.tests.find((t) => t.id === resultsTestId)}
          clientId={clientId}
          actions={actions}
          onClose={() => setResultsTestId(null)}
        />
      )}
      {sessionResult && !modal && (
        <SessionCompleteModal
          result={sessionResult}
          onSave={(id, patch) => { updateSession(id, patch); setStats(getStats()); }}
          onClose={() => setSessionResult(null)}
        />
      )}
      </Suspense>

      {(() => {
        const taking = room.tests.find((t) => t.id === takingTestId);
        if (!taking || testStatus(taking, testNow + room.clockOffset) === "upcoming") return null;
        return (
          <TestTaker
            key={taking.id}
            test={taking}
            clockOffset={room.clockOffset}
            actions={actions}
            onMinimize={() => setTakingTestId(null)}
            onFinished={finishTaking}
          />
        );
      })()}

      {callCreds && (
        <Suspense fallback={null}>
          <CallView
            url={callCreds.url}
            token={callCreds.token}
            hostId={room.meta.hostId}
            myClientId={clientId}
            call={room.call}
            hands={room.hands}
            actions={actions}
            onLeave={leaveCall}
          />
        </Suspense>
      )}

      <NotesDrawer
        open={notesOpen}
        onOpenChange={setNotesOpen}
        notebook={notebook}
        onChange={setNotebook}
        sharedNotes={room.sharedNotes || []}
        onShareNote={({ title, text }) => { actions.shareNote(title, text); pushToast("📒 notes shared with the squad!"); }}
        onOpenNote={setNoteViewId}
      />
      {noteViewId && (
        <Suspense fallback={null}>
          <NoteViewerModal
            note={(room.sharedNotes || []).find((n) => n.id === noteViewId)}
            canRemove={(room.sharedNotes || []).some((n) => n.id === noteViewId && (n.byId === clientId || isHost))}
            onSaveCopy={(note) => {
              setNotebook((nb) => ({ ...nb, pages: [...nb.pages, { ...newPage(`${note.title} (from ${note.by})`), text: note.text }] }));
              pushToast("📥 saved to your notebook");
            }}
            onRemove={(id) => { actions.unshareNote(id); setNoteViewId(null); }}
            onClose={() => setNoteViewId(null)}
          />
        </Suspense>
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}
