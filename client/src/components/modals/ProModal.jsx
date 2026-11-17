import { useState } from "react";
import { Sparkles, Check, Minus, Loader2, ExternalLink } from "lucide-react";
import Modal from "../ui/Modal";
import { api } from "../../lib/api";
import { loadRazorpay } from "../../lib/razorpay";
import { PUBLIC_URL, isNative } from "../../lib/native";

const FEATURES = [
  ["AI tests from notes, PDFs, photos or topics", "1 / day", "5 / day"],
  ["AI Tutor (/ask in chat)", "3 / day", "30 / day"],
  ["Create group tests for the squad", "1 / day", "unlimited*"],
  ["Take tests, timer, chat, whiteboard, video calls", true, true],
  ["Insights: heatmap, weekly report, subjects, best focus time, recap card", "basic stats", true],
  ["All accent colours & background scenes", false, true],
  ["Full ambient mixer (ocean, fireplace, wind, noise…)", "lofi + rain", true],
  ["Private password-protected rooms", false, true],
  ["Pro badge ✨ next to your name", false, true],
];

function Cell({ value }) {
  if (value === true) return <Check className="w-4 h-4 text-emerald-500 mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-slate-600 mx-auto" />;
  return <span className="text-xs text-slate-300">{value}</span>;
}

export default function ProModal({ account, token, billing, clientId, reason, onNeedLogin, onActivated, onClose }) {
  const [plan, setPlan] = useState("yearly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const prices = billing?.plans || { monthly: { amount: 149 }, yearly: { amount: 1199 } };
  const saving = Math.round((1 - prices.yearly.amount / (prices.monthly.amount * 12)) * 100);
  const proUntil = account?.pro && account.proUntil ? new Date(account.proUntil).toLocaleDateString() : null;

  const buy = async () => {
    setError("");
    if (!account) return onNeedLogin();
    if (!billing?.enabled) return setError("Payments aren't set up on this server yet (Razorpay keys missing).");
    setBusy(true);
    const order = await api("/billing/order", { method: "POST", token, body: { plan } });
    if (!order.ok) {
      setBusy(false);
      return setError(order.error);
    }
    try {
      const Razorpay = await loadRazorpay();
      const checkout = new Razorpay({
        key: order.data.keyId,
        amount: order.data.amount,
        currency: order.data.currency,
        order_id: order.data.orderId,
        name: "StudyGroup",
        description: order.data.label,
        prefill: { email: account.email, name: account.name },
        theme: { color: "#7c3aed" },
        handler: async (payment) => {
          const res = await api("/billing/verify", {
            method: "POST",
            token,
            body: {
              orderId: payment.razorpay_order_id,
              paymentId: payment.razorpay_payment_id,
              signature: payment.razorpay_signature,
              clientId,
            },
          });
          setBusy(false);
          if (!res.ok) return setError(res.error);
          onActivated(res.data.account);
          setDone(true);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on("payment.failed", (resp) => {
        setBusy(false);
        setError(resp?.error?.description || "Payment failed. No money was taken — try again.");
      });
      checkout.open();
    } catch (err) {
      setBusy(false);
      setError(err.message);
    }
  };

  if (done) {
    return (
      <Modal title="Welcome to Pro ✨" icon={<Sparkles className="w-4 h-4 text-indigo-400" />} onClose={onClose}>
        <div className="text-center space-y-3 py-6">
          <div className="text-6xl">🎉</div>
          <div className="font-display text-2xl font-extrabold text-slate-100">you're Pro now. it's giving main character ✨</div>
          <p className="text-sm text-slate-400">Everything is unlocked on all your devices. Go cook some tests 🍳</p>
          <button onClick={onClose} className="pop px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold">let's go</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="StudyGroup Pro" icon={<Sparkles className="w-4 h-4 text-indigo-400" />} onClose={busy ? () => {} : onClose} wide>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="font-display text-3xl sm:text-4xl font-extrabold text-slate-100">
            level up your grind <span className="text-indigo-500">✨</span>
          </div>
          <p className="text-sm text-slate-400">{reason || "5 AI tests a day, unlimited group tests, full insights, every theme and private rooms."}</p>
          {proUntil && <p className="text-sm font-semibold text-emerald-500">You're Pro until {proUntil} — buying again adds more time.</p>}
        </div>

        {/* Plans */}
        <div className="grid sm:grid-cols-2 gap-3 max-w-xl mx-auto">
          {[
            ["monthly", "Monthly", `₹${prices.monthly.amount}`, "/ month", null],
            ["yearly", "Yearly", `₹${prices.yearly.amount}`, "/ year", `save ${saving}% · ₹${Math.round(prices.yearly.amount / 12)}/mo`],
          ].map(([id, name, price, per, tag]) => (
            <button
              key={id}
              onClick={() => setPlan(id)}
              className={`relative text-left p-5 rounded-2xl border-2 transition ${plan === id ? "border-indigo-500 bg-indigo-600/10" : "border-slate-700 hover:border-slate-500"}`}
            >
              {tag && <span className="sticker absolute -top-3 right-3 rotate-2 !text-[11px] !py-0.5" style={{ backgroundColor: "oklch(90% 0.12 120)" }}>{tag}</span>}
              <div className="text-sm font-bold text-slate-400">{name}</div>
              <div className="font-display text-3xl font-extrabold text-slate-100">{price} <span className="text-sm font-semibold text-slate-500">{per}</span></div>
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2 max-w-xl mx-auto">{error}</p>}

        <div className="flex flex-col items-center gap-2">
          {isNative ? (
            <>
              <a
                href={`${PUBLIC_URL}/?pro=1`} target="_blank" rel="noopener noreferrer"
                className="pop flex items-center gap-2 px-8 py-3 rounded-full bg-indigo-600 text-white font-bold"
              >
                get Pro on the website <ExternalLink className="w-4 h-4" />
              </a>
              <p className="text-[11px] text-slate-500 text-center max-w-sm">
                Buy on the website with the same login — Pro unlocks here automatically when you come back.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={buy}
                disabled={busy}
                className="pop flex items-center gap-2 px-8 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {account ? `get Pro — ₹${prices[plan].amount}` : "log in to get Pro"}
              </button>
              <p className="text-[11px] text-slate-500">UPI, cards, netbanking & wallets via Razorpay · one-time payment, no auto-renew</p>
            </>
          )}
        </div>

        {/* Free vs Pro */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-bold px-4 py-2.5">Feature</th>
                <th className="font-bold px-3 py-2.5 w-28">Free</th>
                <th className="font-bold px-3 py-2.5 w-28 text-indigo-400">Pro ✨</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(([name, free, pro]) => (
                <tr key={name} className="border-t border-slate-800">
                  <td className="px-4 py-2.5 text-slate-200">{name}</td>
                  <td className="px-3 py-2.5 text-center"><Cell value={free} /></td>
                  <td className="px-3 py-2.5 text-center"><Cell value={pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 text-center">*fair-use limit of 50 group tests per day.</p>
      </div>
    </Modal>
  );
}
