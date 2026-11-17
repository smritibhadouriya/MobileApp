import { newId, readJSON, writeJSON } from "./storage";

const KEY = "fs:stats";

export const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
};

function load() {
  const data = readJSON(KEY, {});
  // Older versions stored only the per-day map
  if (!data.days) return { days: data, sessions: [], xp: 0, badges: {} };
  return { sessions: [], xp: 0, badges: {}, ...data };
}

// ================= LEVELS =================
const TITLES = [[21, "Master"], [11, "Expert"], [6, "Scholar"], [3, "Learner"], [1, "Beginner"]];

export function levelInfo(xp) {
  const level = Math.floor(Math.sqrt(xp / 60)) + 1;
  const current = 60 * (level - 1) ** 2;
  const next = 60 * level ** 2;
  return {
    level,
    title: TITLES.find(([min]) => level >= min)[1],
    progress: (xp - current) / (next - current),
    toNext: next - xp,
  };
}

// ================= BADGES =================
export const BADGES = [
  { id: "first", icon: "🌱", name: "First Focus", desc: "Complete your first focus session", test: (s) => s.totalPomodoros >= 1 },
  { id: "p10", icon: "📘", name: "Getting Serious", desc: "10 focus sessions", test: (s) => s.totalPomodoros >= 10 },
  { id: "p50", icon: "🏅", name: "Half Century", desc: "50 focus sessions", test: (s) => s.totalPomodoros >= 50 },
  { id: "p100", icon: "💯", name: "Centurion", desc: "100 focus sessions", test: (s) => s.totalPomodoros >= 100 },
  { id: "streak3", icon: "🔥", name: "On a Roll", desc: "3 day streak", test: (s) => s.streak >= 3 },
  { id: "streak7", icon: "⚡", name: "Week Warrior", desc: "7 day streak", test: (s) => s.streak >= 7 },
  { id: "streak30", icon: "🏆", name: "Unstoppable", desc: "30 day streak", test: (s) => s.streak >= 30 },
  { id: "hours10", icon: "⏳", name: "10 Hour Club", desc: "10 hours of focus", test: (s) => s.totalMinutes >= 600 },
  { id: "hours50", icon: "👑", name: "50 Hour Legend", desc: "50 hours of focus", test: (s) => s.totalMinutes >= 3000 },
  { id: "marathon", icon: "🏃", name: "Marathon", desc: "4 sessions in one day", test: (s) => s.bestDayPomodoros >= 4 },
  { id: "owl", icon: "🦉", name: "Night Owl", desc: "Finish a session after 11 PM", test: (_s, session) => session && (new Date(session.time).getHours() >= 23 || new Date(session.time).getHours() < 4) },
  { id: "bird", icon: "🐦", name: "Early Bird", desc: "Finish a session before 7 AM", test: (_s, session) => session && new Date(session.time).getHours() >= 4 && new Date(session.time).getHours() < 7 },
  { id: "laser", icon: "🎯", name: "Laser Focus", desc: "100% focus score", test: (_s, session) => session?.score === 100 },
];

// ================= PLANT =================
const PLANT_STAGES = [
  [240, "🌸", "In full bloom"],
  [150, "🌳", "Strong tree"],
  [100, "🪴", "Growing well"],
  [50, "🌿", "Sprouting"],
  [25, "🌱", "Seedling"],
  [0, "🌰", "Seed — focus to make it grow"],
];

function plantFor(todayMinutes, lastTodaySession) {
  if (lastTodaySession && lastTodaySession.score < 50) {
    return { icon: "🥀", label: "Wilted — stay on the tab next session to revive it" };
  }
  const [, icon, label] = PLANT_STAGES.find(([min]) => todayMinutes >= min);
  return { icon, label };
}

