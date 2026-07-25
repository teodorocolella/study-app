// Best game scores kept in localStorage, keyed by deck + game.
// Match tracks a best time (lower is better); the others track a high score.

export type GameId = "match" | "speed" | "blocks";

function key(gameId: GameId, deckId: string) {
  return `game.best.${gameId}.${deckId}`;
}

export function getBest(gameId: GameId, deckId: string): number | null {
  const raw = localStorage.getItem(key(gameId, deckId));
  return raw != null ? Number(raw) : null;
}

/**
 * Records a result if it beats the stored best. `lowerIsBetter` for time-based
 * games (Match). Returns true when a new record was set.
 */
export function recordBest(
  gameId: GameId,
  deckId: string,
  value: number,
  lowerIsBetter: boolean,
): boolean {
  const current = getBest(gameId, deckId);
  const isBetter = current == null || (lowerIsBetter ? value < current : value > current);
  if (isBetter) localStorage.setItem(key(gameId, deckId), String(value));
  return isBetter;
}
