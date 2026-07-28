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

// Maps common unit spellings and symbols to one canonical token, so that
// "m/s", "meters per second", and "metres/second" all compare as equal.
// Word forms are mapped to their symbol; bare symbols are left as-is.
const UNIT_CANON: [RegExp, string][] = [
  [/\b(?:meters?|metres?)\s+per\s+second\s+squared\b/g, " m/s2 "],
  [/\bm\/s(?:2|²)\b/g, " m/s2 "],
  [/\b(?:meters?|metres?)\s+per\s+second\b/g, " m/s "],
  [/\b(?:kilometers?|kilometres?)\s+per\s+hour\b/g, " km/h "],
  [/\b(?:miles?)\s+per\s+hour\b/g, " mph "],
  [/\b(?:kilograms?)\b/g, " kg "],
  [/\b(?:milligrams?)\b/g, " mg "],
  [/\b(?:grams?)\b/g, " g "],
  [/\b(?:kilometers?|kilometres?)\b/g, " km "],
  [/\b(?:centimeters?|centimetres?)\b/g, " cm "],
  [/\b(?:millimeters?|millimetres?)\b/g, " mm "],
  [/\b(?:meters?|metres?)\b/g, " m "],
  [/\b(?:seconds?)\b/g, " s "],
  [/\b(?:minutes?)\b/g, " min "],
  [/\b(?:hours?)\b/g, " h "],
  [/\b(?:newtons?)\b/g, " n "],
  [/\b(?:joules?)\b/g, " j "],
  [/\b(?:watts?)\b/g, " w "],
  [/\b(?:liters?|litres?)\b/g, " l "],
  [/\b(?:moles?)\b/g, " mol "],
  [/\b(?:degrees?)\s+(?:celsius|c)\b/g, " °c "],
  [/\b(?:degrees?)\s+(?:fahrenheit|f)\b/g, " °f "],
];

function canonUnits(text: string): string {
  let t = ` ${text} `;
  for (const [re, rep] of UNIT_CANON) t = t.replace(re, rep);
  return t.replace(/\s+/g, " ").trim();
}

// Canonical unit tokens (plus a few symbols students commonly type) — used to
// recognize when the leftover part of a numeric answer is really just a unit.
const KNOWN_UNITS = new Set([
  "m/s2", "m/s", "km/h", "mph", "kg", "mg", "g", "km", "cm", "mm", "m", "s",
  "min", "h", "n", "j", "w", "l", "mol", "°c", "°f", "kph", "kmh", "sec",
  "secs", "hr", "hrs", "ml", "hz", "pa", "kpa", "v",
]);

function isJustAUnit(text: string): boolean {
  const t = text.trim();
  if (!t) return true; // no unit at all
  return KNOWN_UNITS.has(canonUnits(t));
}

/**
 * If the expected answer is a quantity — a number optionally followed by a
 * unit — returns that numeric value, else null. "9.8", "9.8 m/s", and
 * "9.8 meters per second" all yield 9.8; "5 apples" yields null so we don't
 * accept a wrong noun.
 */
function quantityValue(text: string): number | null {
  const m = text.toLowerCase().trim().replace(/,/g, "").match(/^([-+]?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  return isJustAUnit(m[2]) ? parseFloat(m[1]) : null;
}

/** The leading number of a student's answer, ignoring any trailing unit. */
function leadingNumber(text: string): number | null {
  const m = text.toLowerCase().trim().replace(/,/g, "").match(/^[-+]?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Forgiving comparison for typed answers: case/punctuation/article
 * insensitive, one typo allowed on answers of 5+ characters, and — so students
 * aren't marked wrong for leaving off or reformatting units — a matching
 * numeric value counts (e.g. "9.8" for "9.8 meters per second"), and unit
 * words match their symbols ("m/s" ≈ "meters per second").
 */
export function fuzzyAnswerMatch(expected: string, given: string): boolean {
  const a = normalize(expected);
  const b = normalize(given);
  if (!a || !b) return false;
  if (a === b) return true;

  // Quantities: accept the right number even if the unit is dropped or written
  // differently. Only applies when the expected answer really is a quantity.
  const expectedValue = quantityValue(expected);
  if (expectedValue !== null && leadingNumber(given) === expectedValue) return true;

  // Units written differently ("m/s" vs "meters per second").
  if (canonUnits(a) === canonUnits(b)) return true;

  return a.length >= 5 && levenshtein(a, b) <= 1;
}
