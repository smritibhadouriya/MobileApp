import { useEffect, useRef, useState } from "react";

// Small dropdown: `trigger` renders the button, `children(close)` renders the items
export default function Menu({ trigger, children, align = "right", width = "w-56" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-2 ${width} bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick, danger, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 text-left text-xs px-3 py-2 rounded-lg transition ${
        danger ? "text-rose-400 hover:bg-rose-500/10" : "text-slate-300 hover:bg-slate-800"
      }`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span className="flex-1">{children}</span>
      {badge > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center">{badge}</span>}
    </button>
  );
}
