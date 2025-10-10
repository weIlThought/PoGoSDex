function qs(s) {
  return document.querySelector(s);
}
function qsa(s) {
  return Array.from(document.querySelectorAll(s));
}
function esc(t) {
  const d = document.createElement("div");
  d.textContent = t;
  return d.innerHTML;
}

let devices = [];
let i18n = {};
let currentLang =
  new URLSearchParams(window.location.search).get("lang") ||
  localStorage.getItem("lang") ||
  (navigator.language || "en").slice(0, 2);

function t(key, fallback) {
  return (i18n && i18n[key]) || fallback || key;
}

async function loadLang(lang) {
  try {
    const res = await fetch(`/lang/${lang}.json`);
    if (!res.ok) throw new Error("lang not found");
    i18n = await res.json();
    currentLang = lang;
    localStorage.setItem("lang", lang);
    applyTranslations();
  } catch (e) {
    console.warn("Failed to load lang:", lang, e);
  }
}

function applyTranslations() {
  document.title = t("title", document.title);

  qs("#searchInput")?.setAttribute(
    "placeholder",
    t("search_placeholder", "Search model or brand...")
  );

  const typeFilter = qs("#typeFilter");
  if (typeFilter) {
    typeFilter.options[0].text = t("type_all", "All Devices");
    if (typeFilter.options[1])
      typeFilter.options[1].text = t("type_phone", "Phones");
    if (typeFilter.options[2])
      typeFilter.options[2].text = t("type_tablet", "Tablets");
  }

  const sortSelect = qs("#sortSelect");
  if (sortSelect) {
    if (sortSelect.options[0])
      sortSelect.options[0].text = t("sort_default", "Sort: Default");
    if (sortSelect.options[1])
      sortSelect.options[1].text = t("sort_brand", "Brand (A–Z)");
    if (sortSelect.options[2])
      sortSelect.options[2].text = t("sort_model", "Model (A–Z)");
    if (sortSelect.options[3])
      sortSelect.options[3].text = t("sort_os", "OS Version");
  }

  qsa('a[href="/privacy.html"]').forEach(
    (a) => (a.textContent = t("privacy", "Privacy"))
  );
  qsa('a[href="/impressum.html"]').forEach(
    (a) => (a.textContent = t("impressum", "Impressum"))
  );

  const ls = qs("#langSelect");
  if (ls) ls.value = currentLang;
}

async function loadDevices() {
  try {
    const res = await fetch("/data/devices.json");
    devices = await res.json();
  } catch (e) {
    devices = [];
    console.error("Failed to load devices.json", e);
  }
  applyFilters();
}

function cardHtml(d) {
  const compatClass = d.compatible ? "text-emerald-400" : "text-amber-400";
  const pogoColor =
    d.PoGoComp === "Yes"
      ? "compat-yes"
      : d.PoGoComp === "Partial"
      ? "compat-partial"
      : "compat-no";

  return `
    <article class="card-hover bg-slate-800 border border-slate-700 rounded-lg p-4 cursor-pointer" data-id="${esc(
      d.id
    )}">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-lg font-semibold">${esc(d.model)}</h3>
          <p class="text-sm text-slate-400">${esc(d.brand)} • ${esc(d.type)}</p>
        </div>
        <div class="${compatClass} text-xs font-medium">
          ${d.compatible ? "Confirmed" : "Unverified"}
        </div>
      </div>
      <p class="mt-3 text-slate-300 text-sm">${esc(d.os)}</p>
      <div class="mt-3 text-sm">
        <p><strong>Price Range:</strong> ${esc(d.priceRange || "—")}</p>
        <p><strong>PoGO Comp:</strong> <span class="${pogoColor}">${
    d.PoGoComp || "Unknown"
  }</span></p>
      </div>
    </article>
  `;
}

function renderDevices(list) {
  const wrap = qs("#gridWrap");
  wrap.innerHTML = "";
  if (list.length === 0) {
    wrap.innerHTML = `<div class="col-span-full text-center text-slate-400">${t(
      "no_devices_found",
      "No devices found"
    )}</div>`;
    return;
  }
  list.forEach((d) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = cardHtml(d);
    const card = tmp.firstElementChild;
    card.addEventListener("click", () => openModal(d));
    wrap.appendChild(card);
  });
}

function openModal(d) {
  qs("#modalBackdrop").classList.remove("hidden");
  qs("#modalBackdrop").classList.add("flex");
  qs("#modalTitle").textContent = d.model;
  qs("#modalMeta").textContent = `${d.brand} • ${d.type} • ${d.os}`;
  qs("#modalDesc").textContent = d.compatible
    ? t("modal_compatibility_confirmed", "Compatibility: confirmed")
    : t("modal_compatibility_unknown", "Compatibility: unknown or not verified");

  qs("#modalPriceRange").textContent = d.priceRange || "—";
  qs("#modalPoGoComp").textContent = d.PoGoComp || "Unknown";

  qs("#modalNotesList").innerHTML = (d.notes || [])
    .map((n) => `<div class="text-sm">• ${esc(n)}</div>`)
    .join("");

  const links = (d.rootLinks || [])
    .map(
      (u) =>
        `<div class="text-sm"><a href="${u}" target="_blank" rel="noopener noreferrer nofollow" class="text-sky-400 hover:underline">${esc(
          u
        )}</a></div>`
    )
    .join("");

  qs("#modalRootLinks").innerHTML = links
    ? `<h4 class="text-sm font-semibold mt-3">Root Links</h4>${links}`
    : "";

  document.body.style.overflow = "hidden";
}

function closeModal() {
  qs("#modalBackdrop").classList.add("hidden");
  qs("#modalBackdrop").classList.remove("flex");
  document.body.style.overflow = "";
}

qs("#closeModal")?.addEventListener("click", closeModal);
qs("#modalBackdrop")?.addEventListener("click", (e) => {
  if (e.target === qs("#modalBackdrop")) closeModal();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

function applyFilters() {
  const q = (qs("#searchInput")?.value || "").trim().toLowerCase();
  const type = qs("#typeFilter")?.value || "all";
  const sort = qs("#sortSelect")?.value || "default";
  let filtered = devices.filter((d) => {
    const hay = [d.model, d.brand, d.os, (d.notes || []).join(" ")]
      .join(" ")
      .toLowerCase();
    const matchesSearch = q ? hay.includes(q) : true;
    const matchesType = type === "all" ? true : d.type === type;
    return matchesSearch && matchesType;
  });

  if (sort !== "default") {
    filtered.sort((a, b) => {
      if (sort === "brand") return a.brand.localeCompare(b.brand);
      if (sort === "model") return a.model.localeCompare(b.model);
      if (sort === "os") return a.os.localeCompare(b.os);
      return 0;
    });
  }

  renderDevices(filtered);
}

qs("#searchInput")?.addEventListener("input", applyFilters);
qs("#typeFilter")?.addEventListener("change", applyFilters);
qs("#sortSelect")?.addEventListener("change", applyFilters);

qs("#langSelect")?.addEventListener("change", (e) => {
  const lang = e.target.value;
  const params = new URLSearchParams(window.location.search);
  params.set("lang", lang);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  loadLang(lang);
});

loadLang(currentLang).then(loadDevices);