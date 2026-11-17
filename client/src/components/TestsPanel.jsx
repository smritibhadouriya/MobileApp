import { Plus, Play, Trophy, X, Users, Clock } from "lucide-react";
import { formatCountdown, formatTimeOfDay, testStatus } from "../lib/tests";

const SOURCE_LABEL = { notes: "📒 from notes", topic: "🎯 AI topic test", manual: "✍️ handmade" };

export default function TestsPanel({ tests, now, clientId, isHost, onCreate, onTake, onResults, onCancel }) {
  const sorted = [...tests].sort((a, b) => {
    const order = { live: 0, upcoming: 1, ended: 2 };
    return order[testStatus(a, now)] - order[testStatus(b, now)] || b.startsAt - a.startsAt;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Make a test from your notes or any topic — the whole squad takes it together, then the leaderboard drops 🏆</p>
        <button onClick={onCreate} className="pop flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold">
          <Plus className="w-4 h-4" /> create test
        </button>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-10 rounded-2xl border-2 border-dashed border-slate-800">
          <div className="text-4xl mb-2">📝</div>
          <div className="font-display font-bold text-slate-200">no tests yet</div>
          <div className="text-xs text-slate-500">upload your notes and let AI cook a test for everyone</div>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((test) => {
          const status = testStatus(test, now);
          const me = test.participants.find((p) => p.clientId === clientId);
          const canCancel = status !== "ended" && (test.creatorId === clientId || isHost);
          return (
            <div key={test.id} className={`p-4 rounded-2xl border-2 ${status === "live" ? "border-rose-500 bg-rose-500/5" : "border-slate-800 bg-slate-900/40"}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {status === "live" && <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">● LIVE</span>}
                    {status === "upcoming" && <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">UPCOMING</span>}
                    {status === "ended" && <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 text-[10px] font-bold">ENDED</span>}
                    <span className="font-display font-bold text-slate-100 truncate">{test.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    <span>{test.questionCount} Qs</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {test.durationMin} min</span>
                    <span>{test.marking.wrong ? "+4/−1" : "+1/0"}</span>
                    <span>{SOURCE_LABEL[test.source]}</span>
                    <span>by {test.createdBy}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {test.participants.length} {status === "ended" ? "took it" : "started"}</span>
                  </div>
                </div>
                {canCancel && (
                  <button
                    onClick={() => window.confirm(`Cancel "${test.title}" for everyone?`) && onCancel(test.id)}
                    title="Cancel test" className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {status === "upcoming" && (
                  <span className="text-sm font-semibold text-slate-200">
                    starts in <span className="font-display tabular-nums">{formatCountdown(test.startsAt - now)}</span>
                    <span className="text-slate-500 font-normal"> · {formatTimeOfDay(test.startsAt)}</span>
                  </span>
                )}
                {status === "live" && !me?.submitted && (
                  <button onClick={() => onTake(test.id)} className="pop flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-bold">
                    <Play className="w-4 h-4" /> {me ? "continue test" : "take test now"}
                  </button>
                )}
                {status === "live" && (
                  <span className="text-xs text-slate-400">⏱ {formatCountdown(test.endsAt - now)} left{me?.submitted && " · you submitted ✅"}</span>
                )}
                {status === "ended" && (
                  <button onClick={() => onResults(test.id)} className="pop flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-300 text-[oklch(17%_0.03_285)] text-sm font-bold">
                    <Trophy className="w-4 h-4" /> leaderboard & answers
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
