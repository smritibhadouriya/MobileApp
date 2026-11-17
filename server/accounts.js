import express from "express";
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { accounts, sessions, usage, scheduleSave } from "./store.js";

// ================= PLANS & LIMITS =================
export const PLANS = {
  monthly: { amount: Number(process.env.PRO_PRICE_MONTHLY) || 149, days: 30, label: "StudyGroup Pro — Monthly" },
  yearly: { amount: Number(process.env.PRO_PRICE_YEARLY) || 1199, days: 365, label: "StudyGroup Pro — Yearly" },
};

// Per-day limits. Pro numbers are fair-use caps so one account can't run up a huge AI bill.
export const DAILY_LIMITS = {
  free: { aiTests: 1, aiAsks: 3, testsCreated: 1 },
  pro: { aiTests: 5, aiAsks: 30, testsCreated: 50 },
};

const UPGRADE_MESSAGES = {
  aiTests: "Free plan includes 1 AI-generated test per day. Get Pro ✨ for 5 AI tests every day.",
  aiAsks: "Free plan includes 3 AI Tutor questions per day. Get Pro ✨ for 30 a day.",
  testsCreated: "Free plan includes 1 group test per day. Get Pro ✨ to create unlimited tests.",
};

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";
export const billingEnabled = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ================= HELPERS =================
const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
};
const checkPassword = (password, stored) =>
  timingSafeEqual(scryptSync(password, stored.salt, 64), Buffer.from(stored.hash, "hex"));

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase().slice(0, 120);
const findByEmail = (email) => [...accounts.values()].find((a) => a.email === email);

export const isPro = (account) => Boolean(account?.pro?.until && account.pro.until > Date.now());

export function accountFromToken(token) {
  if (typeof token !== "string" || !token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return accounts.get(session.accountId) || null;
}

function createSession(account) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { accountId: account.id, expiresAt: Date.now() + SESSION_MS });
  scheduleSave();
  return token;
}

// ================= DAILY USAGE =================
const today = () => new Date().toISOString().slice(0, 10);

function usageFor(account, clientId) {
  // Logged-out users are counted per browser; logged-in users per account (across devices)
  const key = account ? `acct:${account.id}` : `client:${clientId}`;
  let entry = usage.get(key);
  if (!entry || entry.day !== today()) {
    entry = { day: today(), counts: {} };
    usage.set(key, entry);
  }
  return entry;
}

// Counts one use of `kind`. Returns null when allowed, or an error reply when the limit is hit.
export function consume(account, clientId, kind) {
  const tier = isPro(account) ? "pro" : "free";
  const entry = usageFor(account, clientId);
  const used = entry.counts[kind] || 0;
  if (used >= DAILY_LIMITS[tier][kind]) {
    return tier === "free"
      ? { ok: false, upgrade: true, error: UPGRADE_MESSAGES[kind] }
      : { ok: false, error: "You've hit today's fair-use limit — it resets tomorrow." };
  }
  entry.counts[kind] = used + 1;
  scheduleSave();
  return null;
}

// Give a use back when the action failed (e.g. the AI errored)
export function refund(account, clientId, kind) {
  const entry = usageFor(account, clientId);
  entry.counts[kind] = Math.max(0, (entry.counts[kind] || 0) - 1);
  scheduleSave();
}

export function publicAccount(account, clientId) {
  const pro = isPro(account);
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    pro,
    plan: account.pro?.plan || null,
    proUntil: account.pro?.until || null,
    usage: usageFor(account, clientId).counts,
    limits: DAILY_LIMITS[pro ? "pro" : "free"],
  };
}

// Adds the plan's days on top of any remaining Pro time. Safe to call twice for the same payment.
function grantPro(account, plan, paymentId) {
  account.pro ||= { until: 0, plan: null, payments: [] };
  if (account.pro.payments.includes(paymentId)) return false;
  const base = Math.max(Date.now(), account.pro.until || 0);
  account.pro.until = base + PLANS[plan].days * DAY_MS;
  account.pro.plan = plan;
  account.pro.payments.push(paymentId);
  scheduleSave();
  return true;
}

