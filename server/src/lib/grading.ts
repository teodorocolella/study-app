// Auto-grading for exercise types that don't need AI.

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(the|a|an) /, "");
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }
  return dist[rows - 1][cols - 1];
}

/**
 * Forgiving comparison for typed answers: case/punctuation/article
 * insensitive, and one typo is allowed on answers of 5+ characters.
 */
export function fuzzyAnswerMatch(expected: string, given: string): boolean {
  const a = normalize(expected);
  const b = normalize(given);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 5 && levenshtein(a, b) <= 1;
}
