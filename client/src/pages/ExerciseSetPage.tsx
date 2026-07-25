import {
  ArrowLeft,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Exercise, ExerciseSetDetail, ExerciseType } from "../api/types";
import { AppShell } from "../components/layout/AppShell";

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  mcq: "Multiple choice",
  true_false: "True / false",
  fill_blank: "Fill in the blank",
  short_answer: "Short answer",
};

const TYPE_BADGES: Record<ExerciseType, string> = {
  mcq: "bg-violet-100 text-violet-700",
  true_false: "bg-sky-100 text-sky-700",
  fill_blank: "bg-amber-100 text-amber-700",
  short_answer: "bg-emerald-100 text-emerald-700",
};

export function ExerciseSetPage() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const [set, setSet] = useState<ExerciseSetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    if (!setId) return;
    const data = await api.get<ExerciseSetDetail>(`/exercise-sets/${setId}`);
    setSet(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  async function handleDeleteSet() {
    if (!set) return;
    const n = set.exercises.length;
    const detail = n ? ` This permanently deletes ${n} question${n === 1 ? "" : "s"}.` : "";
    if (!confirm(`Delete "${set.name}"?${detail}`)) return;
    await api.delete(`/exercise-sets/${set.id}`);
    navigate(`/classes/${set.classFolderId}`);
  }

  async function handleDeleteExercise(exerciseId: string) {
    await api.delete(`/exercises/${exerciseId}`);
    setSet((prev) =>
      prev ? { ...prev, exercises: prev.exercises.filter((e) => e.id !== exerciseId) } : prev,
    );
  }

  return (
    <AppShell>
      {set && (
        <Link
          to={`/classes/${set.classFolderId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to class
        </Link>
      )}

      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display flex items-center gap-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
          <BrainCircuit className="h-6 w-6 text-violet-500" />
          {set?.name}
        </h1>
        <div className="flex items-center gap-3">
          {set && set.exercises.length > 0 && (
            <Link
              to={`/practice/${setId}/run`}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Practice
            </Link>
          )}
          <button
            onClick={() => void handleDeleteSet()}
            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {set && set.attempts.length > 0 && (
        <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recent attempts
          </p>
          <div className="flex flex-wrap gap-2">
            {set.attempts.map((a) => {
              const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
              const color =
                pct >= 80
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : pct >= 50
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-red-200 bg-red-50 text-red-600";
              return (
                <span key={a.id} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${color}`}>
                  {a.score}/{a.total} · {new Date(a.createdAt).toLocaleDateString()}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-6 space-y-2.5">
        {set?.exercises.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No questions yet — add one below, or ask the AI assistant to make some.
          </p>
        )}
        {set?.exercises.map((exercise, i) =>
          editingId === exercise.id ? (
            <ExerciseForm
              key={exercise.id}
              initial={exercise}
              onCancel={() => setEditingId(null)}
              onSaved={(updated) => {
                setSet((prev) =>
                  prev
                    ? { ...prev, exercises: prev.exercises.map((e) => (e.id === updated.id ? updated : e)) }
                    : prev,
                );
                setEditingId(null);
              }}
            />
          ) : (
            <div
              key={exercise.id}
              className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_BADGES[exercise.type]}`}>
                    {i + 1} · {EXERCISE_TYPE_LABELS[exercise.type]}
                  </span>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{exercise.prompt}</p>
                  {exercise.options && (
                    <p className="mt-1 text-sm text-slate-400">{exercise.options.join(" · ")}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => setEditingId(exercise.id)} className="hover:text-violet-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => void handleDeleteExercise(exercise.id)} className="hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      {adding && setId ? (
        <ExerciseForm
          setId={setId}
          onCancel={() => setAdding(false)}
          onSaved={(created) => {
            setSet((prev) => (prev ? { ...prev, exercises: [...prev.exercises, created] } : prev));
            setAdding(false);
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900"
        >
          <Plus className="h-4 w-4" />
          Write a question
        </button>
      )}
    </AppShell>
  );
}

/** Create/edit form for one exercise, with fields that adapt to the type. */
function ExerciseForm({
  setId,
  initial,
  onSaved,
  onCancel,
}: {
  setId?: string;
  initial?: Exercise;
  onSaved: (exercise: Exercise) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<ExerciseType>(initial?.type ?? "mcq");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [options, setOptions] = useState<string[]>(() => {
    const existing = initial?.options ?? [];
    return [...existing, "", "", "", ""].slice(0, 4);
  });
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(Boolean(initial?.explanation));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const filledOptions = options.map((o) => o.trim()).filter(Boolean);
    const body = {
      type,
      prompt: prompt.trim(),
      options: type === "mcq" ? filledOptions : null,
      answer: type === "true_false" ? answer || "true" : answer.trim(),
      explanation: explanation.trim() || null,
    };
    try {
      const saved = initial
        ? await api.patch<Exercise>(`/exercises/${initial.id}`, body)
        : await api.post<Exercise>(`/exercise-sets/${setId}/exercises`, body);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-violet-300 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{initial ? "Edit question" : "New question"}</p>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as ExerciseType);
            setAnswer("");
          }}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
        >
          {(Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[]).map((t) => (
            <option key={t} value={t}>
              {EXERCISE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <textarea
        placeholder={
          type === "fill_blank"
            ? "Sentence with the missing part as _____ (e.g. The _____ is the powerhouse of the cell)"
            : type === "true_false"
              ? "Statement to judge as true or false"
              : "Question"
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        className={inputClass}
      />

      {type === "mcq" && (
        <div className="space-y-2">
          {options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct-option"
                checked={answer === option && option !== ""}
                onChange={() => setAnswer(option)}
                title="Mark as the correct answer"
              />
              <input
                placeholder={`Option ${i + 1}`}
                value={option}
                onChange={(e) => {
                  const next = [...options];
                  if (answer === option) setAnswer(e.target.value);
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                className={inputClass}
              />
            </div>
          ))}
          <p className="text-xs text-slate-400">Select the radio button next to the correct answer.</p>
        </div>
      )}

      {type === "true_false" && (
        <div className="flex gap-2">
          {["true", "false"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAnswer(value)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize ${
                (answer || "true") === value
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      {type === "fill_blank" && (
        <input
          placeholder="The missing word or phrase"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className={inputClass}
        />
      )}

      {type === "short_answer" && (
        <textarea
          placeholder="Model answer — the points a good response should include (Claude uses this to grade)"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={2}
          className={inputClass}
        />
      )}

      <button
        type="button"
        onClick={() => setShowExplanation((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600"
      >
        {showExplanation ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Explanation (optional)
      </button>
      {showExplanation && (
        <textarea
          placeholder="Shown after answering — why this is the correct answer"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={2}
          className={inputClass}
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !prompt.trim() || (type !== "true_false" && !answer.trim())}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save question"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
