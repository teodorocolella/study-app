import { Router } from "express";
import {
  getDashboard,
  getDueCardsAcrossClasses,
  getDueCardsForDeck,
  postReview,
} from "../controllers/review.controller.js";

export const reviewRouter = Router();
reviewRouter.get("/due", getDueCardsAcrossClasses);

export const deckReviewNestedRouter = Router({ mergeParams: true });
deckReviewNestedRouter.get("/due", getDueCardsForDeck);

export const cardReviewNestedRouter = Router({ mergeParams: true });
cardReviewNestedRouter.post("/", postReview);

export const dashboardRouter = Router();
dashboardRouter.get("/summary", getDashboard);
