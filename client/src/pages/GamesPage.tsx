import { Gamepad2, Layers, Timer, Trophy, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { DeckSummary } from "../api/types";
import { AppShell } from "../components/layout/AppShell";
import { getBest, type GameId } from "../lib/gameScores";
import { classGradient } from "../lib/classColors";

const GAMES: { id: GameId; name: string; blurb: string; icon: typeof Zap; emoji: string }[] = [
  { id: "match", name: "Match", blurb: "Pair terms to definitions against the clock", icon: Timer, emoji: "🎯" },
  { id: "speed", name: "Speed round", blurb: "Answer as many as you can in 60 seconds", icon: Zap, emoji: "⚡" },
  { id: "blocks", name: "Answer Blocks", blurb: "Catch the right answer before it drops", icon: Gamepad2, emoji: "🧱" },
];

export function GamesPage() {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [selected, setSelected] = useState<DeckSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DeckSummary[]>("/decks")
      .then((d) => setDecks(d.filter((deck) => deck.cardCount >= 2)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load decks"));
  }, []);

  return (
    <AppShell>
      <h1 className="font-display mb-1 flex items-center gap-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
        <Gamepad2 className="h-6 w-6 text-violet-500" />
        Games
      </h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Turn any flashcard deck into a game. Pick a deck, then choose how you want to play.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {decks.length === 0 && !error && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No decks with cards yet — add a flashcard deck to a class first, then come back to play.
        </p>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        {decks.map((deck) => {
          const g = classGradient(deck.colorTag, "b");
          const active = selected?.id === deck.id;
          return (
            <button
              key={deck.id}
              onClick={() => setSelected(deck)}
              className={`relative overflow-hidden rounded-xl border bg-white dark:bg-slate-800 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                active ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <div className={`absolute inset-y-0 left-0 w-1.5 ${g.className}`} style={g.style} />
              <div className="pl-2">
                <p className="font-medium text-slate-700 dark:text-slate-200">{deck.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  <span>{deck.className}</span>
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {deck.cardCount}
                  </span>
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="animate-flip-in">
          <h2 className="font-display mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Play “{selected.name}”
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {GAMES.map((game) => {
              const best = getBest(game.id, selected.id);
              return (
                <Link
                  key={game.id}
                  to={`/games/${selected.id}/${game.id}`}
                  className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
                >
                  <div className="mb-2 text-2xl">{game.emoji}</div>
                  <p className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-violet-700">
                    {game.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{game.blurb}</p>
                  {best != null && (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-600">
                      <Trophy className="h-3 w-3" />
                      Best: {game.id === "match" ? `${best}s` : best}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
