// localStorage can throw (private mode, blocked storage), so every access is guarded
export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore: the app still works, it just won't remember this across refreshes
  }
}

export const newId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

// Stable per-browser id so reactions, "mine" messages and leaderboard survive reconnects
export function getClientId() {
  let id = readJSON("fs:clientId", null);
  if (!id) {
    id = newId();
    writeJSON("fs:clientId", id);
  }
  return id;
}

export const loadSession = () => readJSON("fs:session", null);
export const saveSession = (session) => writeJSON("fs:session", session);

// Bump when the default look changes so existing users get the new design once
const DESIGN_VERSION = 2;

export const DEFAULT_PROFILE = {
  avatar: "🙂",
  theme: "light",
  accent: "violet",
  background: "pastel",
  designVersion: DESIGN_VERSION,
  dailyGoal: 120, // minutes
  onboarded: false,
  blocked: [], // clientIds whose messages are hidden
};

export function loadProfile() {
  const saved = readJSON("fs:profile", {});
  if (saved.designVersion !== DESIGN_VERSION) {
    const { theme, accent, background, designVersion } = DEFAULT_PROFILE;
    Object.assign(saved, { theme, accent, background, designVersion });
  }
  return { ...DEFAULT_PROFILE, ...saved };
}
export const saveProfile = (profile) => writeJSON("fs:profile", profile);
