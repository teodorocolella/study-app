import { Router } from "express";
import {
  getConversations,
  getThread,
  getUnreadCount,
  markThreadRead,
  postImportAttachment,
  postMessage,
  postTyping,
  streamThread,
} from "../controllers/messages.controller.js";

export const messagesRouter = Router();

messagesRouter.post("/", postMessage);
messagesRouter.get("/conversations", getConversations);
messagesRouter.get("/unread-count", getUnreadCount);
messagesRouter.get("/with/:userId", getThread);
messagesRouter.post("/:messageId/import", postImportAttachment);
messagesRouter.get("/stream/:userId", streamThread);
messagesRouter.post("/typing", postTyping);
messagesRouter.post("/with/:userId/read", markThreadRead);
