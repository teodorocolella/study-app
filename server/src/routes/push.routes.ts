import { Router } from "express";
import { getPushConfig, postSubscribe, postUnsubscribe } from "../controllers/push.controller.js";

export const pushRouter = Router();

pushRouter.get("/config", getPushConfig);
pushRouter.post("/subscribe", postSubscribe);
pushRouter.post("/unsubscribe", postUnsubscribe);