// ================= RAZORPAY =================
async function razorpay(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay error ${res.status}`);
  return data;
}

// Simple in-memory limiter for login/signup attempts per IP
const attempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 15 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

// ================= HTTP ROUTES (/api) =================
export function createAccountRouter({ onAccountChanged }) {
  const router = express.Router();

  // Webhook needs the raw body for signature checks, so it is registered before the JSON parser
  router.post("/billing/webhook", express.raw({ type: "*/*", limit: "1mb" }), (req, res) => {
    if (!RAZORPAY_WEBHOOK_SECRET) return res.status(503).end();
    const expected = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(req.body).digest("hex");
    if (!safeEqual(expected, req.get("x-razorpay-signature") || "")) return res.status(400).end();
    let event;
    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).end();
    }
    if (event.event === "order.paid") {
      const order = event.payload?.order?.entity;
      const payment = event.payload?.payment?.entity;
      const account = accounts.get(order?.notes?.accountId);
      const plan = order?.notes?.plan;
      if (account && PLANS[plan] && payment?.id && order.amount_paid >= PLANS[plan].amount * 100) {
        if (grantPro(account, plan, payment.id)) onAccountChanged(account);
      }
    }
    res.json({ ok: true });
  });

  router.use(express.json({ limit: "20kb" }));

  const auth = (req, res, next) => {
    const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const account = accountFromToken(token);
    if (!account) return res.status(401).json({ error: "Please log in again." });
    req.account = account;
    req.token = token;
    next();
  };

  router.post("/auth/signup", (req, res) => {
    if (tooManyAttempts(req.ip)) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const name = String(req.body?.name || "").trim().slice(0, 30);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Enter a valid email." });
    if (password.length < 6 || password.length > 128) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (findByEmail(email)) return res.status(409).json({ error: "An account with this email already exists — log in instead." });
    const account = { id: randomUUID(), email, name: name || email.split("@")[0], password: hashPassword(password), createdAt: Date.now(), pro: null };
    accounts.set(account.id, account);
    scheduleSave();
    res.json({ token: createSession(account), account: publicAccount(account, req.body?.clientId) });
  });

  router.post("/auth/login", (req, res) => {
    if (tooManyAttempts(req.ip)) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
    const account = findByEmail(normalizeEmail(req.body?.email));
    if (!account || !checkPassword(String(req.body?.password || ""), account.password)) {
      return res.status(401).json({ error: "Wrong email or password." });
    }
    res.json({ token: createSession(account), account: publicAccount(account, req.body?.clientId) });
  });

  router.post("/auth/logout", auth, (req, res) => {
    sessions.delete(req.token);
    scheduleSave();
    res.json({ ok: true });
  });

  router.get("/me", auth, (req, res) => res.json({ account: publicAccount(req.account, String(req.query.clientId || "")) }));

  router.get("/billing/config", (_req, res) => {
    res.json({
      enabled: billingEnabled,
      keyId: billingEnabled ? RAZORPAY_KEY_ID : null,
      plans: Object.fromEntries(Object.entries(PLANS).map(([id, p]) => [id, { amount: p.amount, days: p.days }])),
      limits: DAILY_LIMITS,
    });
  });

  router.post("/billing/order", auth, async (req, res) => {
    if (!billingEnabled) return res.status(503).json({ error: "Payments are not set up on this server yet." });
    const plan = req.body?.plan;
    if (!PLANS[plan]) return res.status(400).json({ error: "Unknown plan." });
    try {
      const order = await razorpay("/orders", {
        method: "POST",
        body: {
          amount: PLANS[plan].amount * 100, // paise
          currency: "INR",
          receipt: `fs_${Date.now()}`,
          notes: { accountId: req.account.id, plan },
        },
      });
      res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: RAZORPAY_KEY_ID, label: PLANS[plan].label });
    } catch (err) {
      console.error("Razorpay order failed:", err.message);
      res.status(502).json({ error: "Couldn't start the payment. Please try again." });
    }
  });

  // Called by the checkout after a successful payment
  router.post("/billing/verify", auth, async (req, res) => {
    if (!billingEnabled) return res.status(503).json({ error: "Payments are not set up on this server yet." });
    const { orderId, paymentId, signature } = req.body || {};
    const expected = createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    if (!orderId || !paymentId || !safeEqual(expected, signature || "")) {
      return res.status(400).json({ error: "Payment could not be verified." });
    }
    try {
      // Re-read the order from Razorpay so the plan and account can't be tampered with
      const order = await razorpay(`/orders/${encodeURIComponent(orderId)}`);
      const plan = order.notes?.plan;
      if (order.notes?.accountId !== req.account.id || !PLANS[plan]) {
        return res.status(400).json({ error: "This payment belongs to a different account." });
      }
      if (grantPro(req.account, plan, paymentId)) onAccountChanged(req.account);
      res.json({ account: publicAccount(req.account, req.body?.clientId) });
    } catch (err) {
      console.error("Razorpay verify failed:", err.message);
      res.status(502).json({ error: "Payment received but we couldn't confirm it yet. It will activate shortly — refresh in a minute." });
    }
  });

  // Admin: give Pro manually (testing, gifts, refunds)
  router.post("/admin/grant-pro", (req, res) => {
    const expectedKey = process.env.ADMIN_KEY || "";
    if (!expectedKey || !safeEqual(req.get("x-admin-key") || "", expectedKey)) return res.status(403).json({ error: "Forbidden" });
    const account = findByEmail(normalizeEmail(req.body?.email));
    if (!account) return res.status(404).json({ error: "No account with that email." });
    const days = Math.min(3650, Math.max(1, Math.round(Number(req.body?.days)) || 30));
    account.pro ||= { until: 0, plan: null, payments: [] };
    account.pro.until = Math.max(Date.now(), account.pro.until || 0) + days * DAY_MS;
    account.pro.plan ||= "gift";
    scheduleSave();
    onAccountChanged(account);
    res.json({ ok: true, proUntil: new Date(account.pro.until).toISOString() });
  });

  return router;
}
