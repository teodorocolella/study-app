export interface SM2State {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SM2Result extends SM2State {
  dueDate: Date;
}

export function computeNextSchedule(
  state: SM2State,
  grade: number,
  now: Date = new Date(),
): SM2Result {
  const newEase = Math.max(
    1.3,
    state.easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
  );

  if (grade < 3) {
    return {
      easeFactor: newEase,
      intervalDays: 1,
      repetitions: 0,
      dueDate: addDays(now, 1),
    };
  }

  const newReps = state.repetitions + 1;
  let newInterval: number;
  if (newReps === 1) newInterval = 1;
  else if (newReps === 2) newInterval = 6;
  else newInterval = Math.round(state.intervalDays * newEase);

  return {
    easeFactor: newEase,
    intervalDays: newInterval,
    repetitions: newReps,
    dueDate: addDays(now, newInterval),
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
