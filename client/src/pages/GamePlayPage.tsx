import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Deck, Flashcard } from "../api/types";
import { BlocksGame } from "../components/games/BlocksGame";
import { MatchGame } from "../components/games/MatchGame";
import { SpeedGame } from "../components/games/SpeedGame";
import { AppShell } from "../components/layout/AppShell";
import type { GameId } from "../lib/gameScores";

const GAME_NAMES: Record<GameId, string> = {
  match: "Match",
  speed: "Speed round",
  blocks: "Answer Blocks",
};

export function GamePlayPage() {
  const { deckId, gameId } = useParams<{ deckId: string; gameId: GameId }>();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deckId) return;
    Promise.all([
      api.get<Deck>(`/decks/${deckId}`),
      api.get<Flashcard[]>(`/decks/${deckId}/cards`),
    ])
      .then(([d, c]) => {
        setDeck(d);
        setCards(c);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [deckId]);

  const validGame = gameId && gameId in GAME_NAMES;

  return (
    <AppShell>
      <Link
        to="/games"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to games
      </Link>

      <h1 className="font-display mt-2 mb-6 text-2xl font-semibold text-slate-800 dark:text-slate-100">
        {validGame ? GAME_NAMES[gameId as GameId] : "Game"}
        {deck && <span className="text-slate-400"> · {deck.name}</span>}
      </h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : !validGame || !deckId ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Unknown game.</p>
      ) : gameId === "match" ? (
        <MatchGame deckId={deckId} cards={cards} />
      ) : gameId === "speed" ? (
        <SpeedGame deckId={deckId} cards={cards} />
      ) : (
        <BlocksGame deckId={deckId} cards={cards} />
      )}
    </AppShell>
  );
}
