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
  const compat = d.compatible
    ? '<span class="inline-block bg-emerald-600/20 text-emerald-300 px-2 py-1 rounded text-xs">Compatible</span>'
    : '<span class="inline-block bg-amber-600/20 text-amber-300 px-2 py-1 rounded text-xs">Unverified</span>';
  return `<article class="card-hover bg-slate-800 border border-slate-700 rounded-lg p-4 cursor-pointer" data-id="${esc(
    d.id
  )}"><div class="flex items-start justify-between"><div><h3 class="text-lg font-semibold">${esc(
    d.model
  )}</h3><p class="text-sm text-slate-400">${esc(d.brand)} • ${esc(
    d.type
  )}</p></div><div>${compat}</div></div><p class="mt-3 text-slate-300 text-sm">${esc(
    d.os
  )}</p></article>`;
}
function renderDevices(list) {
  const wrap = qs("#gridWrap");
  wrap.innerHTML = "";
  if (list.length === 0) {
    wrap.innerHTML =
      '<div class="col-span-full text-center text-slate-400">No devices found</div>';
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
    ? "Compatibility: confirmed"
    : "Compatibility: unknown or not verified";
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
    const ms = q ? hay.includes(q) : true;
    const mt = type === "all" ? true : d.type === type;
    return ms && mt;
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
qs("#clearBtn")?.addEventListener("click", () => {
  qs("#searchInput").value = "";
  qs("#typeFilter").value = "all";
  qs("#sortSelect").value = "default";
  applyFilters();
});
qs("#menuBtn")?.addEventListener("click", () =>
  qs("#menu").classList.toggle("hidden")
);
qs("#langSelect")?.addEventListener("change", (e) => {
  const params = new URLSearchParams(window.location.search);
  params.set("lang", e.target.value);
  window.location.search = params.toString();
});
loadDevices();
