const apiBase = "/api/devices";
const table = document.getElementById("deviceTable");
const modal = document.getElementById("deviceModal");
const form = document.getElementById("deviceForm");
const addBtn = document.getElementById("addDeviceBtn");
const cancelBtn = document.getElementById("cancelBtn");
const modalTitle = document.getElementById("modalTitle");
const logoutBtn = document.getElementById("logoutBtn");

async function fetchDevices() {
  const res = await fetch(apiBase);
  const devices = await res.json();
  renderTable(devices);
}

function renderTable(devices) {
  table.innerHTML = "";
  devices.forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="px-3 py-2">${d.brand}</td>
      <td class="px-3 py-2">${d.model}</td>
      <td class="px-3 py-2">${d.os}</td>
      <td class="px-3 py-2">${d.type}</td>
      <td class="px-3 py-2">${d.compatible ? "✅" : "❌"}</td>
      <td class="px-3 py-2">
        <button class="text-sky-400 hover:underline" onclick="editDevice('${
          d.id
        }')">Edit</button> |
        <button class="text-red-400 hover:underline" onclick="deleteDevice('${
          d.id
        }')">Delete</button>
      </td>`;
    table.appendChild(tr);
  });
}

function openModal(editing = false, device = {}) {
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  modalTitle.textContent = editing ? "Edit Device" : "Add Device";

  form.deviceId.value = device.id || "";
  form.brand.value = device.brand || "";
  form.model.value = device.model || "";
  form.os.value = device.os || "";
  form.type.value = device.type || "";
  form.compatible.checked = device.compatible || false;
  form.notes.value = (device.notes || []).join(", ");
  form.rootLinks.value = (device.rootLinks || []).join(", ");
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  form.reset();
}

addBtn.onclick = () => openModal();
cancelBtn.onclick = closeModal;

form.onsubmit = async (e) => {
  e.preventDefault();
  const data = {
    brand: form.brand.value,
    model: form.model.value,
    os: form.os.value,
    type: form.type.value,
    compatible: form.compatible.checked,
    notes: form.notes.value
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean),
    rootLinks: form.rootLinks.value
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean),
  };
  const id = form.deviceId.value;
  const method = id ? "PUT" : "POST";
  const url = id ? `${apiBase}/${id}` : apiBase;
  await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  closeModal();
  fetchDevices();
};

async function editDevice(id) {
  const res = await fetch(`${apiBase}/${id}`);
  const device = await res.json();
  openModal(true, device);
}

async function deleteDevice(id) {
  if (!confirm("Delete this device?")) return;
  await fetch(`${apiBase}/${id}`, { method: "DELETE" });
  fetchDevices();
}

logoutBtn.onclick = async () => {
  await fetch("/api/logout", { method: "POST" });
  location.href = "/admin/login.html";
};

fetchDevices();

// --- i18n helper (appended) ---
(function () {
  const LANG_KEY = "lang";
  let i18n = {};
  let currentLang =
    localStorage.getItem(LANG_KEY) || (navigator.language || "en").slice(0, 2);

  function qs(s) {
    return document.querySelector(s);
  }
  function qsa(s) {
    return Array.from(document.querySelectorAll(s));
  }

  // t(key, fallback)
  function t(k, f) {
    return (i18n && i18n[k]) || f || k;
  }

  async function loadAdminLang(lang) {
    try {
      const res = await fetch(`/lang/${lang}.json`);
      if (!res.ok) throw new Error("lang not found");
      i18n = await res.json();
      currentLang = lang;
      localStorage.setItem(LANG_KEY, lang);
      applyAdminTranslations();
    } catch (err) {
      console.warn("Failed to load admin lang", lang, err);
    }
  }

  function applyAdminTranslations() {
    // document title
    document.title = t("admin_dashboard_title", document.title);

    // Generic: elements with data-i18n="key" -> textContent
    qsa("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const target = el.getAttribute("data-i18n-target") || "text";
      const txt = t(key, el.textContent || "");
      if (target === "text") {
        el.textContent = txt;
      } else if (target === "html") {
        el.innerHTML = txt;
      } else if (target === "placeholder") {
        el.setAttribute("placeholder", txt);
      } else if (target === "title") {
        el.setAttribute("title", txt);
      } else if (target === "value") {
        el.value = txt;
      }
    });

    // set langSelect value if present
    const ls = qs("#langSelect");
    if (ls) ls.value = currentLang;
  }

  // Wire lang select change
  document.addEventListener("DOMContentLoaded", () => {
    const ls = qs("#langSelect");
    if (ls) {
      ls.value = currentLang;
      ls.addEventListener("change", (e) => {
        const lang = e.target.value;
        const params = new URLSearchParams(window.location.search);
        params.set("lang", lang);
        history.replaceState(
          null,
          "",
          `${location.pathname}?${params.toString()}`
        );
        loadAdminLang(lang);
      });
    }

    // initial load
    loadAdminLang(currentLang);
  });
})();
