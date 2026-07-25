import { Router } from "express";
import {
  getAuthProviders,
  login,
  logout,
  me,
  oauthCallback,
  oauthStart,
  refresh,
  signup,
  updateProfile,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/signup", signup);
authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.get("/me", requireAuth, me);
authRouter.patch("/me", requireAuth, updateProfile);

// Social sign-in
authRouter.get("/providers", getAuthProviders);
authRouter.get("/oauth/:provider", oauthStart);
authRouter.get("/oauth/:provider/callback", oauthCallback);
