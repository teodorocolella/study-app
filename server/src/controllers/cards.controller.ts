import type { Request, Response } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { prisma } from "../prisma.js";
import { getOwnedDeck, getOwnedFlashcard } from "../services/ownership.service.js";

export async function listCards(req: Request, res: Response) {
  const deckId = param(req, "deckId");
  await getOwnedDeck(req.userId, deckId);
  const cards = await prisma.flashcard.findMany({
    where: { deckId },
    orderBy: { createdAt: "asc" },
  });
  res.json(cards);
}

const createSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
});

export async function createCard(req: Request, res: Response) {
  const deckId = param(req, "deckId");
  await getOwnedDeck(req.userId, deckId);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const card = await prisma.flashcard.create({
    data: { ...parsed.data, deckId },
  });
  res.status(201).json(card);
}

const updateSchema = z.object({
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
});

export async function updateCard(req: Request, res: Response) {
  const cardId = param(req, "cardId");
  await getOwnedFlashcard(req.userId, cardId);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const card = await prisma.flashcard.update({
    where: { id: cardId },
    data: parsed.data,
  });
  res.json(card);
}

export async function deleteCard(req: Request, res: Response) {
  const cardId = param(req, "cardId");
  await getOwnedFlashcard(req.userId, cardId);
  await prisma.flashcard.delete({ where: { id: cardId } });
  res.status(204).send();
}
