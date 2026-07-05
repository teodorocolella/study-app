import type { Request, Response } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { prisma } from "../prisma.js";
import { getOwnedClassFolder, getOwnedNote } from "../services/ownership.service.js";

export async function listNotes(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const notes = await prisma.note.findMany({
    where: { classFolderId: classId },
    orderBy: { updatedAt: "desc" },
  });
  res.json(notes);
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  contentMarkdown: z.string().default(""),
});

export async function createNote(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const note = await prisma.note.create({
    data: { ...parsed.data, classFolderId: classId },
  });
  res.status(201).json(note);
}

export async function getNote(req: Request, res: Response) {
  const note = await getOwnedNote(req.userId, param(req, "noteId"));
  res.json(note);
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentMarkdown: z.string().optional(),
});

export async function updateNote(req: Request, res: Response) {
  const noteId = param(req, "noteId");
  await getOwnedNote(req.userId, noteId);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
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
