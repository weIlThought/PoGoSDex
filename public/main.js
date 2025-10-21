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

function dash() {
  return t("placeholder_dash", "—");
}

let devices = [];
let news = [];
let newsSearch = "";
let newsSelectedTags = new Set();

const newsSearchInput = qs("#newsSearchInput");
const newsTagFilterWrap = qs("#newsTagFilter");

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

// add pgsharp section to sections map
const sections = {
  overview: qs("#overviewSection"),
  devices: qs("#devicesSection"),
  news: qs("#newsSection"),
  pgsharp: qs("#pgsharpSection"),
};
let activeSection = "overview";

let navButtons = [];

function bindNavigation() {
  navButtons = qsa("[data-section]");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      showSection(btn.dataset.section);
    });
  });
}

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
  populateNewsTagFilter(news);
  if (activeSection === "news") renderNews(news);
}

function populateNewsTagFilter(items) {
  if (!newsTagFilterWrap) return;
  const tags = [
    ...new Set(
      items.flatMap((item) => (item.tags || []).map((tag) => tag.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));
  newsTagFilterWrap.innerHTML = "";
  if (!tags.length) {
    newsTagFilterWrap.innerHTML = `<span class="text-xs text-slate-500" data-i18n="news_filter_no_tags">No tags available.</span>`;
    return;
  }
  tags.forEach((tag) => {
    const tagKey = tag.toLowerCase();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = tag;
    btn.dataset.tag = tagKey;
    btn.className =
      "px-3 py-1 text-xs rounded-full border transition-colors " +
      (newsSelectedTags.has(tagKey)
        ? "bg-emerald-600 border-emerald-400"
        : "bg-slate-800 border-slate-700");
    newsTagFilterWrap.appendChild(btn);
  });
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

const deviceLimitSelect = qs("[data-device-limit]");
let deviceRenderLimit = 50;

if (deviceLimitSelect) {
  deviceLimitSelect.addEventListener("change", () => {
    const value = deviceLimitSelect.value;
    deviceRenderLimit =
      value === "all"
        ? Infinity
        : Number.parseInt(value, 10) || deviceRenderLimit;
    renderDevices(devices);
  });
}

let devicesPageSize = 10;

function getVisibleDevices() {
  if (devicesPageSize === "all") return devices;
  return devices.slice(0, devicesPageSize);
}

function renderDevices() {
  const list = qs("[data-devices-list]");
  if (!list) return;
  const rows = getVisibleDevices().map(createDeviceRow).join("");
  list.innerHTML = rows || `<li class="text-slate-500">No devices found.</li>`;
}

function renderDevices(list) {
  const container = qs("[data-devices-grid]");
  if (!container) return;

  const limited =
    deviceRenderLimit === Infinity ? list : list.slice(0, deviceRenderLimit);
  container.innerHTML = "";
  if (!limited.length) {
    container.innerHTML = `<div class="col-span-full text-center text-slate-400">${t(
      "no_devices_found",
      "No devices found"
    )}</div>`;
    return;
  }
  limited.forEach((d) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = cardHtml(d);
    const card = tmp.firstElementChild;
    card.addEventListener("click", () => openModal(d));
    container.appendChild(card);
  });
}

function hydrateGrid() {
  renderDevices(devices);
}

function renderNews(items) {
  const wrap = qs("#newsWrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  const filtered = items.filter((item) => {
    const title = item.title?.toLowerCase() || "";
    const excerpt = item.excerpt?.toLowerCase() || "";
    const content = item.content?.toLowerCase() || "";
    const matchesSearch =
      !newsSearch ||
      title.includes(newsSearch) ||
      excerpt.includes(newsSearch) ||
      content.includes(newsSearch);
    const itemTags = (item.tags || []).map((tag) => tag.toLowerCase());
    const matchesTags =
      !newsSelectedTags.size ||
      itemTags.some((tag) => newsSelectedTags.has(tag));
    return matchesSearch && matchesTags;
  });
  if (!filtered.length) {
    wrap.innerHTML = `<div class="border border-slate-800 bg-slate-900 rounded-lg p-6 text-center text-slate-400">${t(
      "news_empty",
      "No news available yet."
    )}</div>`;
    return;
  }
  const publishedLabel = t("news_published", "Published");
  const updatedLabel = t("news_updated", "Updated");
  filtered.forEach((item) => {
    const title = item.title;
    const excerpt = item.excerpt;
    const tags = item.tags || [];
    const content = item.content || item.excerpt || "";

    const pub = item.publishedAt
      ? dateFormatter.format(new Date(item.publishedAt))
      : dash();
    const upd =
      item.updatedAt && item.updatedAt !== item.publishedAt
        ? dateFormatter.format(new Date(item.updatedAt))
        : null;

    const article = document.createElement("article");
    article.className =
      "bg-slate-900 border border-slate-800 rounded-lg p-6 cursor-pointer card-hover transition";
    article.tabIndex = 0;
    article.setAttribute("role", "button");
    article.innerHTML = `
      <h3 class="text-xl font-semibold">${esc(title)}</h3>
      <div class="text-xs text-slate-400 mt-2 space-x-3">
        <span>${publishedLabel}: ${esc(pub)}</span>
        ${upd ? `<span>${updatedLabel}: ${esc(upd)}</span>` : ""}
      </div>
      ${
        excerpt
          ? `<p class="text-sm text-slate-300 mt-3">${esc(excerpt)}</p>`
          : ""
      }
      ${
        tags.length
          ? `<div class="flex flex-wrap gap-2 mt-3">${tags
              .map(
                (tag) =>
                  `<span class="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs">${esc(
                    tag
                  )}</span>`
              )
              .join("")}</div>`
          : ""
      }
    `;
    const open = () => openNewsModal(item, { content });
    article.addEventListener("click", open);
    article.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        open();
      }
    });
    wrap.appendChild(article);
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
  qs("#modalPriceRange").textContent = d.priceRange || dash();
  const pogoDetails = [d.pogo, d.pgsharp].filter(Boolean).join(" • ");
  qs("#modalPoGoComp").textContent = pogoDetails || dash();
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

function hydrateTranslations() {
  applyTranslations();
}

const deviceBuilderForm = qs("#deviceBuilderForm");
const deviceJsonOutput = qs("#deviceJsonOutput");
const copyDeviceJsonBtn = qs("#copyDeviceJson");
const deviceBuilderStatus = qs("#deviceBuilderStatus");
const deviceModal = qs("#deviceModal");
const deviceModalOpenBtn = qs("#deviceModalOpen");
const deviceModalCloseBtn = qs("#deviceModalClose");
const deviceFormClearBtn = qs("#deviceFormClear");

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

  deviceModalOpenBtn?.addEventListener("click", () => {
    deviceModal?.classList.remove("hidden");
    deviceModal?.classList.add("flex");
  });

  deviceModalCloseBtn?.addEventListener("click", () => {
    deviceModal?.classList.add("hidden");
    deviceModal?.classList.remove("flex");
  });

  deviceModal?.addEventListener("click", (evt) => {
    if (evt.target === deviceModal) {
      deviceModal.classList.add("hidden");
      deviceModal.classList.remove("flex");
    }
  });

  deviceFormClearBtn?.addEventListener("click", () => {
    deviceBuilderForm?.reset();
    if (deviceJsonOutput) deviceJsonOutput.textContent = "";
    if (deviceBuilderStatus)
      deviceBuilderStatus.textContent = t(
        "device_builder_empty",
        "Fill in the form to generate JSON."
      );
  });
}

