import Anthropic from "@anthropic-ai/sdk";
import type { Request, Response } from "express";
import { z } from "zod";
import { paragraphsToHtml, stripHtml } from "../lib/html.js";
import { ApiError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";
import { runAssistant, type AssistantEvent } from "../services/assistant.service.js";
import {
  EXERCISE_TYPES,
  explainDifferently,
  extractNoteFromSource,
  generateExercisesFromNotes,
  generateFlashcardsFromNotes,
  type ImportSource,
  summarizeNote,
} from "../services/claude.service.js";
import {
  getOwnedClassFolder,
  getOwnedDeck,
  getOwnedFlashcard,
  getOwnedNote,
} from "../services/ownership.service.js";

function handleClaudeError(err: unknown): never {
  if (err instanceof Anthropic.APIError) {
    throw new ApiError(502, "The AI tutor is temporarily unavailable. Please try again in a moment.");
  }
  throw err;
}

const generateFlashcardsSchema = z.object({
  noteId: z.string().optional(),
  rawText: z.string().optional(),
  deckId: z.string(),
  count: z.number().int().min(1).max(30).optional(),
});

export async function postGenerateFlashcards(req: Request, res: Response) {
  const parsed = generateFlashcardsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { noteId, rawText, deckId, count } = parsed.data;
  await getOwnedDeck(req.userId, deckId);

  let text = rawText;
  if (noteId) {
    const note = await getOwnedNote(req.userId, noteId);
    text = stripHtml(note.contentHtml);
  }
  if (!text || !text.trim()) {
    res.status(400).json({ error: "No note text provided" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { gradeLevel: true },
  });

  try {
    const cards = await generateFlashcardsFromNotes(text, count ?? 10, user?.gradeLevel);
    const created = await prisma.$transaction(
      cards.map((c) => prisma.flashcard.create({ data: { front: c.front, back: c.back, deckId } })),
    );
    res.status(201).json(created);
  } catch (err) {
    handleClaudeError(err);
  }
}

const generateExercisesSchema = z.object({
  noteId: z.string().optional(),
  rawText: z.string().optional(),
  classId: z.string(),
  setName: z.string().min(1).max(120).optional(),
  types: z.array(z.enum(EXERCISE_TYPES)).min(1).default([...EXERCISE_TYPES]),
  count: z.number().int().min(3).max(25).optional(),
});

export async function postGenerateExercises(req: Request, res: Response) {
  const parsed = generateExercisesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { noteId, rawText, classId, setName, types, count } = parsed.data;
  await getOwnedClassFolder(req.userId, classId);

  let text = rawText;
  let defaultName = "Practice quiz";
  if (noteId) {
    const note = await getOwnedNote(req.userId, noteId);
    text = stripHtml(note.contentHtml);
    defaultName = `${note.title} practice`;
  }
  if (!text || !text.trim()) {
    res.status(400).json({ error: "No note text provided" });
    return;
  }

  const gradeUser = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { gradeLevel: true },
  });

  try {
    const generated = await generateExercisesFromNotes(text, types, count ?? 10, gradeUser?.gradeLevel);
    const set = await prisma.exerciseSet.create({
      data: {
        name: setName ?? defaultName,
        classFolderId: classId,
        exercises: {
          create: generated.map((e, i) => ({
            type: e.type,
            prompt: e.prompt,
            optionsJson: e.type === "mcq" && e.options ? JSON.stringify(e.options) : null,
            answer: e.type === "true_false" ? e.answer.toLowerCase() : e.answer,
            explanation: e.explanation,
            position: i,
          })),
        },
      },
      include: { _count: { select: { exercises: true } } },
    });
    res.status(201).json({
      id: set.id,
      name: set.name,
      classFolderId: set.classFolderId,
      exerciseCount: set._count.exercises,
    });
  } catch (err) {
    handleClaudeError(err);
  }
}

const importSchema = z
  .object({
    classId: z.string(),
    text: z.string().max(50000).optional(),
    dataUrl: z
      .string()
      .max(12_000_000)
      .regex(/^data:(image\/(png|jpeg|jpg|webp|gif)|application\/pdf);base64,/, "Unsupported file")
      .optional(),
    makeDeck: z.boolean().default(true),
    makeQuiz: z.boolean().default(true),
    quizTypes: z.array(z.enum(EXERCISE_TYPES)).min(1).default([...EXERCISE_TYPES]),
  })
  .refine((d) => (d.text && d.text.trim()) || d.dataUrl, {
    message: "Paste some text or upload a file",
  });

