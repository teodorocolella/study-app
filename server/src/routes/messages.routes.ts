import { Router } from "express";
import {
  editMessage,
  getConversations,
  getThread,
  getUnreadCount,
  markThreadRead,
  postImportAttachment,
  postMessage,
  postTyping,
  streamThread,
  unsendMessage,
} from "../controllers/messages.controller.js";

export const messagesRouter = Router();

messagesRouter.post("/", postMessage);
messagesRouter.get("/conversations", getConversations);
messagesRouter.get("/unread-count", getUnreadCount);
messagesRouter.get("/with/:userId", getThread);
messagesRouter.post("/:messageId/import", postImportAttachment);
messagesRouter.patch("/:messageId", editMessage);
messagesRouter.delete("/:messageId", unsendMessage);
messagesRouter.get("/stream/:userId", streamThread);
messagesRouter.post("/typing", postTyping);
messagesRouter.post("/with/:userId/read", markThreadRead);