function init() {
  newsSearchInput?.addEventListener("input", (evt) => {
    newsSearch = evt.target.value.trim().toLowerCase();
    renderNews(news);
  });
  newsTagFilterWrap?.addEventListener("click", (evt) => {
    const btn = evt.target.closest("[data-tag]");
    if (!btn) return;
    const tag = btn.getAttribute("data-tag");
    if (newsSelectedTags.has(tag)) {
      newsSelectedTags.delete(tag);
      btn.classList.remove("bg-emerald-600", "border-emerald-400");
      btn.classList.add("bg-slate-800", "border-slate-700");
    } else {
      newsSelectedTags.add(tag);
      btn.classList.remove("bg-slate-800", "border-slate-700");
      btn.classList.add("bg-emerald-600", "border-emerald-400");
    }
    renderNews(news);
  });
}

async function hydrateUptimeStatus() {
  const statusIndicator = qs("#statusIndicator");
  const statusMessage = qs("#statusMessage");
  const statusUptime = qs("#statusUptime");
  if (!statusIndicator || !statusMessage || !statusUptime) return;

  try {
    statusIndicator.classList.add("animate-pulse");
    const res = await fetch("/status/uptime", {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const { state, uptimeRatio, checkedAt } = data;
    statusIndicator.classList.remove("animate-pulse");
    statusIndicator.classList.remove(
      "bg-yellow-400",
      "bg-emerald-400",
      "bg-red-500"
    );
    if (state === "up") {
      statusIndicator.classList.add("bg-emerald-400");
      statusMessage.textContent = t("status_ok", "All systems operational");
    } else if (state === "degraded") {
      statusIndicator.classList.add("bg-yellow-400");
      statusMessage.textContent = t("status_warn", "Degraded performance");
    } else {
      statusIndicator.classList.add("bg-red-500");
      statusMessage.textContent = t("status_down", "Service unavailable");
    }

    const uptimeText =
      typeof uptimeRatio === "number" ? `${uptimeRatio.toFixed(2)}%` : "— %";
    statusUptime.textContent = `${t(
      "status_uptime_label",
      "Uptime"
    )}: ${uptimeText}`;

    if (checkedAt) {
      statusUptime.title = `${t("status_checked_at", "Last check")}: ${new Date(
        checkedAt
      ).toLocaleString()}`;
    }
  } catch (error) {
    statusIndicator.classList.remove("animate-pulse");
    statusIndicator.classList.add("bg-red-500");
    statusMessage.textContent = t("status_error", "Status check failed");
    statusUptime.textContent = `${t("status_uptime_label", "Uptime")}: — %`;
    console.error("Status fetch failed:", error);
  }
}

function hydrateNewsInternal() {
  const list = qs("[data-news-list]");
  if (!list) return;
  fetch("/data/news.json", { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((newsItems) => {
      if (!Array.isArray(newsItems) || !newsItems.length) {
        list.innerHTML = `<li class="text-slate-500">No news available.</li>`;
        return;
      }
      list.innerHTML = newsItems
        .slice(0, 6)
        .map(
          (item) => `
            <li class="space-y-1">
              <p class="text-xs uppercase tracking-wide text-emerald-400">${esc(
                item.date ?? ""
              )}</p>
              <p class="font-semibold text-slate-100">${esc(
                item.title ?? "Untitled"
              )}</p>
              ${
                item.excerpt
                  ? `<p class="text-sm text-slate-400">${esc(item.excerpt)}</p>`
                  : ""
              }
            </li>
          `
        )
        .join("");
    })
    .catch((error) => {
      console.error("Failed to hydrate news:", error);
      list.innerHTML = `<li class="text-red-400">News feed unavailable.</li>`;
    });
}

function hydrateNews() {
  const list = qs("[data-news-list]");
  if (!list) return;
  fetch("/data/news.json", { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((newsItems) => {
      if (!Array.isArray(newsItems) || !newsItems.length) {
        list.innerHTML = `<li class="text-slate-500">No news available.</li>`;
        return;
      }
      list.innerHTML = newsItems
        .slice(0, 6)
        .map(
          (item) => `
            <li class="space-y-1">
              <p class="text-xs uppercase tracking-wide text-emerald-400">${esc(
                item.date ?? ""
              )}</p>
              <p class="font-semibold text-slate-100">${esc(
                item.title ?? "Untitled"
              )}</p>
              ${
                item.excerpt
                  ? `<p class="text-sm text-slate-400">${esc(item.excerpt)}</p>`
                  : ""
              }
            </li>
          `
        )
        .join("");
    })
    .catch((error) => {
      console.error("Failed to hydrate news:", error);
      list.innerHTML = `<li class="text-red-400">News feed unavailable.</li>`;
    });
}
window.hydrateNews = hydrateNews;

document.addEventListener("DOMContentLoaded", () => {
  const pageSizeSelect = qs("#device-page-size");
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", (event) => {
      devicesPageSize =
        event.target.value === "all" ? "all" : Number(event.target.value);
      renderDevices();
    });
  }

  hydrateTranslations();
  hydrateGrid();
  hydrateNewsInternal();
  hydrateUptimeStatus();
  bindNavigation();

  // PGSharp Tabs
  const pgsharpTabs = document.querySelectorAll("#pgsharp-tabs .tab-btn");
  const pgsharpContents = document.querySelectorAll(
    ".tab-content[id^='pgsharp-']"
  );

  pgsharpTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      pgsharpTabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      pgsharpContents.forEach((c) => {
        c.style.display =
          c.id === "pgsharp-" + btn.dataset.tab ? "block" : "none";
      });
    });
  });

  fetch("/api/uptime")
    .then((res) => res.json())
    .then((data) => {
      const el = document.getElementById("uptime");
      if (el && data && typeof data.uptime === "number") {
        el.textContent = `Uptime: ${data.uptime.toFixed(2)} %`;
      }
    })
    .catch(() => {
      // Fehler ignorieren, Anzeige bleibt auf — %
    });
});

