import { Plus } from "lucide-react";
import { useRef } from "react";
import { CLASS_COLORS, isCustomColor } from "../../lib/classColors";

/** Preset color swatches plus a "custom color" picker for class folders. */
export function ClassColorPicker({
  value,
  onChange,
  size = 6,
}: {
  value: string;
  onChange: (color: string) => void;
  size?: 6 | 7;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const custom = isCustomColor(value);
  const dim = size === 7 ? "h-7 w-7" : "h-6 w-6";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {CLASS_COLORS.map((c) => (
        <button
          type="button"
          key={c.id}
          onClick={() => onChange(c.id)}
          aria-label={c.label}
          className={`${dim} rounded-full ${c.dot} transition-transform hover:scale-110 ${
            value === c.id ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800" : ""
          }`}
        />
      ))}

      {/* Custom color: shows the chosen hex as a swatch, opens the native picker. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Custom color"
        title="Custom color"
        className={`${dim} flex items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 transition-transform hover:scale-110 dark:border-slate-600 ${
          custom ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800" : ""
        }`}
        style={custom ? { backgroundColor: value, borderStyle: "solid" } : undefined}
      >
        {!custom && <Plus className="h-3.5 w-3.5" />}
      </button>
      <input
        ref={inputRef}
        type="color"
        value={custom ? value : "#7c3aed"}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
