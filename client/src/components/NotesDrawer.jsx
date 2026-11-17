import { useRef, useState } from "react";
import { NotebookPen, X, Plus, Trash2, Clock, Eye, Pencil, Copy, Users, Check } from "lucide-react";
import MathText from "./ui/MathText";
import { newPage } from "../lib/notebook";
import NotesButton from "./NotesButton";

// Personal notebook: saved only on this device, reachable from anywhere (even over a
// full-screen whiteboard or a lecture video), so you can write while someone teaches.
const formatWhen = (ts) => new Date(ts).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function NotesDrawer({ open, onOpenChange, notebook, onChange, sharedNotes = [], onShareNote, onOpenNote }) {
  const [preview, setPreview] = useState(false);
  const [view, setView] = useState("mine");
  const [copied, setCopied] = useState(false);
  const textRef = useRef(null);
  const pages = notebook.pages.length ? notebook.pages : [newPage()];
  const page = pages.find((p) => p.id === notebook.activeId) || pages[0];

  const updatePage = (patch) =>
    onChange({ ...notebook, pages: pages.map((p) => (p.id === page.id ? { ...p, ...patch, updatedAt: Date.now() } : p)), activeId: page.id });

  const addPage = () => {
    const created = newPage(`Page ${pages.length + 1}`);
    onChange({ pages: [...pages, created], activeId: created.id });
    setPreview(false);
  };

  const deletePage = () => {
    if (!window.confirm(`Delete "${page.title}"? This can't be undone.`)) return;
    const rest = pages.filter((p) => p.id !== page.id);
    const next = rest.length ? rest : [newPage()];
    onChange({ pages: next, activeId: next[0].id });
  };

  // Drops "[7:42 PM] " at the cursor — handy for marking moments in a lecture
  const insertTimestamp = () => {
    const stamp = `[${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}] `;
    const el = textRef.current;
    const start = el?.selectionStart ?? page.text.length;
    const end = el?.selectionEnd ?? page.text.length;
    const before = page.text.slice(0, start);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    updatePage({ text: before + prefix + stamp + page.text.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + prefix.length + stamp.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(page.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked
    }
  };

  const tool = "flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-800";
  const segment = (active) =>
    `flex-1 py-1.5 rounded-full text-xs font-bold transition ${active ? "bg-slate-100 text-slate-950" : "text-slate-400 hover:text-slate-100"}`;

  return (
    <>
      {!open && <NotesButton onOpen={() => onOpenChange(true)} />}

      {open && (
        <aside
          className="fixed z-45 inset-x-0 bottom-0 h-[78dvh] sm:inset-x-auto sm:right-0 sm:top-0 sm:h-auto sm:w-104 flex flex-col bg-slate-950 border-t-2 sm:border-t-0 sm:border-l-2 border-slate-800 shadow-2xl rounded-t-3xl sm:rounded-none safe-top safe-bottom"
          aria-label="My notes"
        >
          <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <div className="font-display font-bold text-slate-100 flex items-center gap-2"><NotebookPen className="w-4 h-4 text-indigo-400" /> my notes</div>
              <div className="text-[11px] text-slate-500">only you can see these · saved on this device</div>
            </div>
            <button onClick={() => onOpenChange(false)} title="Close (N)" className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mine / shared with the room */}
          <div className="shrink-0 px-4 pb-3">
            <div className="flex gap-1 p-1 rounded-full bg-slate-900 border border-slate-800">
              <button onClick={() => setView("mine")} className={segment(view === "mine")}>my notes</button>
              <button onClick={() => setView("shared")} className={segment(view === "shared")}>shared with squad ({sharedNotes.length})</button>
            </div>
          </div>

          {view === "shared" ? (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2">
              {sharedNotes.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">No shared notes yet.<br />Open a page and tap “share with squad”.</p>
              )}
              {[...sharedNotes].reverse().map((note) => (
                <button
                  key={note.id}
                  onClick={() => onOpenNote(note.id)}
                  className="w-full text-left p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 transition"
                >
                  <div className="font-semibold text-sm text-slate-100 truncate">📒 {note.title}</div>
                  <div className="text-[11px] text-slate-500">{note.avatar} {note.by} · {formatWhen(note.at)}</div>
                  <div className="mt-1 text-xs text-slate-400 line-clamp-2">{note.text}</div>
                </button>
              ))}
            </div>
          ) : (
          <>
          {/* Pages */}
          <div className="shrink-0 flex items-center gap-2 px-4 pb-2">
            <select
              value={page.id}
              onChange={(e) => { onChange({ ...notebook, pages, activeId: e.target.value }); setPreview(false); }}
              className="min-w-0 flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              aria-label="Page"
            >
              {pages.map((p) => <option key={p.id} value={p.id}>{p.title || "Untitled"}</option>)}
            </select>
            <button onClick={addPage} title="New page" className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-slate-100"><Plus className="w-4 h-4" /></button>
            <button onClick={deletePage} title="Delete page" className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
          </div>
          <div className="shrink-0 px-4">
            <input
              value={page.title}
              maxLength={60}
              onChange={(e) => updatePage({ title: e.target.value })}
              placeholder="Page title"
              className="w-full bg-transparent font-display text-lg font-bold text-slate-100 focus:outline-none border-b border-transparent focus:border-slate-700"
            />
          </div>

          {/* Toolbar */}
          <div className="shrink-0 flex flex-wrap items-center gap-1 px-3 py-2">
            <button onClick={insertTimestamp} className={tool} title="Insert current time"><Clock className="w-3.5 h-3.5" /> timestamp</button>
            <button onClick={() => setPreview(!preview)} className={tool}>
              {preview ? <><Pencil className="w-3.5 h-3.5" /> edit</> : <><Eye className="w-3.5 h-3.5" /> preview math</>}
            </button>
            <button onClick={copy} className={tool} disabled={!page.text}>{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} copy</button>
            <button
              onClick={() =>
                page.text.trim() &&
                window.confirm(`Share "${page.title || "Untitled"}" with everyone in the room? They'll get a copy they can read and save.`) &&
                onShareNote({ title: page.title || "Untitled notes", text: page.text })
              }
              className={`${tool} text-indigo-400`}
              disabled={!page.text.trim()}
              title="Share a copy of this page with the room"
            >
              <Users className="w-3.5 h-3.5" /> share with squad
            </button>
          </div>

          {/* Page */}
          <div className="flex-1 min-h-0 px-3 pb-3 flex flex-col">
            {preview ? (
              <div className="notebook flex-1 overflow-y-auto rounded-xl text-[15px] text-slate-200">
                {page.text ? <MathText text={page.text} /> : <span className="text-slate-500">Nothing here yet.</span>}
              </div>
            ) : (
              <textarea
                ref={textRef}
                value={page.text}
                onChange={(e) => updatePage({ text: e.target.value })}
                placeholder={"Write while you listen…\nFormulas: $F = ma$\nTip: hit “timestamp” to mark a moment in the lecture"}
                className="notebook flex-1 w-full resize-none rounded-xl focus:outline-none text-[15px] text-slate-200 placeholder:text-slate-500"
                autoFocus
              />
            )}
          </div>
          </>
          )}
        </aside>
      )}
    </>
  );
}