setupDeviceBuilder();
showSection(activeSection);
loadLang(currentLang).then(() => {
  loadDevices();
  loadNews();
  init();
});

const newsModalBackdrop = qs("#newsModalBackdrop");
const closeNewsModalBtn = qs("#closeNewsModal");
const newsModalTitle = qs("#newsModalTitle");
const newsModalMeta = qs("#newsModalMeta");
const newsModalBody = qs("#newsModalBody");
const newsModalTagsWrap = qs("#newsModalTagsWrap");
const newsModalTags = qs("#newsModalTags");

function openNewsModal(original, translated = {}) {
  const merged = {
    ...original,
    ...translated,
    tags: original.tags || [],
  };
  newsModalTitle.textContent = merged.title;
  const pub = merged.publishedAt
    ? dateFormatter.format(new Date(merged.publishedAt))
    : dash();
  const upd =
    merged.updatedAt && merged.updatedAt !== merged.publishedAt
      ? dateFormatter.format(new Date(merged.updatedAt))
      : null;

  const publishedLabel = t("news_published", "Published");
  const updatedLabel = t("news_updated", "Updated");
  newsModalMeta.innerHTML = `
    <span>${publishedLabel}: ${esc(pub)}</span>
    ${upd ? `<span class="ml-3">${updatedLabel}: ${esc(upd)}</span>` : ""}
  `;

  const body = merged.content || merged.excerpt || "";
  if (body) {
    newsModalBody.innerHTML = body
      .split(/\n{2,}/)
      .map(
        (block) =>
          `<p>${esc(block)
            .replace(/\n/g, "<br>")
            .replace(/ {2}/g, "&nbsp;&nbsp;")}</p>`
      )
      .join("");
  } else {
    newsModalBody.innerHTML = `<p>${esc(
      t("news_modal_no_content", "No additional details provided.")
    )}</p>`;
  }

  if (merged.tags && merged.tags.length) {
    newsModalTags.innerHTML = merged.tags
      .map(
        (tag) =>
          `<span class="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">${esc(
            tag
          )}</span>`
      )
      .join("");
    newsModalTagsWrap.classList.remove("hidden");
  } else {
    newsModalTagsWrap.classList.add("hidden");
    newsModalTags.innerHTML = "";
  }

  newsModalBackdrop.classList.remove("hidden");
  newsModalBackdrop.classList.add("flex");
  document.body.style.overflow = "hidden";
}

