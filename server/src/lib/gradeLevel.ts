// Grade level auto-advances once per US school year (rolls over in August),
// so the app always knows the student's current grade without them re-entering it.

export const COLLEGE_GRADE = 13; // 13 = college / other; does not auto-advance

// A date's "school year" — August or later belongs to that calendar year's year.
function schoolYearIndex(date: Date): number {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
}

/**
 * Given the grade last entered and when, returns the student's grade today,
 * advancing one level per school-year boundary crossed (capped at college).
 */
export function currentGrade(gradeLevel: number, gradeUpdatedAt: Date, now = new Date()): number {
  if (gradeLevel >= COLLEGE_GRADE) return COLLEGE_GRADE;
  const yearsPassed = schoolYearIndex(now) - schoolYearIndex(gradeUpdatedAt);
  const advanced = gradeLevel + Math.max(0, yearsPassed);
  return Math.min(COLLEGE_GRADE, advanced);
}

export function gradeLabel(gradeLevel: number | null | undefined): string | null {
  if (gradeLevel == null) return null;
  if (gradeLevel >= COLLEGE_GRADE) return "College / other";
  return `Grade ${gradeLevel}`;
}
