import { useCallback, useEffect, useMemo, useState } from "react";
import { Timer, Trophy, Zap } from "lucide-react";
import type { Flashcard } from "../../api/types";
import { getBest, recordBest } from "../../lib/gameScores";

const ROUND_SECONDS = 60;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Question {
  card: Flashcard;
  options: string[];
}

export function SpeedGame({ deckId, cards }: { deckId: string; cards: Flashcard[] }) {
  const pool = useMemo(() => cards.filter((c) => c.front.trim() && c.back.trim()), [cards]);

  const buildQuestion = useCallback((): Question => {
    const card = pool[Math.floor(Math.random() * pool.length)];
    const distractors = shuffle(pool.filter((c) => c.id !== card.id))
      .slice(0, 3)
      .map((c) => c.back);
    return { card, options: shuffle([card.back, ...distractors]) };
  }, [pool]);

  const [question, setQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [playing, setPlaying] = useState(false);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const [record, setRecord] = useState(false);

  function start() {
    setScore(0);
    setStreak(0);
    setTimeLeft(ROUND_SECONDS);
    setQuestion(buildQuestion());
    setPlaying(true);
    setRecord(false);
  }

  useEffect(() => {
    if (!playing) return;
    if (timeLeft <= 0) {
      setPlaying(false);
      setRecord(recordBest("speed", deckId, score, false));
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [playing, timeLeft, score, deckId]);

  function answer(option: string) {
    if (!question || !playing) return;
    const correct = option === question.card.back;
    setFlash(correct ? "right" : "wrong");
    setTimeout(() => setFlash(null), 250);
    if (correct) {
      setScore((s) => s + 10 + streak * 2);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
    setQuestion(buildQuestion());
  }

  const best = getBest("speed", deckId);

  if (pool.length < 4) {
    return <p className="text-sm text-slate-500">Add at least 4 text cards to this deck to play Speed round.</p>;
  }

  if (!playing) {
    return (
      <div className="animate-flip-in rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-md">
        {score > 0 ? (
          <>
            <Zap className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <p className="font-display text-3xl font-semibold text-slate-800">{score}</p>
            <p className="mt-1 text-sm text-slate-500">{record ? "New high score! 🎉" : "Time's up!"}</p>
          </>
        ) : (
          <>
            <Zap className="mx-auto mb-3 h-10 w-10 text-violet-500" />
            <p className="font-display text-xl font-semibold text-slate-800">Speed round</p>
            <p className="mt-1 text-sm text-slate-500">
              Answer as many as you can in {ROUND_SECONDS} seconds. Streaks score bonus points.
            </p>
          </>
        )}
        {best != null && <p className="mt-2 text-sm text-slate-400">Best: {best}</p>}
        <button
          onClick={start}
          className="mt-5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
        >
          {score > 0 ? "Play again" : "Start"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
          <Timer className="h-4 w-4 text-violet-500" />
          {timeLeft}s
        </span>
        <span className="flex items-center gap-3 text-sm">
          {streak > 1 && <span className="font-semibold text-amber-500">🔥 {streak}</span>}
          <span className="flex items-center gap-1 font-semibold text-slate-700">
            <Trophy className="h-4 w-4 text-amber-500" />
            {score}
          </span>
        </span>
      </div>

      <div
        className={`rounded-2xl border-2 bg-white p-8 text-center shadow-md transition-colors ${
          flash === "right" ? "border-emerald-300" : flash === "wrong" ? "border-red-300" : "border-slate-200"
        }`}
      >
        <p className="font-display mb-6 text-xl font-medium text-slate-800">{question?.card.front}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {question?.options.map((opt) => (
            <button
              key={opt}
              onClick={() => answer(opt)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50/40"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
