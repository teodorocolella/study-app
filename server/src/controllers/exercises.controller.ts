import Anthropic from "@anthropic-ai/sdk";
import type { Request, Response } from "express";
import { z } from "zod";
import { fuzzyAnswerMatch } from "../lib/grading.js";
import { folderFilter, param } from "../lib/params.js";
import { ApiError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";
import {
  EXERCISE_TYPES,
  gradeShortAnswers,
  type ShortAnswerSubmission,
} from "../services/claude.service.js";
import {
  getOwnedClassFolder,
  getOwnedExercise,
  getOwnedExerciseSet,
  getOwnedFolder,
} from "../services/ownership.service.js";

function parseOptions(optionsJson: string | null): string[] | null {
  if (!optionsJson) return null;
  try {
    return JSON.parse(optionsJson) as string[];
  } catch {
    return null;
  }
}

function exerciseDto(exercise: {
  id: string;
  setId: string;
  type: string;
  prompt: string;
  optionsJson: string | null;
  answer: string;
  explanation: string | null;
  position: number;
}) {
  return {
    id: exercise.id,
    setId: exercise.setId,
    type: exercise.type,
    prompt: exercise.prompt,
    options: parseOptions(exercise.optionsJson),
    answer: exercise.answer,
    explanation: exercise.explanation,
    position: exercise.position,
  };
}

// --- Sets ---

export async function listExerciseSets(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);

  const sets = await prisma.exerciseSet.findMany({
    where: { classFolderId: classId, ...folderFilter(req) },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { exercises: true } },
      attempts: {
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { score: true, total: true, createdAt: true },
      },
    },
  });

  res.json(
    sets.map((set) => ({
      id: set.id,
      name: set.name,
      colorTag: set.colorTag,
      folderId: set.folderId,
      classFolderId: set.classFolderId,
      createdAt: set.createdAt,
      exerciseCount: set._count.exercises,
      lastAttempt: set.attempts[0] ?? null,
    })),
  );
}

const createSetSchema = z.object({
  name: z.string().min(1).max(120),
  folderId: z.string().nullish(),
  colorTag: z.string().max(40).nullish(),
});

async function assertFolderInClass(userId: string, folderId: string, classId: string) {
  const folder = await getOwnedFolder(userId, folderId);
  if (folder.classFolderId !== classId) {
    throw new ApiError(400, "That folder belongs to a different class");
  }
}

export async function createExerciseSet(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);

  const parsed = createSetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  if (parsed.data.folderId) await assertFolderInClass(req.userId, parsed.data.folderId, classId);
  const set = await prisma.exerciseSet.create({
    data: {
      name: parsed.data.name,
      classFolderId: classId,
      folderId: parsed.data.folderId ?? null,
      colorTag: parsed.data.colorTag ?? null,
    },
  });
  res.status(201).json(set);
}

export async function getExerciseSet(req: Request, res: Response) {
  const setId = param(req, "setId");
  const set = await getOwnedExerciseSet(req.userId, setId);

  const [exercises, attempts] = await Promise.all([
    prisma.exercise.findMany({
      where: { setId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.exerciseAttempt.findMany({
      where: { setId, userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, score: true, total: true, createdAt: true },
    }),
  ]);

  res.json({
    id: set.id,
    name: set.name,
    classFolderId: set.classFolderId,
    createdAt: set.createdAt,
    exercises: exercises.map(exerciseDto),
    attempts,
  });
}

const updateSetSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  folderId: z.string().nullish(),
  colorTag: z.string().max(40).nullish(),
});

export async function updateExerciseSet(req: Request, res: Response) {
  const setId = param(req, "setId");
  const existing = await getOwnedExerciseSet(req.userId, setId);

  const parsed = updateSetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  if (parsed.data.folderId) {
    await assertFolderInClass(req.userId, parsed.data.folderId, existing.classFolderId);
  }
  const set = await prisma.exerciseSet.update({
    where: { id: setId },
    data: parsed.data,
  });
  res.json(set);
}

export async function deleteExerciseSet(req: Request, res: Response) {
  const setId = param(req, "setId");
  await getOwnedExerciseSet(req.userId, setId);
  await prisma.exerciseSet.delete({ where: { id: setId } });
  res.status(204).end();
}

// --- Individual exercises (manual authoring) ---

const exerciseInputSchema = z
  .object({
    type: z.enum(EXERCISE_TYPES),
    prompt: z.string().min(1).max(2000),
    options: z.array(z.string().min(1).max(500)).min(2).max(6).nullish(),
    answer: z.string().min(1).max(4000),
    explanation: z.string().max(4000).nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "mcq") {
      if (!data.options) {
        ctx.addIssue({ code: "custom", message: "Multiple choice needs answer options" });
      } else if (!data.options.includes(data.answer)) {
        ctx.addIssue({ code: "custom", message: "The answer must be one of the options" });
      }
    }
    if (data.type === "true_false" && !["true", "false"].includes(data.answer.toLowerCase())) {
      ctx.addIssue({ code: "custom", message: 'True/false answer must be "true" or "false"' });
    }
  });

