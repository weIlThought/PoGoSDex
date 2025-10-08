/* =======================================================
   Pokémon GO Compatible Devices — Main JS
   ======================================================= */

// Load device data from JSON (if available), otherwise fallback to defaults
let devices = [];

// Fetch external JSON data (optional)
async function loadDevices() {
  try {
    const res = await fetch("../../data/devices.json");
    if (res.ok) {
      devices = await res.json();
    } else {
      console.warn("No devices.json found — using fallback data.");
      useFallbackData();
    }
  } catch (err) {
    console.warn("Failed to load devices.json:", err);
    useFallbackData();
  }
  initUI();
}

// Fallback sample data
function useFallbackData() {
  devices = [
    {
      id: "d1",
      model: "Google Pixel 7",
      brand: "Google",
      type: "Phone",
      os: "Android 13",
      compatible: true,
      notes: ["Stable GPS performance", "ARCore supported"],
      manufacturerUrl: "https://store.google.com/product/pixel_7",
    },
    {
      id: "d2",
      model: "Apple iPhone 12",
      brand: "Apple",
      type: "Phone",
      os: "iOS 16",
      compatible: true,
      notes: ["AR compatible", "Excellent battery life"],
      manufacturerUrl: "https://www.apple.com/iphone-12/",
    },
    {
      id: "d3",
      model: "Samsung Galaxy Tab S7",
      brand: "Samsung",
      type: "Tablet",
      os: "Android 12",
      compatible: true,
      notes: ["Large display", "GPS via Wi-Fi / BT"],
      manufacturerUrl: "https://www.samsung.com/",
    },
  ];
}

// ====== DOM ELEMENTS ======
const tbody = document.querySelector("#devicesTable tbody");
const searchInput = document.getElementById("searchInput");
const brandSelect = document.getElementById("brandSelect");
const typeSelect = document.getElementById("typeSelect");
const countChip = document.getElementById("countChip");
const clearBtn = document.getElementById("clearBtn");
const exportCsvBtn = document.getElementById("exportCsv");
const addSampleBtn = document.getElementById("addSample");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalDesc = document.getElementById("modalDesc");
const manufacturerLink = document.getElementById("manufacturerLink");
const modalNotesList = document.getElementById("modalNotesList");
const closeModalBtn = document.getElementById("closeModal");

let filteredList = [];

