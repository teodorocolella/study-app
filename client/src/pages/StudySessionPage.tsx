import {
  ArrowLeft,
  CheckCircle2,
  Frown,
  Loader2,
  Meh,
  PartyPopper,
  Smile,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Flashcard } from "../api/types";
import { AppShell } from "../components/layout/AppShell";

type GradeLabel = "again" | "hard" | "good" | "easy";

const GRADE_BUTTONS: { label: GradeLabel; text: string; icon: typeof Frown; className: string }[] = [
  { label: "again", text: "Again", icon: Frown, className: "bg-red-50 text-red-600 hover:bg-red-100 border-red-100" },
  { label: "hard", text: "Hard", icon: Meh, className: "bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-100" },
  { label: "good", text: "Good", icon: Smile, className: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100" },
  { label: "easy", text: "Easy", icon: Zap, className: "bg-sky-50 text-sky-600 hover:bg-sky-100 border-sky-100" },
];

export function StudySessionPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => {
    if (!deckId) return;
    api
      .get<Flashcard[]>(`/decks/${deckId}/review/due`)
      .then((cards) => {
        setQueue(cards);
        setTotalCount(cards.length);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [deckId]);

  const current = queue[0];
  const progress = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;

  async function handleGrade(grade: GradeLabel) {
    if (!current) return;
    try {
      await api.post(`/cards/${current.id}/review`, { grade });
      setReviewedCount((n) => n + 1);
      setQueue((prev) => prev.slice(1));
      setRevealed(false);
      setExplanation(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit review");
    }
  }

  async function handleExplainDifferently() {
    if (!current) return;
    setExplaining(true);
    try {
      const { explanation: text } = await api.post<{ explanation: string }>(
        "/ai/explain-differently",
        { cardId: current.id, priorExplanation: explanation ?? undefined },
      );
      setExplanation(text);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to get an explanation");
    } finally {
      setExplaining(false);
    }
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
        to={`/decks/${deckId}`}
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-violet-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to deck
      </Link>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!current ? (
        <div className="animate-fade-in mt-8 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-100">
            {reviewedCount > 0 ? (
              <PartyPopper className="h-7 w-7 text-violet-600" />
            ) : (
              <CheckCircle2 className="h-7 w-7 text-violet-600" />
            )}
          </div>
          <p className="font-display text-xl font-semibold text-slate-800">
            {reviewedCount > 0 ? "Session complete!" : "All caught up!"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {reviewedCount > 0
              ? `You reviewed ${reviewedCount} card${reviewedCount === 1 ? "" : "s"}.`
              : "No cards are due for review right now."}
          </p>
          <Link
            to={`/decks/${deckId}`}
            className="mt-5 inline-block rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
          >
            Back to deck
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-xs font-medium text-slate-400">
              {queue.length} left
            </span>
          </div>

          <div
            onClick={() => !revealed && setRevealed(true)}
            className="animate-flip-in flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-md transition-shadow hover:shadow-lg"
          >
            <p className="font-display text-xl font-medium text-slate-800">{current.front}</p>
            {revealed && (
              <>
                <hr className="my-4 w-24 border-slate-200" />
                <p className="text-lg text-slate-600">{current.back}</p>
              </>
            )}
            {!revealed && (
              <p className="mt-6 flex items-center gap-1 text-xs text-slate-400">
                <Sparkles className="h-3 w-3" />
                Click to reveal answer
              </p>
            )}
          </div>

          {revealed && (
            <>
              <div className="mt-3 text-center">
                <button
                  onClick={() => void handleExplainDifferently()}
                  disabled={explaining}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50"
                >
                  {explaining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {explaining ? "Thinking of another way to explain it…" : "Explain differently"}
                </button>
              </div>
              {explanation && (
                <div className="animate-flip-in mt-3 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4 text-sm text-slate-700">
                  {explanation}
                </div>
              )}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {GRADE_BUTTONS.map((btn) => {
                  const Icon = btn.icon;
                  return (
                    <button
                      key={btn.label}
                      onClick={() => void handleGrade(btn.label)}
                      className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-sm font-medium transition-transform hover:scale-[1.03] ${btn.className}`}
                    >
                      <Icon className="h-4 w-4" />
                      {btn.text}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