function closeNewsModal() {
  newsModalBackdrop.classList.add("hidden");
  newsModalBackdrop.classList.remove("flex");
  document.body.style.overflow = "";
}

closeNewsModalBtn?.addEventListener("click", closeNewsModal);
newsModalBackdrop?.addEventListener("click", (evt) => {
  if (evt.target === newsModalBackdrop) closeNewsModal();
});
window.addEventListener("keydown", (evt) => {
  if (evt.key === "Escape") {
    closeModal();
    closeNewsModal();
  }
});

(async function ensureSITEKEY() {
  const el = document.querySelector(".cf-turnstile");
  if (!el) return;

  try {
    const r = await fetch("/config");
    if (!r.ok) return;
    const j = await r.json();

    if (j.sitekey) {
      el.dataset.sitekey = j.sitekey;

      // Wait until Turnstile API is available, then render explicitly
      const waitForTurnstile = () =>
        new Promise((resolve) => {
          if (window.turnstile) return resolve(window.turnstile);
          const iv = setInterval(() => {
            if (window.turnstile) {
              clearInterval(iv);
              resolve(window.turnstile);
            }
          }, 100);
        });

      const turnstile = await waitForTurnstile();
      turnstile.render("#cf-turnstile", {
        sitekey: j.sitekey,
        theme: "auto", // or "light"/"dark"
      });
    }
  } catch (e) {
    console.warn("Turnstile sitekey fetch failed", e);
  }
})();

