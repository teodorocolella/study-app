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
  postMessage,
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