// ====== INITIALIZE UI ======
function initUI() {
  populateBrandOptions();
  applyFilters();

  // Event listeners
  searchInput.addEventListener("input", applyFilters);
  brandSelect.addEventListener("change", applyFilters);
  typeSelect.addEventListener("change", applyFilters);
  clearBtn.addEventListener("click", clearFilters);
  exportCsvBtn.addEventListener("click", exportCsv);
  addSampleBtn.addEventListener("click", addSampleDevices);
  closeModalBtn.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

// ====== POPULATE BRAND DROPDOWN ======
function populateBrandOptions() {
  const brands = Array.from(new Set(devices.map((d) => d.brand))).sort();
  brandSelect.innerHTML =
    '<option value="">All brands</option>' +
    brands.map((b) => `<option value="${b}">${b}</option>`).join("");
}

// ====== RENDER TABLE ======
function renderTable(list) {
  tbody.innerHTML = "";
  list.forEach((d) => {
    const tr = document.createElement("tr");
    tr.dataset.id = d.id;
    tr.innerHTML = `
      <td>${escapeHtml(d.model)}</td>
      <td>${escapeHtml(d.brand)}</td>
      <td>${escapeHtml(d.type)}</td>
      <td>${escapeHtml(d.os)}</td>
      <td>${(d.notes || [])
        .slice(0, 2)
        .map((n) => `<span class="muted">${escapeHtml(n)}</span>`)
        .join(" • ")}</td>
    `;
    tr.addEventListener("click", () => openModal(d));
    tbody.appendChild(tr);
  });
  countChip.textContent = `${list.length} ${
    list.length === 1 ? "item" : "items"
  }`;
}

// ====== ESCAPE HELPER ======
function escapeHtml(str) {
  return String(str).replace(
    /[&<>"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      }[c])
  );
}

// ====== FILTERING ======
function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const brand = brandSelect.value;
  const type = typeSelect.value;

  filteredList = devices.filter((d) => {
    if (brand && d.brand !== brand) return false;
    if (type && d.type !== type) return false;
    if (!q) return true;

    const haystack = [d.model, d.brand, d.os, (d.notes || []).join(" ")]
      .join(" ")
      .toLowerCase();
    if (q.startsWith('"') && q.endsWith('"')) {
      return haystack.includes(q.slice(1, -1));
    }
    return haystack.includes(q);
  });

  renderTable(filteredList);
}

// ====== CLEAR FILTERS ======
function clearFilters() {
  searchInput.value = "";
  brandSelect.value = "";
  typeSelect.value = "";
  applyFilters();
}

// ====== MODAL ======
function openModal(device) {
  modalBackdrop.style.display = "flex";
  modalBackdrop.setAttribute("aria-hidden", "false");
  modalTitle.textContent = device.model;
  modalMeta.textContent = `${device.brand} • ${device.type} • ${device.os}`;
  modalDesc.textContent = device.compatible
    ? "Compatibility: confirmed"
    : "Compatibility: unknown or not verified";
  manufacturerLink.href = device.manufacturerUrl || "#";
  manufacturerLink.textContent = device.manufacturerUrl
    ? "Open manufacturer site"
    : "No link available";
  modalNotesList.innerHTML = (device.notes || [])
    .map((n) => `<li>${escapeHtml(n)}</li>`)
    .join("");
  const colEl = document.querySelector(".modal .col");
  const oldLinks = colEl.querySelector(".root-links");
  if (oldLinks) oldLinks.remove();
  if (device.rootLinks && device.rootLinks.length > 0) {
    const linksHtml = device.rootLinks
      .map(
        (url) =>
          `<li><a href="${url}" target="_blank" class="link">${escapeHtml(
            url
          )}</a></li>`
      )
      .join("");
    const linksSection = document.createElement("div");
    linksSection.classList.add("root-links");
    linksSection.innerHTML = `
      <p class="muted" style="margin-top:10px;"><strong>Root Links:</strong></p>
      <ul class="muted" style="padding-left:16px;">${linksHtml}</ul>
    `;
    colEl.appendChild(linksSection);
  }

  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalBackdrop.style.display = "none";
  modalBackdrop.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

// ====== CSV EXPORT ======
function exportCsv() {
  const rows = [
    ["Model", "Brand", "Type", "OS", "Notes", "ManufacturerURL"],
    ...filteredList.map((d) => [
      d.model,
      d.brand,
      d.type,
      d.os,
      (d.notes || []).join("; "),
      d.manufacturerUrl || "",
    ]),
  ];

  const csv = rows
    .map((r) =>
      r.map((field) => `"${String(field || "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pokemon-go-compatible-devices.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ====== ADD SAMPLE DEVICES ======
function addSampleDevices() {
  const samples = [
    {
      id: "d4",
      model: "Xiaomi 12",
      brand: "Xiaomi",
      type: "Phone",
      os: "Android 13",
      compatible: true,
      notes: ["Good GPS stability"],
      manufacturerUrl: "https://www.mi.com",
    },
    {
      id: "d5",
      model: "OnePlus 11",
      brand: "OnePlus",
      type: "Phone",
      os: "Android 13",
      compatible: true,
      notes: ["Fast performance", "Strong GPS signal"],
      manufacturerUrl: "https://www.oneplus.com",
    },
  ];

  for (const s of samples) {
    if (!devices.find((d) => d.id === s.id)) devices.push(s);
  }

  populateBrandOptions();
  applyFilters();
}

// ====== START ======
loadDevices();
