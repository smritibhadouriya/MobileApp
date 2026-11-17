import { Trophy } from "lucide-react";

const MEDALS = ["🥇", "🥈", "🥉"];
const formatMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export default function Leaderboard({ leaderboard, clientId }) {
  const rows = Object.entries(leaderboard)
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => b.minutes - a.minutes);
  const top = rows[0]?.minutes || 1;

  return (
    <div className="h-full p-4 overflow-y-auto">
      <p className="text-[11px] text-slate-500 mb-3">
        Focus minutes in this room. You earn a full interval each time a focus session completes while your tab is open.
      </p>
      {rows.length === 0 && (
        <div className="flex flex-col items-center text-center py-10 text-slate-500">
          <Trophy className="w-8 h-8 mb-2 text-slate-600" />
          <p className="text-xs">Finish the first focus interval to get on the board.</p>
        </div>
      )}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={`p-2.5 rounded-xl border ${r.id === clientId ? "bg-indigo-600/10 border-indigo-500/30" : "bg-slate-800/40 border-slate-800"}`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-5 text-center">{MEDALS[i] || <span className="text-slate-500">{i + 1}</span>}</span>
                <span className="font-medium text-slate-200 truncate">{r.name}{r.id === clientId && " (You)"}</span>
              </span>
              <span className="font-mono text-slate-300 tabular-nums">{formatMinutes(r.minutes)}</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(r.minutes / top) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