// --- PGSharp tab setup (was in public/pgsharp.js) ---
function setupPgSharpTabs() {
  const root = qs("#pgsharpSection");
  if (!root) return;
  const tabBtns = Array.from(root.querySelectorAll("[data-pgsharp-tab]"));
  const tabContents = Array.from(
    root.querySelectorAll("[data-pgsharp-content]")
  );
  let active = "faq";

  function activate(tab) {
    tabBtns.forEach((btn) => {
      const isActive = btn.dataset.pgsharpTab === tab;
      btn.classList.toggle("bg-emerald-400", isActive);
      btn.classList.toggle("text-slate-900", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    tabContents.forEach((content) => {
      if (content.dataset.pgsharpContent === tab) {
        content.classList.remove("hidden");
        content.classList.add("active");
        content.classList.remove("fade");
      } else {
        content.classList.add("hidden");
        content.classList.remove("active");
        content.classList.add("fade");
      }
    });
    active = tab;
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => activate(btn.dataset.pgsharpTab));
  });

  // initial
  activate(active);
}

// call setup in DOMContentLoaded (or init)
document.addEventListener("DOMContentLoaded", () => {
  // existing DOMContentLoaded logic remains...
  // ensure PGSharp tabs and any PGSharp-specific hydration run
  setupPgSharpTabs();

  // optional: wire pgsharp-specific simple behaviors (coords list placeholder)
  const coordsList = qs("#coords-list");
  if (coordsList) {
    // try to load coords from /data/coords.json if present
    fetch("/data/coords.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((coords) => {
        if (!coords || !coords.length) {
          coordsList.textContent = "No coords available.";
          return;
        }
        coordsList.innerHTML = coords
          .slice(0, 10)
          .map(
            (c) =>
              `<div class="py-1">${esc(c.name || c.label || "—")} — ${esc(
                c.lat
              )}, ${esc(c.lng)}</div>`
          )
          .join("");
      })
      .catch(() => {
        coordsList.textContent = "Failed to load coords.";
      });
  }

  // handle PGSharp report form (simple client-side submit behavior)
  const reportForm = qs("#pgsharp-report-form");
  if (reportForm) {
    reportForm.addEventListener("submit", (evt) => {
      evt.preventDefault();
      const email = qs("#pgsharp-report-email")?.value || "";
      const message = qs("#pgsharp-report-message")?.value || "";
      // For privacy, just show a local confirmation — server endpoint not configured here.
      reportForm.innerHTML = `<div class="text-green-400">Danke — deine Nachricht wurde lokal verarbeitet.</div>`;
      console.log("PGSharp report (local):", { email, message });
    });
  }
});

