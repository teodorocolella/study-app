import { Eraser, Loader2, Pen, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

const COLORS = ["#1e1b2e", "#7c3aed", "#dc2626", "#2563eb", "#16a34a", "#ea580c"];

/** A simple freehand sketch canvas that returns a PNG data URL. */
export function DrawingModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [erasing, setErasing] = useState(false);
  const [size, setSize] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function pos(e: PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasRef.current!.width,
      y: ((e.clientY - rect.top) / rect.height) * canvasRef.current!.height,
    };
  }

  function start(e: PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = erasing ? size * 6 : size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function end() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
  }

  function insert() {
    setSaving(true);
    onInsert(canvasRef.current!.toDataURL("image/png"));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
            <Pen className="h-4.5 w-4.5 text-violet-500" />
            Draw a diagram
          </p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
              aria-label={`Color ${c}`}
              className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                color === c && !erasing ? "ring-2 ring-offset-2 ring-slate-400" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="mx-1 h-5 w-px bg-slate-200" />
          <button
            onClick={() => setErasing((v) => !v)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              erasing ? "bg-violet-100 text-violet-700" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            }`}
          >
            <Eraser className="h-3.5 w-3.5" />
            Eraser
          </button>
          <input
            type="range"
            min={1}
            max={10}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-24 accent-violet-600"
            aria-label="Brush size"
          />
          <button onClick={clear} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100">
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={640}
          height={400}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          className="w-full touch-none rounded-xl border border-slate-300 dark:border-slate-700"
          style={{ cursor: "crosshair", aspectRatio: "640 / 400" }}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={insert}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Insert into note
          </button>
        </div>
      </div>
    </div>
  );
}
