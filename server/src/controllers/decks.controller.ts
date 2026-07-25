import type { Request, Response } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { prisma } from "../prisma.js";
import { getOwnedClassFolder, getOwnedDeck } from "../services/ownership.service.js";

export async function listDecks(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const decks = await prisma.deck.findMany({
    where: { classFolderId: classId },
    include: { _count: { select: { cards: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(decks);
}

// All of a user's decks across every class — powers the games deck picker.
export async function listAllDecks(req: Request, res: Response) {
  const decks = await prisma.deck.findMany({
    where: { classFolder: { userId: req.userId } },
    include: {
      _count: { select: { cards: true } },
      classFolder: { select: { name: true, colorTag: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    decks.map((d) => ({
      id: d.id,
      name: d.name,
      classFolderId: d.classFolderId,
      className: d.classFolder.name,
      colorTag: d.classFolder.colorTag,
      cardCount: d._count.cards,
    })),
  );
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function createDeck(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const deck = await prisma.deck.create({
    data: { ...parsed.data, classFolderId: classId },
  });
  res.status(201).json(deck);
}

export async function getDeck(req: Request, res: Response) {
  const deckId = param(req, "deckId");
  await getOwnedDeck(req.userId, deckId);
  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    include: { _count: { select: { cards: true } } },
  });
  res.json(deck);
}

const updateSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function updateDeck(req: Request, res: Response) {
  const deckId = param(req, "deckId");
  await getOwnedDeck(req.userId, deckId);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const deck = await prisma.deck.update({
    where: { id: deckId },
    data: parsed.data,
  });
  res.json(deck);
}

export async function deleteDeck(req: Request, res: Response) {
  const deckId = param(req, "deckId");
  await getOwnedDeck(req.userId, deckId);
  await prisma.deck.delete({ where: { id: deckId } });
  res.status(204).send();
}
