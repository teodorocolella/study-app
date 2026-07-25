import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  PartyPopper,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { AttemptResult, Exercise, ExerciseSetDetail } from "../api/types";
import { AppShell } from "../components/layout/AppShell";
import { MathText } from "../components/math/MathText";
import { EXERCISE_TYPE_LABELS } from "./ExerciseSetPage";

type Phase = "answering" | "grading" | "results";

export function PracticeSessionPage() {
  const { setId } = useParams<{ setId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [set, setSet] = useState<ExerciseSetDetail | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("answering");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ?only=id1,id2 runs a subset — used by "Retry wrong answers".
  const onlyIds = searchParams.get("only");
  // Bumped on every retry so restarting the same subset re-runs this effect.
  const runNonce = searchParams.get("r");

  useEffect(() => {
    if (!setId) return;
    setLoading(true);
    setIndex(0);
    setAnswers({});
    setResult(null);
    setPhase("answering");
    api
      .get<ExerciseSetDetail>(`/exercise-sets/${setId}`)
      .then(setSet)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [setId, onlyIds, runNonce]);

  const exercises = useMemo(() => {
    if (!set) return [];
    if (!onlyIds) return set.exercises;
    const wanted = new Set(onlyIds.split(","));
    return set.exercises.filter((e) => wanted.has(e.id));
  }, [set, onlyIds]);

  const current = exercises[index];
  const hasShortAnswers = exercises.some((e) => e.type === "short_answer");

  async function handleSubmit() {
    if (!setId) return;
    setPhase("grading");
    setError(null);
    try {
      const graded = await api.post<AttemptResult>(`/exercise-sets/${setId}/attempts`, {
        answers: exercises.map((e) => ({ exerciseId: e.id, answer: answers[e.id] ?? "" })),
      });
      setResult(graded);
      setPhase("results");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to grade — please try again");
      setPhase("answering");
    }
  }

  function handleRetryWrong() {
    if (!result) return;
    const wrongIds = result.results.filter((r) => !r.correct).map((r) => r.exerciseId);
    navigate(`/practice/${setId}/run?only=${wrongIds.join(",")}&r=${Date.now()}`);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link
        to={`/practice/${setId}`}
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {set?.name ?? "practice set"}
      </Link>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {phase === "answering" && exercises.length === 0 && (
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">This practice set has no questions yet.</p>
      )}

      {phase === "answering" && current && (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${((index + 1) / exercises.length) * 100}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-xs font-medium text-slate-400">
              {index + 1} of {exercises.length}
            </span>
          </div>

          <div className="animate-flip-in rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-md">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-500">
              {EXERCISE_TYPE_LABELS[current.type]}
            </p>
            <MathText
              className="font-display mb-6 block text-xl font-medium text-slate-800 dark:text-slate-100"
              text={current.prompt}
            />
            <AnswerInput
              exercise={current}
              value={answers[current.id] ?? ""}
              onChange={(value) => setAnswers((prev) => ({ ...prev, [current.id]: value }))}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            {index < exercises.length - 1 ? (
              <button
                onClick={() => setIndex((i) => i + 1)}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
              >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => void handleSubmit()}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
              >
                <Check className="h-4 w-4" />
                Submit answers
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "grading" && (
        <div className="mt-16 flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm font-medium">
            {hasShortAnswers ? "Claude is grading your written answers…" : "Grading…"}
          </p>
        </div>
      )}

      {phase === "results" && result && (
        <div className="mt-6">
          <div className="animate-flip-in mb-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-md">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-100">
              {result.score === result.total ? (
                <PartyPopper className="h-7 w-7 text-violet-600" />
              ) : (
                <Sparkles className="h-7 w-7 text-violet-600" />
              )}
            </div>
            <p className="font-display text-3xl font-semibold text-slate-800 dark:text-slate-100">
              {result.score} / {result.total}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {result.score === result.total
                ? "Perfect score — you've got this!"
                : `${Math.round((result.score / result.total) * 100)}% — review the ones you missed below.`}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {result.score < result.total && (
                <button
                  onClick={handleRetryWrong}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry wrong answers ({result.total - result.score})
                </button>
              )}
              <Link
                to={`/practice/${setId}`}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Done
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {result.results.map((row, i) => (
              <div
                key={row.exerciseId}
                className={`rounded-xl border bg-white dark:bg-slate-800 p-4 shadow-sm ${
                  row.correct ? "border-emerald-200" : "border-red-200"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      row.correct ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
                    }`}
                  >
                    {row.correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                      {i + 1}. {row.prompt}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Your answer:{" "}
                      <span className={row.correct ? "text-emerald-600" : "text-red-500"}>
                        {row.userAnswer || "(blank)"}
                      </span>
                    </p>
                    {!row.correct && row.type !== "short_answer" && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Correct answer: <span className="font-medium text-slate-700 dark:text-slate-200">{row.correctAnswer}</span>
                      </p>
                    )}
                    {row.feedback && (
                      <p className="mt-1.5 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">
                        <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                        {row.feedback}
                      </p>
                    )}
                    {row.explanation && (
                      <p className="mt-1.5 text-sm text-slate-400">{row.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function AnswerInput({
  exercise,
  value,
  onChange,
}: {
  exercise: Exercise;
  value: string;
  onChange: (value: string) => void;
}) {
  if (exercise.type === "mcq" && exercise.options) {
    return (
      <div className="space-y-2">
        {exercise.options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`block w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
              value === option
                ? "border-violet-500 bg-violet-50 text-violet-700"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300 hover:bg-violet-50/40"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  if (exercise.type === "true_false") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {["true", "false"].map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition-colors ${
              value === option
                ? "border-violet-500 bg-violet-50 text-violet-700"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  if (exercise.type === "fill_blank") {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type the missing word or phrase…"
        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
      />
    );
  }

  return (
    <textarea
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      placeholder="Explain in your own words — Claude will grade it and give you feedback…"
      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
    />
  );
}
