import { RefreshCw, WifiOff } from "lucide-react";
import Logo from "./ui/Logo";

// Full-screen page shown when the app can't reach the server at all
export default function ConnectionErrorPage({ serverMissing, detail, onRetry }) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10 safe-top safe-bottom text-slate-100">
      <div className="paper-card w-full max-w-md rounded-3xl p-8 text-center space-y-5">
        <div className="flex items-center justify-center gap-2">
          <Logo className="w-9 h-9" />
          <span className="font-display text-xl font-bold">StudyGroup</span>
        </div>

        <div className="mx-auto w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center">
          <WifiOff className="w-10 h-10 text-rose-500" />
        </div>

        {serverMissing ? (
          <>
            <h1 className="font-display text-2xl font-extrabold">App isn't connected to a server</h1>
            <p className="text-sm text-slate-400">
              This build doesn't know where the StudyGroup server is. Rebuild the app with <code className="px-1 rounded bg-slate-800">VITE_SERVER_URL</code> set to your server's address.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-extrabold">Can't reach StudyGroup</h1>
            <p className="text-sm text-slate-400">
              We couldn't connect to the server. Check your internet connection. If you're online, the server may be restarting — we'll keep trying automatically.
            </p>
            <button onClick={onRetry} className="pop inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
            <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Retrying automatically…
            </p>
          </>
        )}

        {detail && !serverMissing && (
          <details className="text-left text-[11px] text-slate-500">
            <summary className="cursor-pointer text-center">Technical details</summary>
            <p className="mt-2 font-mono break-all">{detail}</p>
          </details>
        )}
      </div>
    </div>
  );
}
