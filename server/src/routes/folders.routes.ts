import { Router } from "express";
import {
  createFolder,
  deleteFolder,
  getFolder,
  listFolders,
  updateFolder,
} from "../controllers/folders.controller.js";

// Mounted at /api/classes/:classId/folders
export const foldersNestedRouter = Router({ mergeParams: true });
foldersNestedRouter.get("/", listFolders);
foldersNestedRouter.post("/", createFolder);

// Mounted at /api/folders
export const foldersRouter = Router();
foldersRouter.get("/:folderId", getFolder);
foldersRouter.patch("/:folderId", updateFolder);
foldersRouter.delete("/:folderId", deleteFolder);
