import { useState } from "react";
import { NotebookPen, Copy, Check, Download, Trash2 } from "lucide-react";
import Modal from "../ui/Modal";
import MathText from "../ui/MathText";

const formatWhen = (ts) => new Date(ts).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Read a note someone shared with the room, and keep your own copy
export default function NoteViewerModal({ note, canRemove, onSaveCopy, onRemove, onClose }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!note) {
    return (
      <Modal title="Shared notes" icon={<NotebookPen className="w-4 h-4 text-indigo-400" />} onClose={onClose}>
        <p className="text-sm text-slate-400">These notes were removed by the person who shared them.</p>
      </Modal>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${note.title}\n\n${note.text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <Modal title={note.title} icon={<NotebookPen className="w-4 h-4 text-indigo-400" />} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            <span className="text-base align-middle">{note.avatar}</span> shared by <b className="text-slate-300">{note.by}</b> · {formatWhen(note.at)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { onSaveCopy(note); setSaved(true); }}
              disabled={saved}
              className="pop flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-70"
            >
              {saved ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />} {saved ? "saved to my notebook" : "save to my notebook"}
            </button>
            <button onClick={copy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />} copy
            </button>
            {canRemove && (
              <button
                onClick={() => window.confirm("Stop sharing these notes with the room?") && onRemove(note.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="w-4 h-4" /> unshare
              </button>
            )}
          </div>
        </div>
        <div className="notebook rounded-2xl text-[15px] text-slate-200 min-h-64 max-h-[60dvh] overflow-y-auto">
          <MathText text={note.text} />
        </div>
      </div>
    </Modal>
  );
}
