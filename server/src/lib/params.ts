import type { Request } from "express";
import { ApiError } from "../middleware/errorHandler.js";

export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new ApiError(400, `Missing route parameter: ${name}`);
  }
  return value;
}

/**
 * Turns a `?folder=` query into a Prisma where-fragment for filtering by folder:
 * `folder=root` → items at the class root, `folder=<id>` → that folder's items,
 * absent → no folder filter (all items in the class).
 */
export function folderFilter(req: Request): { folderId?: string | null } {
  const folder = req.query.folder;
  if (folder === "root") return { folderId: null };
  if (typeof folder === "string" && folder) return { folderId: folder };
  return {};
}
