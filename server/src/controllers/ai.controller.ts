import Anthropic from "@anthropic-ai/sdk";
import type { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";
import {
  explainDifferently,
  generateFlashcardsFromNotes,
  summarizeNote,
  tutorChatReply,
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
    text = note.contentMarkdown;
  }
  if (!text || !text.trim()) {
    res.status(400).json({ error: "No note text provided" });
    return;
  }

  try {
    const cards = await generateFlashcardsFromNotes(text, count ?? 10);
    const created = await prisma.$transaction(
      cards.map((c) => prisma.flashcard.create({ data: { front: c.front, back: c.back, deckId } })),
    );
    res.status(201).json(created);
  } catch (err) {
    handleClaudeError(err);
  }
}

const tutorChatSchema = z.object({
  classId: z.string(),
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .default([]),
});

export async function postTutorChat(req: Request, res: Response) {
  const parsed = tutorChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { classId, message, history } = parsed.data;
  const classFolder = await getOwnedClassFolder(req.userId, classId);

  const notes = await prisma.note.findMany({
    where: { classFolderId: classId },
    select: { title: true, contentMarkdown: true },
  });
  const classContext = notes
    .map((n) => `## ${n.title}\n${n.contentMarkdown}`)
    .join("\n\n")
    .slice(0, 20000);

  try {
    const reply = await tutorChatReply(classFolder.name, classContext, history, message);
    res.json({ reply });
  } catch (err) {
    handleClaudeError(err);
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
    const summary = await summarizeNote(note.contentMarkdown);
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
