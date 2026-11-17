import { useState } from "react";
import { CalendarClock, Trash2, Plus } from "lucide-react";
import Modal from "../ui/Modal";
import { newId } from "../../lib/storage";
import { SUBJECTS } from "../../lib/subjects";

const sortBlocks = (blocks) => [...blocks].sort((a, b) => a.start.localeCompare(b.start));

export default function PlannerModal({ blocks, activeBlockId, onChange, onClose }) {
  const [form, setForm] = useState({ start: "18:00", end: "19:00", subject: "Physics", label: "" });

  const add = (e) => {
    e.preventDefault();
    if (form.end <= form.start) return;
    onChange(sortBlocks([...blocks, { id: newId(), ...form, label: form.label.trim() }]));
  };

  const inputClass = "w-full mt-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs focus:outline-none focus:border-indigo-500";

  return (
    <Modal title="Daily Study Planner" icon={<CalendarClock className="w-4 h-4 text-indigo-400" />} onClose={onClose}>
      <p className="text-xs text-slate-400 mb-4">
        Plan your day in time blocks. During a block, the timer picks that subject automatically so your stats stay accurate.
      </p>

      <div className="space-y-1.5 mb-5">
        {blocks.length === 0 && <p className="text-xs text-slate-500">No blocks yet.</p>}
        {blocks.map((b) => (
          <div
            key={b.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-xs ${b.id === activeBlockId ? "border-indigo-500 bg-indigo-600/10" : "border-slate-800 bg-slate-800/40"}`}
          >
            <span className="font-mono text-slate-300 w-24 shrink-0">{b.start}–{b.end}</span>
            <span className="font-medium text-slate-100">{b.subject}</span>
            {b.label && <span className="text-slate-400 truncate">· {b.label}</span>}
            {b.id === activeBlockId && <span className="text-[10px] text-indigo-300 ml-auto shrink-0">NOW</span>}
            <button onClick={() => onChange(blocks.filter((x) => x.id !== b.id))} className={`text-slate-500 hover:text-rose-400 shrink-0 ${b.id === activeBlockId ? "" : "ml-auto"}`} title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end p-3 rounded-xl bg-slate-800/30 border border-slate-800">
        <label className="text-[10px] uppercase tracking-wider text-slate-500">From
          <input type="time" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={inputClass} />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-slate-500">To
          <input type="time" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={inputClass} />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-slate-500">Subject
          <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-slate-500">Note
          <input value={form.label} maxLength={40} placeholder="Ch-4 problems" onChange={(e) => setForm({ ...form, label: e.target.value })} className={inputClass} />
        </label>
        {form.end <= form.start && <p className="col-span-full text-[11px] text-rose-400">End time must be after start time.</p>}
        <button type="submit" className="col-span-full py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add block
        </button>
      </form>
    </Modal>
  );
}
