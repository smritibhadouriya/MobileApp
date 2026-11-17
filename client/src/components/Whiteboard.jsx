import { useEffect, useRef, useState } from "react";
import { Eraser, Pencil, Trash2, Undo2 } from "lucide-react";
import { newId } from "../lib/storage";

// Pen colours that read well on the white board
const COLORS = ["#1f2937", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"];
const SIZES = [2, 4, 8];

// Points are stored in board widths (v2): x 0..1 across, y down from the top in the same unit,
// so the board can be any height without stretching drawings. Old v1 strokes used 0..1 of a 16:10 board.
const yScale = (stroke) => (stroke.v === 2 ? 1 : 0.625);

function drawStroke(ctx, stroke, width) {
  const { points } = stroke;
  if (!points.length) return;
  const height = width * yScale(stroke);
  ctx.save();
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  // Sizes are relative to an 800px-wide board so drawings scale with the canvas
  ctx.lineWidth = (stroke.size * width) / 800;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0][0] * width, points[0][1] * height);
  if (points.length === 1) {
    ctx.arc(points[0][0] * width, points[0][1] * height, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (const [x, y] of points.slice(1)) ctx.lineTo(x * width, y * height);
    ctx.stroke();
  }
  ctx.restore();
}

// `fill`: the board takes the whole block, width and height
export default function Whiteboard({ strokes, actions, fill = false }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const currentRef = useRef(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Fill the space (minus the 2px border on each side); without `fill`, a 16:10 board
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width) - 4;
      const height = fill ? Math.floor(entry.contentRect.height) - 4 : Math.floor(width * 0.625);
      setDims({ width: Math.max(0, width), height: Math.max(0, height) });
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, [fill]);

  // Redraw everything whenever strokes or size change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dims.width) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = dims.width * ratio;
    canvas.height = dims.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, dims.width, dims.height);
    for (const stroke of strokes) drawStroke(ctx, stroke, dims.width);
  }, [strokes, dims]);

  const pointFrom = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(rect.height / rect.width, Math.max(0, (e.clientY - rect.top) / rect.width)),
    ];
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    currentRef.current = { id: newId(), v: 2, color, size: eraser ? size * 4 : size, erase: eraser, points: [pointFrom(e)] };
  };

  const onPointerMove = (e) => {
    const stroke = currentRef.current;
    if (!stroke || stroke.points.length >= 1000) return;
    const point = pointFrom(e);
    const prev = stroke.points.at(-1);
    if (Math.hypot(point[0] - prev[0], point[1] - prev[1]) < 0.002) return;
    stroke.points.push(point);
    // Draw just the newest segment for instant feedback
    const ctx = canvasRef.current.getContext("2d");
    drawStroke(ctx, { ...stroke, points: [prev, point] }, dims.width);
  };

  const onPointerUp = () => {
    const stroke = currentRef.current;
    currentRef.current = null;
    if (stroke) actions.addStroke(stroke);
  };

  const toolClass = (active) => `p-1.5 rounded-lg transition ${active ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"}`;

  return (
    <div className={`flex flex-col gap-2 ${fill ? "h-full" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setEraser(false)} className={toolClass(!eraser)} title="Pen"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => setEraser(true)} className={toolClass(eraser)} title="Eraser"><Eraser className="w-4 h-4" /></button>
        <div className="flex items-center gap-1 ml-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setEraser(false); }}
              title={c}
              className={`w-5 h-5 rounded-full border-2 transition ${color === c && !eraser ? "border-slate-100 scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 ml-1">
          {SIZES.map((s) => (
            <button key={s} onClick={() => setSize(s)} className={toolClass(size === s)} title={`Size ${s}`}>
              <span className="block rounded-full bg-current" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={actions.undoStroke} className={toolClass(false)} title="Undo my last stroke"><Undo2 className="w-4 h-4" /></button>
          <button
            onClick={() => window.confirm("Clear the whiteboard for everyone?") && actions.clearBoard()}
            className={toolClass(false)} title="Clear board"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div ref={wrapRef} className={fill ? "flex-1 min-h-0" : "w-full"}>
        {/* Plain white board in both themes, so every pen colour shows */}
        <div className="inline-block align-top rounded-xl overflow-hidden bg-white border-2 border-slate-700">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ width: dims.width, height: dims.height, touchAction: "none" }}
          className={`block ${eraser ? "cursor-cell" : "cursor-crosshair"}`}
        />
        </div>
      </div>
      <p className="text-[11px] text-slate-500">Whatever anyone draws or writes here shows up live for the whole room.</p>
    </div>
  );
}
