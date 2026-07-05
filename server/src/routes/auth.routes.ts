import { Router } from "express";
import { login, logout, me, refresh, signup } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/signup", signup);
authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.get("/me", requireAuth, me);
