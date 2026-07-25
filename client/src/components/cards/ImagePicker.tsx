import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { resizeImageToDataUrl } from "../../lib/imageResize";

/** Compact image picker: pick + downscale an image to a data URL, with a thumbnail + remove. */
export function ImagePicker({
  value,
  onChange,
  label = "Add image",
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      onChange(await resizeImageToDataUrl(file, 800));
    } catch {
      setError("Could not process that image.");
    }
    e.target.value = "";
  }

  if (value) {
    return (
      <div className="relative inline-block">
        <img src={value} alt="" className="h-16 rounded-lg border border-slate-200 object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove image"
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white shadow hover:bg-slate-900"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-violet-300 hover:text-violet-600"
      >
        <ImagePlus className="h-3.5 w-3.5" />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => void handleFile(e)}
        className="hidden"
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}
