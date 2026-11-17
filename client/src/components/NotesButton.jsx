import { useRef, useState } from "react";
import { NotebookPen, GripVertical } from "lucide-react";
import useLocalState from "../hooks/useLocalState";

const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag

// Floating notes button. Tap to open; drag to put it wherever you like. The spot is saved as a
// fraction of the screen, so it stays in the same place after rotating a phone or tablet.
export default function NotesButton({ onOpen }) {
  const [saved, setSaved] = useLocalState("fs:notesButton", null); // { x: 0..1, y: 0..1 } or null = default corner
  const [dragPos, setDragPos] = useState(null);
  const dragRef = useRef(null);
  const pos = dragPos || saved;

  const onPointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, w: rect.width, h: rect.height, moved: false };
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
    d.moved = true;
    const maxX = window.innerWidth - d.w;
    const maxY = window.innerHeight - d.h;
    setDragPos({
      x: Math.min(1, Math.max(0, (e.clientX - d.offsetX) / maxX)),
      y: Math.min(1, Math.max(0, (e.clientY - d.offsetY) / maxY)),
    });
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.moved) {
      if (dragPos) setSaved(dragPos);
      setDragPos(null);
    } else {
      onOpen();
    }
  };

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { dragRef.current = null; setDragPos(null); }}
      onDoubleClick={() => setSaved(null)}
      title="My notes (N) · drag to move · double-click to reset"
      style={pos ? { left: `calc(${pos.x} * (100vw - 8.5rem))`, top: `calc(${pos.y} * (100dvh - 3.25rem))`, touchAction: "none" } : { touchAction: "none" }}
      className={`pop fixed z-[45] w-[8.5rem] h-[3.25rem] flex items-center justify-center gap-1.5 rounded-full bg-[oklch(88%_0.15_95)] text-[oklch(17%_0.03_285)] font-bold text-sm select-none ${
        pos ? "" : "right-4 bottom-20 md:right-auto md:left-6 md:bottom-6"
      } ${dragPos ? "cursor-grabbing scale-105" : "cursor-grab"}`}
    >
      <GripVertical className="w-4 h-4 opacity-40 -ml-1" />
      <NotebookPen className="w-5 h-5" /> notes
    </button>
  );
}
