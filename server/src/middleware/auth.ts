import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../services/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "Missing access token" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}
