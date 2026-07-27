import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/auth.js";
import { aiRateLimiter } from "./middleware/rateLimiter.js";
import { authRouter } from "./routes/auth.routes.js";
import { aiRouter } from "./routes/ai.routes.js";
import { messagesRouter } from "./routes/messages.routes.js";
import { groupsRouter } from "./routes/groups.routes.js";
import { listShareableResources } from "./controllers/resources.controller.js";
import { search } from "./controllers/search.controller.js";
import { getUploadStatus, postUpload } from "./controllers/uploads.controller.js";
import { pushRouter } from "./routes/push.routes.js";
import {
  exerciseSetsNestedRouter,
  exerciseSetsRouter,
  exercisesRouter,
} from "./routes/exercises.routes.js";
import { classFoldersRouter } from "./routes/classFolders.routes.js";
import { foldersNestedRouter, foldersRouter } from "./routes/folders.routes.js";
import { notesNestedRouter, notesRouter } from "./routes/notes.routes.js";
import { decksNestedRouter, decksRouter } from "./routes/decks.routes.js";
import { cardsNestedRouter, cardsRouter } from "./routes/cards.routes.js";
import {
  cardReviewNestedRouter,
  dashboardRouter,
  deckReviewNestedRouter,
  reviewRouter,
} from "./routes/review.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN ?? true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "15mb" })); // large enough for imported photos/PDFs
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/classes/:classId/notes", requireAuth, notesNestedRouter);
  app.use("/api/classes/:classId/decks", requireAuth, decksNestedRouter);
  app.use("/api/classes/:classId/exercise-sets", requireAuth, exerciseSetsNestedRouter);
  app.use("/api/classes/:classId/folders", requireAuth, foldersNestedRouter);
  app.use("/api/exercise-sets", requireAuth, exerciseSetsRouter);
  app.use("/api/exercises", requireAuth, exercisesRouter);
  app.use("/api/folders", requireAuth, foldersRouter);
  app.use("/api/classes", requireAuth, classFoldersRouter);
  app.use("/api/notes", requireAuth, notesRouter);
  app.use("/api/decks/:deckId/cards", requireAuth, cardsNestedRouter);
  app.use("/api/decks/:deckId/review", requireAuth, deckReviewNestedRouter);
  app.use("/api/decks", requireAuth, decksRouter);
  app.use("/api/cards/:cardId/review", requireAuth, cardReviewNestedRouter);
  app.use("/api/cards", requireAuth, cardsRouter);
  app.use("/api/review", requireAuth, reviewRouter);
  app.use("/api/dashboard", requireAuth, dashboardRouter);
  app.use("/api/messages", requireAuth, messagesRouter);
  app.use("/api/groups", requireAuth, groupsRouter);
  app.get("/api/resources", requireAuth, listShareableResources);
  app.get("/api/search", requireAuth, search);
  app.get("/api/uploads/status", requireAuth, getUploadStatus);
  app.post("/api/uploads", requireAuth, postUpload);
  app.use("/api/push", requireAuth, pushRouter);
  app.use("/api/ai", requireAuth, aiRateLimiter, aiRouter);

  if (env.NODE_ENV === "production") {
    const clientDist = path.join(__dirname, "../../client/dist");
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
