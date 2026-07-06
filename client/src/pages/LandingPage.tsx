import {
  BookOpen,
  Flame,
  GraduationCap,
  Layers,
  MessageCircleQuestion,
  Sparkles,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Class folders",
    description: "Keep notes and flashcard decks organized by subject, all in one place.",
  },
  {
    icon: Layers,
    title: "Spaced repetition",
    description: "An SM-2 scheduler resurfaces cards you miss sooner and pushes ones you know further out.",
  },
  {
    icon: MessageCircleQuestion,
    title: "AI tutor",
    description: "Ask questions scoped to your class notes, generate flashcards from a note, or get a fresh explanation.",
  },
  {
    icon: Flame,
    title: "Track your progress",
    description: "See what's due today across every class, plus your study streak.",
  },
];

export function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-[#f6f5fb] bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.1),transparent_55%)]">
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm shadow-violet-300">
              <GraduationCap className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="font-display text-lg font-semibold text-slate-800">Study Hub</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl font-semibold text-slate-800 sm:text-5xl">
            Ace every class, one flashcard at a time.
          </h1>
          <p className="mt-4 text-lg text-slate-500">
            Class folders, spaced-repetition flashcards, markdown notes, and an AI tutor — all in
            one place built for how you actually study.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/signup"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-200 transition-transform hover:scale-[1.02] hover:shadow-lg"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xl shadow-violet-100">
          <div className="rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-700 p-6">
            <p className="text-sm font-medium text-violet-100">Welcome back</p>
            <p className="font-display text-2xl font-semibold text-white">Alex</p>
            <p className="mt-1 text-sm text-violet-100">You have 6 cards ready for review.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 p-4">
            <MockStat icon={Layers} label="Due today" value="6" accent="violet" />
            <MockStat icon={BookOpen} label="Studied today" value="12" accent="sky" />
            <MockStat icon={Flame} label="Day streak" value="4" accent="amber" />
          </div>
        </div>

        <div className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <f.icon className="h-4.5 w-4.5" strokeWidth={2.25} />
              </div>
              <h3 className="font-display mb-1 font-semibold text-slate-800">{f.title}</h3>
              <p className="text-sm text-slate-500">{f.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-10 text-center text-white shadow-lg">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-white/70" />
          <h2 className="font-display text-2xl font-semibold">Ready to start studying smarter?</h2>
          <Link
            to="/signup"
            className="mt-5 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-violet-700 shadow-md transition-transform hover:scale-[1.02]"
          >
            Create your account
          </Link>
        </div>
      </main>
    </div>
  );
}

function MockStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  accent: "violet" | "sky" | "amber";
}) {
  const accents = {
    violet: "bg-violet-100 text-violet-600",
    sky: "bg-sky-100 text-sky-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-md ${accents[accent]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-display text-lg font-semibold text-slate-800">{value}</p>
    </div>
  );
}
