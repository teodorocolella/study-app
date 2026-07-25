import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

/** A flat list of everything the user could share — notes, decks, and quizzes. */
export async function listShareableResources(req: Request, res: Response) {
  const classes = await prisma.classFolder.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
    select: {
      name: true,
      notes: { select: { id: true, title: true }, orderBy: { updatedAt: "desc" } },
      decks: {
        select: { id: true, name: true, _count: { select: { cards: true } } },
        orderBy: { createdAt: "asc" },
      },
      exerciseSets: {
        select: { id: true, name: true, _count: { select: { exercises: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const notes: { id: string; title: string; className: string }[] = [];
  const decks: { id: string; name: string; className: string; cardCount: number }[] = [];
  const quizzes: { id: string; name: string; className: string; questionCount: number }[] = [];

  for (const cf of classes) {
    for (const n of cf.notes) notes.push({ id: n.id, title: n.title, className: cf.name });
    for (const d of cf.decks) {
      if (d._count.cards > 0) decks.push({ id: d.id, name: d.name, className: cf.name, cardCount: d._count.cards });
    }
    for (const s of cf.exerciseSets) {
      if (s._count.exercises > 0)
        quizzes.push({ id: s.id, name: s.name, className: cf.name, questionCount: s._count.exercises });
    }
  }

  res.json({ notes, decks, quizzes });
}
