import { useState } from "react";
import { UserRound, Loader2, LogOut, Sparkles } from "lucide-react";
import Modal from "../ui/Modal";

const USAGE_LABELS = { aiTests: "AI tests", aiAsks: "AI Tutor questions", testsCreated: "Group tests created" };

export default function AccountModal({ accountState, onGetPro, onClose }) {
  const { account, pro, login, signup, logout } = accountState;
  const [mode, setMode] = useState("signup");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await (mode === "signup" ? signup(form) : login(form));
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  const inputClass = "w-full px-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500";

  if (account) {
    return (
      <Modal title="Your account" icon={<UserRound className="w-4 h-4 text-indigo-400" />} onClose={onClose}>
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-display text-xl font-bold">
              {account.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-100 truncate">{account.name} {pro && <span className="text-indigo-400">✨</span>}</div>
              <div className="text-xs text-slate-500 truncate">{account.email}</div>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border-2 ${pro ? "border-indigo-500 bg-indigo-600/10" : "border-slate-800"}`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Plan</div>
            <div className="font-display text-xl font-extrabold text-slate-100">{pro ? "Pro ✨" : "Free"}</div>
            {pro && account.proUntil && (
              <div className="text-xs text-slate-400">active until {new Date(account.proUntil).toLocaleDateString()} · no auto-renew</div>
            )}
            <button onClick={onGetPro} className="pop mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold">
              <Sparkles className="w-4 h-4" /> {pro ? "add more Pro time" : "get Pro"}
            </button>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Used today</div>
            <div className="space-y-2">
              {Object.entries(USAGE_LABELS).map(([key, labelText]) => {
                const used = account.usage?.[key] || 0;
                const limit = account.limits?.[key] || 1;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs"><span className="text-slate-300">{labelText}</span><span className="text-slate-500 tabular-nums">{used} / {limit}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={logout} className="flex items-center gap-1.5 text-sm text-rose-400 hover:text-rose-300">
            <LogOut className="w-4 h-4" /> log out
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={mode === "signup" ? "Create your account" : "Welcome back"} icon={<UserRound className="w-4 h-4 text-indigo-400" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-400">An account keeps your Pro plan on every device. Studying stays free without one.</p>
        {mode === "signup" && (
          <input value={form.name} maxLength={30} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="your name" className={inputClass} />
        )}
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email" autoComplete="email" className={inputClass} />
        <input
          type="password" required minLength={6} value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder={mode === "signup" ? "password (6+ characters)" : "password"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={inputClass}
        />
        {error && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}
        <button type="submit" disabled={busy} className="pop w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {mode === "signup" ? "create account" : "log in"}
        </button>
        <p className="text-center text-xs text-slate-500">
          {mode === "signup" ? "already have an account? " : "new here? "}
          <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }} className="font-semibold text-indigo-400 hover:text-indigo-300">
            {mode === "signup" ? "log in" : "create one"}
          </button>
        </p>
      </form>
    </Modal>
  );
}
