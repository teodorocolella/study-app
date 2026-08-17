import { Router } from "express";
import {
  forgotPassword,
  getAuthProviders,
  login,
  logout,
  me,
  oauthCallback,
  oauthStart,
  refresh,
  resetPassword,
  signup,
  updateProfile,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";

export const authRouter = Router();

authRouter.post("/signup", authRateLimiter, signup);
authRouter.post("/login", authRateLimiter, login);
authRouter.post("/forgot-password", authRateLimiter, forgotPassword);
authRouter.post("/reset-password", authRateLimiter, resetPassword);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.get("/me", requireAuth, me);
authRouter.patch("/me", requireAuth, updateProfile);

// Social sign-in
authRouter.get("/providers", getAuthProviders);
authRouter.get("/oauth/:provider", oauthStart);
authRouter.get("/oauth/:provider/callback", oauthCallback);
