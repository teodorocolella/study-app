import type { Request, Response } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { prisma } from "../prisma.js";
import { getOwnedClassFolder } from "../services/ownership.service.js";

export async function listClassFolders(req: Request, res: Response) {
  const classFolders = await prisma.classFolder.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
  });
  res.json(classFolders);
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  colorTag: z.string().max(40).optional(),
});

export async function createClassFolder(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const classFolder = await prisma.classFolder.create({
    data: { ...parsed.data, userId: req.userId },
  });
  res.status(201).json(classFolder);
}

export async function getClassFolder(req: Request, res: Response) {
  const classFolder = await getOwnedClassFolder(req.userId, param(req, "classId"));
  res.json(classFolder);
}

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  colorTag: z.string().max(40).nullable().optional(),
});

export async function updateClassFolder(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const classFolder = await prisma.classFolder.update({
    where: { id: classId },
    data: parsed.data,
  });
  res.json(classFolder);
}

export async function deleteClassFolder(req: Request, res: Response) {
  const classId = param(req, "classId");
  await getOwnedClassFolder(req.userId, classId);
  await prisma.classFolder.delete({ where: { id: classId } });
  res.status(204).send();
}
