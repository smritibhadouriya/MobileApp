import { Target, CalendarPlus, Trophy } from "lucide-react";
import { PUBLIC_URL } from "../lib/native";

const DAY = 24 * 60 * 60 * 1000;

// Google Calendar "add event" link for the room's daily session (no API key needed)
function calendarLink(meta, code) {
  const [h, m] = meta.schedule.split(":").map(Number);
  const start = new Date();
  start.setHours(h, m, 0, 0);
  if (start < new Date()) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${meta.emoji} ${meta.name} — study session`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Join the room: ${PUBLIC_URL}/room/${code}`,
    recur: "RRULE:FREQ=DAILY",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const formatTime = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function RoomGoals({ meta, challenge, code, now }) {
  const hasExam = meta.examName && meta.examDate;
  const daysLeft = hasExam ? Math.ceil((new Date(`${meta.examDate}T00:00:00`).getTime() - now) / DAY) : null;
  const challengeHours = challenge.minutes / 60;
  if (!hasExam && !meta.schedule && !meta.challengeGoal) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <Target className="w-4 h-4" /> Room Goals
      </div>

      {hasExam && (
        <div className="p-3 rounded-xl bg-indigo-600/10 border border-indigo-500/20">
          <div className="text-[10px] uppercase tracking-wider text-indigo-300/80">Exam countdown</div>
          <div className="text-sm font-semibold text-slate-100">
            {daysLeft > 0 ? `${meta.examName} in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : daysLeft === 0 ? `${meta.examName} is today — all the best! 🍀` : `${meta.examName} is done 🎉`}
          </div>
        </div>
      )}

      {meta.challengeGoal > 0 && (
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-200 font-medium"><Trophy className="w-3.5 h-3.5 text-amber-400" /> Weekly challenge</span>
            <span className="text-slate-400 tabular-nums">{challengeHours.toFixed(1)} / {meta.challengeGoal} h</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (challengeHours / meta.challengeGoal) * 100)}%` }} />
          </div>
          {challengeHours >= meta.challengeGoal && <div className="text-[11px] text-emerald-400 mt-1.5">🏆 Challenge complete! Great teamwork.</div>}
        </div>
      )}

      {meta.schedule && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs">
          <span className="text-slate-300">📅 Daily session at <b>{formatTime(meta.schedule)}</b></span>
          <a
            href={calendarLink(meta, code)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-indigo-300 hover:text-indigo-200 shrink-0"
          >
            <CalendarPlus className="w-3.5 h-3.5" /> Add
          </a>
        </div>
      )}
    </div>
  );
}
