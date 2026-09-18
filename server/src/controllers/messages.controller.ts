import type { Request, Response } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { openSse } from "../lib/sse.js";
import { ApiError } from "../middleware/errorHandler.js";
import {
  dmChannel,
  markActive,
  markInactive,
  publish,
  subscribe,
} from "../services/liveChannel.service.js";
import { notifyOfflineMembers } from "../services/notify.service.js";
import {
  getOwnedClassFolder,
  getOwnedDeck,
  getOwnedExerciseSet,
  getOwnedNote,
} from "../services/ownership.service.js";
import { prisma } from "../prisma.js";

// Shared notes/decks/quizzes are stored as self-contained JSON snapshots on the
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

interface ExerciseSetAttachment {
  type: "exercise_set";
  name: string;
  exercises: {
    type: string;
    prompt: string;
    options: string[] | null;
    answer: string;
    explanation: string | null;
  }[];
}

type Attachment = NoteAttachment | DeckAttachment | ExerciseSetAttachment;

// Builds the self-contained snapshot for a shared note/deck/quiz.
async function buildSnapshot(
  userId: string,
  attachment: { type: "note" | "deck" | "exercise_set"; id: string },
): Promise<Attachment> {
  if (attachment.type === "note") {
    const note = await getOwnedNote(userId, attachment.id);
    return { type: "note", title: note.title, contentHtml: note.contentHtml };
  }
  if (attachment.type === "deck") {
    const deck = await getOwnedDeck(userId, attachment.id);
    const cards = await prisma.flashcard.findMany({
      where: { deckId: deck.id },
      orderBy: { createdAt: "asc" },
      select: { front: true, back: true },
    });
    if (cards.length === 0) throw new ApiError(400, "That deck has no cards to share yet");
    return { type: "deck", name: deck.name, cards };
  }
  const set = await getOwnedExerciseSet(userId, attachment.id);
  const exercises = await prisma.exercise.findMany({
    where: { setId: set.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  if (exercises.length === 0) throw new ApiError(400, "That quiz has no questions to share yet");
  return {
    type: "exercise_set",
    name: set.name,
    exercises: exercises.map((e) => ({
      type: e.type,
      prompt: e.prompt,
      options: e.optionsJson ? (JSON.parse(e.optionsJson) as string[]) : null,
      answer: e.answer,
      explanation: e.explanation,
    })),
  };
}

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
  editedAt?: Date | null;
  deletedAt?: Date | null;
}) {
  const deleted = !!message.deletedAt;
  return {
    id: message.id,
    senderId: message.senderId,
    recipientId: message.recipientId,
    // An unsent message keeps its row for ordering but shows nothing.
    body: deleted ? null : message.body,
    attachment: deleted ? null : parseAttachment(message),
    createdAt: message.createdAt,
    readAt: message.readAt,
    editedAt: message.editedAt ?? null,
    deleted,
  };
}

const sendSchema = z
  .object({
    // Prefer recipientId (picked by name); recipientEmail kept for older callers.
    recipientId: z.string().optional(),
    recipientEmail: z.string().email().optional(),
    body: z.string().max(4000).optional(),
    attachment: z
      .object({
        type: z.enum(["note", "deck", "exercise_set"]),
        id: z.string(),
      })
      .optional(),
  })
  .refine((data) => data.recipientId || data.recipientEmail, {
    message: "Pick who to send to",
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
  const { recipientId, recipientEmail, body, attachment } = parsed.data;

  const recipient = await prisma.user.findFirst({
    where: recipientId
      ? { id: recipientId }
      : { email: { equals: recipientEmail!.trim(), mode: "insensitive" } },
    select: PARTNER_SELECT,
  });
  if (!recipient) {
    throw new ApiError(404, "That classmate isn't on Study Hub");
  }
  if (recipient.id === req.userId) {
    throw new ApiError(400, "You can't message yourself");
  }

  const snapshot: Attachment | null = attachment ? await buildSnapshot(req.userId, attachment) : null;

  const message = await prisma.message.create({
    data: {
      senderId: req.userId,
      recipientId: recipient.id,
      body: body?.trim() || null,
      attachmentType: snapshot?.type ?? null,
      attachmentJson: snapshot ? JSON.stringify(snapshot) : null,
    },
  });

  const dto = toDto(message);
  const channel = dmChannel(req.userId, recipient.id);
  publish(channel, { type: "message", message: dto });

  const sender = await prisma.user.findUnique({ where: { id: req.userId }, select: { displayName: true } });
  void notifyOfflineMembers(channel, [recipient.id], {
    title: sender?.displayName ?? "New message",
    body: dto.body ?? "Shared something with you",
    url: `/direct?with=${req.userId}`,
    tag: channel,
  });

  res.status(201).json({ ...dto, recipient });
}

export async function streamThread(req: Request, res: Response) {
  const partnerId = param(req, "userId");
  const channel = dmChannel(req.userId, partnerId);

  const { send, close } = openSse(res);
  markActive(channel, req.userId);
  const unsubscribe = subscribe(channel, send);

  req.on("close", () => {
    unsubscribe();
    markInactive(channel, req.userId);
    close();
  });
}

// Cheap "mark read" for when a live message arrives while the thread is already
// open (getThread only marks read on a fresh GET, which live delivery skips).
export async function markThreadRead(req: Request, res: Response) {
  const partnerId = param(req, "userId");
  await prisma.message.updateMany({
    where: { senderId: partnerId, recipientId: req.userId, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).end();
}

// Loads a message the current user sent, or 404s. Used by edit/unsend so only
// the author can change their own message.
async function getOwnSentMessage(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.senderId !== userId) throw new ApiError(404, "Message not found");
  if (message.deletedAt) throw new ApiError(400, "That message was already unsent");
  return message;
}

const editSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function editMessage(req: Request, res: Response) {
  const messageId = param(req, "messageId");
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const existing = await getOwnSentMessage(req.userId, messageId);
  if (!existing.body) throw new ApiError(400, "Only text messages can be edited");

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body: parsed.data.body, editedAt: new Date() },
  });
  const dto = toDto(updated);
  publish(dmChannel(existing.senderId, existing.recipientId), { type: "message-updated", message: dto });
  res.json(dto);
}

