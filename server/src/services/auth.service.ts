import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  userId: string;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(userId: string) {
  return jwt.sign({ userId } satisfies AccessTokenPayload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRefreshToken(userId: string) {
  const jti = randomUUID();
  const token = jwt.sign({ userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return { token, tokenHash: hashToken(token), expiresAt };
}

export function verifyRefreshToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AccessTokenPayload;
}
