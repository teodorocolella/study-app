import { prisma } from "../prisma.js";
import { computeNextSchedule, type SM2State } from "../lib/spacedRepetition.js";

export const GRADE_LABELS = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
} as const;

export type GradeLabel = keyof typeof GRADE_LABELS;

interface DueCardsFilter {
  classId?: string;
  deckId?: string;
}

export async function getDueCards(userId: string, filter: DueCardsFilter = {}) {
  const now = new Date();
  const cards = await prisma.flashcard.findMany({
    where: {
      deck: {
        ...(filter.deckId ? { id: filter.deckId } : {}),
        classFolder: {
          userId,
          ...(filter.classId ? { id: filter.classId } : {}),
        },
      },
    },
    include: {
      progress: { where: { userId } },
      deck: { select: { id: true, name: true, classFolderId: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return cards.filter((card) => {
    const progress = card.progress[0];
    return !progress || progress.dueDate <= now;
  });
}

export async function submitReview(userId: string, cardId: string, grade: number) {
  const now = new Date();
  const existing = await prisma.cardProgress.findUnique({
    where: { cardId_userId: { cardId, userId } },
  });

  const state: SM2State = existing
    ? {
        easeFactor: existing.easeFactor,
        intervalDays: existing.intervalDays,
        repetitions: existing.repetitions,
      }
    : { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

  const result = computeNextSchedule(state, grade, now);

  const progress = await prisma.cardProgress.upsert({
    where: { cardId_userId: { cardId, userId } },
    create: {
      cardId,
      userId,
      easeFactor: result.easeFactor,
      intervalDays: result.intervalDays,
      repetitions: result.repetitions,
      dueDate: result.dueDate,
      lastReviewedAt: now,
    },
    update: {
      easeFactor: result.easeFactor,
      intervalDays: result.intervalDays,
      repetitions: result.repetitions,
      dueDate: result.dueDate,
      lastReviewedAt: now,
    },
  });

  await prisma.reviewLog.create({ data: { userId, cardId, grade, reviewedAt: now } });

  return progress;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function getDashboardSummary(userId: string) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = addDays(startOfToday, -6);

  const [classFolders, dueCards, reviewLogs] = await Promise.all([
    prisma.classFolder.findMany({ where: { userId }, select: { id: true, name: true, colorTag: true } }),
    getDueCards(userId),
    prisma.reviewLog.findMany({
      where: { userId, reviewedAt: { gte: addDays(startOfToday, -365) } },
      select: { reviewedAt: true },
    }),
  ]);

  const dueCountByClass = new Map<string, number>();
  for (const card of dueCards) {
    const classId = card.deck.classFolderId;
    dueCountByClass.set(classId, (dueCountByClass.get(classId) ?? 0) + 1);
  }

  const studiedDays = new Set(reviewLogs.map((log) => toDateKey(log.reviewedAt)));
  const studiedToday = reviewLogs.filter((log) => log.reviewedAt >= startOfToday).length;
  const studiedThisWeek = reviewLogs.filter((log) => log.reviewedAt >= startOfWeek).length;

  let streakCursor = studiedDays.has(toDateKey(now)) ? now : addDays(now, -1);
  let streak = 0;
  while (studiedDays.has(toDateKey(streakCursor))) {
    streak++;
    streakCursor = addDays(streakCursor, -1);
  }

  return {
    classes: classFolders.map((cf) => ({
      classId: cf.id,
      name: cf.name,
      colorTag: cf.colorTag,
      dueCount: dueCountByClass.get(cf.id) ?? 0,
    })),
    totalDue: dueCards.length,
    studiedToday,
    studiedThisWeek,
    streak,
  };
}
