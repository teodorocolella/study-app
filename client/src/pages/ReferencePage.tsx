import { Library } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { MathText } from "../components/math/MathText";

interface Formula {
  name: string;
  tex: string;
}

interface FormulaGroup {
  heading: string;
  formulas: Formula[];
}

const MATH: FormulaGroup[] = [
  {
    heading: "Algebra",
    formulas: [
      { name: "Quadratic formula", tex: "x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
      { name: "Slope", tex: "m = \\dfrac{y_2 - y_1}{x_2 - x_1}" },
      { name: "Distance", tex: "d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}" },
      { name: "Exponent rule", tex: "a^m \\cdot a^n = a^{m+n}" },
    ],
  },
  {
    heading: "Geometry",
    formulas: [
      { name: "Circle area / circumference", tex: "A = \\pi r^2 \\qquad C = 2\\pi r" },
      { name: "Triangle area", tex: "A = \\tfrac{1}{2} b h" },
      { name: "Pythagorean theorem", tex: "a^2 + b^2 = c^2" },
      { name: "Sphere volume", tex: "V = \\tfrac{4}{3}\\pi r^3" },
    ],
  },
  {
    heading: "Trigonometry",
    formulas: [
      { name: "Definitions", tex: "\\sin\\theta = \\tfrac{o}{h},\\ \\cos\\theta = \\tfrac{a}{h},\\ \\tan\\theta = \\tfrac{o}{a}" },
      { name: "Identity", tex: "\\sin^2\\theta + \\cos^2\\theta = 1" },
      { name: "Law of cosines", tex: "c^2 = a^2 + b^2 - 2ab\\cos C" },
    ],
  },
];

const PHYSICS: FormulaGroup[] = [
  {
    heading: "Mechanics",
    formulas: [
      { name: "Velocity", tex: "v = \\dfrac{\\Delta x}{\\Delta t}" },
      { name: "Newton's 2nd law", tex: "F = ma" },
      { name: "Kinetic energy", tex: "KE = \\tfrac{1}{2}mv^2" },
      { name: "Kinematics", tex: "v = v_0 + at" },
      { name: "Momentum", tex: "p = mv" },
    ],
  },
  {
    heading: "Electricity",
    formulas: [
      { name: "Ohm's law", tex: "V = IR" },
      { name: "Power", tex: "P = IV" },
    ],
  },
];

const CONSTANTS: Formula[] = [
  { name: "Speed of light", tex: "c = 3.00 \\times 10^8 \\ \\text{m/s}" },
  { name: "Gravity (Earth)", tex: "g = 9.81 \\ \\text{m/s}^2" },
  { name: "Avogadro's number", tex: "N_A = 6.022 \\times 10^{23}" },
  { name: "Planck's constant", tex: "h = 6.626 \\times 10^{-34}\\ \\text{J·s}" },
];

const CONVERSIONS: { from: string; to: string }[] = [
  { from: "1 inch", to: "2.54 cm" },
  { from: "1 mile", to: "1.609 km" },
  { from: "1 kg", to: "2.205 lb" },
  { from: "1 liter", to: "0.264 gal" },
  { from: "0 °C", to: "32 °F = 273.15 K" },
  { from: "1 mol gas (STP)", to: "22.4 L" },
];

const GREEK: { letter: string; name: string }[] = [
  { letter: "α", name: "alpha" },
  { letter: "β", name: "beta" },
  { letter: "γ / Γ", name: "gamma" },
  { letter: "Δ / δ", name: "delta" },
  { letter: "θ", name: "theta" },
  { letter: "λ", name: "lambda" },
  { letter: "π", name: "pi" },
  { letter: "Σ / σ", name: "sigma" },
  { letter: "φ", name: "phi" },
  { letter: "ω / Ω", name: "omega" },
];

// A compact set of the most common elements for chemistry class.
const ELEMENTS: { z: number; sym: string; name: string }[] = [
  { z: 1, sym: "H", name: "Hydrogen" },
  { z: 2, sym: "He", name: "Helium" },
  { z: 3, sym: "Li", name: "Lithium" },
  { z: 6, sym: "C", name: "Carbon" },
  { z: 7, sym: "N", name: "Nitrogen" },
  { z: 8, sym: "O", name: "Oxygen" },
  { z: 9, sym: "F", name: "Fluorine" },
  { z: 11, sym: "Na", name: "Sodium" },
  { z: 12, sym: "Mg", name: "Magnesium" },
  { z: 13, sym: "Al", name: "Aluminum" },
  { z: 14, sym: "Si", name: "Silicon" },
  { z: 15, sym: "P", name: "Phosphorus" },
  { z: 16, sym: "S", name: "Sulfur" },
  { z: 17, sym: "Cl", name: "Chlorine" },
  { z: 19, sym: "K", name: "Potassium" },
  { z: 20, sym: "Ca", name: "Calcium" },
  { z: 26, sym: "Fe", name: "Iron" },
  { z: 29, sym: "Cu", name: "Copper" },
  { z: 47, sym: "Ag", name: "Silver" },
  { z: 79, sym: "Au", name: "Gold" },
];

const TABS = ["Math", "Physics", "Chemistry", "Conversions", "Greek"] as const;
type Tab = (typeof TABS)[number];

export function ReferencePage() {
  const [tab, setTab] = useState<Tab>("Math");

  return (
    <AppShell>
      <h1 className="font-display mb-1 flex items-center gap-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
        <Library className="h-6 w-6 text-violet-500" />
        Reference
      </h1>
      <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Quick formulas and facts, always a click away.</p>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm"
                : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-violet-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Math" && <FormulaGroups groups={MATH} />}
      {tab === "Physics" && (
        <>
          <FormulaGroups groups={PHYSICS} />
          <Card heading="Constants">
            <FormulaList formulas={CONSTANTS} />
          </Card>
        </>
      )}
      {tab === "Chemistry" && (
        <Card heading="Common elements">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {ELEMENTS.map((el) => (
              <div key={el.z} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-center">
                <p className="text-xs text-slate-400">{el.z}</p>
                <p className="font-display text-xl font-semibold text-slate-800 dark:text-slate-100">{el.sym}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{el.name}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "Conversions" && (
        <Card heading="Unit conversions">
          <div className="divide-y divide-slate-100">
            {CONVERSIONS.map((c) => (
              <div key={c.from} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">{c.from}</span>
                <span className="text-slate-400">=</span>
                <span className="text-slate-600 dark:text-slate-300">{c.to}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "Greek" && (
        <Card heading="Greek alphabet">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {GREEK.map((g) => (
              <div key={g.name} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
                <span className="font-display text-xl text-slate-800 dark:text-slate-100">{g.letter}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{g.name}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </AppShell>
  );
}

function FormulaGroups({ groups }: { groups: FormulaGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <Card key={g.heading} heading={g.heading}>
          <FormulaList formulas={g.formulas} />
        </Card>
      ))}
    </>
  );
}

function FormulaList({ formulas }: { formulas: Formula[] }) {
  return (
    <div className="divide-y divide-slate-100">
      {formulas.map((f) => (
        <div key={f.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{f.name}</span>
          <span className="text-slate-800 dark:text-slate-100">
            <MathText text={`$${f.tex}$`} />
          </span>
        </div>
      ))}
    </div>
  );
}

function Card({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
      <h2 className="font-display mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {heading}
      </h2>
      {children}
    </div>
  );
}
