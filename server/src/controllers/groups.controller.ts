import type { Request, Response } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { openSse } from "../lib/sse.js";
import { ApiError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";
import {
  groupChannel,
  isActive,
  markActive,
  markInactive,
  publish,
  subscribe,
} from "../services/liveChannel.service.js";
import {
  getOwnedClassFolder,
  getOwnedDeck,
  getOwnedExerciseSet,
  getOwnedNote,
} from "../services/ownership.service.js";
import { notifyOfflineMembers } from "../services/notify.service.js";

const MEMBER_SELECT = { id: true, displayName: true, email: true, avatarUrl: true } as const;

// --- Attachment snapshots (self-contained copies so recipients never touch live data) ---

type Attachment =
  | { type: "note"; title: string; contentHtml: string }
  | { type: "deck"; name: string; cards: { front: string; back: string }[] }
  | {
      type: "exercise_set";
      name: string;
      exercises: {
        type: string;
        prompt: string;
        options: string[] | null;
        answer: string;
        explanation: string | null;
      }[];
    };

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

function parseAttachment(m: { attachmentType: string | null; attachmentJson: string | null }) {
  if (!m.attachmentType || !m.attachmentJson) return null;
  try {
    return JSON.parse(m.attachmentJson) as Attachment;
  } catch {
    return null;
  }
}

function messageDto(m: {
  id: string;
  senderId: string;
  body: string | null;
  attachmentType: string | null;
  attachmentJson: string | null;
  createdAt: Date;
  sender: { id: string; displayName: string; avatarUrl: string | null };
}) {
  return {
    id: m.id,
    senderId: m.senderId,
    senderName: m.sender.displayName,
    senderAvatar: m.sender.avatarUrl,
    body: m.body,
    attachment: parseAttachment(m),
    createdAt: m.createdAt,
  };
}

async function requireMembership(userId: string, groupId: string) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) throw new ApiError(404, "Group not found");
  return membership;
}

// --- Groups ---

const createGroupSchema = z.object({ name: z.string().min(1).max(120) });

export async function createGroup(req: Request, res: Response) {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const group = await prisma.studyGroup.create({
    data: {
      name: parsed.data.name,
      members: { create: { userId: req.userId, role: "owner" } },
    },
  });
  res.status(201).json({ id: group.id, name: group.name });
}

export async function listGroups(req: Request, res: Response) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId: req.userId },
    include: {
      group: {
        include: {
          _count: { select: { members: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: MEMBER_SELECT } },
          },
        },
      },
    },
  });

  const groups = await Promise.all(
    memberships.map(async (m) => {
      const unread = await prisma.groupMessage.count({
        where: { groupId: m.groupId, createdAt: { gt: m.lastReadAt }, senderId: { not: req.userId } },
      });
      const last = m.group.messages[0];
      return {
        id: m.group.id,
        name: m.group.name,
        memberCount: m.group._count.members,
        unreadCount: unread,
        lastMessage: last
          ? { senderName: last.sender.displayName, body: last.body, hasAttachment: !!last.attachmentType, createdAt: last.createdAt }
          : null,
      };
    }),
  );

  groups.sort((a, b) => {
    const at = a.lastMessage?.createdAt.getTime() ?? 0;
    const bt = b.lastMessage?.createdAt.getTime() ?? 0;
    return bt - at;
  });
  res.json(groups);
}

export async function getGroup(req: Request, res: Response) {
  const groupId = param(req, "groupId");
  const membership = await requireMembership(req.userId, groupId);
  const group = await prisma.studyGroup.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: { select: MEMBER_SELECT } }, orderBy: { joinedAt: "asc" } } },
  });
  if (!group) throw new ApiError(404, "Group not found");
  res.json({
    id: group.id,
    name: group.name,
    myRole: membership.role,
    members: group.members.map((mem) => ({
      id: mem.user.id,
      displayName: mem.user.displayName,
      email: mem.user.email,
      avatarUrl: mem.user.avatarUrl,
      role: mem.role,
    })),
  });
}

const addMemberSchema = z.object({ email: z.string().email() });

export async function addMember(req: Request, res: Response) {
  const groupId = param(req, "groupId");
  await requireMembership(req.userId, groupId);
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const user = await prisma.user.findFirst({
    where: { email: { equals: parsed.data.email.trim(), mode: "insensitive" } },
    select: MEMBER_SELECT,
  });
  if (!user) throw new ApiError(404, "No Study Hub account uses that email");

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (existing) throw new ApiError(409, "They're already in this group");

  await prisma.groupMember.create({ data: { groupId, userId: user.id, role: "member" } });
  res.status(201).json({ id: user.id, displayName: user.displayName, email: user.email, avatarUrl: user.avatarUrl, role: "member" });
}