// ================= SUMMARY =================
function summarize(data) {
  const { days, sessions, xp, badges } = data;
  const today = days[daysAgo(0)] || { minutes: 0, pomodoros: 0 };

  let week = 0;
  let lastWeek = 0;
  for (let i = 0; i < 7; i++) week += days[daysAgo(i)]?.minutes || 0;
  for (let i = 7; i < 14; i++) lastWeek += days[daysAgo(i)]?.minutes || 0;

  // Streak counts consecutive study days; today not studied yet doesn't break it
  let streak = 0;
  let i = today.pomodoros ? 0 : 1;
  while (days[daysAgo(i)]?.pomodoros) {
    streak++;
    i++;
  }

  const allDays = Object.values(days);
  const totalMinutes = allDays.reduce((s, d) => s + (d.minutes || 0), 0);
  const totalPomodoros = allDays.reduce((s, d) => s + (d.pomodoros || 0), 0);
  const bestDayPomodoros = allDays.reduce((m, d) => Math.max(m, d.pomodoros || 0), 0);

  // Last 18 weeks for the heatmap, oldest first
  const heatmap = [];
  for (let d = 18 * 7 - 1; d >= 0; d--) {
    const key = daysAgo(d);
    heatmap.push({ date: key, minutes: days[key]?.minutes || 0 });
  }

  const hours = {};
  const subjects = {};
  for (let d = 0; d < 30; d++) {
    const day = days[daysAgo(d)];
    if (!day) continue;
    for (const [h, m] of Object.entries(day.hours || {})) hours[h] = (hours[h] || 0) + m;
    for (const [s, m] of Object.entries(day.subjects || {})) subjects[s] = (subjects[s] || 0) + m;
  }
  const bestHourEntry = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];

  const todayKey = daysAgo(0);
  const lastTodaySession = sessions.findLast((s) => dayKey(s.time) === todayKey);

  return {
    todayMinutes: today.minutes,
    todayPomodoros: today.pomodoros,
    weekMinutes: week,
    lastWeekMinutes: lastWeek,
    streak,
    totalMinutes,
    totalPomodoros,
    bestDayPomodoros,
    heatmap,
    bestHour: bestHourEntry ? Number(bestHourEntry[0]) : null,
    subjects,
    sessions: sessions.slice(-50).reverse(),
    xp,
    level: levelInfo(xp),
    badges,
    plant: plantFor(today.minutes, lastTodaySession),
  };
}

export const getStats = () => summarize(load());

// Records a completed focus session; returns what changed for the celebration screen
export function recordSession({ minutes, subject = "General", score = 100 }) {
  const data = load();
  const now = Date.now();
  const key = dayKey(now);
  const hour = new Date(now).getHours();
  const day = data.days[key] || { minutes: 0, pomodoros: 0 };
  day.minutes = (day.minutes || 0) + minutes;
  day.pomodoros = (day.pomodoros || 0) + 1;
  day.subjects = { ...day.subjects, [subject]: (day.subjects?.[subject] || 0) + minutes };
  day.hours = { ...day.hours, [hour]: (day.hours?.[hour] || 0) + minutes };
  data.days[key] = day;

  const session = { id: newId(), time: now, minutes, subject, score, note: "" };
  data.sessions = [...data.sessions, session].slice(-500);

  const xpBefore = data.xp;
  const gained = minutes + 10 + (score >= 90 ? 5 : 0);
  data.xp += gained;

  const summary = summarize(data);
  const newBadges = BADGES.filter((b) => !data.badges[b.id] && b.test(summary, session));
  for (const b of newBadges) data.badges[b.id] = now;

  writeJSON(KEY, data);
  return {
    session,
    xpGained: gained,
    levelUp: levelInfo(data.xp).level > levelInfo(xpBefore).level ? levelInfo(data.xp) : null,
    newBadges,
  };
}

export function updateSession(id, patch) {
  const data = load();
  const session = data.sessions.find((s) => s.id === id);
  if (!session) return;
  // Moving a session to another subject also moves its minutes in the day breakdown
  if (patch.subject && patch.subject !== session.subject) {
    const day = data.days[dayKey(session.time)];
    if (day?.subjects) {
      day.subjects[session.subject] = Math.max(0, (day.subjects[session.subject] || 0) - session.minutes);
      if (!day.subjects[session.subject]) delete day.subjects[session.subject];
      day.subjects[patch.subject] = (day.subjects[patch.subject] || 0) + session.minutes;
    }
  }
  Object.assign(session, patch);
  writeJSON(KEY, data);
}

export const formatMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
