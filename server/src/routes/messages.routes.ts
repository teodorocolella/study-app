import { Router } from "express";
import {
  getConversations,
  getThread,
  getUnreadCount,
  postImportAttachment,
  postMessage,
} from "../controllers/messages.controller.js";

export const messagesRouter = Router();

messagesRouter.post("/", postMessage);
messagesRouter.get("/conversations", getConversations);
messagesRouter.get("/unread-count", getUnreadCount);
messagesRouter.get("/with/:userId", getThread);
messagesRouter.post("/:messageId/import", postImportAttachment);
