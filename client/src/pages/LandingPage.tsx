import {
  Bell,
  BookOpen,
  Flame,
  GraduationCap,
  Layers,
  Share2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Claude AI assistant",
    description:
      "An assistant powered by Claude lives in the corner of every page. It knows all your notes and flashcards — ask it anything, get quizzed, or have it build study material for you.",
  },
  {
    icon: Layers,
    title: "Spaced repetition",
    description:
      "A proven SM-2 scheduler resurfaces cards you miss sooner and pushes ones you know further out, so every minute of review counts.",
  },
  {
    icon: Wand2,
    title: "Flashcards from notes",
    description:
      "Turn any note into a ready-to-study deck in one click — Claude writes the questions and answers for you.",
  },
  {
    icon: Share2,
    title: "Share with classmates",
    description:
      "Message other students, and send them copies of your notes and flashcard decks. Great for study groups before a test.",
  },
  {
    icon: Bell,
    title: "Email reminders",
    description:
      "When cards are due and you haven't studied yet, Study Hub emails you a nudge so your streak never dies by accident.",
  },
  {
    icon: BookOpen,
    title: "Everything organized",
    description:
      "Class folders keep notes and decks tidy per subject, and the dashboard shows exactly what's due today across all of them.",
  },
];

const STEPS = [
  {
    number: "1",
    title: "Capture your notes",
    description: "Create a folder per class and write notes in a clean rich-text editor.",
  },
  {
    number: "2",
    title: "Let Claude build your deck",
    description: "Generate flashcards from any note, or ask the assistant to make them from chat.",
  },
  {
    number: "3",
    title: "Review a few minutes a day",
    description: "Study what's due, grade yourself, and watch your streak grow.",
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
          <p className="mx-auto mb-5 flex w-fit items-center gap-1.5 rounded-full border border-violet-200 bg-white px-4 py-1.5 text-xs font-semibold text-violet-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by Claude AI
          </p>
          <h1 className="font-display text-4xl font-semibold text-slate-800 sm:text-5xl">
            The study app that actually studies <span className="text-violet-600">with</span> you.
          </h1>
          <p className="mt-4 text-lg text-slate-500">
            Notes, spaced-repetition flashcards, and a Claude-powered assistant that knows
            everything you're studying — plus sharing with classmates and reminders when it's
            time to review.
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
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xl shadow-violet-100">
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
            <div className="border-t border-slate-100 p-4">
              <div className="ml-auto max-w-sm rounded-xl border border-slate-200 bg-white shadow-md">
                <div className="flex items-center gap-1.5 rounded-t-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                  <span className="text-xs font-semibold text-white">AI assistant</span>
                  <span className="ml-auto text-[10px] font-medium text-violet-200">
                    Powered by Claude
                  </span>
                </div>
                <div className="space-y-2 p-3 text-left">
                  <p className="ml-auto w-fit rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 px-3 py-1.5 text-xs text-white">
                    Quiz me on my biology notes
                  </p>
                  <p className="w-fit rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
                    Sure! First question: what organelle produces the cell's energy?
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24">
          <h2 className="font-display text-center text-2xl font-semibold text-slate-800">
            Everything you need to study smarter
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <f.icon className="h-4.5 w-4.5" strokeWidth={2.25} />
                </div>
                <h3 className="font-display mb-1 font-semibold text-slate-800">{f.title}</h3>
                <p className="text-sm text-slate-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24">
          <h2 className="font-display text-center text-2xl font-semibold text-slate-800">
            How it works
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <span className="font-display mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-semibold text-white">
                  {step.number}
                </span>
                <h3 className="font-display mb-1 font-semibold text-slate-800">{step.title}</h3>
                <p className="text-sm text-slate-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-10 text-center text-white shadow-lg">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-white/70" />
          <h2 className="font-display text-2xl font-semibold">Ready to start studying smarter?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-violet-100">
            Free to use. Your own AI study assistant, powered by Claude, is one signup away.
          </p>
          <Link
            to="/signup"
            className="mt-5 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-violet-700 shadow-md transition-transform hover:scale-[1.02]"
          >
            Create your account
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Study Hub</p>
          <p className="flex items-center gap-1">
            AI features powered by <span className="font-semibold text-slate-500">Claude</span> from Anthropic
          </p>
        </div>
      </footer>
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
