import { useState } from "react";
import { BookOpenCheck, ChevronDown, Plus, RotateCcw } from "lucide-react";
import Modal from "../ui/Modal";
import { EXAMS, REVISION_DAYS, chapterKey, dueRevisions, markRevised, nextRevision, subjectsFor, toggleChapter } from "../../lib/syllabus";

const formatDue = (ts, now) => {
  const days = Math.round((ts - now) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "due now";
  return days === 1 ? "in 1 day" : `in ${days} days`;
};

export default function SyllabusModal({ syllabus, now, onChange, onClose }) {
  const [open, setOpen] = useState(null);
  const [newChapter, setNewChapter] = useState("");
  const subjects = subjectsFor(syllabus);
  const due = dueRevisions(syllabus, now);


  const addChapter = (subject) => {
    const name = newChapter.trim();
    if (!name) return;
    const customKey = `${syllabus.exam}|${subject}`;
    onChange({ ...syllabus, custom: { ...syllabus.custom, [customKey]: [...(syllabus.custom[customKey] || []), name] } });
    setNewChapter("");
  };

  const allChapters = Object.entries(subjects).flatMap(([s, list]) => list.map((c) => chapterKey(syllabus.exam, s, c)));
  const doneCount = allChapters.filter((k) => syllabus.done[k]).length;

  return (
    <Modal title="Syllabus & Revision" icon={<BookOpenCheck className="w-4 h-4 text-indigo-400" />} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(EXAMS).map(([id, exam]) => (
              <button
                key={id}
                onClick={() => onChange({ ...syllabus, exam: id })}
                className={`px-3 py-1.5 rounded-lg text-xs border transition ${syllabus.exam === id ? "border-indigo-500 bg-indigo-600/20 text-indigo-200" : "border-slate-700 text-slate-300 hover:border-slate-600"}`}
              >
                {exam.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400">{doneCount}/{allChapters.length} chapters done</span>
        </div>

        {/* Spaced repetition */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
            <RotateCcw className="w-4 h-4 text-amber-400" /> Due for revision ({due.length})
          </div>
          {due.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nothing due. When you finish a chapter, revisions are scheduled after {REVISION_DAYS.join(", ")} days so it sticks.
            </p>
          ) : (
            <div className="space-y-1.5">
              {due.map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-200 truncate"><span className="text-slate-500">{r.subject} ·</span> {r.chapter} <span className="text-amber-400">· revision {r.round}</span></span>
                  <button onClick={() => onChange(markRevised(syllabus, r.key))} className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 shrink-0">Revised ✓</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {Object.entries(subjects).map(([subject, chapters]) => {
            const keys = chapters.map((c) => chapterKey(syllabus.exam, subject, c));
            const done = keys.filter((k) => syllabus.done[k]).length;
            const isOpen = open === subject;
            return (
              <div key={subject} className="rounded-xl border border-slate-800 overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : subject)} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/40 hover:bg-slate-800/70 text-left">
                  <span className="text-sm font-medium text-slate-100 w-32 shrink-0">{subject}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(done / (chapters.length || 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums w-14 text-right">{done}/{chapters.length}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="p-3 space-y-1">
                    {chapters.map((chapter) => {
                      const key = chapterKey(syllabus.exam, subject, chapter);
                      const entry = syllabus.done[key];
                      const next = nextRevision(entry);
                      return (
                        <label key={chapter} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800/40 cursor-pointer text-xs">
                          <input type="checkbox" checked={!!entry} onChange={() => onChange(toggleChapter(syllabus, key))} className="accent-indigo-500" />
                          <span className={`flex-1 ${entry ? "text-slate-500 line-through" : "text-slate-200"}`}>{chapter}</span>
                          {entry && (
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {next ? `revise ${formatDue(next, now)}` : "✓ mastered"}
                            </span>
                          )}
                        </label>
                      );
                    })}
                    <form onSubmit={(e) => { e.preventDefault(); addChapter(subject); }} className="flex gap-2 pt-2">
                      <input
                        value={newChapter} onChange={(e) => setNewChapter(e.target.value)} maxLength={60}
                        placeholder={`Add a chapter to ${subject}`}
                        className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <button type="submit" className="px-2.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700" title="Add chapter">
                        <Plus className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
