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

/**
 * Turns a `?archived=` query into a Prisma where-fragment: absent → only
 * active items (archived false), `all` → both, `1`/`true`/`only` → archived
 * items only. Lets a list hide archived items by default while still being
 * able to fetch them for the "show archived" view.
 */
export function archivedFilter(req: Request): { archived?: boolean } {
  const a = req.query.archived;
  if (a === "all") return {};
  if (a === "1" || a === "true" || a === "only") return { archived: true };
  return { archived: false };
}