export async function unsendMessage(req: Request, res: Response) {
  const messageId = param(req, "messageId");
  const existing = await getOwnSentMessage(req.userId, messageId);

  // Keep the row for ordering/read state, but strip its content.
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), body: null, attachmentType: null, attachmentJson: null },
  });
  const dto = toDto(updated);
  publish(dmChannel(existing.senderId, existing.recipientId), { type: "message-updated", message: dto });
  res.json(dto);
}

const typingSchema = z.object({ recipientId: z.string() });

export async function postTyping(req: Request, res: Response) {
  const parsed = typingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { displayName: true } });
  publish(dmChannel(req.userId, parsed.data.recipientId), {
    type: "typing",
    userId: req.userId,
    name: user?.displayName ?? "Someone",
  });
  res.status(204).end();
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

  if (attachment.type === "deck") {
    const deck = await prisma.deck.create({
      data: { name: attachment.name, classFolderId: classFolder.id },
    });
    await prisma.flashcard.createMany({
      data: attachment.cards.map((c) => ({ front: c.front, back: c.back, deckId: deck.id })),
    });
    res.status(201).json({ type: "deck", deckId: deck.id, classId: classFolder.id });
    return;
  }

  const set = await prisma.exerciseSet.create({
    data: {
      name: attachment.name,
      classFolderId: classFolder.id,
      exercises: {
        create: attachment.exercises.map((e, i) => ({
          type: e.type,
          prompt: e.prompt,
          optionsJson: e.options ? JSON.stringify(e.options) : null,
          answer: e.answer,
          explanation: e.explanation,
          position: i,
        })),
      },
    },
  });
  res.status(201).json({ type: "exercise_set", setId: set.id, classId: classFolder.id });
}

export async function getUnreadCount(req: Request, res: Response) {
  const count = await prisma.message.count({
    where: { recipientId: req.userId, readAt: null },
  });
  res.json({ count });
}

// Typeahead for picking a classmate by name (so people don't need to know an
// email). Matches on display name or email; never returns the current user.
export async function searchUsers(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 1) {
    res.json([]);
    return;
  }
  const users = await prisma.user.findMany({
    where: {
      id: { not: req.userId },
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: PARTNER_SELECT,
    orderBy: { displayName: "asc" },
    take: 8,
  });
  res.json(users);
}
