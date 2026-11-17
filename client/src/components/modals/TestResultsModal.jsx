import { useEffect, useState } from "react";
import { Trophy, Check, X, Minus } from "lucide-react";
import Modal from "../ui/Modal";
import MathText from "../ui/MathText";
import { formatDuration, formatTimeOfDay } from "../../lib/tests";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function TestResultsModal({ test, clientId, actions, onClose }) {
  const [mine, setMine] = useState(null);

  useEffect(() => {
    let cancelled = false;
    actions.getTestState(test.id).then((res) => !cancelled && setMine(res));
    return () => {
      cancelled = true;
    };
  }, [test.id, test.ended, actions]);

  const ranked = [...test.participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (a.timeTaken ?? 0) - (b.timeTaken ?? 0));
  const maxScore = test.questionCount * test.marking.correct;
  const me = ranked.find((p) => p.clientId === clientId);
  const myRank = ranked.indexOf(me) + 1;

  if (!test.ended) {
    const submitted = test.participants.filter((p) => p.submitted).length;
    return (
      <Modal title={test.title} icon={<Trophy className="w-4 h-4 text-indigo-400" />} onClose={onClose}>
        <div className="text-center space-y-3 py-4">
          <div className="text-5xl">⏳</div>
          <div className="font-display text-xl font-bold text-slate-100">submitted! now we wait 👀</div>
          <p className="text-sm text-slate-400">
            Leaderboard and answers unlock at <b>{formatTimeOfDay(test.endsAt)}</b> — or as soon as everyone submits.
          </p>
          <p className="text-xs text-slate-500">{submitted} of {test.participants.length} who started have submitted</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`${test.title} — results`} icon={<Trophy className="w-4 h-4 text-indigo-400" />} onClose={onClose} wide>
      <div className="space-y-6">
        {me ? (
          <div className="paper-card rounded-3xl p-5 flex flex-wrap items-center gap-5">
            <div className="text-5xl">{MEDALS[myRank - 1] || "🎯"}</div>
            <div className="flex-1 min-w-40">
              <div className="font-display text-3xl font-extrabold text-slate-100">{me.score} <span className="text-base text-slate-500 font-semibold">/ {maxScore}</span></div>
              <div className="text-sm text-slate-400">rank #{myRank} of {ranked.length} · {myRank === 1 ? "absolute W 👑" : me.score >= maxScore / 2 ? "solid run 💪" : "you'll cook next time 🍳"}</div>
            </div>
            <div className="flex gap-4 text-center text-sm">
              <div><div className="font-bold text-emerald-400">{me.correct}</div><div className="text-[10px] uppercase text-slate-500">correct</div></div>
              <div><div className="font-bold text-rose-400">{me.wrong}</div><div className="text-[10px] uppercase text-slate-500">wrong</div></div>
              <div><div className="font-bold text-slate-300">{me.skipped}</div><div className="text-[10px] uppercase text-slate-500">skipped</div></div>
              <div><div className="font-bold text-slate-300">{formatDuration(me.timeTaken)}</div><div className="text-[10px] uppercase text-slate-500">time</div></div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">You didn't take this one — here's how the squad did.</p>
        )}

        {/* Leaderboard */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🏆 Leaderboard</h3>
          {ranked.length === 0 && <p className="text-sm text-slate-500">Nobody attempted this test.</p>}
          <div className="space-y-2">
            {ranked.map((p, i) => (
              <div
                key={p.clientId}
                className={`flex items-center gap-3 p-3 rounded-2xl border ${p.clientId === clientId ? "border-indigo-500 bg-indigo-600/10" : "border-slate-800 bg-slate-900/50"}`}
              >
                <span className="w-7 text-center text-lg">{MEDALS[i] || <span className="text-sm font-bold text-slate-500">{i + 1}</span>}</span>
                <span className="text-xl">{p.avatar}</span>
                <span className="flex-1 min-w-0 font-semibold text-slate-100 truncate">{p.name}{p.clientId === clientId && <span className="text-slate-500 font-normal"> (you)</span>}</span>
                <span className="hidden sm:inline text-xs text-slate-500">✅ {p.correct} · ❌ {p.wrong} · ⏱ {formatDuration(p.timeTaken)}</span>
                <span className="font-display text-lg font-extrabold text-slate-100 tabular-nums w-14 text-right">{p.score}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Answer review */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">📖 Answers & explanations</h3>
          <div className="space-y-3">
            {test.questions.map((q, i) => {
              const choice = mine?.answers?.[i] ?? null;
              const status = choice === null ? "skipped" : choice === q.answer ? "correct" : "wrong";
              const StatusIcon = { correct: Check, wrong: X, skipped: Minus }[status];
              return (
                <div key={i} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${
                      status === "correct" ? "bg-emerald-500 text-white" : status === "wrong" ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-300"
                    }`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                    </span>
                    <div className="text-sm font-semibold text-slate-100"><span className="text-slate-500">Q{i + 1}.</span> <MathText text={q.question} /></div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-1.5 pl-8">
                    {q.options.map((opt, j) => (
                      <div
                        key={j}
                        className={`px-3 py-1.5 rounded-xl text-sm border ${
                          j === q.answer ? "border-emerald-500 bg-emerald-500/10 text-slate-100" : j === choice ? "border-rose-500 bg-rose-500/10 text-slate-200" : "border-slate-800 text-slate-400"
                        }`}
                      >
                        <b>{"ABCDEF"[j]}.</b> <MathText text={opt} mentionClass="" />
                        {j === q.answer && " ✓"}
                        {j === choice && j !== q.answer && " (your answer)"}
                      </div>
                    ))}
                  </div>
                  {q.explanation && <div className="pl-8 text-xs text-slate-400">💡 <MathText text={q.explanation} /></div>}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Modal>
  );
}
