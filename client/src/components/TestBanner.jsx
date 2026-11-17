import { formatCountdown, testStatus } from "../lib/tests";

// Strip under the header: a live test you still have to take, or the next one coming up
export default function TestBanner({ tests, now, clientId, onTake, onOpenTests }) {
  const pending = tests.filter((t) => !t.participants.find((p) => p.clientId === clientId)?.submitted);
  const live = pending.find((t) => testStatus(t, now) === "live");
  const upcoming = pending
    .filter((t) => testStatus(t, now) === "upcoming")
    .sort((a, b) => a.startsAt - b.startsAt)[0];

  if (live) {
    return (
      <button
        onClick={() => onTake(live.id)}
        className="shrink-0 w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-500 text-white text-sm font-bold"
      >
        <span className="animate-pulse">●</span> LIVE TEST: {live.title} — {formatCountdown(live.endsAt - now)} left
        <span className="ml-1 px-2.5 py-0.5 rounded-full bg-white text-rose-600 text-xs">take it now →</span>
      </button>
    );
  }
  if (upcoming && upcoming.startsAt - now < 60 * 60 * 1000) {
    return (
      <button
        onClick={onOpenTests}
        className="shrink-0 w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-300 text-[oklch(17%_0.03_285)] text-sm font-bold"
      >
        📝 {upcoming.title} starts in <span className="font-display tabular-nums">{formatCountdown(upcoming.startsAt - now)}</span> — get ready!
      </button>
    );
  }
  return null;
}
