async function getPgsharpVersion() {
  const fetchedAt = new Date().toISOString();

  try {
    const res = await axios.get(PGSHARP_URL, {
      timeout: 10_000,
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      responseType: "text",
      maxRedirects: 5,
    });

    if (res.status !== 200) {
      return { ok: false, error: `HTTP ${res.status}`, fetchedAt };
    }

    const html = String(res.data || "");
    const $ = load(html);

    let pageVersion = null;
    let pogoVersion = null;

    const allText = $("body").text();

    const match = /Latest Version:\s*([\d.]+)\s*\(([\d.]+-?G?)\)/i.exec(
      allText
    );
    if (match) {
      pageVersion = match[1].trim();
      pogoVersion = match[2].trim();
    } else {
      const simple = /Latest Version:\s*([\d.]+)/i.exec(allText);
      if (simple) pageVersion = simple[1].trim();
    }

    if (!pageVersion) {
      return { ok: false, error: "No version found", fetchedAt };
    }

    return {
      ok: true,
      pageVersion,
      pogoVersion,
      fetchedAt,
      source: PGSHARP_URL,
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err), fetchedAt };
  }
}
