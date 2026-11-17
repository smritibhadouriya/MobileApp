import { useRef, useState } from "react";
import { ClipboardList, Upload, Sparkles, PenLine, Trash2, Plus, Loader2, FileText, X, ArrowLeft, Send } from "lucide-react";
import Modal from "../ui/Modal";
import MathText from "../ui/MathText";
import { emptyQuestion, isQuestionComplete, readNotesFile } from "../../lib/tests";

const SOURCES = [
  { id: "notes", label: "📒 From my notes", Icon: FileText },
  { id: "topic", label: "🎯 On a topic", Icon: Sparkles },
  { id: "manual", label: "✍️ Write myself", Icon: PenLine },
];
const EXAMS = ["JEE Main", "JEE Advanced", "NEET", "Class 12 Boards", "Class 10 Boards", "University"];
const DURATIONS = [5, 10, 15, 20, 30, 60];
const START_OPTIONS = [
  { id: "now", label: "right now" },
  { id: "5", label: "in 5 min" },
  { id: "15", label: "in 15 min" },
  { id: "at", label: "at a time…" },
];

function QuestionEditor({ q, index, onChange, onDelete }) {
  const set = (patch) => onChange({ ...q, ...patch });
  const complete = isQuestionComplete(q);
  return (
    <div className={`p-3 rounded-2xl border space-y-2 ${complete ? "border-slate-700 bg-slate-950/30" : "border-amber-500/50 bg-amber-500/5"}`}>
      <div className="flex items-start gap-2">
        <span className="mt-2 text-xs font-bold text-slate-500 w-6 shrink-0">Q{index + 1}</span>
        <textarea
          value={q.question} rows={2} maxLength={600}
          onChange={(e) => set({ question: e.target.value })}
          placeholder="Type the question… ($x^2$ for maths)"
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm resize-y focus:outline-none focus:border-indigo-500"
        />
        <button onClick={onDelete} title="Delete question" className="mt-2 p-1 text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 pl-8">
        {q.options.map((opt, i) => (
          <label key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border ${q.answer === i ? "border-emerald-500 bg-emerald-500/10" : "border-slate-700"}`}>
            <input type="radio" name={`answer-${index}`} checked={q.answer === i} onChange={() => set({ answer: i })} className="accent-emerald-500" title="Correct answer" />
            <span className="text-xs font-bold text-slate-500">{"ABCDEF"[i]}</span>
            <input
              value={opt} maxLength={250}
              onChange={(e) => set({ options: q.options.map((o, j) => (j === i ? e.target.value : o)) })}
              placeholder={`Option ${"ABCDEF"[i]}`}
              className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
            />
          </label>
        ))}
      </div>
      <input
        value={q.explanation} maxLength={1000}
        onChange={(e) => set({ explanation: e.target.value })}
        placeholder="Explanation shown after the test (optional)"
        className="ml-8 w-[calc(100%-2rem)] px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
      />
      {!complete && <p className="pl-8 text-[11px] text-amber-400">Needs a question, at least 2 options and the correct one selected (green).</p>}
    </div>
  );
}

export default function CreateTestModal({ notes, aiEnabled, pro, account, onUpgrade, onUsageChanged, actions, onCreated, onClose }) {
  const [step, setStep] = useState("source");
  const [source, setSource] = useState(aiEnabled ? "notes" : "manual");
  const [notesText, setNotesText] = useState("");
  const [file, setFile] = useState(null);
  const [topic, setTopic] = useState("");
  const [exam, setExam] = useState("JEE Main");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsPro, setNeedsPro] = useState(false);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [duration, setDuration] = useState(10);
  const [start, setStart] = useState("now");
  const [startAt, setStartAt] = useState("");
  const [marking, setMarking] = useState("simple");
  const fileRef = useRef(null);

  const pickFile = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError("");
    try {
      const result = await readNotesFile(picked);
      if (result.kind === "text") setNotesText((t) => (t ? `${t}\n\n${result.text}` : result.text).slice(0, 30000));
      else setFile(result);
    } catch (err) {
      setError(err.message);
    }
  };

  const generate = async () => {
    setError("");
    if (source === "manual") {
      setQuestions([emptyQuestion()]);
      setStep("review");
      return;
    }
    if (source === "notes" && !notesText.trim() && !file) return setError("Paste your notes, use the room notes, or upload a PDF/photo.");
    if (source === "topic" && !topic.trim()) return setError("Type a topic, e.g. “Rotational motion — torque & moment of inertia”.");
    setBusy(true);
    const res = await actions.generateTest({
      mode: source,
      text: notesText,
      file: file && { data: file.data, mediaType: file.mediaType },
      topic,
      exam,
      count,
      difficulty,
    });
    setBusy(false);
    onUsageChanged?.();
    if (!res.ok) {
      setNeedsPro(!!res.upgrade);
      return setError(res.error);
    }
    setTitle(res.title || topic || "Squad test");
    setQuestions(res.questions.map((q) => ({ ...q, options: [...q.options] })));
    setStep("review");
  };

  const startTime = () => {
    if (start === "now") return null;
    if (start !== "at") return Date.now() + Number(start) * 60000;
    if (!startAt) return null;
    const [h, m] = startAt.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); // a time that already passed means tomorrow
    return d.getTime();
  };

  const send = async () => {
    setError("");
    const ready = questions.filter(isQuestionComplete);
    if (!ready.length) return setError("Add at least one complete question.");
    if (ready.length < questions.length && !window.confirm(`${questions.length - ready.length} incomplete question(s) will be skipped. Send anyway?`)) return;
    if (start === "at" && !startAt) return setError("Pick a start time.");
    setBusy(true);
    const res = await actions.createTest({
      title: title.trim() || "Squad test",
      questions: ready.map((q) => ({ ...q, options: q.options.map((o) => o.trim()) })),
      durationMin: duration,
      startsAt: startTime(),
      marking,
      source,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setBusy(false);
    onUsageChanged?.();
    if (!res.ok) {
      setNeedsPro(!!res.upgrade);
      return setError(res.error);
    }
    onCreated?.();
    onClose();
  };

  const chip = (active) =>
    `px-3 py-1.5 rounded-full text-xs font-semibold border transition ${active ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-700 text-slate-300 hover:border-slate-500"}`;
  const inputClass = "w-full px-3 py-2.5 bg-slate-950/50 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500";
  const label = "block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <Modal title={step === "source" ? "Make a test for the squad" : "Review & send"} icon={<ClipboardList className="w-4 h-4 text-indigo-400" />} onClose={busy ? () => {} : onClose} wide>
      {step === "source" ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <button key={s.id} onClick={() => { setSource(s.id); setError(""); }} className={chip(source === s.id)}>{s.label}</button>
            ))}
          </div>

          {!aiEnabled && source !== "manual" && (
            <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
              AI test generation needs <code>ANTHROPIC_API_KEY</code> on the server. You can still write the questions yourself ✍️
            </p>
          )}

          {source === "notes" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={label}>Your notes</span>
                {notes.trim() && (
                  <button onClick={() => setNotesText(notes.slice(0, 30000))} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                    import from my notebook 📒
                  </button>
                )}
              </div>
              <textarea
                value={notesText} rows={7} maxLength={30000}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Paste your notes here — chapter summary, formulas, class notes…"
                className={`${inputClass} resize-y`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,.txt,.md,text/plain" onChange={pickFile} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="pop flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold">
                  <Upload className="w-4 h-4" /> upload PDF / photo of notes / .txt
                </button>
                {file && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-indigo-600/15 text-xs text-indigo-300">
                    📎 {file.name}
                    <button onClick={() => setFile(null)} title="Remove"><X className="w-3.5 h-3.5" /></button>
                  </span>
                )}
                <span className="text-[11px] text-slate-500">max 5 MB · handwritten notes work too 📸</span>
              </div>
            </div>
          )}

          {source === "topic" && (
            <div className="grid sm:grid-cols-[1fr_12rem] gap-3">
              <div>
                <span className={label}>Topic</span>
                <input value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Electrostatics — Gauss's law" className={inputClass} />
              </div>
              <div>
                <span className={label}>Level</span>
                <select value={exam} onChange={(e) => setExam(e.target.value)} className={inputClass}>
                  {EXAMS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            </div>
          )}

          {source !== "manual" && aiEnabled && !pro && (
            <p className="text-xs text-slate-500">
              Free plan: {account ? `${Math.max(0, (account.limits?.aiTests ?? 1) - (account.usage?.aiTests ?? 0))} of ${account.limits?.aiTests ?? 1}` : "1"} AI test left today ·{" "}
              <button onClick={onUpgrade} className="font-semibold text-indigo-500 hover:text-indigo-400">5 a day with Pro ✨</button>
            </p>
          )}

          {source !== "manual" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <span className={label}>Number of questions</span>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 20, 30].map((n) => <button key={n} onClick={() => setCount(n)} className={chip(count === n)}>{n}</button>)}
                </div>
              </div>
              <div>
                <span className={label}>Difficulty</span>
                <div className="flex flex-wrap gap-2">
                  {[["easy", "easy 😌"], ["medium", "medium 🤔"], ["hard", "hard 💀"]].map(([id, text]) => (
                    <button key={id} onClick={() => setDifficulty(id)} className={chip(difficulty === id)}>{text}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {source === "manual" && (
            <p className="text-sm text-slate-400">Write your own questions on the next screen — mark the correct option for each one.</p>
          )}

          {error && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              <span>{error}</span>
              {needsPro && <button onClick={onUpgrade} className="pop px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold">get Pro ✨</button>}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={generate}
              disabled={busy || (!aiEnabled && source !== "manual")}
              className="pop flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> AI is cooking your test… 🍳</> : source === "manual" ? "start writing →" : <><Sparkles className="w-4 h-4" /> generate test</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <span className={label}>Test title</span>
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Physics Showdown" className={inputClass} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={label}>Questions ({questions.length}) · edit anything before sending</span>
            </div>
            {questions.map((q, i) => (
              <QuestionEditor
                key={i} q={q} index={i}
                onChange={(next) => setQuestions(questions.map((x, j) => (j === i ? next : x)))}
                onDelete={() => setQuestions(questions.filter((_, j) => j !== i))}
              />
            ))}
            <button
              onClick={() => setQuestions([...questions, emptyQuestion()])}
              disabled={questions.length >= 50}
              className="w-full py-2.5 rounded-2xl border-2 border-dashed border-slate-700 text-sm font-semibold text-slate-400 hover:text-slate-100 hover:border-slate-500 flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" /> add question
            </button>
          </div>

          {questions.some((q) => /\$/.test(q.question)) && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer">Preview maths</summary>
              <div className="mt-2 space-y-1">{questions.map((q, i) => <div key={i}><b>Q{i + 1}.</b> <MathText text={q.question} /></div>)}</div>
            </details>
          )}

          <div className="grid sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-950/40 border border-slate-800">
            <div>
              <span className={label}>⏱️ Time limit</span>
              <div className="flex flex-wrap gap-1.5">
                {DURATIONS.map((d) => <button key={d} onClick={() => setDuration(d)} className={chip(duration === d)}>{d}m</button>)}
              </div>
            </div>
            <div>
              <span className={label}>🕒 Starts</span>
              <div className="flex flex-wrap gap-1.5">
                {START_OPTIONS.map((o) => <button key={o.id} onClick={() => setStart(o.id)} className={chip(start === o.id)}>{o.label}</button>)}
              </div>
              {start === "at" && <input type="time" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={`${inputClass} mt-2`} />}
            </div>
            <div>
              <span className={label}>🧮 Marking</span>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setMarking("simple")} className={chip(marking === "simple")}>+1 / 0</button>
                <button onClick={() => setMarking("jee")} className={chip(marking === "jee")}>JEE +4 / −1</button>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              <span>{error}</span>
              {needsPro && <button onClick={onUpgrade} className="pop px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold">get Pro ✨</button>}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setStep("source")} disabled={busy} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100">
              <ArrowLeft className="w-4 h-4" /> back
            </button>
            <button
              onClick={send}
              disabled={busy}
              className="pop flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} send to the squad 🚀
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
