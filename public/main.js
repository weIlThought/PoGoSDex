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
let news = [];
let i18n = {};
let currentLang =
  new URLSearchParams(window.location.search).get("lang") ||
  localStorage.getItem("lang") ||
  (navigator.language || "en").slice(0, 2);

let dateFormatter = new Intl.DateTimeFormat(currentLang, {
  dateStyle: "medium",
});

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
    dateFormatter = new Intl.DateTimeFormat(currentLang, {
      dateStyle: "medium",
    });
    applyTranslations();
    renderNews(news);
    applyFilters();
  } catch (e) {
    console.warn("Failed to load lang:", lang, e);
  }
}

const sections = {
  overview: qs("#overviewSection"),
  devices: qs("#devicesSection"),
  news: qs("#newsSection"),
};
let activeSection = "overview";

const navButtons = qsa("[data-section]");
navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    showSection(btn.dataset.section);
  });
});

function showSection(name = "overview") {
  if (!sections[name]) return;
  Object.entries(sections).forEach(([key, node]) => {
    if (!node) return;
    if (key === name) {
      node.classList.remove("hidden");
    } else {
      node.classList.add("hidden");
    }
  });
  navButtons.forEach((btn) => {
    const isActive = btn.dataset.section === name;
    btn.setAttribute("aria-selected", String(isActive));
    btn.classList.toggle("border-slate-700", isActive);
    btn.classList.toggle("bg-slate-800", isActive);
    btn.classList.toggle("bg-slate-800/60", !isActive);
    btn.classList.toggle("border-transparent", !isActive);
  });
  activeSection = name;
  if (name === "devices") applyFilters();
  if (name === "news") renderNews(news);
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

async function loadNews() {
  try {
    const res = await fetch("/data/news.json");
    news = await res.json();
  } catch (e) {
    news = [];
    console.error("Failed to load news.json", e);
  }
  if (activeSection === "news") renderNews(news);
}

function cardHtml(d) {
  const compat = d.compatible
    ? `<span class="inline-block bg-emerald-600/20 text-emerald-300 px-2 py-1 rounded text-xs">${t(
        "modal_compatibility_confirmed",
        "Compatibility: confirmed"
      )}</span>`
    : `<span class="inline-block bg-amber-600/20 text-amber-300 px-2 py-1 rounded text-xs">${t(
        "modal_compatibility_unknown",
        "Compatibility: unknown or not verified"
      )}</span>`;
  return `<article class="card-hover bg-slate-800 border border-slate-700 rounded-lg p-4 cursor-pointer" data-id="${esc(
    d.id
  )}">
    <div class="flex items-start justify-between">
      <div>
        <h3 class="text-lg font-semibold">${esc(d.model)}</h3>
        <p class="text-sm text-slate-400">${esc(d.brand)} • ${esc(d.type)}</p>
      </div>
      <div>${compat}</div>
    </div>
    <p class="mt-3 text-slate-300 text-sm">${esc(d.os)}</p>
  </article>`;
}

function renderDevices(list) {
  const wrap = qs("#gridWrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!list.length) {
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

function renderNews(items) {
  const wrap = qs("#newsWrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!items.length) {
    wrap.innerHTML = `<div class="border border-slate-800 bg-slate-900 rounded-lg p-6 text-center text-slate-400">${t(
      "news_empty",
      "No news available yet."
    )}</div>`;
    return;
  }
  const publishedLabel = t("news_published", "Published");
  const updatedLabel = t("news_updated", "Updated");
  const readMoreLabel = t("news_read_more", "Read more");

  items.forEach((item) => {
    const pub = item.publishedAt
      ? dateFormatter.format(new Date(item.publishedAt))
      : "—";
    const upd =
      item.updatedAt && item.updatedAt !== item.publishedAt
        ? dateFormatter.format(new Date(item.updatedAt))
        : null;
    const tags =
      item.tags && item.tags.length
        ? `<div class="flex flex-wrap gap-2 mt-3">${item.tags
            .map(
              (tag) =>
                `<span class="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs">${esc(
                  tag
                )}</span>`
            )
            .join("")}</div>`
        : "";
    const excerpt = item.excerpt
      ? `<p class="text-sm text-slate-300 mt-3">${esc(item.excerpt)}</p>`
      : "";
    const link = item.contentUrl
      ? `<a href="${
          item.contentUrl
        }" target="_blank" rel="noopener noreferrer nofollow" class="text-sky-400 hover:underline text-sm mt-4 inline-flex items-center gap-1">${esc(
          readMoreLabel
        )} →</a>`
      : "";
    wrap.insertAdjacentHTML(
      "beforeend",
      `<article class="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <h3 class="text-xl font-semibold">${esc(item.title)}</h3>
        <div class="text-xs text-slate-400 mt-2 space-x-3">
          <span>${publishedLabel}: ${esc(pub)}</span>
          ${upd ? `<span>${updatedLabel}: ${esc(upd)}</span>` : ""}
        </div>
        ${excerpt}
        ${tags}
        ${link}
      </article>`
    );
  });
}

function openModal(d) {
  qs("#modalBackdrop").classList.remove("hidden");
  qs("#modalBackdrop").classList.add("flex");
  qs("#modalTitle").textContent = d.model;
  qs("#modalMeta").textContent = `${d.brand} • ${d.type} • ${d.os}`;
  qs("#modalDesc").textContent = d.compatible
    ? t("modal_compatibility_confirmed", "Compatibility: confirmed")
    : t(
        "modal_compatibility_unknown",
        "Compatibility: unknown or not verified"
      );
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
    ? `<h4 class="text-sm font-semibold mt-3">${t(
        "modal_root_links",
        "Root Links"
      )}</h4>${links}`
    : "";
  const dash = t("placeholder_dash", "—");
  qs("#modalPriceRange").textContent = d.priceRange || dash;
  qs("#modalPoGoComp").textContent = d.poGoNotes || dash;
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

const searchInput = qs("#searchInput");
const typeFilter = qs("#typeFilter");
const sortSelect = qs("#sortSelect");

searchInput?.addEventListener("input", applyFilters);
typeFilter?.addEventListener("change", applyFilters);
sortSelect?.addEventListener("change", applyFilters);

function applyFilters() {
  const wrap = qs("#gridWrap");
  if (!wrap) return;
  const q = (searchInput?.value || "").trim().toLowerCase();
  const type = typeFilter?.value || "all";
  const sort = sortSelect?.value || "default";
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

const langSelect = qs("#langSelect");
langSelect?.addEventListener("change", (e) => {
  const lang = e.target.value;
  const params = new URLSearchParams(window.location.search);
  params.set("lang", lang);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  loadLang(lang);
});

function applyTranslations() {
  document.title = t(
    "title",
    "Pokémon GO Compatible Devices & PGSharp Updates"
  );

  qs("#siteTitle") &&
    (qs("#siteTitle").textContent = t(
      "site_name",
      qs("#siteTitle").textContent
    ));
  qs("#siteSubtitle") &&
    (qs("#siteSubtitle").textContent = t(
      "site_subtitle",
      qs("#siteSubtitle").textContent
    ));

  qsa("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const target = el.getAttribute("data-i18n-target") || "text";
    const fallback =
      target === "placeholder"
        ? el.getAttribute("placeholder") || ""
        : el.textContent || "";
    const value = t(key, fallback);
    if (target === "text") el.textContent = value;
    if (target === "html") el.innerHTML = value;
    if (target === "placeholder") el.setAttribute("placeholder", value);
    if (target === "title") el.setAttribute("title", value);
    if (target === "value") el.setAttribute("value", value);
  });

  const statusEl = qs("#deviceBuilderStatus");
  if (statusEl?.dataset.i18nKey) {
    statusEl.textContent = t(statusEl.dataset.i18nKey, statusEl.textContent);
  }

  if (langSelect) langSelect.value = currentLang;
}

const deviceBuilderForm = qs("#deviceBuilderForm");
const deviceJsonOutput = qs("#deviceJsonOutput");
const copyDeviceJsonBtn = qs("#copyDeviceJson");
const deviceBuilderStatus = qs("#deviceBuilderStatus");

function setBuilderStatus(key) {
  if (!deviceBuilderStatus) return;
  deviceBuilderStatus.dataset.i18nKey = key;
  deviceBuilderStatus.textContent = t(key, deviceBuilderStatus.textContent);
}

function setupDeviceBuilder() {
  if (!deviceBuilderForm) return;
  copyDeviceJsonBtn.disabled = true;
  setBuilderStatus("device_builder_empty");
  deviceJsonOutput.textContent = "";

  deviceBuilderForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const entry = {
      id: `${qs("#builderBrand").value}-${qs("#builderModel").value}`
        .toLowerCase()
        .replace(/\s+/g, "-"),
      brand: qs("#builderBrand").value.trim(),
      model: qs("#builderModel").value.trim(),
      os: qs("#builderOs").value.trim(),
      type: qs("#builderType").value.trim() || "Phone",
      compatible: qs("#builderCompatible").checked,
      priceRange: qs("#builderPrice")?.value.trim() || undefined,
      notes: qs("#builderNotes")
        .value.split(",")
        .map((n) => n.trim())
        .filter(Boolean),
      rootLinks: qs("#builderRootLinks")
        .value.split(",")
        .map((n) => n.trim())
        .filter(Boolean),
    };
    if (!entry.brand || !entry.model) {
      setBuilderStatus("device_builder_empty");
      copyDeviceJsonBtn.disabled = true;
      deviceJsonOutput.textContent = "";
      return;
    }
    if (!entry.priceRange) delete entry.priceRange;
    const jsonString = JSON.stringify(entry, null, 2);
    deviceJsonOutput.textContent = jsonString;
    copyDeviceJsonBtn.disabled = false;
    setBuilderStatus("device_builder_result_hint");
  });

  copyDeviceJsonBtn?.addEventListener("click", async () => {
    if (!deviceJsonOutput.textContent) return;
    try {
      await navigator.clipboard.writeText(deviceJsonOutput.textContent);
      setBuilderStatus("device_builder_copied");
    } catch (err) {
      console.error("Clipboard copy failed", err);
    }
  });
}

setupDeviceBuilder();
showSection(activeSection);
loadLang(currentLang).then(() => {
  loadDevices();
  loadNews();
});
