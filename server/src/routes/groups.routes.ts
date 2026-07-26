import { Router } from "express";
import {
  addMember,
  createGroup,
  getGroup,
  getGroupsUnreadCount,
  importAttachment,
  leaveGroup,
  listGroups,
  listMessages,
  markGroupRead,
  postGroupTyping,
  postMessage,
  streamGroup,
} from "../controllers/groups.controller.js";

export const groupsRouter = Router();

groupsRouter.get("/", listGroups);
groupsRouter.post("/", createGroup);
groupsRouter.get("/unread-count", getGroupsUnreadCount);
groupsRouter.get("/:groupId", getGroup);
groupsRouter.post("/:groupId/members", addMember);
groupsRouter.delete("/:groupId/members/me", leaveGroup);
groupsRouter.get("/:groupId/messages", listMessages);
groupsRouter.post("/:groupId/messages", postMessage);
groupsRouter.post("/:groupId/messages/:messageId/import", importAttachment);
groupsRouter.get("/:groupId/stream", streamGroup);
groupsRouter.post("/:groupId/typing", postGroupTyping);
groupsRouter.post("/:groupId/read", markGroupRead);
