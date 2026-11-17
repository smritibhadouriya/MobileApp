import { useEffect, useState } from "react";
import { Loader2, Lock, RefreshCw, Users, ChevronDown } from "lucide-react";
import { AVATARS } from "../lib/subjects";
import Logo from "./ui/Logo";
import { ProTag } from "./ui/ProLock";

const STICKERS = [
  { text: "⏱️ one timer for the squad", bg: "oklch(88% 0.1 300)", tilt: "-rotate-2" },
  { text: "🔥 streaks that slap", bg: "oklch(90% 0.12 60)", tilt: "rotate-1" },
  { text: "💬 doubts > memes (mostly)", bg: "oklch(90% 0.1 165)", tilt: "rotate-2" },
  { text: "🌱 grow your study plant", bg: "oklch(92% 0.12 120)", tilt: "-rotate-1" },
  { text: "📚 syllabus tracker", bg: "oklch(89% 0.08 230)", tilt: "rotate-1" },
];

export default function LobbyModal({ initialName = "", initialCode = "", initialError = "", avatar, onAvatarChange, connected, onCreate, onJoin, listRooms, pro, account, onUpgrade, onAccount }) {
  const [userName, setUserName] = useState(initialName);
  const [roomCode, setRoomCode] = useState(initialCode);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState({ roomName: "", isPublic: false, password: "" });
  const [publicRooms, setPublicRooms] = useState(null);

  const refreshRooms = () => listRooms().then(setPublicRooms);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    listRooms().then((rooms) => !cancelled && setPublicRooms(rooms));
    return () => {
      cancelled = true;
    };
  }, [connected, listRooms]);

  const submit = async (action) => {
    setBusy(true);
    const res = await action();
    // On success the parent switches to the room view and this component unmounts
    if (!res.ok) {
      setError(res.error);
      if (res.needsPassword) setNeedsPassword(true);
      setBusy(false);
    }
  };

  const handleCreateRoom = () => {
    if (!userName.trim()) return setError("Please enter your name!");
    submit(() => onCreate({ name: userName.trim(), ...options }));
  };

  const handleJoinRoom = (code = roomCode) => {
    if (!userName.trim() || !code.trim()) return setError("Please enter both Name and Room Code!");
    submit(() => onJoin({ name: userName.trim(), code: code.trim().toUpperCase(), password }));
  };

  const pickPublicRoom = (room) => {
    setRoomCode(room.code);
    setNeedsPassword(room.hasPassword);
    setError("");
    if (!room.hasPassword) handleJoinRoom(room.code);
  };

  const inputClass = "w-full px-4 py-3 bg-slate-950/60 border border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm placeholder:text-slate-500";
  const labelClass = "text-[11px] font-semibold text-slate-400 uppercase tracking-[0.14em]";

  return (
    <div className="min-h-dvh text-slate-100 flex items-center justify-center px-4 py-8 safe-top safe-bottom">
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-12 items-center">
        {/* Hero */}
        <section className="space-y-4 sm:space-y-6 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-3">
            <Logo className="w-12 h-12" />
            <span className="font-display text-2xl font-bold tracking-tight">StudyGroup</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-[1.02] tracking-tight">
            lock in.
            <span className="block text-indigo-500">together. 🔒</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto lg:mx-0">
            studying alone is lowkey mid. start one timer with the squad, grow your streak and actually finish the syllabus fr.
          </p>
          <ul className="flex flex-wrap justify-center lg:justify-start gap-2.5 max-w-lg mx-auto lg:mx-0">
            {STICKERS.map(({ text, bg, tilt }) => (
              <li key={text} className={`sticker ${tilt}`} style={{ backgroundColor: bg }}>{text}</li>
            ))}
          </ul>
        </section>

        {/* Form */}
        <section className="paper-card rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
            <h2 className="font-display text-2xl font-bold">join the study sesh ✨</h2>
            <p className="text-xs text-slate-500 mt-1">drop a name your friends will recognise</p>
            </div>
            <button onClick={onAccount} className="shrink-0 text-xs font-semibold text-indigo-500 hover:text-indigo-400">
              {account ? <>{account.name}{pro && " ✨"}</> : "log in"}
            </button>
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Your name & avatar</label>
            <div className="flex gap-2">
              <select
                value={avatar}
                onChange={(e) => onAvatarChange(e.target.value)}
                aria-label="Avatar"
                className="px-2 bg-slate-950/60 border border-slate-700 rounded-xl text-xl focus:outline-none focus:border-indigo-500"
              >
                {AVATARS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <input
                type="text"
                placeholder="your name (e.g. Rahul)"
                value={userName}
                maxLength={30}
                onChange={(e) => { setUserName(e.target.value); setError(""); }}
                className={inputClass}
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="space-y-2">
            <button
              onClick={handleCreateRoom}
              disabled={busy}
              className="pop w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold rounded-xl text-base flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} start a new room 🚀
            </button>
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"
            >
              Room options <ChevronDown className={`w-3 h-3 transition ${showOptions ? "rotate-180" : ""}`} />
            </button>
            {showOptions && (
              <div className="space-y-2 p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                <input
                  type="text" placeholder="Room name (e.g. JEE Night Owls)" maxLength={40}
                  value={options.roomName} onChange={(e) => setOptions({ ...options, roomName: e.target.value })}
                  className={inputClass}
                />
                {pro ? (
                  <input
                    type="password" placeholder="Password (optional, makes it private)" maxLength={64} autoComplete="new-password"
                    value={options.password} onChange={(e) => setOptions({ ...options, password: e.target.value })}
                    className={inputClass}
                  />
                ) : (
                  <button type="button" onClick={onUpgrade} className="w-full text-left px-4 py-3 rounded-xl border border-dashed border-slate-700 text-sm text-slate-500 hover:text-slate-300">
                    🔒 Private room with password<ProTag />
                  </button>
                )}
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={options.isPublic} onChange={(e) => setOptions({ ...options, isPublic: e.target.checked })} className="accent-indigo-500" />
                  List in public rooms so anyone can find it
                </label>
              </div>
            )}
          </div>

          <div className="relative flex items-center">
            <div className="grow border-t border-slate-800"></div>
            <span className="shrink mx-3 text-[11px] text-slate-500 uppercase tracking-[0.14em]">or pull up to a friend's room</span>
            <div className="grow border-t border-slate-800"></div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="room code, e.g. STUDY-9X2K"
                value={roomCode}
                onChange={(e) => { setRoomCode(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                className={`${inputClass} flex-1 min-w-0 uppercase tracking-wider font-mono`}
              />
              <button
                onClick={() => handleJoinRoom()}
                disabled={busy}
                className="pop px-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 border border-slate-700 rounded-xl font-bold text-sm"
              >
                Join
              </button>
            </div>
            {needsPassword && (
              <input
                type="password" placeholder="Room password" autoFocus value={password} maxLength={64}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                className={inputClass}
              />
            )}
          </div>

          {/* Public rooms */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className={labelClass}>🔴 live rooms rn</span>
              <button onClick={refreshRooms} title="Refresh" className="p-1 text-slate-500 hover:text-slate-200">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {!connected && <p className="text-xs text-amber-400/80">Connecting to server…</p>}
              {connected && publicRooms === null && <p className="text-xs text-slate-500">Loading…</p>}
              {publicRooms?.length === 0 && (
                <p className="text-xs text-slate-500">no public rooms rn — start one and tick “List in public rooms” 👀</p>
              )}
              {publicRooms?.map((r) => (
                <button
                  key={r.code}
                  onClick={() => pickPublicRoom(r)}
                  className="w-full flex items-center gap-3 text-left p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-indigo-500/50 transition"
                >
                  <span className="w-9 h-9 shrink-0 rounded-lg bg-slate-800 flex items-center justify-center text-lg">{r.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                      <span className="truncate">{r.name}</span>
                      {r.hasPassword && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                    </span>
                    <span className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r.members} locked in</span>
                      {r.examName && <span className="truncate">🎯 {r.examName}</span>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
