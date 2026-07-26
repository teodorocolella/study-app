import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { prisma } from "../prisma.js";
import { pushEnabled } from "../services/push.service.js";

export function getPushConfig(_req: Request, res: Response) {
  res.json({ enabled: pushEnabled, publicKey: pushEnabled ? env.VAPID_PUBLIC_KEY : null });
}

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export async function postSubscribe(req: Request, res: Response) {
  if (!pushEnabled) {
    res.status(501).json({ error: "Push notifications are not configured" });
    return;
  }
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { endpoint, keys } = parsed.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: req.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: req.userId, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(201).json({ ok: true });
}

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function postUnsubscribe(req: Request, res: Response) {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: req.userId },
  });
  res.status(204).end();
}
