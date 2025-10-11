const express = require("express");

const router = express.Router();

const TRANSLATE_ENDPOINT =
  process.env.TRANSLATE_ENDPOINT || "https://translate.astian.org/translate";
const TRANSLATE_API_KEY = process.env.TRANSLATE_API_KEY || "";
const SOURCE_LANG = "en";

async function translateText(text, target) {
  if (!text) return text;
  const res = await fetch(TRANSLATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: SOURCE_LANG,
      target,
      format: "text",
      api_key: TRANSLATE_API_KEY || undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`translate failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.translatedText || text;
}

router.post("/news", async (req, res) => {
  const { target, items } = req.body || {};
  if (!target || !Array.isArray(items)) {
    return res.status(400).json({ error: "invalid payload" });
  }

  try {
    const translated = [];
    for (const item of items) {
      const { id, title, excerpt, tags = [], content = "" } = item;
      const translatedTitle = await translateText(title, target);
      const translatedExcerpt = await translateText(excerpt, target);
      const translatedContent = await translateText(content, target);
      const translatedTags = await Promise.all(
        tags.map((tag) => translateText(tag, target))
      );
      translated.push({
        id,
        title: translatedTitle,
        excerpt: translatedExcerpt,
        content: translatedContent,
        tags: translatedTags,
      });
    }
    res.json(translated);
  } catch (err) {
    console.error("news translate failed", err);
    res.status(502).json({ error: "translation unavailable" });
  }
});

module.exports = router;
