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
    if (name === 'overview') loadOverview();
    if (name === 'devices') loadDevices();
    if (name === 'news') loadNews();
    if (name === 'coords') loadCoords();
  }

  // Sorting state and helpers
  const sortState = {
    devices: { key: 'id', dir: 'desc' },
    news: { key: 'id', dir: 'desc' },
    coords: { key: 'id', dir: 'desc' },
  };

  function applySortIndicators(tableId, { key, dir }) {
    qsa(`#${tableId} thead th[data-sort]`).forEach((th) => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.sort === key) th.classList.add(dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    });
  }

  function sortItems(items, { key, dir }) {
    const copy = [...(items || [])];
    const mul = dir === 'asc' ? 1 : -1;
    return copy.sort((a, b) => {
      const va = a?.[key];
      const vb = b?.[key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
      return String(va ?? '').localeCompare(String(vb ?? ''), 'de', { numeric: true }) * mul;
    });
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
    if (!res.ok) {
      try {
        const msg = await res.text();
        showToast(`Geräteliste fehlgeschlagen: ${msg.slice(0, 120)}`, 'error');
      } catch {
        showToast('Geräteliste fehlgeschlagen', 'error');
      }
      return;
    }
    const json = await res.json();
    const items = sortItems(json.items, sortState.devices);
    const tbody = qs('#devTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('devTable', sortState.devices);
    for (const d of items) {
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
    if (!res.ok) {
      try {
        const msg = await res.text();
        showToast(`News-Laden fehlgeschlagen: ${msg.slice(0, 120)}`, 'error');
      } catch {
        showToast('News-Laden fehlgeschlagen', 'error');
      }
      return;
    }
    const json = await res.json();
    const items = sortItems(json.items, sortState.news);
    const tbody = qs('#newsTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('newsTable', sortState.news);
    for (const n of items) {
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

    // Coords
    qs('#coordsRefresh')?.addEventListener('click', loadCoords);
    qs('#coordsSearch')?.addEventListener('change', loadCoords);
    qs('#coordsCategory')?.addEventListener('change', loadCoords);
    qs('#coordsNew')?.addEventListener('click', () => openCoordsDialog(null));
    qs('#coordsSave')?.addEventListener('click', (e) => {
      e.preventDefault();
      saveCoord();
    });
    qs('#coordsTable')?.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.editCoord) {
        const id = Number(t.dataset.editCoord);
        const row = t.closest('tr');
        openCoordsDialog({
          id,
          category: row.children[1].textContent,
          name: row.children[2].textContent,
          lat: row.children[3].textContent,
          lng: row.children[4].textContent,
          note: '',
          tags: [],
        });
      }
      if (t.dataset.delCoord) {
        await deleteCoord(Number(t.dataset.delCoord));
      }
    });

    // Sort click handlers
    qsa('#devTable thead th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const st = sortState.devices;
        st.dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
        st.key = key;
        loadDevices();
      })
    );
    qsa('#newsTable thead th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const st = sortState.news;
        st.dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
        st.key = key;
        loadNews();
      })
    );
    qsa('#coordsTable thead th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const st = sortState.coords;
        st.dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
        st.key = key;
        loadCoords();
      })
    );

    // Overview events
    qs('#ovRefresh')?.addEventListener('click', loadOverview);
    qs('#ovRange')?.addEventListener('change', loadOverview);
  }

  // Coords
  async function loadCoords() {
    const q = (qs('#coordsSearch')?.value || '').trim();
    const category = (qs('#coordsCategory')?.value || '').trim();
    const url = new URL('/admin/api/coords', location.origin);
    if (q) url.searchParams.set('q', q);
    if (category) url.searchParams.set('category', category);
    const res = await fetch(url);
    if (res.status === 401) {
      location.href = '/login.html';
      return;
    }
    if (!res.ok) {
      try {
        const msg = await res.text();
        showToast(`Coords-Laden fehlgeschlagen: ${msg.slice(0, 120)}`, 'error');
      } catch {
        showToast('Coords-Laden fehlgeschlagen', 'error');
      }
      return;
    }
    const json = await res.json();
    const items = sortItems(json.items, sortState.coords);
    const tbody = qs('#coordsTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('coordsTable', sortState.coords);
    for (const c of items) {
      const tr = document.createElement('tr');
      const tags = Array.isArray(c.tags) ? c.tags.join(', ') : c.tags || '';
      tr.innerHTML = `<td>${c.id}</td><td>${escapeHtml(c.category)}</td><td>${escapeHtml(
        c.name
      )}</td><td>${c.lat}</td><td>${c.lng}</td><td>${escapeHtml(tags)}</td><td>
        <button class="btn" data-edit-coord="${c.id}">Bearbeiten</button>
        <button class="btn danger" data-del-coord="${c.id}">Löschen</button>
      </td>`;
      tbody.appendChild(tr);
    }
  }

  // Overview
  async function fetchOverview(range) {
    const u = new URL('/admin/api/overview', location.origin);
    if (range) u.searchParams.set('range', range);
    const res = await fetch(u);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
  async function loadOverview() {
    try {
      const range = qs('#ovRange')?.value || '7d';
      const [r1, r7, r30, rSel] = await Promise.all([
        fetchOverview('1d'),
        fetchOverview('7d'),
        fetchOverview('30d'),
        fetchOverview(range),
      ]);
      qs('#ovToday') && (qs('#ovToday').textContent = String(r1.total ?? 0));
      qs('#ov7') && (qs('#ov7').textContent = String(r7.total ?? 0));
      qs('#ov30') && (qs('#ov30').textContent = String(r30.total ?? 0));
      const total = rSel.total ?? 0;
      const from = rSel.range?.from || '';
      const to = rSel.range?.to || '';
      qs('#ovTotal') && (qs('#ovTotal').textContent = `${total} Besucher von ${from} bis ${to}`);
    } catch (e) {
      showToast('Overview laden fehlgeschlagen', 'error');
    }
  }

  function openCoordsDialog(data) {
    const dlg = qs('#coordsDialog');
    const form = qs('#coordsForm');
    form.reset();
    if (data) {
      form.id.value = data.id;
      form.category.value = data.category || 'top10';
      form.name.value = data.name || '';
      form.lat.value = data.lat ?? '';
      form.lng.value = data.lng ?? '';
      form.note.value = data.note || '';
      form.tags.value = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags || '';
      qs('#coordsDialogTitle').textContent = 'Coord bearbeiten';
    } else {
      qs('#coordsDialogTitle').textContent = 'Coord erstellen';
    }
    dlg.showModal();
  }

  async function saveCoord() {
    const form = qs('#coordsForm');
    const id = form.id.value ? Number(form.id.value) : null;
    const payload = {
      category: form.category.value,
      name: form.name.value.trim(),
      lat: parseFloat(form.lat.value),
      lng: parseFloat(form.lng.value),
      note: form.note.value.trim() || null,
      tags: (form.tags.value || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (!payload.name || !Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
      showToast('Name und gültige Koordinaten sind erforderlich', 'error');
      return;
    }
    try {
      if (id) {
        await putJson(`/admin/api/coords/${id}`, payload, { csrf: state.csrf });
      } else {
        await postJson('/admin/api/coords', payload, { csrf: state.csrf });
      }
      qs('#coordsDialog').close();
      showToast('Gespeichert');
      await loadCoords();
    } catch (e) {
      showToast('Speichern fehlgeschlagen', 'error');
    }
  }

  async function deleteCoord(id) {
    if (!confirm('Wirklich löschen?')) return;
    try {
      await del(`/admin/api/coords/${id}`, { csrf: state.csrf });
      showToast('Gelöscht');
      await loadCoords();
    } catch (e) {
      showToast('Löschen fehlgeschlagen', 'error');
    }
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
