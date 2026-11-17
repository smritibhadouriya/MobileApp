import { useState } from "react";
import { ExternalLink, FileText, Plus, X } from "lucide-react";

export default function ResourcesPanel({ resources, onAdd, onRemove }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const add = (e) => {
    e.preventDefault();
    let link = url.trim();
    if (!link) return;
    if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
    try {
      new URL(link);
    } catch {
      return setError("That doesn't look like a valid link.");
    }
    onAdd(title.trim(), link);
    setTitle("");
    setUrl("");
    setError("");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {resources.length === 0 && (
          <p className="text-xs text-slate-500">Share formula sheets, Drive folders, PDFs or the class meeting link here.</p>
        )}
        {resources.map((r) => (
          <div key={r.id} className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition">
            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-200 truncate flex items-center gap-1">
                {r.title} <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
              </div>
              <div className="text-[10px] text-slate-500 truncate">Added by {r.by}</div>
            </a>
            <button
              onClick={() => onRemove(r.id)}
              title="Remove"
              className="p-0.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="p-3 border-t border-slate-800/80 bg-slate-900/50 space-y-2">
        <input
          type="text"
          placeholder="Title (e.g. Formula Sheet.pdf)"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="https://drive.google.com/..."
            value={url}
            maxLength={500}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
          />
          <button type="submit" className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white" title="Add link">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-[11px] text-rose-400">{error}</p>}
      </form>
    </div>
  );
}
