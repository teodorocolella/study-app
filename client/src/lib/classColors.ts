export interface ClassColor {
  id: string;
  label: string;
  dot: string;
  gradient: string;
  soft: string;
  text: string;
  ring: string;
}

export const CLASS_COLORS: ClassColor[] = [
  {
    id: "violet",
    label: "Violet",
    dot: "bg-violet-500",
    gradient: "from-violet-500 to-indigo-600",
    soft: "bg-violet-50",
    text: "text-violet-700",
    ring: "ring-violet-200",
  },
  {
    id: "sky",
    label: "Sky",
    dot: "bg-sky-500",
    gradient: "from-sky-400 to-blue-600",
    soft: "bg-sky-50",
    text: "text-sky-700",
    ring: "ring-sky-200",
  },
  {
    id: "emerald",
    label: "Emerald",
    dot: "bg-emerald-500",
    gradient: "from-emerald-400 to-teal-600",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  {
    id: "amber",
    label: "Amber",
    dot: "bg-amber-500",
    gradient: "from-amber-400 to-orange-600",
    soft: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
  },
  {
    id: "rose",
    label: "Rose",
    dot: "bg-rose-500",
    gradient: "from-rose-400 to-pink-600",
    soft: "bg-rose-50",
    text: "text-rose-700",
    ring: "ring-rose-200",
  },
  {
    id: "slate",
    label: "Slate",
    dot: "bg-slate-500",
    gradient: "from-slate-500 to-slate-700",
    soft: "bg-slate-100",
    text: "text-slate-700",
    ring: "ring-slate-200",
  },
];

export function getClassColor(colorTag: string | null | undefined): ClassColor {
  return CLASS_COLORS.find((c) => c.id === colorTag) ?? CLASS_COLORS[0];
}

export function isCustomColor(colorTag: string | null | undefined): colorTag is string {
  return typeof colorTag === "string" && /^#[0-9a-fA-F]{6}$/.test(colorTag);
}

/** Shifts a hex color lighter (positive) or darker (negative) by a percent. */
export function shadeHex(hex: string, percent: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 0xff) * (1 + percent / 100));
  const g = clamp(((n >> 8) & 0xff) * (1 + percent / 100));
  const b = clamp((n & 0xff) * (1 + percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Gradient classes/style for a class color, supporting both presets (Tailwind
 * classes) and custom hex colors (inline linear-gradient). Spread both onto the
 * element: className={`… ${g.className}`} style={g.style}.
 */
export function classGradient(
  colorTag: string | null | undefined,
  dir: "br" | "b" = "br",
): { className: string; style?: React.CSSProperties } {
  if (isCustomColor(colorTag)) {
    const to = dir === "b" ? "to bottom" : "to bottom right";
    return {
      className: "",
      style: { backgroundImage: `linear-gradient(${to}, ${colorTag}, ${shadeHex(colorTag, -22)})` },
    };
  }
  // Full literal class names — Tailwind's scanner can't see interpolated strings
  // like `bg-gradient-to-${dir}`, so it would never generate the CSS for them.
  const base = dir === "b" ? "bg-gradient-to-b" : "bg-gradient-to-br";
  return { className: `${base} ${getClassColor(colorTag).gradient}` };
}

/** Accent bar for an individual item: its color if set, else a neutral bar. */
export function itemAccent(colorTag: string | null | undefined): {
  className: string;
  style?: React.CSSProperties;
} {
  if (!colorTag) return { className: "bg-slate-200 dark:bg-slate-700" };
  return classGradient(colorTag, "b");
}
