(() => {
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const $toast = () => qs('#toast');

  function showToast(msg, type = 'info') {
    const t = $toast();
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    t.style.borderColor = type === 'error' ? '#ef4444' : '#3b82f6';
    clearTimeout(showToast._tid);
    showToast._tid = setTimeout(() => {
      t.hidden = true;
    }, 2500);
  }

  async function postJson(url, body, { csrf } = {}) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
  async function putJson(url, body, { csrf } = {}) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
  async function del(url, { csrf } = {}) {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  const isLoginPage = !!qs('#loginForm');
  if (isLoginPage) {
    const $form = qs('#loginForm');
    const $err = qs('#loginError');
    $form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      $err.hidden = true;
      $err.textContent = '';
      const fd = new FormData($form);
      const payload = Object.fromEntries(fd.entries());
      try {
        await postJson('/admin/login', payload);
        location.href = '/admin.html';
      } catch (e) {
        $err.hidden = false;
        $err.textContent = 'Login fehlgeschlagen';
      }
    });
    return;
  }

  // Admin page
  const state = { csrf: null };

  async function ensureMe() {
    const res = await fetch('/admin/me');
    if (res.status === 401) {
      location.href = '/login.html';
      return null;
    }
    const json = await res.json();
    state.csrf = json.csrf;
    return json.user;
  }

  function switchTab(name) {
    qsa('.tab').forEach((btn) => {
      const is = btn.dataset.tab === name;
      btn.classList.toggle('active', is);
      btn.setAttribute('aria-selected', String(is));
    });
    qsa('.panel').forEach((p) => p.classList.add('hidden'));
    qs(`#panel-${name}`)?.classList.remove('hidden');
  }

  // Devices
  async function loadDevices() {
    const q = (qs('#devSearch')?.value || '').trim();
    const url = new URL('/admin/api/devices', location.origin);
    if (q) url.searchParams.set('q', q);
    const res = await fetch(url);
    if (res.status === 401) {
      location.href = '/login.html';
      return;
    }
    const json = await res.json();
    const tbody = qs('#devTable tbody');
    tbody.innerHTML = '';
    for (const d of json.items) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.id}</td><td>${escapeHtml(d.name)}</td><td>${escapeHtml(
        d.status || ''
      )}</td><td>${
        d.image_url ? `<a href="${attr(d.image_url)}" target="_blank">Bild</a>` : ''
      }</td><td>
        <button class="btn" data-edit="${d.id}">Bearbeiten</button>
        <button class="btn danger" data-del="${d.id}">Löschen</button>
      </td>`;
      tbody.appendChild(tr);
    }
  }

  function openDevDialog(data) {
    const dlg = qs('#devDialog');
    const form = qs('#devForm');
    form.reset();
    if (data) {
      form.id.value = data.id;
      form.name.value = data.name || '';
      form.status.value = data.status || 'active';
      form.image_url.value = data.image_url || '';
      form.description.value = data.description || '';
      qs('#devDialogTitle').textContent = 'Device bearbeiten';
    } else {
      qs('#devDialogTitle').textContent = 'Device erstellen';
    }
    dlg.showModal();
  }

  async function saveDevice() {
    const form = qs('#devForm');
    const id = form.id.value ? Number(form.id.value) : null;
    const payload = {
      name: form.name.value.trim(),
      status: form.status.value,
      image_url: form.image_url.value.trim() || null,
      description: form.description.value.trim() || null,
    };
    if (!payload.name) {
      showToast('Name ist erforderlich', 'error');
      return;
    }
    try {
      if (id) {
        await putJson(`/admin/api/devices/${id}`, payload, { csrf: state.csrf });
      } else {
        await postJson('/admin/api/devices', payload, { csrf: state.csrf });
      }
      qs('#devDialog').close();
      showToast('Gespeichert');
      await loadDevices();
    } catch (e) {
      showToast('Speichern fehlgeschlagen', 'error');
    }
  }

  async function deleteDevice(id) {
    if (!confirm('Wirklich löschen?')) return;
    try {
      await del(`/admin/api/devices/${id}`, { csrf: state.csrf });
      showToast('Gelöscht');
      await loadDevices();
    } catch (e) {
      showToast('Löschen fehlgeschlagen', 'error');
    }
  }

  // News
  async function loadNews() {
    const q = (qs('#newsSearch')?.value || '').trim();
    const url = new URL('/admin/api/news', location.origin);
    if (q) url.searchParams.set('q', q);
    const res = await fetch(url);
    if (res.status === 401) {
      location.href = '/login.html';
      return;
    }
    const json = await res.json();
    const tbody = qs('#newsTable tbody');
    tbody.innerHTML = '';
    for (const n of json.items) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${n.id}</td><td>${escapeHtml(n.title)}</td><td>${
        n.published ? 'Ja' : 'Nein'
      }</td><td>${
        n.image_url ? `<a href="${attr(n.image_url)}" target="_blank">Bild</a>` : ''
      }</td><td>
        <button class="btn" data-edit-news="${n.id}">Bearbeiten</button>
        <button class="btn danger" data-del-news="${n.id}">Löschen</button>
      </td>`;
      tbody.appendChild(tr);
    }
  }

  function openNewsDialog(data) {
    const dlg = qs('#newsDialog');
    const form = qs('#newsForm');
    form.reset();
    if (data) {
      form.id.value = data.id;
      form.title.value = data.title || '';
      form.published.value = String(data.published ? 1 : 0);
      form.image_url.value = data.image_url || '';
      form.content.value = data.content || '';
      qs('#newsDialogTitle').textContent = 'News bearbeiten';
    } else {
      qs('#newsDialogTitle').textContent = 'News erstellen';
    }
    dlg.showModal();
  }

  async function saveNews() {
    const form = qs('#newsForm');
    const id = form.id.value ? Number(form.id.value) : null;
    const payload = {
      title: form.title.value.trim(),
      published: form.published.value === '1',
      image_url: form.image_url.value.trim() || null,
      content: form.content.value.trim(),
    };
    if (!payload.title || !payload.content) {
      showToast('Titel und Inhalt sind erforderlich', 'error');
      return;
    }
    try {
      if (id) {
        await putJson(`/admin/api/news/${id}`, payload, { csrf: state.csrf });
      } else {
        await postJson('/admin/api/news', payload, { csrf: state.csrf });
      }
      qs('#newsDialog').close();
      showToast('Gespeichert');
      await loadNews();
    } catch (e) {
      showToast('Speichern fehlgeschlagen', 'error');
    }
  }

  async function deleteNews(id) {
    if (!confirm('Wirklich löschen?')) return;
    try {
      await del(`/admin/api/news/${id}`, { csrf: state.csrf });
      showToast('Gelöscht');
      await loadNews();
    } catch (e) {
      showToast('Löschen fehlgeschlagen', 'error');
    }
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"]/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
        }[c])
    );
  }
  function attr(s) {
    return String(s).replace(/["'`<>\s]/g, '_');
  }

  function attachEvents() {
    // Tabs
    qsa('.tab').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    // Logout
    qs('#logoutBtn')?.addEventListener('click', async () => {
      try {
        await postJson('/admin/logout', {});
        location.href = '/login.html';
      } catch {
        location.href = '/login.html';
      }
    });

    // Devices
    qs('#devRefresh')?.addEventListener('click', loadDevices);
    qs('#devSearch')?.addEventListener('change', loadDevices);
    qs('#devNew')?.addEventListener('click', () => openDevDialog(null));
    qs('#devSave')?.addEventListener('click', (e) => {
      e.preventDefault();
      saveDevice();
    });
    qs('#devTable')?.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.edit) {
        // fetch current and open
        const id = Number(t.dataset.edit);
        const res = await fetch(`/admin/api/devices?limit=1&offset=0&q=${id}`);
        await loadDevices(); // ensure list (for simplicity, just reload)
        // A small trick: we don't have an endpoint get by id open; simplify by reading row
        const row = t.closest('tr');
        openDevDialog({
          id,
          name: row.children[1].textContent,
          status: row.children[2].textContent,
          image_url: row.children[3].querySelector('a')?.getAttribute('href') || '',
          description: '',
        });
      }
      if (t.dataset.del) {
        await deleteDevice(Number(t.dataset.del));
      }
    });

    // News
    qs('#newsRefresh')?.addEventListener('click', loadNews);
    qs('#newsSearch')?.addEventListener('change', loadNews);
    qs('#newsNew')?.addEventListener('click', () => openNewsDialog(null));
    qs('#newsSave')?.addEventListener('click', (e) => {
      e.preventDefault();
      saveNews();
    });
    qs('#newsTable')?.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.editNews) {
        const id = Number(t.dataset.editNews);
        // naive: open dialog with partial info; for full content we'd need GET by id
        const row = t.closest('tr');
        openNewsDialog({
          id,
          title: row.children[1].textContent,
          published: row.children[2].textContent === 'Ja',
          image_url: row.children[3].querySelector('a')?.getAttribute('href') || '',
          content: '',
        });
      }
      if (t.dataset.delNews) {
        await deleteNews(Number(t.dataset.delNews));
      }
    });
  }

  window.addEventListener('DOMContentLoaded', async () => {
    if (!isLoginPage) {
      const u = await ensureMe();
      if (!u) return;
      attachEvents();
      await loadDevices();
    }
  });
})();
