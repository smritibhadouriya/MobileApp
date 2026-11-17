import { useEffect, useMemo, useRef, useState } from "react";
import { readJSON, writeJSON } from "../lib/storage";

// Solo timer with the same focus/break cycle as the room timer, plus a single-block mock test mode.
// Saved to localStorage so a refresh doesn't lose a running session.
const KEY = "fs:soloTimer";
const DEFAULT_SETTINGS = { focus: 25, short: 5, long: 15, rounds: 4, exam: 180 };
const DEFAULTS = { mode: "pomodoro", phase: "focus", round: 1, running: false, endsAt: null, remaining: 25 * 60, settings: DEFAULT_SETTINGS };

const duration = (t, phase = t.phase) => (t.mode === "exam" ? t.settings.exam : t.settings[phase]) * 60;
const stopped = (t) => ({ ...t, running: false, endsAt: null, remaining: duration(t) });

function advance(t) {
  if (t.mode === "exam") return stopped({ ...t, phase: "focus" });
  if (t.phase === "focus") return stopped({ ...t, phase: t.round >= t.settings.rounds ? "long" : "short" });
  return stopped({ ...t, round: t.phase === "long" ? 1 : t.round + 1, phase: "focus" });
}

export default function usePersonalTimer(onComplete) {
  const [timer, setTimer] = useState(() => {
    const saved = readJSON(KEY, {});
    return { ...DEFAULTS, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
  });
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  });

  useEffect(() => writeJSON(KEY, timer), [timer]);

  // Fire completion when the running interval ends (also catches one that ended while the tab was closed)
  useEffect(() => {
    if (!timer.running) return;
    const id = setTimeout(() => {
      const exam = timer.mode === "exam";
      setTimer(advance);
      completeRef.current?.({
        phase: exam ? "focus" : timer.phase,
        minutes: exam ? timer.settings.exam : timer.settings[timer.phase],
        solo: true,
        exam,
      });
    }, Math.max(0, timer.endsAt - Date.now()));
    return () => clearTimeout(id);
  }, [timer]);

  const controls = useMemo(
    () => ({
      startTimer: () =>
        setTimer((t) => (t.running ? t : { ...t, running: true, endsAt: Date.now() + (t.remaining || duration(t)) * 1000 })),
      pauseTimer: () =>
        setTimer((t) =>
          t.running ? { ...t, running: false, endsAt: null, remaining: Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000)) } : t
        ),
      resetTimer: () => setTimer(stopped),
      skipTimer: () => setTimer(advance),
      setMode: (mode) => setTimer((t) => stopped({ ...t, mode, phase: "focus", round: 1 })),
      updateSettings: (settings) =>
        setTimer((t) => {
          const next = { ...t, settings: { ...t.settings, ...settings } };
          if (next.round > next.settings.rounds) next.round = 1;
          return t.running ? next : stopped(next);
        }),
    }),
    []
  );

  return { timer, settings: timer.settings, controls };
}
