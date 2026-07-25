import { describe, expect, it } from "vitest";
import { computeNextSchedule, type SM2State } from "./spacedRepetition.js";

const fresh: SM2State = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };
const now = new Date("2026-01-01T00:00:00Z");

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

describe("computeNextSchedule (SM-2)", () => {
  it("resets to a 1-day interval on a failing grade", () => {
    const state: SM2State = { easeFactor: 2.5, intervalDays: 30, repetitions: 5 };
    const result = computeNextSchedule(state, 0, now);
    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
    expect(daysBetween(now, result.dueDate)).toBe(1);
  });

  it("schedules the first two successful reviews at 1 then 6 days", () => {
    const first = computeNextSchedule(fresh, 4, now);
    expect(first.repetitions).toBe(1);
    expect(first.intervalDays).toBe(1);

    const second = computeNextSchedule(first, 4, now);
    expect(second.repetitions).toBe(2);
    expect(second.intervalDays).toBe(6);
  });

  it("grows the interval by the ease factor from the third review on", () => {
    const state: SM2State = { easeFactor: 2.5, intervalDays: 6, repetitions: 2 };
    const result = computeNextSchedule(state, 4, now);
    // 6 * ~2.5 ≈ 15
    expect(result.intervalDays).toBe(15);
    expect(result.repetitions).toBe(3);
  });

  it("never lets the ease factor drop below 1.3", () => {
    let state: SM2State = { easeFactor: 1.3, intervalDays: 10, repetitions: 3 };
    for (let i = 0; i < 5; i++) {
      state = computeNextSchedule(state, 3, now);
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("raises the ease factor on an easy grade and lowers it on a hard grade", () => {
    const easy = computeNextSchedule(fresh, 5, now);
    expect(easy.easeFactor).toBeGreaterThan(2.5);
    const hard = computeNextSchedule(fresh, 3, now);
    expect(hard.easeFactor).toBeLessThan(2.5);
  });
});
