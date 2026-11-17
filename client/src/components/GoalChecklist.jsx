import { useState } from "react";
import { Plus, X } from "lucide-react";

// Shared session goals, styled as a sticky note on the desk
export default function GoalChecklist({ tasks, onAdd, onToggle, onDelete }) {
  const [newTaskText, setNewTaskText] = useState("");
  const doneCount = tasks.filter((t) => t.done).length;

  const addTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    onAdd(newTaskText.trim());
    setNewTaskText("");
  };

  return (
    <div className="sticky-note rounded-sm px-4 pb-4 pt-1.5 rotate-[-0.8deg]">
      <div className="flex items-center justify-between h-7 text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
        <span>📌 today's goals</span>
        {tasks.length > 0 && <span className="normal-case tracking-normal">{doneCount}/{tasks.length} done</span>}
      </div>

      <div className="mt-2 space-y-0.5">
        {tasks.length === 0 && <p className="font-hand text-xl opacity-60">what are we cooking today? 🍳</p>}
        {tasks.map((task) => (
          <div key={task.id} className="group flex items-start gap-2">
            <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => onToggle(task.id)}
                className="mt-2 w-4 h-4 accent-stone-700 cursor-pointer shrink-0"
              />
              <span className={`font-hand text-[22px] leading-8 wrap-break-word ${task.done ? "line-through opacity-50" : ""}`}>
                {task.text}
              </span>
            </label>
            <button
              onClick={() => onDelete(task.id)}
              title="Remove goal"
              className="mt-2 p-0.5 opacity-0 group-hover:opacity-60 hover:opacity-100! focus:opacity-100 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={addTask} className="flex gap-2 mt-3">
        <input
          type="text"
          placeholder="+ add a goal…"
          value={newTaskText}
          maxLength={120}
          onChange={(e) => setNewTaskText(e.target.value)}
          className="flex-1 min-w-0 bg-transparent border-b border-dashed border-stone-600/50 font-hand text-xl placeholder:text-stone-600/60 focus:outline-none focus:border-stone-700"
        />
        <button type="submit" className="p-1.5 rounded-full bg-stone-800/80 text-amber-50 hover:bg-stone-900" title="Add goal">
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
