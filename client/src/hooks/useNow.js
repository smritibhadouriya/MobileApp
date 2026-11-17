import { useEffect, useState } from "react";

// Re-renders on an interval; used for clocks, countdowns and the current planner block
export default function useNow(intervalMs = 1000, active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}
