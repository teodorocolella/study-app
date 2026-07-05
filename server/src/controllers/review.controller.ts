import type { Request, Response } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { getOwnedFlashcard } from "../services/ownership.service.js";
import {
  GRADE_LABELS,
  getDashboardSummary,
  getDueCards,
  submitReview,
} from "../services/review.service.js";

export async function getDueCardsAcrossClasses(req: Request, res: Response) {
  const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
  const cards = await getDueCards(req.userId, { classId });
  res.json(cards);
}

export async function getDueCardsForDeck(req: Request, res: Response) {
  const deckId = param(req, "deckId");
  const cards = await getDueCards(req.userId, { deckId });
  res.json(cards);
}

const reviewSchema = z.object({
  grade: z.union([
    z.number().int().min(0).max(5),
    z.enum(["again", "hard", "good", "easy"]),
  ]),
});

export async function postReview(req: Request, res: Response) {
  const cardId = param(req, "cardId");
  await getOwnedFlashcard(req.userId, cardId);

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const grade =
    typeof parsed.data.grade === "number" ? parsed.data.grade : GRADE_LABELS[parsed.data.grade];

  const progress = await submitReview(req.userId, cardId, grade);
  res.json(progress);
}

export async function getDashboard(req: Request, res: Response) {
  const summary = await getDashboardSummary(req.userId);
  res.json(summary);
}
