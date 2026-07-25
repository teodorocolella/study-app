import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

// Global search across the user's classes, notes, decks, and quizzes.
export async function search(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) {
    res.json({ classes: [], notes: [], decks: [], quizzes: [] });
    return;
  }

  const contains = { contains: q, mode: "insensitive" as const };
  const userId = req.userId;
  const ownedClass = { classFolder: { userId } };

  const [classes, notes, decks, quizzes] = await Promise.all([
    prisma.classFolder.findMany({
      where: { userId, name: contains },
      select: { id: true, name: true },
      take: 8,
    }),
    prisma.note.findMany({
      where: { ...ownedClass, OR: [{ title: contains }, { contentHtml: contains }] },
      select: { id: true, title: true, classFolderId: true, classFolder: { select: { name: true } } },
      take: 8,
    }),
    prisma.deck.findMany({
      where: { ...ownedClass, name: contains },
      select: { id: true, name: true, classFolderId: true, classFolder: { select: { name: true } } },
      take: 8,
    }),
    prisma.exerciseSet.findMany({
      where: { ...ownedClass, name: contains },
      select: { id: true, name: true, classFolderId: true, classFolder: { select: { name: true } } },
      take: 8,
    }),
  ]);

  res.json({
    classes: classes.map((c) => ({ id: c.id, name: c.name })),
    notes: notes.map((n) => ({ id: n.id, title: n.title, classId: n.classFolderId, className: n.classFolder.name })),
    decks: decks.map((d) => ({ id: d.id, name: d.name, classId: d.classFolderId, className: d.classFolder.name })),
    quizzes: quizzes.map((s) => ({ id: s.id, name: s.name, classId: s.classFolderId, className: s.classFolder.name })),
  });
}
