import { Router } from "express";
import {
  postExplainDifferently,
  postGenerateFlashcards,
  postSummarizeNote,
  postTutorChat,
} from "../controllers/ai.controller.js";

export const aiRouter = Router();

aiRouter.post("/generate-flashcards", postGenerateFlashcards);
aiRouter.post("/tutor-chat", postTutorChat);
aiRouter.post("/summarize-note", postSummarizeNote);
aiRouter.post("/explain-differently", postExplainDifferently);
