import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { COLLEGE_GRADE, currentGrade } from "../lib/gradeLevel.js";
import { param } from "../lib/params.js";
import { prisma } from "../prisma.js";
import {
  createRefreshToken,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword,
  verifyRefreshToken,
} from "../services/auth.service.js";
import {
  buildAuthorizationUrl,
  enabledProviders,
  exchangeCodeForProfile,
  isProviderEnabled,
} from "../services/oauth.service.js";

function publicUser(user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  hasOnboarded: boolean;
  gradeLevel: number | null;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    hasOnboarded: user.hasOnboarded,
    gradeLevel: user.gradeLevel,
  };
}

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

async function issueTokens(res: Response, userId: string) {
  const accessToken = signAccessToken(userId);
  const { token, tokenHash, expiresAt } = createRefreshToken(userId);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  setRefreshCookie(res, token);
  return accessToken;
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80),
});

export async function signup(req: Request, res: Response) {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, password, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  });

  const accessToken = await issueTokens(res, user.id);
  res.status(201).json({
    accessToken,
    user: publicUser(user),
  });
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const accessToken = await issueTokens(res, user.id);
  res.json({
    accessToken,
    user: publicUser(user),
  });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Missing refresh token" });
    return;
  }

  let payload: { userId: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const tokenHash = hashToken(token);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.expiresAt < new Date()) {
    res.status(401).json({ error: "Refresh token has been revoked" });
    return;
  }

  const accessToken = signAccessToken(payload.userId);
  res.json({ accessToken });
}

// --- Social sign-in (OAuth) ---

const OAUTH_STATE_COOKIE = "oauthState";

export function getAuthProviders(_req: Request, res: Response) {
  res.json(enabledProviders());
}

export function oauthStart(req: Request, res: Response) {
  const provider = param(req, "provider");
  if (!isProviderEnabled(provider)) {
    res.redirect(`${env.APP_URL}/login?error=provider_disabled`);
    return;
  }
  const state = randomUUID();
  res.cookie(OAUTH_STATE_COOKIE, `${provider}:${state}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(buildAuthorizationUrl(provider, state));
}

export async function oauthCallback(req: Request, res: Response) {
  const provider = param(req, "provider");
  const failure = `${env.APP_URL}/login?error=oauth`;
  try {
    const { code, state } = req.query;
    const cookie = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE);

    if (
      !isProviderEnabled(provider) ||
      typeof code !== "string" ||
      typeof state !== "string" ||
      cookie !== `${provider}:${state}`
    ) {
      res.redirect(failure);
      return;
    }

    const profile = await exchangeCodeForProfile(provider, code);
    const email = profile.email.toLowerCase();

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // New account from a verified social identity — no usable password until they set one.
      const passwordHash = await hashPassword(randomUUID() + randomUUID());
      user = await prisma.user.create({
        data: { email, displayName: profile.displayName, passwordHash },
      });
    }

    await issueTokens(res, user.id);
    res.redirect(`${env.APP_URL}/dashboard`);
  } catch (err) {
    console.error(`OAuth ${provider} error:`, err);
    res.redirect(failure);
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  let user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Keep the grade current: advance it if a new school year has started.
  if (user.gradeLevel != null && user.gradeUpdatedAt) {
    const advanced = currentGrade(user.gradeLevel, user.gradeUpdatedAt);
    if (advanced !== user.gradeLevel) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { gradeLevel: advanced, gradeUpdatedAt: new Date() },
      });
    }
  }

  res.json(publicUser(user));
}

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  avatarUrl: z
    .string()
    .max(1_500_000, "Image is too large")
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/, "Invalid image format")
    .nullable()
    .optional(),
  hasOnboarded: z.literal(true).optional(),
  gradeLevel: z.number().int().min(1).max(COLLEGE_GRADE).nullable().optional(),
});

export async function updateProfile(req: Request, res: Response) {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { gradeLevel, ...rest } = parsed.data;
  const user = await prisma.user.update({
    where: { id: req.userId },
    // Stamp gradeUpdatedAt whenever the grade is (re)set, so auto-advance counts from now.
    data:
      gradeLevel !== undefined ? { ...rest, gradeLevel, gradeUpdatedAt: new Date() } : rest,
  });
  res.json(publicUser(user));
}
