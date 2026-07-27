import type { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/errorHandler.js";
import { folderFilter, param } from "../lib/params.js";
import { prisma } from "../prisma.js";
import { getOwnedClassFolder, getOwnedFolder, getOwnedNote } from "../services/ownership.service.js";

export async function listNotes(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const notes = await prisma.note.findMany({
    where: { classFolderId: classId, ...folderFilter(req) },
    orderBy: { updatedAt: "desc" },
  });
  res.json(notes);
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  contentHtml: z.string().default(""),
  folderId: z.string().nullish(),
});

export async function createNote(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { folderId, ...rest } = parsed.data;
  if (folderId) await assertFolderInClass(req.userId, folderId, classId);
  const note = await prisma.note.create({
    data: { ...rest, classFolderId: classId, folderId: folderId ?? null },
  });
  res.status(201).json(note);
}

// A folder an item is filed into must belong to the item's own class.
async function assertFolderInClass(userId: string, folderId: string, classId: string) {
  const folder = await getOwnedFolder(userId, folderId);
  if (folder.classFolderId !== classId) {
    throw new ApiError(400, "That folder belongs to a different class");
  }
}

export async function getNote(req: Request, res: Response) {
  const note = await getOwnedNote(req.userId, param(req, "noteId"));
  res.json(note);
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentHtml: z.string().optional(),
  folderId: z.string().nullish(), // null = move to class root
});

export async function updateNote(req: Request, res: Response) {
  const noteId = param(req, "noteId");
  const existing = await getOwnedNote(req.userId, noteId);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  if (parsed.data.folderId) {
    await assertFolderInClass(req.userId, parsed.data.folderId, existing.classFolderId);
  }
  const note = await prisma.note.update({
    where: { id: noteId },
    data: parsed.data,
  });
  res.json(note);
}

export async function deleteNote(req: Request, res: Response) {
  const noteId = param(req, "noteId");
  await getOwnedNote(req.userId, noteId);
  await prisma.note.delete({ where: { id: noteId } });
  res.status(204).send();
}
