import { Lock } from "lucide-react";

// Shows a blurred preview of a Pro-only section with an unlock button on top
export default function ProLock({ locked, onUpgrade, label = "Pro feature", children }) {
  if (!locked) return children;
  return (
    <div className="relative rounded-2xl overflow-hidden">
      <div aria-hidden="true" inert="" className="pointer-events-none select-none blur-[3px] opacity-60">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          onClick={onUpgrade}
          className="pop flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-bold"
        >
          <Lock className="w-4 h-4" /> {label} — unlock with Pro ✨
        </button>
      </div>
    </div>
  );
}

// Small inline "PRO" tag for locked options
export function ProTag() {
  return <span className="ml-1 px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-extrabold tracking-wider align-middle">PRO</span>;
}
