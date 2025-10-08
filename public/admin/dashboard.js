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
