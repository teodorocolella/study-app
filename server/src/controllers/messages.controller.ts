import type { Request, Response } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { ApiError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";
import { getOwnedClassFolder, getOwnedDeck, getOwnedNote } from "../services/ownership.service.js";

// Shared notes/decks are stored as self-contained JSON snapshots on the
// message, so recipients never read (or depend on) the sender's live data.
interface NoteAttachment {
  type: "note";
  title: string;
  contentHtml: string;
}

interface DeckAttachment {
  type: "deck";
  name: string;
  cards: { front: string; back: string }[];
}

type Attachment = NoteAttachment | DeckAttachment;

const PARTNER_SELECT = { id: true, displayName: true, email: true, avatarUrl: true } as const;

function parseAttachment(message: { attachmentType: string | null; attachmentJson: string | null }) {
  if (!message.attachmentType || !message.attachmentJson) return null;
  try {
    return JSON.parse(message.attachmentJson) as Attachment;
  } catch {
    return null;
  }
}

function toDto(message: {
  id: string;
  senderId: string;
  recipientId: string;
  body: string | null;
  attachmentType: string | null;
  attachmentJson: string | null;
  createdAt: Date;
  readAt: Date | null;
}) {
  return {
    id: message.id,
    senderId: message.senderId,
    recipientId: message.recipientId,
    body: message.body,
    attachment: parseAttachment(message),
    createdAt: message.createdAt,
    readAt: message.readAt,
  };
}

const sendSchema = z
  .object({
    recipientEmail: z.string().email(),
    body: z.string().max(4000).optional(),
    attachment: z
      .object({
        type: z.enum(["note", "deck"]),
        id: z.string(),
      })
      .optional(),
  })
  .refine((data) => (data.body && data.body.trim()) || data.attachment, {
    message: "Message needs text or an attachment",
  });

export async function postMessage(req: Request, res: Response) {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { recipientEmail, body, attachment } = parsed.data;

  const recipient = await prisma.user.findFirst({
    where: { email: { equals: recipientEmail.trim(), mode: "insensitive" } },
    select: PARTNER_SELECT,
  });
  if (!recipient) {
    throw new ApiError(404, "No Study Hub account uses that email");
  }
  if (recipient.id === req.userId) {
    throw new ApiError(400, "You can't message yourself");
  }

  let snapshot: Attachment | null = null;
  if (attachment?.type === "note") {
    const note = await getOwnedNote(req.userId, attachment.id);
    snapshot = { type: "note", title: note.title, contentHtml: note.contentHtml };
  } else if (attachment?.type === "deck") {
    const deck = await getOwnedDeck(req.userId, attachment.id);
    const cards = await prisma.flashcard.findMany({
      where: { deckId: deck.id },
      orderBy: { createdAt: "asc" },
      select: { front: true, back: true },
    });
    if (cards.length === 0) {
      throw new ApiError(400, "That deck has no cards to share yet");
    }
    snapshot = { type: "deck", name: deck.name, cards };
  }

  const message = await prisma.message.create({
    data: {
      senderId: req.userId,
      recipientId: recipient.id,
      body: body?.trim() || null,
      attachmentType: snapshot?.type ?? null,
      attachmentJson: snapshot ? JSON.stringify(snapshot) : null,
    },
  });

  res.status(201).json({ ...toDto(message), recipient });
}

export async function getConversations(req: Request, res: Response) {
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: req.userId }, { recipientId: req.userId }] },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { sender: { select: PARTNER_SELECT }, recipient: { select: PARTNER_SELECT } },
  });

  const byPartner = new Map<
    string,
    {
      partner: (typeof messages)[number]["sender"];
      lastMessage: ReturnType<typeof toDto>;
      unreadCount: number;
    }
  >();
  for (const message of messages) {
    const partner = message.senderId === req.userId ? message.recipient : message.sender;
    const existing = byPartner.get(partner.id);
    const unread = message.recipientId === req.userId && !message.readAt ? 1 : 0;
    if (existing) {
      existing.unreadCount += unread;
    } else {
      byPartner.set(partner.id, { partner, lastMessage: toDto(message), unreadCount: unread });
    }
  }

  res.json([...byPartner.values()]);
}

export async function getThread(req: Request, res: Response) {
  const partnerId = param(req, "userId");
  const partner = await prisma.user.findUnique({
    where: { id: partnerId },
    select: PARTNER_SELECT,
  });
  if (!partner) throw new ApiError(404, "User not found");

  await prisma.message.updateMany({
    where: { senderId: partnerId, recipientId: req.userId, readAt: null },
    data: { readAt: new Date() },
  });

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: req.userId, recipientId: partnerId },
        { senderId: partnerId, recipientId: req.userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  res.json({ partner, messages: messages.map(toDto) });
}

const importSchema = z.object({ classId: z.string() });

export async function postImportAttachment(req: Request, res: Response) {
  const messageId = param(req, "messageId");
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || (message.recipientId !== req.userId && message.senderId !== req.userId)) {
    throw new ApiError(404, "Message not found");
  }
  const attachment = parseAttachment(message);
  if (!attachment) throw new ApiError(400, "This message has no attachment to save");

  const classFolder = await getOwnedClassFolder(req.userId, parsed.data.classId);

  if (attachment.type === "note") {
    const note = await prisma.note.create({
      data: {
        title: attachment.title,
        contentHtml: attachment.contentHtml,
        classFolderId: classFolder.id,
      },
    });
    res.status(201).json({ type: "note", noteId: note.id, classId: classFolder.id });
    return;
  }

  const deck = await prisma.deck.create({
    data: { name: attachment.name, classFolderId: classFolder.id },
  });
  await prisma.flashcard.createMany({
    data: attachment.cards.map((c) => ({ front: c.front, back: c.back, deckId: deck.id })),
  });
  res.status(201).json({ type: "deck", deckId: deck.id, classId: classFolder.id });
}

export async function getUnreadCount(req: Request, res: Response) {
  const count = await prisma.message.count({
    where: { recipientId: req.userId, readAt: null },
  });
  res.json({ count });
}
