import { describe, expect, it } from "vitest";
import { COLLEGE_GRADE, currentGrade, gradeLabel } from "./gradeLevel.js";

describe("currentGrade (school-year auto-advance)", () => {
  it("keeps the same grade within the same school year", () => {
    const set = new Date("2026-03-01"); // spring, school year 2025
    const now = new Date("2026-05-01"); // still spring 2025 school year
    expect(currentGrade(9, set, now)).toBe(9);
  });

  it("advances one grade after the August rollover", () => {
    const set = new Date("2026-03-01"); // school year 2025
    const now = new Date("2026-09-01"); // school year 2026
    expect(currentGrade(9, set, now)).toBe(10);
  });

  it("advances multiple grades across multiple years", () => {
    const set = new Date("2024-09-01"); // school year 2024
    const now = new Date("2026-09-01"); // school year 2026 → +2
    expect(currentGrade(9, set, now)).toBe(11);
  });

  it("caps at the college level and never regresses", () => {
    const set = new Date("2020-09-01");
    const now = new Date("2030-09-01");
    expect(currentGrade(11, set, now)).toBe(COLLEGE_GRADE);
  });

  it("does not advance a college/other grade", () => {
    const set = new Date("2024-09-01");
    const now = new Date("2027-09-01");
    expect(currentGrade(COLLEGE_GRADE, set, now)).toBe(COLLEGE_GRADE);
  });

  it("labels grades and college correctly", () => {
    expect(gradeLabel(9)).toBe("Grade 9");
    expect(gradeLabel(COLLEGE_GRADE)).toBe("College / other");
    expect(gradeLabel(null)).toBeNull();
  });
});
