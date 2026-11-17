import { useEffect } from "react";
import { PenTool, ClipboardList, Tv, Maximize2, Minimize2, Radio } from "lucide-react";

const WORKSPACE_TABS = [
  { id: "board", label: "Whiteboard", Icon: PenTool },
  { id: "tests", label: "Tests", Icon: ClipboardList },
  { id: "watch", label: "Watch Party", Icon: Tv },
];

// Shared tools card. Inline it fills the screen once you scroll to it; full screen it covers
// everything. Content renders in only one place at a time (a whiteboard or video can't be in two).
export default function Workspace({ tab, onTab, full, onEnterFull, onExitFull, stage, myName, dots, render }) {
  // Esc leaves full screen just for you (unless a dialog on top is handling Esc)
  useEffect(() => {
    if (!full) return;
    const onKey = (e) => e.key === "Escape" && !document.querySelector('[role="dialog"]') && onExitFull();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [full, onExitFull]);

  const presenter = stage?.by && stage.by !== myName ? stage.by : null;

  const tabs = (
    <div className="flex items-center min-w-0 overflow-x-auto">
      {WORKSPACE_TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onTab(id)}
          className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition ${
            tab === id ? "text-indigo-300 border-indigo-500" : "text-slate-500 hover:text-slate-300 border-transparent"
          }`}
        >
          <Icon className="w-3.5 h-3.5" /> {label}
          {dots[id] && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
        </button>
      ))}
    </div>
  );

  const presenterChip = presenter && (
    <span className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-semibold whitespace-nowrap">
      <Radio className="w-3.5 h-3.5" /> {presenter} is presenting
    </span>
  );

  return (
    <>
      {/* Inline card: at least one screen tall, so scrolling down shows the tools full height */}
      <section className="paper-card shrink-0 min-h-[calc(100dvh-9rem)] flex flex-col rounded-3xl">
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-800/80 pr-2">
          {tabs}
          <div className="flex items-center gap-2 shrink-0">
            {presenterChip}
            <button
              onClick={onEnterFull}
              title="Full screen for everyone"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-slate-800"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-4 flex-1 flex flex-col min-h-0">
          {full ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-slate-500">
              <Maximize2 className="w-8 h-8" />
              <p className="text-sm">Open in full screen</p>
              <button onClick={onExitFull} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">show it here instead</button>
            </div>
          ) : (
            render(tab, false)
          )}
        </div>
      </section>

      {/* Full-screen view (same content, moved here) */}
      {full && (
        <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col safe-top safe-bottom">
          <div className="shrink-0 flex items-center justify-between gap-2 border-b-2 border-slate-800 pr-2">
            {tabs}
            <div className="flex items-center gap-2 shrink-0">
              {presenterChip}
              <button
                onClick={onExitFull}
                title="Exit full screen (only for you)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              >
                <Minimize2 className="w-4 h-4" /> <span className="hidden sm:inline">exit full screen</span>
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col">{render(tab, true)}</div>
        </div>
      )}
    </>
  );
}
