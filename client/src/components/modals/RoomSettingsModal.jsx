import { useState } from "react";
import { Settings } from "lucide-react";
import Modal from "../ui/Modal";
import { ROOM_EMOJIS } from "../../lib/subjects";
import { ProTag } from "../ui/ProLock";

export default function RoomSettingsModal({ meta, pro, onUpgrade, onSave, onClose }) {
  const [form, setForm] = useState({
    name: meta.name,
    emoji: meta.emoji,
    isPublic: meta.isPublic,
    hostOnlyTimer: meta.hostOnlyTimer,
    examName: meta.examName,
    examDate: meta.examDate,
    schedule: meta.schedule,
    challengeGoal: meta.challengeGoal,
  });
  const [password, setPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = (e) => {
    e.preventDefault();
    const payload = { ...form, challengeGoal: Number(form.challengeGoal) || 0 };
    if (removePassword) payload.password = "";
    else if (password) payload.password = password;
    onSave(payload);
    onClose();
  };

  const inputClass = "w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500";
  const labelClass = "block text-[11px] font-semibold text-slate-400 uppercase tracking-wider";

  return (
    <Modal title="Room Settings" icon={<Settings className="w-4 h-4 text-indigo-400" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className={labelClass}>Room name</label>
          <input value={form.name} onChange={set("name")} maxLength={40} required className={inputClass} />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ROOM_EMOJIS.map((emoji) => (
              <button
                key={emoji} type="button" onClick={() => setForm({ ...form, emoji })}
                className={`w-9 h-9 rounded-lg text-lg border ${form.emoji === emoji ? "border-indigo-500 bg-indigo-600/20" : "border-slate-700 hover:border-slate-600"}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.isPublic} onChange={set("isPublic")} className="accent-indigo-500" />
            Show in public rooms list
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.hostOnlyTimer} onChange={set("hostOnlyTimer")} className="accent-indigo-500" />
            Only I (the host) can control the room timer
          </label>
        </div>

        <div>
          <label className={labelClass}>Password {meta.hasPassword && <span className="normal-case text-emerald-400">· currently set</span>}</label>
          {pro ? (
            <input
              type="password" value={password} onChange={(e) => { setPassword(e.target.value); setRemovePassword(false); }}
              maxLength={64} autoComplete="new-password" placeholder={meta.hasPassword ? "Enter a new password to change it" : "Set a password to make the room private"}
              className={inputClass}
            />
          ) : (
            <button type="button" onClick={onUpgrade} className="w-full mt-1 text-left px-3 py-2 rounded-xl border border-dashed border-slate-700 text-sm text-slate-500 hover:text-slate-300">
              🔒 Password-protect this room<ProTag />
            </button>
          )}
          {meta.hasPassword && (
            <label className="flex items-center gap-2 text-xs text-slate-400 mt-2">
              <input type="checkbox" checked={removePassword} onChange={(e) => setRemovePassword(e.target.checked)} className="accent-rose-500" />
              Remove password (anyone with the code can join)
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Exam name</label>
            <input value={form.examName} onChange={set("examName")} maxLength={40} placeholder="JEE Mains" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Exam date</label>
            <input type="date" value={form.examDate} onChange={set("examDate")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Daily session time</label>
            <input type="time" value={form.schedule} onChange={set("schedule")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Weekly goal (hours)</label>
            <input type="number" min="0" max="1000" value={form.challengeGoal} onChange={set("challengeGoal")} className={inputClass} />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Leave a field empty to hide it. The weekly goal counts every member's completed focus time.</p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100">Cancel</button>
          <button type="submit" className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium">Save</button>
        </div>
      </form>
    </Modal>
  );
}
