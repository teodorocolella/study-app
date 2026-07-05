import { Router } from "express";
import {
  createCard,
  deleteCard,
  listCards,
  updateCard,
} from "../controllers/cards.controller.js";

export const cardsNestedRouter = Router({ mergeParams: true });
cardsNestedRouter.get("/", listCards);
cardsNestedRouter.post("/", createCard);

export const cardsRouter = Router();
cardsRouter.patch("/:cardId", updateCard);
cardsRouter.delete("/:cardId", deleteCard);
