import express from "express";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import db from "../db.js";
import { body, validationResult } from "express-validator";
import { loginLimiter } from "../security/rate-limit.js";
const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Unauthorized" });
}
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const pw = req.body?.password;
    if (!pw) return res.status(400).json({ error: "Password required" });
    const hash = process.env.ADMIN_PASS_HASH;
    if (!hash)
      return res.status(500).json({ error: "Admin password not configured" });
    const ok = await bcrypt.compare(pw, hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    req.session.isAdmin = true;
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});
router.get("/devices", requireAuth, async (req, res) => {
  await db.read();
  res.json(db.data || []);
});
router.post(
  "/devices",
  requireAuth,
  [
    body("model").trim().escape().notEmpty(),
    body("brand").trim().escape().notEmpty(),
    body("type").optional().trim().escape(),
    body("os").optional().trim().escape(),
    body("manufacturerUrl").optional().isURL(),
    body("notes").optional().isArray(),
    body("rootLinks").optional().isArray(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    await db.read();
    const item = req.body;
    const newDevice = {
      id: nanoid(),
      model: item.model,
      brand: item.brand,
      type: item.type || "Phone",
      os: item.os || "",
      compatible: !!item.compatible,
      notes: item.notes || [],
      manufacturerUrl: item.manufacturerUrl || "",
      rootLinks: item.rootLinks || [],
    };
    db.data.push(newDevice);
    await db.write();
    res.status(201).json(newDevice);
  }
);
router.put("/devices/:id", requireAuth, async (req, res) => {
  await db.read();
  const id = req.params.id;
  const idx = (db.data || []).findIndex((d) => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const item = req.body;
  db.data[idx] = {
    ...db.data[idx],
    model: item.model || db.data[idx].model,
    brand: item.brand || db.data[idx].brand,
    type: item.type || db.data[idx].type,
    os: item.os || db.data[idx].os,
    compatible:
      typeof item.compatible === "boolean"
        ? item.compatible
        : db.data[idx].compatible,
    notes: item.notes || db.data[idx].notes,
    manufacturerUrl: item.manufacturerUrl || db.data[idx].manufacturerUrl,
    rootLinks: item.rootLinks || db.data[idx].rootLinks,
  };
  await db.write();
  res.json(db.data[idx]);
});
router.delete("/devices/:id", requireAuth, async (req, res) => {
  await db.read();
  const id = req.params.id;
  const idx = (db.data || []).findIndex((d) => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const removed = db.data.splice(idx, 1);
  await db.write();
  res.json({ ok: true, removed: removed[0] });
});
module.exports = router;
