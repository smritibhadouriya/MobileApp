import { BarChart3, Flame, ChevronRight } from "lucide-react";
import { formatMinutes } from "../lib/stats";

function GoalRing({ value, goal }) {
  const pct = Math.min(1, goal ? value / goal : 0);
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90" role="img" aria-label={`${Math.round(pct * 100)}% of daily goal`}>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-slate-800" />
      <circle
        cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
        className={pct >= 1 ? "stroke-emerald-400" : "stroke-indigo-500"}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        style={{ transition: "stroke-dashoffset 0.6s" }}
      />
    </svg>
  );
}

export default function MyStats({ stats, dailyGoal, onOpenInsights }) {
  const pct = Math.round(Math.min(1, stats.todayMinutes / (dailyGoal || 1)) * 100);
  const { level } = stats;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> my progress</span>
        <span className="flex items-center gap-1 text-[10px] text-orange-400 normal-case tracking-normal">
          <Flame className="w-3.5 h-3.5" /> {stats.streak} day streak
        </span>
      </div>

      <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
        <div className="flex items-center gap-3">
          {/* Daily goal ring with the plant in the middle */}
          <div className="relative shrink-0">
            <GoalRing value={stats.todayMinutes} goal={dailyGoal} />
            <span className="absolute inset-0 flex items-center justify-center text-2xl" title={stats.plant.label}>{stats.plant.icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-100">
              {formatMinutes(stats.todayMinutes)} <span className="text-slate-500 font-normal">/ {formatMinutes(dailyGoal)} today</span>
            </div>
            <div className="text-[11px] text-slate-400">{pct >= 100 ? "🎉 daily goal smashed!" : `${pct}% of daily goal`}</div>
            <div className="text-[11px] text-slate-500 truncate">{stats.plant.label}</div>
          </div>
        </div>

        {/* XP / level */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-300 font-medium">Lv {level.level} · {level.title}</span>
            <span className="text-slate-500">{stats.xp} XP · {level.toNext} to next</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${level.progress * 100}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Sessions", stats.todayPomodoros],
            ["This Week", formatMinutes(stats.weekMinutes)],
            ["Badges", Object.keys(stats.badges).length],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-sm font-bold text-slate-100 tabular-nums">{value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        <button onClick={onOpenInsights} className="w-full flex items-center justify-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200">
          View insights & badges <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