// --- Section navigation + Devices loader + PGSharp init (robust) ---

function showSectionByName(name) {
  const normalized = name.endsWith("Section") ? name : `${name}Section`;
  const target =
    document.getElementById(normalized) || document.getElementById(name);
  if (!target) {
    console.warn("showSectionByName: target not found for", name, normalized);
    return;
  }

  // Hide all main sections (pattern: id ending with "Section" or class "page")
  document
    .querySelectorAll('main section[id$="Section"], main .page, .page')
    .forEach((s) => {
      const el = s;
      if (el === target) {
        el.classList.remove("hidden");
        el.style.display = "";
        el.setAttribute("aria-hidden", "false");
      } else {
        el.classList.add("hidden");
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
      }
    });

  // init hooks for specific sections
  const plain = normalized.replace(/Section$/, "");
  if (plain === "devices")
    loadDevices().catch((e) => console.error("loadDevices:", e));
  if (plain === "pgsharp" && typeof setupPgSharpTabs === "function")
    setupPgSharpTabs();
  if (history && history.replaceState)
    history.replaceState(null, "", `#${plain}`);
}

document.addEventListener("click", (ev) => {
  const btn = ev.target.closest && ev.target.closest("[data-section]");
  if (!btn) return;
  ev.preventDefault();
  const sectionName = btn.getAttribute("data-section");
  if (!sectionName) return;
  showSectionByName(sectionName);
});

// on load: honor hash and init default
window.addEventListener("load", () => {
  const hash = (location.hash || "").replace(/^#/, "");
  if (hash) {
    showSectionByName(hash);
  } else {
    // adjust default section name if your app uses something else
    showSectionByName("overview");
  }

  // Ensure PGSharp tabs are available if section present at load
  if (typeof setupPgSharpTabs === "function") {
    try {
      setupPgSharpTabs();
    } catch (e) {
      /* ignore */
    }
  }
});

// Devices loader: fetch /data/devices.json and render inside element with id "devicesSection"
async function loadDevices() {
  const root = document.getElementById("devicesSection");
  if (!root) {
    console.warn("loadDevices: #devicesSection not found");
    return;
  }
  root.innerHTML = '<div class="text-slate-400">Loading devices…</div>';
  try {
    const res = await fetch("/data/devices.json", { cache: "no-store" });
    if (!res.ok) {
      root.innerHTML = `<div class="text-red-400">Failed to load devices (HTTP ${res.status})</div>`;
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      root.innerHTML = `<div class="text-slate-400">No devices available.</div>`;
      return;
    }
    root.innerHTML = data
      .map((d) => {
        const kv = Object.entries(d)
          .map(
            ([k, v]) =>
              `<div class="text-sm"><strong>${escapeHtml(
                k
              )}:</strong> ${escapeHtml(String(v))}</div>`
          )
          .join("");
        return `<div class="device-card p-3 mb-2 bg-slate-800 rounded">${kv}</div>`;
      })
      .join("");
  } catch (e) {
    console.error("loadDevices error", e);
    root.innerHTML = `<div class="text-red-400">Error loading devices.</div>`;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- end block ---
