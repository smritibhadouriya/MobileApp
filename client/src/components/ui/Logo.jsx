// StudyGroup mark: a desk lamp shining on an open book
export default function Logo({ className = "w-10 h-10" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="fs-glow" cx="0.5" cy="0.2" r="0.7">
          <stop offset="0" stopColor="var(--accent-300)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--accent-300)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="16" className="fill-slate-800" />
      <path d="M20 22 L44 22 L54 52 L10 52 Z" fill="url(#fs-glow)" />
      {/* lamp */}
      <path d="M22 10 h20 l-4 12 h-12 z" fill="var(--accent-500)" />
      <rect x="30" y="4" width="4" height="7" rx="2" className="fill-slate-500" />
      {/* open book */}
      <path d="M12 44 q10 -6 20 0 v10 q-10 -6 -20 0 z" className="fill-slate-100" />
      <path d="M52 44 q-10 -6 -20 0 v10 q10 -6 20 0 z" className="fill-slate-200" />
      <path d="M32 44 v10" className="stroke-slate-500" strokeWidth="1.2" />
    </svg>
  );
}
