export default function Toasts({ toasts }) {
  return (
    <div className="fixed top-20 right-4 left-4 sm:left-auto z-50 flex flex-col items-end gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="max-w-sm w-full sm:w-auto bg-slate-900 border border-slate-700 shadow-2xl rounded-xl px-4 py-3 text-sm text-slate-100"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
