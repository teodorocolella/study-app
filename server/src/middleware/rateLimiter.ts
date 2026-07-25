import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId,
});

// Throttles credential endpoints (login/signup) to slow brute-force attempts.
// Keyed by IP + email so one attacker can't lock out everyone from an IP.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
    return `${ipKeyGenerator(req.ip ?? "")}:${email}`;
  },
});
