import { Loader2, ScanEye, Trash2, X } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { api, ApiError } from "../../api/client";
import type { Flashcard, Occlusion } from "../../api/types";
import { resizeImageToDataUrl } from "../../lib/imageResize";

type DraftRegion = Occlusion;

/**
 * Editor for an image-occlusion card: upload a labeled image, then drag
 * rectangles over the parts to hide. Regions are stored as percentages so
 * they scale with the image at study time.
 */
export function OcclusionCardModal({
  deckId,
  onClose,
  onCreated,
}: {
  deckId: string;
  onClose: () => void;
  onCreated: (card: Flashcard) => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [regions, setRegions] = useState<DraftRegion[]>([]);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImage(await resizeImageToDataUrl(file, 1000));
      setRegions([]);
    } catch {
      setError("Could not process that image.");
    }
  }

  // Pointer position as a percentage of the image box.
  function pct(e: PointerEvent) {
    const box = imgWrapRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100)),
    };
  }

  function onPointerDown(e: PointerEvent) {
    if (!image) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = pct(e);
  }

  function onPointerMove(e: PointerEvent) {
    if (!startRef.current) return;
    const p = pct(e);
    const s = startRef.current;
    setDraft({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  }

  function onPointerUp() {
    if (draft && draft.w > 2 && draft.h > 2) {
      setRegions((prev) => [...prev, { ...draft, label: "" }]);
    }
    setDraft(null);
    startRef.current = null;
  }

  async function handleSave() {
    if (!image || regions.length === 0) return;
    if (regions.some((r) => !r.label.trim())) {
      setError("Give every hidden region a label.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const card = await api.post<Flashcard>(`/decks/${deckId}/cards`, {
        kind: "image_occlusion",
        frontImage: await api.uploadImage(image),
        occlusions: regions,
      });
      onCreated(card);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save card");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-display flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
              <ScanEye className="h-4.5 w-4.5 text-violet-500" />
              Image-occlusion card
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Upload a labeled image, then drag boxes over the parts you want to recall.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {!image ? (
          <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-violet-300 hover:text-violet-600">
            <ScanEye className="h-6 w-6" />
            Choose an image (diagram, map, anatomy…)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void handleFile(e)}
              className="hidden"
            />
          </label>
        ) : (
          <>
            <div
              ref={imgWrapRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="relative select-none touch-none overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
              style={{ cursor: "crosshair" }}
            >
              <img src={image} alt="" className="pointer-events-none w-full" draggable={false} />
              {regions.map((r, i) => (
                <div
                  key={i}
                  className="absolute flex items-center justify-center rounded bg-violet-600/80 text-[10px] font-semibold text-white"
                  style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
                >
                  {i + 1}
                </div>
              ))}
              {draft && (
                <div
                  className="absolute rounded border-2 border-violet-500 bg-violet-400/30"
                  style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.w}%`, height: `${draft.h}%` }}
                />
              )}
            </div>

            {regions.length > 0 && (
              <div className="mt-3 space-y-2">
                {regions.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                      {i + 1}
                    </span>
                    <input
                      value={r.label}
                      onChange={(e) =>
                        setRegions((prev) => prev.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))
                      }
                      placeholder={`What's hidden in box ${i + 1}?`}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      onClick={() => setRegions((prev) => prev.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Remove region"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => setImage(null)} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700">
                Choose a different image
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || regions.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanEye className="h-4 w-4" />}
                Save card
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
