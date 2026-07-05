import { Router } from "express";
import {
  createDeck,
  deleteDeck,
  getDeck,
  listDecks,
  updateDeck,
} from "../controllers/decks.controller.js";

export const decksNestedRouter = Router({ mergeParams: true });
decksNestedRouter.get("/", listDecks);
decksNestedRouter.post("/", createDeck);

export const decksRouter = Router();
decksRouter.get("/:deckId", getDeck);
decksRouter.patch("/:deckId", updateDeck);
decksRouter.delete("/:deckId", deleteDeck);
