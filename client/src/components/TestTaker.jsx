import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Flag, Minimize2, Send, Loader2 } from "lucide-react";
import MathText from "./ui/MathText";
import useNow from "../hooks/useNow";
import { formatCountdown } from "../lib/tests";

// Full-screen exam view. Each answer is sent to the server immediately, so a refresh or
// lost connection doesn't lose work; when time runs out the server submits automatically.
export default function TestTaker({ test, clockOffset, actions, onMinimize, onFinished }) {
  const [answers, setAnswers] = useState(() => Array(test.questionCount).fill(null));
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(0);
  const [review, setReview] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const now = useNow(500);
  const left = test.endsAt - (now + clockOffset);
  const question = test.questions?.[current];
  const answered = answers.filter((a) => a !== null).length;

  // Restore answers already saved on the server
  useEffect(() => {
    let cancelled = false;
    actions.getTestState(test.id).then((res) => {
      if (cancelled) return;
      if (res?.submitted) return onFinished();
      if (Array.isArray(res?.answers) && res.answers.length) setAnswers(res.answers);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [test.id, actions, onFinished]);

  // Time's up or the test was ended by everyone submitting
  useEffect(() => {
    if (test.ended) onFinished();
  }, [test.ended, onFinished]);

  const choose = (choice) => {
    const next = answers[current] === choice ? null : choice; // tap again to clear
    setAnswers(answers.map((a, i) => (i === current ? next : a)));
    actions.answerTest(test.id, current, next);
  };

  const toggleReview = () =>
    setReview((r) => {
      const next = new Set(r);
      if (next.has(current)) next.delete(current);
      else next.add(current);
      return next;
    });

  const submit = () => {
    const skipped = test.questionCount - answered;
    if (!window.confirm(skipped ? `${skipped} question(s) unanswered. Submit anyway?` : "Submit your test?")) return;
    setSubmitting(true);
    actions.submitTest(test.id);
    setTimeout(onFinished, 400);
  };

  // Keyboard: 1-4 / A-D to answer, arrows to move
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const n = "1234".indexOf(e.key) + 1 || "abcd".indexOf(e.key.toLowerCase()) + 1;
      if (n && question && n <= question.options.length) choose(n - 1);
      else if (e.key === "ArrowRight") setCurrent((c) => Math.min(test.questionCount - 1, c + 1));
      else if (e.key === "ArrowLeft") setCurrent((c) => Math.max(0, c - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const urgent = left < 60000;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col safe-top safe-bottom">
      {/* Exam header */}
      <header className="shrink-0 border-b-2 border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onMinimize} title="Back to the room (test keeps running)" className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800">
          <Minimize2 className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-slate-100 truncate">{test.title}</div>
          <div className="text-[11px] text-slate-500">{answered}/{test.questionCount} answered · {test.marking.wrong ? `+${test.marking.correct} / ${test.marking.wrong}` : "+1 / 0"} marking</div>
        </div>
        <div className={`font-display text-2xl font-extrabold tabular-nums px-3 py-1 rounded-xl ${urgent ? "bg-rose-500 text-white animate-pulse" : "bg-slate-800 text-slate-100"}`}>
          ⏱ {formatCountdown(left)}
        </div>
        <button onClick={submit} disabled={submitting} className="pop hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-60">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} submit
        </button>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Question */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          {!loaded || !question ? (
            <div className="h-full flex items-center justify-center text-slate-500 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> loading your test…</div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>QUESTION {current + 1} OF {test.questionCount}{question.topic && <span className="font-medium normal-case"> · {question.topic}</span>}</span>
                <button onClick={toggleReview} className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${review.has(current) ? "border-amber-500 bg-amber-500/15 text-amber-500" : "border-slate-700 hover:text-slate-200"}`}>
                  <Flag className="w-3.5 h-3.5" /> {review.has(current) ? "marked for review" : "mark for review"}
                </button>
              </div>
              <div className="paper-card rounded-3xl p-5 sm:p-6 text-lg sm:text-xl font-semibold text-slate-100 leading-relaxed">
                <MathText text={question.question} />
              </div>
              <div className="space-y-3">
                {question.options.map((opt, i) => {
                  const picked = answers[current] === i;
                  return (
                    <button
                      key={i}
                      onClick={() => choose(i)}
                      className={`pop w-full flex items-center gap-3 text-left p-4 rounded-2xl text-sm sm:text-base transition ${
                        picked ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-100 hover:bg-slate-800"
                      }`}
                    >
                      <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold ${picked ? "bg-white/20" : "bg-slate-800 text-slate-400"}`}>
                        {"ABCDEF"[i]}
                      </span>
                      <span className="min-w-0"><MathText text={opt} mentionClass="" /></span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 text-center">tap an option again to clear it · keys 1-4 and ← → work too</p>
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setCurrent(current - 1)} disabled={current === 0}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-slate-800 text-sm font-semibold disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" /> prev
                </button>
                {current < test.questionCount - 1 ? (
                  <button onClick={() => setCurrent(current + 1)} className="pop flex items-center gap-1 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold">
                    next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={submit} disabled={submitting} className="pop flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold">
                    <Send className="w-4 h-4" /> submit test
                  </button>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Question palette */}
        <aside className="shrink-0 lg:w-72 border-t-2 lg:border-t-0 lg:border-l-2 border-slate-800 px-4 py-3 lg:p-4 bg-slate-900/40">
          <div className="hidden lg:block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Questions</div>
          {/* Phones: one scrollable row of numbers so the question keeps most of the screen */}
          <div className="flex lg:grid lg:grid-cols-5 gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {Array.from({ length: test.questionCount }, (_, i) => {
              const done = answers[i] !== null;
              return (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`relative w-9 h-9 lg:w-auto lg:h-auto shrink-0 lg:aspect-square rounded-xl text-xs font-bold border-2 transition ${
                    i === current ? "border-indigo-500" : "border-transparent"
                  } ${done ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"}`}
                >
                  {i + 1}
                  {review.has(i) && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400" />}
                </button>
              );
            })}
          </div>
          <div className="hidden lg:block mt-4 space-y-1 text-[11px] text-slate-500">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500" /> answered</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-800" /> not answered</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400" /> marked for review</div>
          </div>
          <button onClick={submit} disabled={submitting} className="pop sm:hidden mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold">
            <Send className="w-4 h-4" /> submit test
          </button>
        </aside>
      </div>
    </div>
  );
}
