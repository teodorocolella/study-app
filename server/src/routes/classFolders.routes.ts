import { Router } from "express";
import {
  createClassFolder,
  deleteClassFolder,
  getClassFolder,
  listClassFolders,
  updateClassFolder,
} from "../controllers/classFolders.controller.js";

export const classFoldersRouter = Router();

classFoldersRouter.get("/", listClassFolders);
classFoldersRouter.post("/", createClassFolder);
classFoldersRouter.get("/:classId", getClassFolder);
classFoldersRouter.patch("/:classId", updateClassFolder);
classFoldersRouter.delete("/:classId", deleteClassFolder);
