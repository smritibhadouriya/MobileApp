import { useState } from "react";
import { BarChart3, Download, Share2 } from "lucide-react";
import Modal from "../ui/Modal";
import { BADGES, formatMinutes } from "../../lib/stats";
import ProLock from "../ui/ProLock";

const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });

// Five-step intensity scale for the heatmap cells
function heatClass(minutes) {
  if (!minutes) return "bg-slate-800";
  if (minutes < 30) return "bg-indigo-500/30";
  if (minutes < 60) return "bg-indigo-500/50";
  if (minutes < 120) return "bg-indigo-500/75";
  return "bg-indigo-500";
}

function Heatmap({ days }) {
  // Pad the front so columns start on Monday
  const first = new Date(`${days[0].date}T00:00:00`);
  const pad = (first.getDay() + 6) % 7;
  const cells = [...Array(pad).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 w-max">
        {weeks.map((week, i) => (
          <div key={i} className="flex flex-col gap-1">
            {week.map((day, j) =>
              day ? (
                <div key={j} title={`${day.date}: ${formatMinutes(day.minutes)}`} className={`w-3 h-3 rounded-sm ${heatClass(day.minutes)}`} />
              ) : (
                <div key={j} className="w-3 h-3" />
              )
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
        Less {[0, 20, 45, 90, 150].map((m) => <span key={m} className={`w-3 h-3 rounded-sm ${heatClass(m)}`} />)} More
      </div>
    </div>
  );
}

// Draws a shareable 1080x1350 "day recap" card
async function makeRecapImage(stats, name) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
  grad.addColorStop(0, "#1e1b4b");
  grad.addColorStop(1, "#0f172a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.textAlign = "center";
  ctx.fillStyle = "#a5b4fc";
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText("StudyGroup · Day Recap", 540, 130);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "32px system-ui, sans-serif";
  ctx.fillText(new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }), 540, 185);

  ctx.font = "220px system-ui, sans-serif";
  ctx.fillText(stats.plant.icon, 540, 470);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 120px system-ui, sans-serif";
  ctx.fillText(formatMinutes(stats.todayMinutes), 540, 650);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "36px system-ui, sans-serif";
  ctx.fillText(`${name ? `${name} focused` : "focused"} today`, 540, 710);

  const tiles = [
    [String(stats.todayPomodoros), "sessions"],
    [`${stats.streak}🔥`, "day streak"],
    [`Lv ${stats.level.level}`, stats.level.title],
  ];
  tiles.forEach(([value, label], i) => {
    const x = 200 + i * 340;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(x - 140, 800, 280, 200, 32);
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 64px system-ui, sans-serif";
    ctx.fillText(value, x, 905);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "30px system-ui, sans-serif";
    ctx.fillText(label, x, 955);
  });

  const top = Object.entries(stats.subjects).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "34px system-ui, sans-serif";
    ctx.fillText(`Top subject this month: ${top[0]}`, 540, 1100);
  }
  ctx.fillStyle = "#64748b";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText("Study together at StudyGroup", 540, 1260);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export default function InsightsModal({ stats, name, pro, onUpgrade, onClose }) {
  const [busy, setBusy] = useState(false);
  const weekChange = stats.lastWeekMinutes ? Math.round(((stats.weekMinutes - stats.lastWeekMinutes) / stats.lastWeekMinutes) * 100) : null;
  const subjects = Object.entries(stats.subjects).sort((a, b) => b[1] - a[1]);
  const topSubject = subjects[0]?.[1] || 1;

  const shareRecap = async (download) => {
    setBusy(true);
    try {
      const blob = await makeRecapImage(stats, name);
      const file = new File([blob], "studygroup-recap.png", { type: "image/png" });
      if (!download && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My study recap", text: `I focused ${formatMinutes(stats.todayMinutes)} today on StudyGroup!` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      // Share sheet dismissed
    }
    setBusy(false);
  };

  return (
    <Modal title="Insights, Badges & Recap" icon={<BarChart3 className="w-4 h-4 text-indigo-400" />} onClose={onClose} wide>
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["Total focus", formatMinutes(stats.totalMinutes)],
            ["Sessions", stats.totalPomodoros],
            ["Level", `${stats.level.level} · ${stats.level.title}`],
            ["Streak", `${stats.streak} days 🔥`],
          ].map(([label, value]) => (
            <div key={label} className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
              <div className="text-base font-semibold text-slate-100 mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        <ProLock locked={!pro} onUpgrade={onUpgrade} label="Full insights">
        <div className="space-y-6">
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Study calendar (last 18 weeks)</h3>
          <Heatmap days={stats.heatmap} />
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weekly report</h3>
            <div className="text-2xl font-bold text-slate-100">{formatMinutes(stats.weekMinutes)}</div>
            <div className="text-xs text-slate-400">
              {weekChange === null
                ? "Last week: no data yet"
                : weekChange >= 0
                  ? <span className="text-emerald-400">▲ {weekChange}% vs last week ({formatMinutes(stats.lastWeekMinutes)})</span>
                  : <span className="text-rose-400">▼ {Math.abs(weekChange)}% vs last week ({formatMinutes(stats.lastWeekMinutes)})</span>}
            </div>
            <div className="text-xs text-slate-300 pt-1">
              {stats.bestHour === null
                ? "Complete a few sessions to find your best focus time."
                : <>⚡ You focus best around <b>{hourLabel(stats.bestHour)}–{hourLabel((stats.bestHour + 1) % 24)}</b></>}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Subjects (30 days)</h3>
            {subjects.length === 0 && <p className="text-xs text-slate-500">No sessions yet.</p>}
            <div className="space-y-2">
              {subjects.map(([s, m]) => (
                <div key={s}>
                  <div className="flex justify-between text-xs"><span className="text-slate-200">{s}</span><span className="text-slate-400 tabular-nums">{formatMinutes(m)}</span></div>
                  <div className="h-1.5 mt-1 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(m / topSubject) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>
        </div>
        </ProLock>

        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Badges ({Object.keys(stats.badges).length}/{BADGES.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BADGES.map((b) => {
              const earned = stats.badges[b.id];
              return (
                <div key={b.id} className={`p-3 rounded-xl border text-center ${earned ? "bg-indigo-600/10 border-indigo-500/30" : "bg-slate-800/30 border-slate-800 opacity-50 grayscale"}`} title={b.desc}>
                  <div className="text-2xl">{b.icon}</div>
                  <div className="text-xs font-medium text-slate-200 mt-1">{b.name}</div>
                  <div className="text-[10px] text-slate-500">{earned ? new Date(earned).toLocaleDateString() : b.desc}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recent sessions</h3>
          {stats.sessions.length === 0 && <p className="text-xs text-slate-500">No sessions yet.</p>}
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {stats.sessions.map((s) => (
              <div key={s.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-slate-800/30 text-xs">
                <span className="text-slate-500 w-28 shrink-0">{new Date(s.time).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                <span className="text-slate-200 w-20 shrink-0">{s.subject}</span>
                <span className="text-slate-400 w-12 shrink-0">{s.minutes}m</span>
                <span className={`w-12 shrink-0 ${s.score >= 80 ? "text-emerald-400" : s.score >= 50 ? "text-amber-400" : "text-rose-400"}`}>{s.score}%</span>
                <span className="text-slate-400 min-w-0 break-words">{s.note}</span>
              </div>
            ))}
          </div>
        </section>

        <ProLock locked={!pro} onUpgrade={onUpgrade} label="Recap card">
        <section className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-indigo-600/10 border border-indigo-500/20">
          <div>
            <div className="text-sm font-semibold text-slate-100">📸 Today's recap card</div>
            <div className="text-xs text-slate-400">A shareable image of your day — post it on your story!</div>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => shareRecap(true)} className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1 disabled:opacity-50">
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button disabled={busy} onClick={() => shareRecap(false)} className="px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1 disabled:opacity-50">
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        </section>
        </ProLock>
      </div>
    </Modal>
  );
}
