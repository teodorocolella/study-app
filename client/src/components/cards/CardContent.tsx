import type { Flashcard, Occlusion } from "../../api/types";
import { MathText } from "../math/MathText";

function parseOcclusions(json: string | null): Occlusion[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as Occlusion[];
  } catch {
    return [];
  }
}

/** Renders one face of a flashcard — text (with math), photos, or an occlusion image. */
export function CardContent({ card, side }: { card: Flashcard; side: "front" | "back" }) {
  if (card.kind === "image_occlusion" && card.frontImage) {
    const regions = parseOcclusions(card.occlusionsJson);
    return (
      <div className="relative inline-block max-w-full overflow-hidden rounded-xl">
        <img src={card.frontImage} alt="" className="max-h-[46vh] w-auto max-w-full" />
        {regions.map((r, i) => (
          <div
            key={i}
            className={`absolute flex items-center justify-center rounded text-xs font-semibold ${
              side === "front" ? "bg-violet-600 text-white" : "bg-violet-600/85 text-white ring-2 ring-white"
            }`}
            style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
          >
            {side === "front" ? i + 1 : r.label}
          </div>
        ))}
      </div>
    );
  }

  const text = side === "front" ? card.front : card.back;
  const image = side === "front" ? card.frontImage : card.backImage;
  return (
    <div className="flex flex-col items-center gap-3">
      {image && <img src={image} alt="" className="max-h-[36vh] w-auto max-w-full rounded-xl" />}
      {text && (
        <MathText
          className={side === "front" ? "font-display text-xl font-medium text-slate-800" : "text-lg text-slate-600"}
          text={text}
        />
      )}
    </div>
  );
}
