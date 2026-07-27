import { BookOpen } from "lucide-react";
import { classGradient } from "../../lib/classColors";

/** A rounded, color-filled tile that gives each class a recognizable "logo". */
export function ClassLogo({ colorTag, size = 40 }: { colorTag: string | null | undefined; size?: number }) {
  const g = classGradient(colorTag, "br");
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${g.className}`}
      style={{ width: size, height: size, ...g.style }}
    >
      <BookOpen className="h-1/2 w-1/2" strokeWidth={2.25} />
    </span>
  );
}
