import dotenv from "dotenv";
dotenv.config();

import path from "path";
import express from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import xssClean from "xss-clean";
import { fileURLToPath } from "url";
import { apiLimiter } from "./security/rate-limit.js";
import adminRoutes from "./routes/admin.js";
import { initDB } from "./db.js";

// ESM hat kein __dirname automatisch – selbst definieren:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// Sicherheit & Middleware
app.disable("x-powered-by");
app.use(helmet());
app.use(xssClean());
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use("/api", apiLimiter);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Session Setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8, // 8 Stunden
    },
  })
);

// Starte Server
(async () => {
  await initDB();

  const staticRoot = path.resolve(__dirname, "..", "public");
  app.use(express.static(staticRoot, { extensions: ["html"] }));
  app.use("/api/admin", adminRoutes);

  // Fallback für SPA (React/Vue/etc.)
  app.get("*", (req, res) => res.sendFile(path.join(staticRoot, "index.html")));

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
})();
