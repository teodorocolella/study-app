import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { MovableType } from "../../api/types";
import { CLASS_COLORS, isCustomColor } from "../../lib/classColors";

const PATCH_PATH: Record<MovableType, (id: string) => string> = {
  note: (id) => `/notes/${id}`,
  deck: (id) => `/decks/${id}`,
  quiz: (id) => `/exercise-sets/${id}`,
};

/** The little colored swatch that shows an item's color and opens a picker. */
export function ColorMenu({
  type,
  itemId,
  colorTag,
  onChanged,
}: {
  type: MovableType;
  itemId: string;
  colorTag: string | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function setColor(color: string | null) {
    setBusy(true);
    try {
      await api.patch(PATCH_PATH[type](itemId), { colorTag: color });
      setOpen(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const custom = isCustomColor(colorTag);
  const preset = CLASS_COLORS.find((c) => c.id === colorTag);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Set color"
        className={`h-4 w-4 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110 ${
          preset ? preset.dot : !colorTag ? "bg-slate-300 dark:bg-slate-600" : ""
        }`}
        style={custom ? { backgroundColor: colorTag } : undefined}
      />

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap gap-1.5">
            {CLASS_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void setColor(c.id);
                }}
                aria-label={c.label}
                className={`h-6 w-6 rounded-full ${c.dot} transition-transform hover:scale-110 ${
                  colorTag === c.id ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800" : ""
                }`}
              />
            ))}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                customRef.current?.click();
              }}
              aria-label="Custom color"
              className={`flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-600 ${
                custom ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800" : ""
              }`}
              style={custom ? { backgroundColor: colorTag, borderStyle: "solid" } : undefined}
            >
              {!custom && "+"}
            </button>
            <input
              ref={customRef}
              type="color"
              value={custom ? colorTag : "#7c3aed"}
              onChange={(e) => void setColor(e.target.value)}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void setColor(null);
            }}
            className="mt-2 w-full rounded-md py-1 text-left text-xs text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            No color
          </button>
        </div>
      )}
    </div>
  );
}
