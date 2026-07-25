import {
  ArrowRight,
  Bell,
  BookOpen,
  BrainCircuit,
  GraduationCap,
  Layers,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { ClassFolder } from "../api/types";
import { useAuth } from "../hooks/useAuth";
import { CLASS_COLORS } from "../lib/classColors";
import { GRADE_OPTIONS } from "../lib/gradeLevels";

const TOUR_STOPS = [
  {
    icon: BookOpen,
    title: "Classes hold everything",
    description:
      "Make a folder for each class — Biology, Algebra II, History. Inside each one live your notes, flashcard decks, and practice quizzes.",
  },
  {
    icon: Layers,
    title: "Flashcards that know when to come back",
    description:
      "When you review a card you grade yourself, and Study Hub schedules it: cards you miss return quickly, cards you know drift further out. A few minutes a day beats cramming.",
  },
  {
    icon: BrainCircuit,
    title: "Practice quizzes, four ways",
    description:
      "Multiple choice, true/false, fill-in-the-blank, and short answers that Claude grades with real feedback. Generate a whole quiz from any note in one click.",
  },
  {
    icon: Sparkles,
    title: "Your assistant lives in the corner",
    description:
      "The sparkle button follows you on every page. It's powered by Claude and can see all your notes and cards — ask it anything, get quizzed, or tell it to make study material for you.",
  },
  {
    icon: Share2,
    title: "Study with friends",
    description:
      "Message classmates by their Study Hub email and send them copies of your notes, decks, and quizzes. Everyone keeps their own version.",
  },
  {
    icon: Bell,
    title: "We'll nudge you",
    description:
      "If cards are due and you haven't studied yet, Study Hub can email you a reminder so your streak survives busy days.",
  },
];

export function WelcomePage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [className, setClassName] = useState("");
  const [selectedColor, setSelectedColor] = useState(CLASS_COLORS[0].id);
  const [gradeLevel, setGradeLevel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(createClass: boolean, e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let destination = "/dashboard";
      if (createClass && className.trim()) {
        const created = await api.post<ClassFolder>("/classes", {
          name: className.trim(),
          colorTag: selectedColor,
        });
        destination = `/classes/${created.id}`;
      }
      await updateProfile({
        hasOnboarded: true,
        ...(gradeLevel != null ? { gradeLevel } : {}),
      });
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong — try again");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f5fb] dark:bg-[#0f0e17] bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.1),transparent_55%)]">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <div className="text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-300">
            <GraduationCap className="h-7 w-7" strokeWidth={2.25} />
          </span>
          <h1 className="font-display text-3xl font-semibold text-slate-800 dark:text-slate-100 sm:text-4xl">
            Welcome to Study Hub, {user?.displayName?.split(" ")[0]}!
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-slate-500 dark:text-slate-400">
            Your new study companion: notes, smart flashcards, practice quizzes, and an AI
            assistant powered by Claude — all in one place. Here's the one-minute tour.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {TOUR_STOPS.map((stop, i) => (
            <div
              key={stop.title}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <stop.icon className="h-4.5 w-4.5" strokeWidth={2.25} />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {i + 1} of {TOUR_STOPS.length}
                </span>
              </div>
              <h3 className="font-display mb-1 font-semibold text-slate-800 dark:text-slate-100">{stop.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{stop.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-violet-200 bg-white dark:bg-slate-800 p-6 shadow-md">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">What grade are you in?</h2>
          <div className="mt-3 mb-3 flex items-start gap-2 rounded-xl bg-violet-50 p-3 text-sm text-violet-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
            <p>
              Don't worry — this isn't for collecting your private data. It's so <strong>we</strong>{" "}
              can give <strong>you</strong> recommendations tuned to your grade level. It updates on
              its own each school year, so you'll never have to set it again.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRADE_OPTIONS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGradeLevel(g.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  gradeLevel === g.value
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => void finish(true, e)}
          className="mt-6 rounded-2xl border border-violet-200 bg-white dark:bg-slate-800 p-6 shadow-md"
        >
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">
            Let's set up your first class
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
            Everything starts with a class folder. What are you studying?
          </p>
          <div className="mb-3 flex gap-2">
            {CLASS_COLORS.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setSelectedColor(c.id)}
                aria-label={c.label}
                className={`h-6 w-6 rounded-full ${c.dot} transition-transform hover:scale-110 ${
                  selectedColor === c.id ? "ring-2 ring-offset-2 ring-slate-400" : ""
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Class name (e.g. Biology)"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
            <button
              type="submit"
              disabled={busy || !className.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Start studying
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => void finish(false)}
            disabled={busy}
            className="mt-4 text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            Skip for now — take me to the dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
