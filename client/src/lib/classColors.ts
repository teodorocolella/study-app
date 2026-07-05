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