export async function leaveGroup(req: Request, res: Response) {
  const groupId = param(req, "groupId");
  await requireMembership(req.userId, groupId);
  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId: req.userId } },
  });
  // Clean up an empty group so it doesn't linger.
  const remaining = await prisma.groupMember.count({ where: { groupId } });
  if (remaining === 0) {
    await prisma.studyGroup.delete({ where: { id: groupId } });
  }
  res.status(204).end();
}

// --- Messages ---

export async function listMessages(req: Request, res: Response) {
  const groupId = param(req, "groupId");
  await requireMembership(req.userId, groupId);

  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: req.userId } },
    data: { lastReadAt: new Date() },
  });

  const messages = await prisma.groupMessage.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    take: 300,
    include: { sender: { select: MEMBER_SELECT } },
  });
  res.json(messages.map(messageDto));
}

const postMessageSchema = z
  .object({
    body: z.string().max(4000).optional(),
    attachment: z.object({ type: z.enum(["note", "deck", "exercise_set"]), id: z.string() }).optional(),
  })
  .refine((d) => (d.body && d.body.trim()) || d.attachment, {
    message: "Message needs text or an attachment",
  });

export async function postMessage(req: Request, res: Response) {
  const groupId = param(req, "groupId");
  await requireMembership(req.userId, groupId);
  const parsed = postMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  let snapshot: Attachment | null = null;
  if (parsed.data.attachment) {
    snapshot = await buildSnapshot(req.userId, parsed.data.attachment);
  }

  const message = await prisma.groupMessage.create({
    data: {
      groupId,
      senderId: req.userId,
      body: parsed.data.body?.trim() || null,
      attachmentType: snapshot?.type ?? null,
      attachmentJson: snapshot ? JSON.stringify(snapshot) : null,
    },
    include: { sender: { select: MEMBER_SELECT } },
  });
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: req.userId } },
    data: { lastReadAt: new Date() },
  });

  const dto = messageDto(message);
  const channel = groupChannel(groupId);
  publish(channel, { type: "message", message: dto });

  const group = await prisma.studyGroup.findUnique({
    where: { id: groupId },
    include: { members: { select: { userId: true } } },
  });
  const recipientIds = (group?.members ?? [])
    .map((m) => m.userId)
    .filter((id) => id !== req.userId);
  void notifyOfflineMembers(channel, recipientIds, {
    title: group?.name ?? "Study group",
    body: dto.body ?? `${dto.senderName} shared something`,
    url: `/groups/${groupId}`,
    tag: channel,
  });

  res.status(201).json(dto);
}

export async function streamGroup(req: Request, res: Response) {
  const groupId = param(req, "groupId");
  await requireMembership(req.userId, groupId);
  const channel = groupChannel(groupId);

  const { send, close } = openSse(res);
  markActive(channel, req.userId);
  const unsubscribe = subscribe(channel, send);

  req.on("close", () => {
    unsubscribe();
    markInactive(channel, req.userId);
    close();
  });
}

// Cheap "mark read" for when a live message arrives while the chat is already
// open (listMessages only marks read on a fresh GET, which live delivery skips).
export async function markGroupRead(req: Request, res: Response) {
  const groupId = param(req, "groupId");
  await requireMembership(req.userId, groupId);
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: req.userId } },
    data: { lastReadAt: new Date() },
  });
  res.status(204).end();
}

export async function postGroupTyping(req: Request, res: Response) {
  const groupId = param(req, "groupId");
  await requireMembership(req.userId, groupId);
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { displayName: true } });
  publish(groupChannel(groupId), { type: "typing", userId: req.userId, name: user?.displayName ?? "Someone" });
  res.status(204).end();
}

const importSchema = z.object({ classId: z.string() });

export async function importAttachment(req: Request, res: Response) {
  const groupId = param(req, "groupId");
  const messageId = param(req, "messageId");
  await requireMembership(req.userId, groupId);
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const message = await prisma.groupMessage.findFirst({ where: { id: messageId, groupId } });
  const attachment = message ? parseAttachment(message) : null;
  if (!attachment) throw new ApiError(400, "This message has no attachment to save");
  const classFolder = await getOwnedClassFolder(req.userId, parsed.data.classId);

  if (attachment.type === "note") {
    const note = await prisma.note.create({
      data: { title: attachment.title, contentHtml: attachment.contentHtml, classFolderId: classFolder.id },
    });
    res.status(201).json({ type: "note", noteId: note.id, classId: classFolder.id });
    return;
  }
  if (attachment.type === "deck") {
    const deck = await prisma.deck.create({ data: { name: attachment.name, classFolderId: classFolder.id } });
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

export async function getGroupsUnreadCount(req: Request, res: Response) {
  const memberships = await prisma.groupMember.findMany({ where: { userId: req.userId } });
  let count = 0;
  for (const m of memberships) {
    count += await prisma.groupMessage.count({
      where: { groupId: m.groupId, createdAt: { gt: m.lastReadAt }, senderId: { not: req.userId } },
    });
  }
  res.json({ count });
}
