import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try later" },
});

export const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts, please wait 10 minutes" },
});