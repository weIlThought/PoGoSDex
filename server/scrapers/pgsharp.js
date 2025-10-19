const fetch = global.fetch || require("node-fetch");

async function getPgsharpVersion() {
  const res = await fetch("https://www.pgsharp.com");
  const html = await res.text();

  // Beispiel-Match: Latest Version: 1.224.0 (0.383.2-G)
  const m = html.match(/Latest Version:\s*([\d.]+)\s*\(([^)]+)\)/i);
  if (!m) return { ok: false, raw: html.slice(0, 500) };

  const pageVersion = m[1];
  const inner = m[2];
  const apkMatch = inner.match(/([\d.]+)/);
  const apkVersion = apkMatch ? apkMatch[1] : null;

  return { ok: true, pageVersion, apkVersion, rawInner: inner };
}

module.exports = { getPgsharpVersion };
