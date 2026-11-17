import { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ title, icon, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"} max-h-[92dvh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h2 className="flex items-center gap-2 font-semibold text-slate-100">
            {icon} {title}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800" title="Close (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
