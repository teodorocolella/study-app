import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart, Trophy } from "lucide-react";
import type { Flashcard } from "../../api/types";
import { getBest, recordBest } from "../../lib/gameScores";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Wave {
  prompt: string;
  correct: string;
  options: string[];
}

const START_LIVES = 3;
const TICK_MS = 50;

export function BlocksGame({ deckId, cards }: { deckId: string; cards: Flashcard[] }) {
  const pool = useMemo(() => cards.filter((c) => c.front.trim() && c.back.trim()), [cards]);

  const buildWave = useCallback((): Wave => {
    const card = pool[Math.floor(Math.random() * pool.length)];
    const distractors = shuffle(pool.filter((c) => c.id !== card.id))
      .slice(0, 2)
      .map((c) => c.back);
    return { prompt: card.front, correct: card.back, options: shuffle([card.back, ...distractors]) };
  }, [pool]);

  const [wave, setWave] = useState<Wave | null>(null);
  const [dropY, setDropY] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [record, setRecord] = useState(false);
  const scoreRef = useRef(0);

  function start() {
    setScore(0);
    scoreRef.current = 0;
    setLives(START_LIVES);
    setDropY(0);
    setWave(buildWave());
    setPlaying(true);
    setRecord(false);
  }

  const loseLife = useCallback(() => {
    setLives((l) => {
      const next = l - 1;
      if (next <= 0) {
        setPlaying(false);
        setRecord(recordBest("blocks", deckId, scoreRef.current, false));
      }
      return next;
    });
  }, [deckId]);

  // Falling animation; speed ramps up with score.
  useEffect(() => {
    if (!playing || !wave) return;
    const speed = 0.6 + Math.min(scoreRef.current / 100, 1.4); // % per tick
    const t = setInterval(() => {
      setDropY((y) => {
        if (y >= 100) {
          loseLife();
          setWave(buildWave());
          return 0;
        }
        return y + speed;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [playing, wave, buildWave, loseLife]);

  function pick(option: string) {
    if (!wave || !playing) return;
    if (option === wave.correct) {
      setScore((s) => {
        const n = s + 10;
        scoreRef.current = n;
        return n;
      });
    } else {
      loseLife();
    }
    setWave(buildWave());
    setDropY(0);
  }

  const best = getBest("blocks", deckId);

  if (pool.length < 3) {
    return <p className="text-sm text-slate-500">Add at least 3 text cards to this deck to play this game.</p>;
  }

  if (!playing) {
    return (
      <div className="animate-flip-in rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-md">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-xl">
          🧱
        </div>
        {score > 0 || lives === 0 ? (
          <>
            <p className="font-display text-3xl font-semibold text-slate-800">{score}</p>
            <p className="mt-1 text-sm text-slate-500">{record ? "New high score! 🎉" : "Game over!"}</p>
          </>
        ) : (
          <>
            <p className="font-display text-xl font-semibold text-slate-800">Answer Blocks</p>
            <p className="mt-1 text-sm text-slate-500">
              Tap the block with the right answer before it hits the floor. It speeds up — don't lose all 3 lives!
            </p>
          </>
        )}
        {best != null && <p className="mt-2 text-sm text-slate-400">Best: {best}</p>}
        <button
          onClick={start}
          className="mt-5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
        >
          {score > 0 || lives === 0 ? "Play again" : "Start"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1">
          {Array.from({ length: START_LIVES }).map((_, i) => (
            <Heart
              key={i}
              className={`h-4 w-4 ${i < lives ? "fill-red-500 text-red-500" : "text-slate-300"}`}
            />
          ))}
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">
          <Trophy className="h-4 w-4 text-amber-500" />
          {score}
        </span>
      </div>

      <div className="mb-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-center">
        <p className="text-xs font-medium text-violet-100">Which answers this?</p>
        <p className="font-display font-semibold text-white">{wave?.prompt}</p>
      </div>

      <div className="relative h-72 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <div
          className="absolute inset-x-0 flex gap-2 px-2"
          style={{ top: `${dropY}%`, transition: `top ${TICK_MS}ms linear` }}
        >
          {wave?.options.map((opt) => (
            <button
              key={opt}
              onClick={() => pick(opt)}
              className="flex-1 rounded-lg border border-violet-300 bg-white px-2 py-3 text-center text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-violet-500 hover:bg-violet-50"
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-red-300" />
      </div>
    </div>
  );
}
