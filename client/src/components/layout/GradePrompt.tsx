import { Loader2, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { GRADE_OPTIONS } from "../../lib/gradeLevels";

/**
 * Asks for the student's grade when it isn't set yet — including existing
 * accounts that predate the grade feature and so never saw it in onboarding.
 */
export function GradePrompt({ onClose }: { onClose: () => void }) {
  const { updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(gradeLevel: number) {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ gradeLevel });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that — try again");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="animate-flip-in w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <div className="mb-3 flex items-start justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">
            What grade are you in?
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Not now">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-xl bg-violet-50 p-3 text-sm text-violet-800 dark:bg-violet-500/10 dark:text-violet-200">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
          <p>
            Don't worry — this isn't for collecting your private data. It's so <strong>we</strong>{" "}
            can give <strong>you</strong> recommendations tuned to your grade level (the AI pitches
            explanations, flashcards, and quizzes to it). It updates itself each school year.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADE_OPTIONS.map((g) => (
            <button
              key={g.value}
              disabled={saving}
              onClick={() => void pick(g.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {g.label}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={onClose}
          disabled={saving}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-600"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Not now
        </button>
      </div>
    </div>
  );
}
