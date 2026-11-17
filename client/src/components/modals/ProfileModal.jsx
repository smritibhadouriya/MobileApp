import { Palette } from "lucide-react";
import Modal from "../ui/Modal";
import { AVATARS } from "../../lib/subjects";
import { FREE_ACCENTS, FREE_BACKGROUNDS } from "../../lib/pro";
import { ProTag } from "../ui/ProLock";

const ACCENTS = [
  ["violet", "oklch(60.6% 0.25 293)", "Grape"],
  ["lamp", "oklch(70% 0.165 56)", "Lamp"],
  ["indigo", "oklch(58.5% 0.233 277)", "Ink"],
  ["emerald", "oklch(63% 0.12 160)", "Sage"],
  ["sky", "oklch(68.5% 0.169 237)", "Sky"],
  ["rose", "oklch(64.5% 0.246 16)", "Rose"],
];
const BACKGROUNDS = [
  ["pastel", "🎨 Pastel grid"],
  ["lamp", "🪔 Desk lamp"],
  ["library", "📚 Library"],
  ["rain", "🌧️ Rainy window"],
  ["night", "🌙 Night sky"],
  ["forest", "🌿 Garden"],
  ["none", "Plain"],
];

export default function ProfileModal({ profile, pro, onUpgrade, onChange, onClose }) {
  const labelClass = "block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2";
  const chip = (active) => `px-3 py-1.5 rounded-lg text-xs border transition ${active ? "border-indigo-500 bg-indigo-600/20 text-indigo-200" : "border-slate-700 text-slate-300 hover:border-slate-600"}`;

  return (
    <Modal title="Theme & Profile" icon={<Palette className="w-4 h-4 text-indigo-400" />} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <span className={labelClass}>Theme</span>
          <div className="flex gap-2">
            {[["light", "☀️ Light"], ["dark", "🌙 Dark"]].map(([id, label]) => (
              <button key={id} onClick={() => onChange({ theme: id })} className={chip(profile.theme === id)}>{label}</button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>Accent colour {!pro && <span className="normal-case font-normal text-slate-500">· more colours with Pro ✨</span>}</span>
          <div className="flex gap-2">
            {ACCENTS.map(([id, color, name]) => (
              <button
                key={id} onClick={() => (pro || FREE_ACCENTS.includes(id) ? onChange({ accent: id }) : onUpgrade())} title={pro || FREE_ACCENTS.includes(id) ? name : `${name} (Pro)`}
                className={`w-8 h-8 rounded-full border-2 transition ${profile.accent === id ? "border-slate-100 scale-110" : "border-transparent"}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>Background</span>
          <div className="flex flex-wrap gap-2">
            {BACKGROUNDS.map(([id, label]) => (
              <button key={id} onClick={() => (pro || FREE_BACKGROUNDS.includes(id) ? onChange({ background: id }) : onUpgrade())} className={chip(profile.background === id)}>
                {label}{!pro && !FREE_BACKGROUNDS.includes(id) && <ProTag />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>Avatar <span className="normal-case font-normal text-slate-500">(applies next time you join a room)</span></span>
          <div className="flex flex-wrap gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a} onClick={() => onChange({ avatar: a })}
                className={`w-9 h-9 rounded-lg text-lg border ${profile.avatar === a ? "border-indigo-500 bg-indigo-600/20" : "border-slate-700 hover:border-slate-600"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>Daily study goal</span>
          <div className="flex items-center gap-3">
            <input
              type="range" min="30" max="600" step="15" value={profile.dailyGoal}
              onChange={(e) => onChange({ dailyGoal: Number(e.target.value) })}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-sm text-slate-200 w-20 text-right tabular-nums">
              {Math.floor(profile.dailyGoal / 60)}h {profile.dailyGoal % 60}m
            </span>
          </div>
        </div>

        {profile.blocked.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{profile.blocked.length} blocked user{profile.blocked.length === 1 ? "" : "s"}</span>
            <button onClick={() => onChange({ blocked: [] })} className="text-indigo-300 hover:text-indigo-200">Unblock all</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
