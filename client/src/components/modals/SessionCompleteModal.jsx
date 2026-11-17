import { useState } from "react";
import { PartyPopper } from "lucide-react";
import Modal from "../ui/Modal";
import { SUBJECTS } from "../../lib/subjects";

// Shown after a focus session: score, XP, new badges, and a quick "what did you study?" note
export default function SessionCompleteModal({ result, onSave, onClose }) {
  const { session, xpGained, levelUp, newBadges, distractions } = result;
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState(session.subject);

  const save = (e) => {
    e?.preventDefault();
    onSave(session.id, { note: note.trim(), subject });
    onClose();
  };

  const scoreColor = session.score >= 80 ? "text-emerald-400" : session.score >= 50 ? "text-amber-400" : "text-rose-400";

  return (
    <Modal title="W session! 🎉" icon={<PartyPopper className="w-4 h-4 text-indigo-400" />} onClose={save}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="text-xl font-bold text-slate-100">{session.minutes}m</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Focused</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className={`text-xl font-bold ${scoreColor}`}>{session.score}%</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Focus score</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="text-xl font-bold text-indigo-300">+{xpGained}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">XP</div>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center">
          {distractions === 0 ? "🎯 zero tab switches — locked in fr" : `you left the tab ${distractions} time${distractions === 1 ? "" : "s"} this session — we saw that 👀`}
        </p>

        {levelUp && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center text-sm text-amber-200">
            ⬆️ level up! you're now <b>Level {levelUp.level} · {levelUp.title}</b> 💅
          </div>
        )}
        {newBadges.length > 0 && (
          <div className="p-3 rounded-xl bg-indigo-600/10 border border-indigo-500/30">
            <div className="text-[11px] uppercase tracking-wider text-indigo-300 mb-2">New badge{newBadges.length > 1 ? "s" : ""} unlocked</div>
            <div className="flex flex-wrap gap-3">
              {newBadges.map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-sm text-slate-100"><span className="text-2xl">{b.icon}</span> {b.name}</div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">what did you study?</label>
          <div className="flex gap-2">
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500">
              {[...new Set([session.subject, ...SUBJECTS])].map((s) => <option key={s}>{s}</option>)}
            </select>
            <input
              autoFocus value={note} maxLength={200} onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Solved 15 problems from Ch-4"
              className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="pop px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold">save & take a break ☕</button>
        </div>
      </form>
    </Modal>
  );
}
