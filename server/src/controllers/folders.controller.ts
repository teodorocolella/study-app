import type { Request, Response } from "express";
import { z } from "zod";
import { archivedFilter, param } from "../lib/params.js";
import { prisma } from "../prisma.js";
import { getOwnedClassFolder, getOwnedFolder } from "../services/ownership.service.js";

// Folders inside a class, each with a count of what it holds.
export async function listFolders(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const folders = await prisma.folder.findMany({
    where: { classFolderId: classId, ...archivedFilter(req) },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { notes: true, decks: true, exerciseSets: true } } },
  });
  res.json(
    folders.map((f) => ({
      id: f.id,
      name: f.name,
      classFolderId: f.classFolderId,
      archived: f.archived,
      noteCount: f._count.notes,
      deckCount: f._count.decks,
      quizCount: f._count.exerciseSets,
    })),
  );
}

const nameSchema = z.object({ name: z.string().min(1).max(120) });

export async function createFolder(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const folder = await prisma.folder.create({
    data: { name: parsed.data.name, classFolderId: classId },
  });
  res.status(201).json({ id: folder.id, name: folder.name, classFolderId: folder.classFolderId });
}

export async function getFolder(req: Request, res: Response) {
  const folderId = param(req, "folderId");
  const folder = await getOwnedFolder(req.userId, folderId);
  res.json({ id: folder.id, name: folder.name, classFolderId: folder.classFolderId });
}

const updateFolderSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  archived: z.boolean().optional(),
});

export async function updateFolder(req: Request, res: Response) {
  const folderId = param(req, "folderId");
  await getOwnedFolder(req.userId, folderId);
  const parsed = updateFolderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const folder = await prisma.folder.update({ where: { id: folderId }, data: parsed.data });
  res.json({ id: folder.id, name: folder.name, classFolderId: folder.classFolderId, archived: folder.archived });
}

export async function deleteFolder(req: Request, res: Response) {
  const folderId = param(req, "folderId");
  await getOwnedFolder(req.userId, folderId);
  // Its notes/decks/quizzes survive — the DB sets their folderId to null (SetNull).
  await prisma.folder.delete({ where: { id: folderId } });
  res.status(204).end();
}
