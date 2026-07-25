export const COLLEGE_GRADE = 13;

export interface GradeOption {
  value: number;
  label: string;
}

// Study Hub targets middle school through college.
export const GRADE_OPTIONS: GradeOption[] = [
  ...Array.from({ length: 7 }, (_, i) => {
    const grade = i + 6; // 6th–12th
    return { value: grade, label: `${grade}th grade` };
  }),
  { value: COLLEGE_GRADE, label: "College / other" },
];

export function gradeLabel(gradeLevel: number | null | undefined): string | null {
  if (gradeLevel == null) return null;
  if (gradeLevel >= COLLEGE_GRADE) return "College / other";
  return `${gradeLevel}th grade`;
}
