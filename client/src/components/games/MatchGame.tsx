import { useEffect, useMemo, useRef, useState } from "react";
import { Timer, Trophy } from "lucide-react";
import type { Flashcard } from "../../api/types";
import { getBest, recordBest } from "../../lib/gameScores";

interface Tile {
  id: string;
  cardId: string;
  text: string;
  side: "front" | "back";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A round uses up to 6 pairs (12 tiles).
const PAIRS_PER_ROUND = 6;

export function MatchGame({ deckId, cards }: { deckId: string; cards: Flashcard[] }) {
  const pool = useMemo(() => cards.filter((c) => c.front.trim() && c.back.trim()), [cards]);

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [record, setRecord] = useState(false);
  const startRef = useRef(0);

  function newRound() {
    const chosen = shuffle(pool).slice(0, PAIRS_PER_ROUND);
    const built: Tile[] = chosen.flatMap((c) => [
      { id: `${c.id}-f`, cardId: c.id, text: c.front, side: "front" as const },
      { id: `${c.id}-b`, cardId: c.id, text: c.back, side: "back" as const },
    ]);
    setTiles(shuffle(built));
    setMatched(new Set());
    setSelected(null);
    setWrong(null);
    setElapsed(0);
    setFinished(false);
    setRecord(false);
    startRef.current = Date.now();
    setRunning(true);
  }

  useEffect(() => {
    newRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 100);
    return () => clearInterval(t);
  }, [running]);

  function handleTile(tile: Tile) {
    if (matched.has(tile.id) || finished) return;
    if (!selected) {
      setSelected(tile.id);
      return;
    }
    if (selected === tile.id) {
      setSelected(null);
      return;
    }
    const a = tiles.find((t) => t.id === selected)!;
    if (a.cardId === tile.cardId && a.side !== tile.side) {
      const next = new Set(matched).add(a.id).add(tile.id);
      setMatched(next);
      setSelected(null);
      if (next.size === tiles.length) {
        const finalTime = (Date.now() - startRef.current) / 1000;
        setElapsed(finalTime);
        setRunning(false);
        setFinished(true);
        setRecord(recordBest("match", deckId, Math.round(finalTime * 10) / 10, true));
      }
    } else {
      // Brief red flash on a mismatch.
      setWrong(tile.id);
      const bad = selected;
      setTimeout(() => {
        setWrong(null);
        setSelected(null);
        void bad;
      }, 500);
    }
  }

  const best = getBest("match", deckId);

  if (pool.length < 2) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Add at least 2 text cards to this deck to play Match.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Timer className="h-4 w-4 text-violet-500" />
          {elapsed.toFixed(1)}s
        </span>
        {best != null && (
          <span className="flex items-center gap-1.5 text-sm text-slate-400">
            <Trophy className="h-4 w-4 text-amber-500" />
            Best {best.toFixed(1)}s
          </span>
        )}
      </div>

      {finished ? (
        <div className="animate-flip-in rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-10 text-center shadow-md">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="font-display text-2xl font-semibold text-slate-800 dark:text-slate-100">{elapsed.toFixed(1)}s</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {record ? "New best time! 🎉" : "Matched them all!"}
          </p>
          <button
            onClick={newRound}
            className="mt-5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
          >
            Play again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {tiles.map((tile) => {
            const isMatched = matched.has(tile.id);
            const isSelected = selected === tile.id;
            const isWrong = wrong === tile.id || (wrong && selected === tile.id);
            return (
              <button
                key={tile.id}
                onClick={() => handleTile(tile)}
                disabled={isMatched}
                className={`flex min-h-[84px] items-center justify-center rounded-xl border p-3 text-center text-sm font-medium transition-all ${
                  isMatched
                    ? "invisible"
                    : isWrong
                      ? "border-red-300 bg-red-50 text-red-600"
                      : isSelected
                        ? "border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-200"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-violet-300 hover:bg-violet-50/40"
                }`}
              >
                {tile.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
