import { useState } from "react";
import { Play, Pause, RotateCcw, SkipForward, Settings2, Lock, CalendarClock } from "lucide-react";
import useNow from "../hooks/useNow";
import { requestNotificationPermission } from "../lib/sound";
import { BREAK_IDEAS, SUBJECTS } from "../lib/subjects";

const PHASES = {
  focus: { label: "lock-in mode 🔒", ring: "stroke-indigo-500", text: "text-indigo-400" },
  short: { label: "touch grass ☀️", ring: "stroke-emerald-400", text: "text-emerald-400" },
  long: { label: "big break 😮‍💨", ring: "stroke-sky-400", text: "text-sky-400" },
  exam: { label: "mock test 📝", ring: "stroke-rose-400", text: "text-rose-400" },
};

const formatClock = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

// Circular progress around the clock face
function Ring({ progress, className }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="3" className="stroke-slate-800" />
      <circle
        cx="50" cy="50" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
        className={className}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        style={{ transition: "stroke-dashoffset 0.4s linear" }}
      />
    </svg>
  );
}

function SettingsForm({ settings, solo, examMode, onSave, onClose }) {
  const [values, setValues] = useState(settings);
  const fields = examMode
    ? [["exam", "Test length (min)", 10, 600]]
    : [["focus", "Focus", 1, 180], ["short", "Short break", 1, 60], ["long", "Long break", 1, 90], ["rounds", "Rounds", 1, 10]];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Object.fromEntries(fields.map(([key]) => [key, Number(values[key])])));
        onClose();
      }}
      className="w-full mt-6 pt-5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      {fields.map(([key, label, min, max]) => (
        <label key={key} className="text-[10px] uppercase tracking-wider text-slate-500">
          {label}
          <input
            type="number" min={min} max={max} required
            value={values[key]}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            className="w-full mt-1 px-2 py-2 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </label>
      ))}
      <p className="col-span-full text-[11px] text-slate-500">
        {solo ? "Applies only to your solo timer." : "Changes apply to everyone in the room."}
      </p>
      <div className="col-span-full flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
        <button type="submit" className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">Save</button>
      </div>
    </form>
  );
}

