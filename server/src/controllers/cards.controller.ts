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

// An inline data-URL image or a hosted https URL (when object storage is on).
const imageField = z
  .string()
  .max(2_000_000, "Image is too large")
  .regex(/^(data:image\/(png|jpeg|jpg|webp);base64,|https:\/\/)/, "Invalid image")
  .nullable()
  .optional();

const occlusionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  label: z.string().max(200),
});

const createSchema = z
  .object({
    front: z.string().max(4000).optional(),
    back: z.string().max(4000).optional(),
    frontImage: imageField,
    backImage: imageField,
    kind: z.enum(["basic", "image_occlusion"]).default("basic"),
    occlusions: z.array(occlusionSchema).max(30).optional(),
  })
  .refine((d) => d.kind === "image_occlusion" || (d.front?.trim() && d.back?.trim()), {
    message: "Front and back are required",
  })
  .refine((d) => d.kind !== "image_occlusion" || (d.frontImage && d.occlusions?.length), {
    message: "An image-occlusion card needs an image and at least one hidden region",
  });

export async function createCard(req: Request, res: Response) {
  const deckId = param(req, "deckId");
  await getOwnedDeck(req.userId, deckId);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { front, back, frontImage, backImage, kind, occlusions } = parsed.data;
  const card = await prisma.flashcard.create({
    data: {
      deckId,
      kind,
      front: front ?? "",
      back: back ?? (kind === "image_occlusion" ? (occlusions ?? []).map((o) => o.label).join(", ") : ""),
      frontImage: frontImage ?? null,
      backImage: backImage ?? null,
      occlusionsJson: kind === "image_occlusion" && occlusions ? JSON.stringify(occlusions) : null,
    },
  });
  res.status(201).json(card);
}

const updateSchema = z.object({
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  frontImage: imageField,
  backImage: imageField,
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
