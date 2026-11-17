import { Keyboard } from "lucide-react";
import Modal from "../ui/Modal";

const SHORTCUTS = [
  ["Space", "Start / pause the timer"],
  ["C", "Open chat"],
  ["N", "Open / close my notes"],
  ["W", "Whiteboard tab"],
  ["H", "Raise / lower hand"],
  ["?", "Show this help"],
  ["Esc", "Close a dialog"],
];

export default function ShortcutsModal({ onClose }) {
  return (
    <Modal title="Keyboard Shortcuts" icon={<Keyboard className="w-4 h-4 text-indigo-400" />} onClose={onClose}>
      <dl className="space-y-2">
        {SHORTCUTS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <dt className="text-slate-300">{label}</dt>
            <dd><kbd className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200">{key}</kbd></dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-slate-500 mt-4">Shortcuts are paused while you type in a text box.</p>
    </Modal>
  );
}