export default function PomodoroTimer({
  source, onSourceChange, timer, settings, clockOffset = 0, controls, canControl = true,
  soloMode, onSoloModeChange, subject, subjectOverride, onSubjectChange, activeBlock,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const now = useNow(250, timer.running);
  const solo = source === "solo";
  const examMode = solo && soloMode === "exam";

  const timeLeft = timer.running
    ? Math.max(0, Math.ceil((timer.endsAt - (now + clockOffset)) / 1000))
    : timer.remaining;
  const total = (examMode ? settings.exam : settings[timer.phase]) * 60 || 1;
  const phase = PHASES[examMode ? "exam" : timer.phase];
  const isBreak = timer.phase !== "focus" && !examMode;

  const toggle = () => {
    if (timer.running) return controls.pauseTimer();
    requestNotificationPermission();
    controls.startTimer();
  };

  const segment = (active) =>
    `px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition ${active ? "bg-slate-100 text-slate-950 shadow" : "text-slate-400 hover:text-slate-100"}`;

  return (
    <div className="paper-card shrink-0 rounded-3xl p-5 md:p-7 flex flex-col items-center relative overflow-hidden">
      {/* soft lamp glow behind the clock */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-md h-80 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Room / solo switch */}
      <div className="relative flex flex-wrap items-center justify-center gap-2 mb-5">
        <div className="flex items-center gap-0.5 p-1 rounded-full bg-slate-950/60 border border-slate-800">
          <button onClick={() => onSourceChange("room")} className={segment(!solo)}>Room timer</button>
          <button onClick={() => onSourceChange("solo")} className={segment(solo)}>Solo</button>
        </div>
        {solo && (
          <div className="flex items-center gap-0.5 p-1 rounded-full bg-slate-950/60 border border-slate-800">
            <button onClick={() => onSoloModeChange("pomodoro")} className={segment(!examMode)}>Pomodoro</button>
            <button onClick={() => onSoloModeChange("exam")} className={segment(examMode)}>Mock test</button>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowSettings(!showSettings)}
        disabled={!canControl}
        title={canControl ? "Timer settings" : "Only the host can change the room timer"}
        className="absolute top-4 right-4 p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition"
      >
        <Settings2 className="w-4 h-4" />
      </button>

      {/* Clock face */}
      <div className="relative shrink-0 w-64 h-64 sm:w-72 sm:h-72 flex flex-col items-center justify-center">
        <Ring progress={timeLeft / total} className={phase.ring} />
        <div className={`text-xs font-bold ${phase.text}`}>{phase.label}</div>
        <div className="font-display text-6xl sm:text-7xl font-extrabold tracking-tight text-slate-50 tabular-nums leading-none my-2">
          {formatClock(timeLeft)}
        </div>
        {!examMode ? (
          <div className="flex items-center gap-1.5" title={`Round ${timer.round} of ${settings.rounds}`}>
            {Array.from({ length: settings.rounds }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i + 1 < timer.round || (i + 1 === timer.round && timer.phase !== "focus")
                    ? "bg-indigo-400"
                    : i + 1 === timer.round ? "bg-indigo-400/50 ring-2 ring-indigo-400/30" : "bg-slate-700"
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-slate-500">no breaks — exam mode fr</div>
        )}
      </div>

      {/* Subject for stats (planner block picks it automatically) */}
      {!isBreak ? (
        <div className="relative flex flex-wrap items-center justify-center gap-2 mt-4 mb-5 text-xs">
          <span className="text-slate-500">studying</span>
          <select
            value={subjectOverride || ""}
            onChange={(e) => onSubjectChange(e.target.value || null)}
            className="px-3 py-1.5 bg-slate-950/60 border border-slate-700 rounded-full text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">{activeBlock ? `Auto: ${activeBlock.subject}` : `Auto: ${subject}`}</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {activeBlock && (
            <span className="flex items-center gap-1 text-[11px] text-indigo-300">
              <CalendarClock className="w-3.5 h-3.5" /> {activeBlock.start}–{activeBlock.end}
            </span>
          )}
        </div>
      ) : (
        <div className="relative mt-4 mb-5 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-200 text-center max-w-sm">
          {BREAK_IDEAS[(timer.round * 3 + timer.phase.length) % BREAK_IDEAS.length]}
        </div>
      )}

      <div className="relative flex items-center gap-3">
        <button
          onClick={controls.resetTimer}
          disabled={!canControl}
          className="w-11 h-11 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-full transition disabled:opacity-50"
          title="Reset this interval"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={toggle}
          disabled={!canControl}
          className={`pop h-14 px-8 rounded-full font-bold flex items-center gap-2 text-base disabled:opacity-50 ${
            timer.running ? "bg-[oklch(88%_0.15_95)] text-[oklch(17%_0.03_285)] hover:bg-[oklch(92%_0.14_95)]" : "bg-indigo-600 hover:bg-indigo-500 text-white"
          }`}
        >
          {timer.running ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          {timer.running ? "pause" : examMode ? "start test" : timer.phase === "focus" ? "let's lock in" : "start break"}
        </button>
        {!examMode ? (
          <button
            onClick={controls.skipTimer}
            disabled={!canControl}
            className="w-11 h-11 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-full transition disabled:opacity-50"
            title="Skip to next interval"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        ) : <span className="w-11" />}
      </div>

      <p className="relative mt-4 text-[11px] text-slate-500 flex items-center gap-1 text-center">
        {solo ? "only you see this timer" : canControl ? "synced for the whole squad 👯" : <><Lock className="w-3 h-3" /> Only the host controls the room timer</>}
      </p>

      {showSettings && (
        <SettingsForm
          key={`${source}-${soloMode}`}
          settings={settings}
          solo={solo}
          examMode={examMode}
          onSave={controls.updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