export async function createExercise(req: Request, res: Response) {
  const setId = param(req, "setId");
  await getOwnedExerciseSet(req.userId, setId);

  const parsed = exerciseInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { type, prompt, options, answer, explanation } = parsed.data;

  const last = await prisma.exercise.findFirst({
    where: { setId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const exercise = await prisma.exercise.create({
    data: {
      setId,
      type,
      prompt,
      optionsJson: type === "mcq" && options ? JSON.stringify(options) : null,
      answer: type === "true_false" ? answer.toLowerCase() : answer,
      explanation: explanation ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });
  res.status(201).json(exerciseDto(exercise));
}

export async function updateExercise(req: Request, res: Response) {
  const exerciseId = param(req, "exerciseId");
  await getOwnedExercise(req.userId, exerciseId);

  const parsed = exerciseInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { type, prompt, options, answer, explanation } = parsed.data;

  const exercise = await prisma.exercise.update({
    where: { id: exerciseId },
    data: {
      type,
      prompt,
      optionsJson: type === "mcq" && options ? JSON.stringify(options) : null,
      answer: type === "true_false" ? answer.toLowerCase() : answer,
      explanation: explanation ?? null,
    },
  });
  res.json(exerciseDto(exercise));
}

export async function deleteExercise(req: Request, res: Response) {
  const exerciseId = param(req, "exerciseId");
  await getOwnedExercise(req.userId, exerciseId);
  await prisma.exercise.delete({ where: { id: exerciseId } });
  res.status(204).end();
}

// --- Attempts (server-side grading) ---

const attemptSchema = z.object({
  answers: z
    .array(z.object({ exerciseId: z.string(), answer: z.string().max(4000) }))
    .min(1)
    .max(100),
});

export async function submitAttempt(req: Request, res: Response) {
  const setId = param(req, "setId");
  await getOwnedExerciseSet(req.userId, setId);

  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const exercises = await prisma.exercise.findMany({ where: { setId } });
  const byId = new Map(exercises.map((e) => [e.id, e]));

  interface ResultRow {
    exerciseId: string;
    type: string;
    prompt: string;
    options: string[] | null;
    userAnswer: string;
    correctAnswer: string;
    correct: boolean;
    explanation: string | null;
    feedback: string | null;
  }

  const results: ResultRow[] = [];
  const shortAnswerBatch: ShortAnswerSubmission[] = [];

  for (const { exerciseId, answer } of parsed.data.answers) {
    const exercise = byId.get(exerciseId);
    if (!exercise) throw new ApiError(400, "Answer for an exercise that isn't in this set");
    const given = answer.trim();

    const row: ResultRow = {
      exerciseId,
      type: exercise.type,
      prompt: exercise.prompt,
      options: parseOptions(exercise.optionsJson),
      userAnswer: given,
      correctAnswer: exercise.answer,
      correct: false,
      explanation: exercise.explanation,
      feedback: null,
    };

    if (!given) {
      row.feedback = "No answer given.";
    } else if (exercise.type === "mcq") {
      row.correct = given === exercise.answer;
    } else if (exercise.type === "true_false") {
      row.correct = given.toLowerCase() === exercise.answer.toLowerCase();
    } else if (exercise.type === "fill_blank") {
      row.correct = fuzzyAnswerMatch(exercise.answer, given);
    } else if (exercise.type === "short_answer") {
      shortAnswerBatch.push({
        index: results.length,
        question: exercise.prompt,
        modelAnswer: exercise.answer,
        studentAnswer: given,
      });
    }
    results.push(row);
  }

  if (shortAnswerBatch.length > 0) {
    try {
      const grades = await gradeShortAnswers(shortAnswerBatch);
      for (const grade of grades) {
        const row = results[grade.index];
        if (row && row.type === "short_answer") {
          row.correct = grade.correct;
          row.feedback = grade.feedback;
        }
      }
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new ApiError(502, "The AI grader is temporarily unavailable. Please submit again in a moment.");
      }
      throw err;
    }
  }

  const score = results.filter((r) => r.correct).length;
  const attempt = await prisma.exerciseAttempt.create({
    data: {
      setId,
      userId: req.userId,
      score,
      total: results.length,
      resultsJson: JSON.stringify(results),
    },
  });

  res.status(201).json({
    attemptId: attempt.id,
    score,
    total: results.length,
    results,
    createdAt: attempt.createdAt,
  });
}
