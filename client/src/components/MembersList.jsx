import { useState } from "react";
import { Users, Hand, MoreVertical, Crown, UserX, Flag, Ban, BellRing } from "lucide-react";
import Menu, { MenuItem } from "./ui/Menu";

const ACTIVITY = {
  focus: { label: "locked in 🔒", dot: "bg-emerald-400", ping: true },
  break: { label: "on break ☕", dot: "bg-amber-400", ping: true },
  idle: { label: "chilling", dot: "bg-sky-400", ping: false },
  away: { label: "afk 👻", dot: "bg-slate-500", ping: false },
};

// Solo-timer users report their own activity; everyone else follows the shared room timer
function memberStatus(member, timer) {
  if (member.away) return ACTIVITY.away;
  if (member.activity) return ACTIVITY[member.activity];
  if (timer.running) return timer.phase === "focus" ? ACTIVITY.focus : ACTIVITY.break;
  return ACTIVITY.idle;
}

export default function MembersList({ members, timer, hands, hostId, clientId, isHost, blocked, actions, onBlock }) {
  const [nudged, setNudged] = useState({});
  const myHandUp = hands.some((h) => h.clientId === clientId);

  const nudge = (id) => {
    actions.nudge(id);
    setNudged((n) => ({ ...n, [id]: true }));
    setTimeout(() => setNudged((n) => ({ ...n, [id]: false })), 10000);
  };

  const report = (member) => {
    const reason = window.prompt(`Why are you reporting ${member.name}?`);
    if (reason !== null) actions.report({ clientId: member.clientId, name: member.name, reason });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <span className="flex items-center gap-2"><Users className="w-4 h-4" /> the squad</span>
        <div className="flex items-center gap-2">
          <button
            onClick={actions.toggleHand}
            title={myHandUp ? "Lower hand (H)" : "Raise hand for a doubt (H)"}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] normal-case tracking-normal border transition ${
              myHandUp ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Hand className="w-3 h-3" /> {myHandUp ? "Lower" : "Raise"}
          </button>
          <span className="bg-slate-800 px-2 py-0.5 rounded-full text-indigo-400 text-[10px]">{members.length} online</span>
        </div>
      </div>

      {/* Hand-raise queue */}
      {hands.length > 0 && (
        <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="text-[10px] uppercase tracking-wider text-amber-300/80 mb-1.5">✋ doubt queue</div>
          <ol className="space-y-1">
            {hands.map((h, i) => (
              <li key={h.clientId} className="flex items-center justify-between text-xs text-slate-200">
                <span className="truncate">{i + 1}. {h.avatar} {h.name}</span>
                {(isHost || h.clientId === clientId) && (
                  <button onClick={() => actions.lowerHand(h.clientId)} className="text-[10px] text-slate-400 hover:text-slate-100 shrink-0 ml-2">
                    {h.clientId === clientId ? "Lower" : "Done"}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="space-y-2">
        {members.map((m) => {
          const status = memberStatus(m, timer);
          const isMe = m.clientId === clientId;
          const handUp = hands.some((h) => h.clientId === m.clientId);
          const isBlocked = blocked.includes(m.clientId);
          return (
            <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative text-lg leading-none shrink-0">
                  {m.avatar || "🙂"}
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    {status.ping && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${status.dot} opacity-75`}></span>}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-slate-900 ${status.dot}`}></span>
                  </span>
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-sm font-medium text-slate-200">
                    <span className="truncate">{m.name}</span>
                    {isMe && <span className="text-slate-500 text-xs">(You)</span>}
                    {m.clientId === hostId && <Crown className="w-3 h-3 text-amber-400 shrink-0" title="Host" />}
                    {m.pro && <span title="Pro member" className="px-1 rounded bg-indigo-600 text-white text-[9px] font-extrabold">PRO</span>}
                    {handUp && <span title="Hand raised">✋</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {status.label}{m.subject && status !== ACTIVITY.away ? ` · ${m.subject}` : ""}
                    {isBlocked && <span className="text-rose-400"> · blocked</span>}
                  </div>
                </div>
              </div>
              {!isMe && (
                <Menu
                  width="w-48"
                  trigger={({ toggle }) => (
                    <button onClick={toggle} title="More" className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700/60">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem icon={BellRing} onClick={() => { nudge(m.id); close(); }}>
                        {nudged[m.id] ? "Nudged!" : "Nudge 👋"}
                      </MenuItem>
                      <MenuItem icon={Ban} onClick={() => { onBlock(m.clientId); close(); }}>
                        {isBlocked ? "Unblock" : "Block (hide messages)"}
                      </MenuItem>
                      <MenuItem icon={Flag} onClick={() => { report(m); close(); }}>Report</MenuItem>
                      {isHost && (
                        <>
                          <div className="my-1 border-t border-slate-800" />
                          <MenuItem icon={Crown} onClick={() => { actions.makeHost(m.id); close(); }}>Make host</MenuItem>
                          <MenuItem
                            icon={UserX}
                            danger
                            onClick={() => {
                              if (window.confirm(`Remove ${m.name} from the room? They won't be able to rejoin.`)) actions.kick(m.id);
                              close();
                            }}
                          >
                            Remove from room
                          </MenuItem>
                        </>
                      )}
                    </>
                  )}
                </Menu>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
