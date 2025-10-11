const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

let currentLang =
  new URLSearchParams(window.location.search).get("lang") ||
  localStorage.getItem("lang") ||
  (navigator.language || "en").slice(0, 2);

async function loadLang(lang) {
  try {
    const res = await fetch(`/lang/${lang}.json`);
    if (!res.ok) throw new Error("lang not found");
    const dict = await res.json();
    applyTranslations(dict, lang);
  } catch (err) {
    console.warn("Failed to load lang", lang, err);
  }
}

function applyTranslations(dict, lang) {
  qsa("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const target = el.getAttribute("data-i18n-target") || "text";
    const fallback =
      target === "placeholder"
        ? el.getAttribute("placeholder") || ""
        : el.textContent || "";
    const value = dict[key] || fallback || key;
    if (target === "text") el.textContent = value;
    if (target === "html") el.innerHTML = value;
    if (target === "placeholder") el.setAttribute("placeholder", value);
    if (target === "title") el.setAttribute("title", value);
  });
  document.title =
    dict["impressum_title"] || document.title || "Impressum · PoGoSDex";
  const select = qs("#langSelect");
  if (select) select.value = lang;
  currentLang = lang;
  localStorage.setItem("lang", lang);
  const params = new URLSearchParams(window.location.search);
  params.set("lang", lang);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

qs("#langSelect")?.addEventListener("change", (evt) => {
  loadLang(evt.target.value);
});

loadLang(currentLang);
