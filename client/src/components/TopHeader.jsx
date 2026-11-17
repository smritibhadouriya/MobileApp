import { useState } from "react";
import {
  Copy, Check, Link2, LogOut, Wrench, BookOpenCheck, CalendarClock, Sigma, BarChart3,
  Keyboard, Settings, Palette, Crown, Lock, HelpCircle, Sparkles, UserRound, Video, Loader2,
} from "lucide-react";
import AmbientPlayer from "./AmbientPlayer";
import Menu, { MenuItem } from "./ui/Menu";
import { PUBLIC_URL } from "../lib/native";

export default function TopHeader({ room, isHost, revisionsDue, pro, account, inCall, joiningCall, onJoinCall, onOpen, onLeave }) {
  const [copied, setCopied] = useState(null);
  const { meta, code } = room;

  const copy = async (what) => {
    const text = what === "link" ? `${PUBLIC_URL}/room/${code}` : code;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be blocked on insecure origins; the code is still visible to copy manually
    }
  };

  return (
    <header className="relative z-20 shrink-0 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md safe-top">
      <div className="h-16 px-3 md:px-5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-10 w-10 shrink-0 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-xl">{meta.emoji}</div>
        <div className="min-w-0 hidden sm:block">
          <div className="flex items-center gap-1.5 font-display font-semibold text-base text-slate-100 truncate">
            {meta.name}
            {meta.hasPassword && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            {isHost ? <><Crown className="w-3 h-3 text-amber-400" /> You are the host</> : "StudyGroup Room"}
          </div>
        </div>
      </div>

      {/* Room Code Pill */}
      <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/60 pl-3 pr-1.5 py-1 rounded-full shrink-0">
        <span className="font-mono text-xs sm:text-sm font-bold text-indigo-400 tracking-wider">{code}</span>
        <button onClick={() => copy("code")} className="p-1 hover:text-indigo-300 transition text-slate-400" title="Copy code">
          {copied === "code" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
        <button onClick={() => copy("link")} className="p-1 hover:text-indigo-300 transition text-slate-400" title="Copy invite link">
          {copied === "link" ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {!inCall && (
          <button
            onClick={onJoinCall}
            disabled={joiningCall}
            title="Join the video call"
            className={`relative flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-60 ${
              room.call?.inCall?.length ? "bg-emerald-500 text-white animate-pulse" : "bg-slate-800 border border-slate-700 hover:bg-slate-700"
            }`}
          >
            {joiningCall ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{room.call?.inCall?.length ? `join call (${room.call.inCall.length})` : "call"}</span>
          </button>
        )}
        {pro ? (
          <button onClick={() => onOpen("account")} title="Your Pro plan" className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-extrabold tracking-wide">
            PRO ✨
          </button>
        ) : (
          <button onClick={() => onOpen("pro")} className="pop hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" /> get Pro
          </button>
        )}
        <AmbientPlayer pro={pro} onUpgrade={() => onOpen("pro")} />
        <Menu
          trigger={({ toggle }) => (
            <button
              onClick={toggle}
              className="relative flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <Wrench className="w-3.5 h-3.5 text-indigo-400" /> <span className="hidden sm:inline">Tools</span>
              {revisionsDue > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500" />}
            </button>
          )}
        >
          {(close) => {
            const open = (name) => () => { onOpen(name); close(); };
            return (
              <>
                <MenuItem icon={BookOpenCheck} onClick={open("syllabus")} badge={revisionsDue}>Syllabus & Revision</MenuItem>
                <MenuItem icon={CalendarClock} onClick={open("planner")}>Study Planner</MenuItem>
                <MenuItem icon={Sigma} onClick={open("formulas")}>Formula Bank</MenuItem>
                <MenuItem icon={BarChart3} onClick={open("insights")}>Insights, Badges & Recap</MenuItem>
                <div className="my-1 border-t border-slate-800" />
                <MenuItem icon={Sparkles} onClick={open(pro ? "account" : "pro")}>{pro ? "Your Pro plan ✨" : "Get Pro ✨"}</MenuItem>
                <MenuItem icon={UserRound} onClick={open("account")}>{account ? `Account (${account.name})` : "Log in / sign up"}</MenuItem>
                <MenuItem icon={Palette} onClick={open("profile")}>Theme & Profile</MenuItem>
                {isHost && <MenuItem icon={Settings} onClick={open("room")}>Room Settings</MenuItem>}
                <MenuItem icon={Keyboard} onClick={open("shortcuts")}>Keyboard Shortcuts</MenuItem>
                <MenuItem icon={HelpCircle} onClick={open("tour")}>Show Tour</MenuItem>
              </>
            );
          }}
        </Menu>
        <button
          onClick={onLeave}
          className="flex items-center gap-1 text-xs text-rose-400 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition"
        >
          <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
      </div>
    </header>
  );
}
