import { useState } from "react";
import { Sigma, Search, Send, Trash2, Plus } from "lucide-react";
import Modal from "../ui/Modal";
import MathText from "../ui/MathText";
import { newId } from "../../lib/storage";
import { SUBJECTS } from "../../lib/subjects";

export default function FormulaBankModal({ formulas, onChange, onShare, onClose }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("All");
  const [form, setForm] = useState({ subject: "Physics", title: "", latex: "" });

  const q = query.trim().toLowerCase();
  const visible = formulas.filter(
    (f) => (subject === "All" || f.subject === subject) && (!q || `${f.title} ${f.latex} ${f.subject}`.toLowerCase().includes(q))
  );
  const usedSubjects = ["All", ...new Set(formulas.map((f) => f.subject))];

  const add = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.latex.trim()) return;
    onChange([{ id: newId(), ...form, title: form.title.trim(), latex: form.latex.trim() }, ...formulas]);
    setForm({ ...form, title: "", latex: "" });
  };

  const inputClass = "px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500";

  return (
    <Modal title="Formula Bank" icon={<Sigma className="w-4 h-4 text-indigo-400" />} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search formulas…" className={`${inputClass} w-full pl-9`} />
          </div>
          <div className="flex flex-wrap gap-1">
            {usedSubjects.map((s) => (
              <button key={s} onClick={() => setSubject(s)} className={`px-2.5 py-1.5 rounded-lg text-xs border ${subject === s ? "border-indigo-500 bg-indigo-600/20 text-indigo-200" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          {visible.length === 0 && <p className="text-xs text-slate-500">No formulas match.</p>}
          {visible.map((f) => (
            <div key={f.id} className="group p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-slate-200 truncate">{f.title} <span className="text-slate-500 font-normal">· {f.subject}</span></span>
                <div className="flex gap-1 shrink-0 opacity-60 group-hover:opacity-100">
                  <button onClick={() => onShare(`${f.title}: $${f.latex}$`)} title="Share to room chat" className="p-1 text-slate-400 hover:text-indigo-300"><Send className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onChange(formulas.filter((x) => x.id !== f.id))} title="Delete" className="p-1 text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="text-slate-100 overflow-x-auto"><MathText text={`$$${f.latex}$$`} /></div>
            </div>
          ))}
        </div>

        <form onSubmit={add} className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Add formula (LaTeX)</div>
          <div className="grid sm:grid-cols-[8rem_1fr] gap-2">
            <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass}>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input value={form.title} maxLength={60} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Name (e.g. Lens formula)" className={inputClass} />
          </div>
          <input value={form.latex} maxLength={300} onChange={(e) => setForm({ ...form, latex: e.target.value })} placeholder="\frac{1}{f} = \frac{1}{v} - \frac{1}{u}" className={`${inputClass} w-full font-mono`} />
          {form.latex && <div className="text-slate-100 overflow-x-auto"><MathText text={`$$${form.latex}$$`} /></div>}
          <button type="submit" className="w-full py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Save formula
          </button>
        </form>
      </div>
    </Modal>
  );
}
