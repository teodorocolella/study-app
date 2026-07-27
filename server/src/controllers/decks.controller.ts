import type { Request, Response } from "express";
import { z } from "zod";
import { folderFilter, param } from "../lib/params.js";
import { ApiError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";
import { getOwnedClassFolder, getOwnedDeck, getOwnedFolder } from "../services/ownership.service.js";

export async function listDecks(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const decks = await prisma.deck.findMany({
    where: { classFolderId: classId, ...folderFilter(req) },
    include: { _count: { select: { cards: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(decks);
}

async function assertFolderInClass(userId: string, folderId: string, classId: string) {
  const folder = await getOwnedFolder(userId, folderId);
  if (folder.classFolderId !== classId) {
    throw new ApiError(400, "That folder belongs to a different class");
  }
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
  folderId: z.string().nullish(),
});

export async function createDeck(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { folderId, ...rest } = parsed.data;
  if (folderId) await assertFolderInClass(req.userId, folderId, classId);
  const deck = await prisma.deck.create({
    data: { ...rest, classFolderId: classId, folderId: folderId ?? null },
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
  name: z.string().min(1).max(120).optional(),
  folderId: z.string().nullish(),
});

export async function updateDeck(req: Request, res: Response) {
  const deckId = param(req, "deckId");
  const existing = await getOwnedDeck(req.userId, deckId);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  if (parsed.data.folderId) {
    await assertFolderInClass(req.userId, parsed.data.folderId, existing.classFolderId);
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
