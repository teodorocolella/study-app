import { Router } from "express";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} from "../controllers/notes.controller.js";

export const notesNestedRouter = Router({ mergeParams: true });
notesNestedRouter.get("/", listNotes);
notesNestedRouter.post("/", createNote);

export const notesRouter = Router();
notesRouter.get("/:noteId", getNote);
notesRouter.patch("/:noteId", updateNote);
notesRouter.delete("/:noteId", deleteNote);