function sourceFromInput(text?: string, dataUrl?: string): ImportSource {
  if (dataUrl) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)!;
    const mime = match[1];
    const data = match[2];
    if (mime === "application/pdf") return { kind: "pdf", data };
    const mediaType = (mime === "image/jpg" ? "image/jpeg" : mime) as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";
    return { kind: "image", mediaType, data };
  }
  return { kind: "text", text: text! };
}

export async function postImportContent(req: Request, res: Response) {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { classId, text, dataUrl, makeDeck, makeQuiz, quizTypes } = parsed.data;
  const classFolder = await getOwnedClassFolder(req.userId, classId);
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { gradeLevel: true },
  });
  const grade = user?.gradeLevel;

  try {
    const source = sourceFromInput(text, dataUrl);
    const { title, content } = await extractNoteFromSource(source, grade);

    const note = await prisma.note.create({
      data: { title, contentHtml: paragraphsToHtml(content), classFolderId: classId },
    });

    const result: {
      classId: string;
      note: { id: string; title: string };
      deck?: { id: string; count: number };
      quiz?: { id: string; count: number };
    } = { classId, note: { id: note.id, title } };

    if (makeDeck) {
      const cards = await generateFlashcardsFromNotes(content, 10, grade);
      const deck = await prisma.deck.create({
        data: {
          name: `${title} flashcards`,
          classFolderId: classId,
          cards: { create: cards.map((c) => ({ front: c.front, back: c.back })) },
        },
      });
      result.deck = { id: deck.id, count: cards.length };
    }

    if (makeQuiz) {
      const exercises = await generateExercisesFromNotes(content, quizTypes, 10, grade);
      const set = await prisma.exerciseSet.create({
        data: {
          name: `${title} quiz`,
          classFolderId: classId,
          exercises: {
            create: exercises.map((e, i) => ({
              type: e.type,
              prompt: e.prompt,
              optionsJson: e.type === "mcq" && e.options ? JSON.stringify(e.options) : null,
              answer: e.type === "true_false" ? e.answer.toLowerCase() : e.answer,
              explanation: e.explanation,
              position: i,
            })),
          },
        },
      });
      result.quiz = { id: set.id, count: exercises.length };
    }

    void classFolder;
    res.status(201).json(result);
  } catch (err) {
    handleClaudeError(err);
  }
}

const assistantSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(30)
    .default([]),
  page: z
    .object({
      path: z.string().max(300),
      classId: z.string().optional(),
      noteId: z.string().optional(),
      deckId: z.string().optional(),
    })
    .optional(),
});

export async function postAssistant(req: Request, res: Response) {
  const parsed = assistantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { message, history, page } = parsed.data;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event: AssistantEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await runAssistant(req.userId, history, message, page, send);
  } catch (err) {
    const friendly =
      err instanceof Anthropic.APIError
        ? "The AI assistant is temporarily unavailable. Please try again in a moment."
        : "Something went wrong. Please try again.";
    send({ type: "error", message: friendly });
    if (!(err instanceof Anthropic.APIError)) {
      console.error("Assistant error:", err);
    }
  } finally {
    res.end();
  }
}

const summarizeSchema = z.object({ noteId: z.string() });

export async function postSummarizeNote(req: Request, res: Response) {
  const parsed = summarizeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const note = await getOwnedNote(req.userId, parsed.data.noteId);

  try {
    const summary = await summarizeNote(stripHtml(note.contentHtml));
    const updated = await prisma.note.update({ where: { id: note.id }, data: { aiSummary: summary } });
    res.json(updated);
  } catch (err) {
    handleClaudeError(err);
  }
}

const explainSchema = z.object({ cardId: z.string(), priorExplanation: z.string().optional() });

export async function postExplainDifferently(req: Request, res: Response) {
  const parsed = explainSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const card = await getOwnedFlashcard(req.userId, parsed.data.cardId);

  try {
    const explanation = await explainDifferently(card.front, card.back, parsed.data.priorExplanation);
    res.json({ explanation });
  } catch (err) {
    handleClaudeError(err);
  }
}
