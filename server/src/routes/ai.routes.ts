import { Router } from "express";
import {
  postAssistant,
  postExplainDifferently,
  postGenerateFlashcards,
  postSummarizeNote,
} from "../controllers/ai.controller.js";

export const aiRouter = Router();

aiRouter.post("/assistant", postAssistant);
aiRouter.post("/generate-flashcards", postGenerateFlashcards);
aiRouter.post("/summarize-note", postSummarizeNote);
aiRouter.post("/explain-differently", postExplainDifferently);
