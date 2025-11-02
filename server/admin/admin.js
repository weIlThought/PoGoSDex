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
      const notesCount = Array.isArray(d.notes) ? d.notes.length : d.notes ? 1 : 0;
      const rootsCount = Array.isArray(d.root_links) ? d.root_links.length : d.root_links ? 1 : 0;
      const manuf = d.manufacturer_url
        ? `<a href="${attr(d.manufacturer_url)}" target="_blank">Link</a>`
        : '';
      tr.innerHTML = `<td>${d.id}</td>
        <td>${escapeHtml(d.model || d.name || '')}</td>
        <td>${escapeHtml(d.brand || '')}</td>
        <td>${escapeHtml(d.type || '')}</td>
        <td>${escapeHtml(d.os || '')}</td>
        <td>${d.compatible ? 'Yes' : 'No'}</td>
        <td>${escapeHtml(d.price_range || '')}</td>
        <td>${escapeHtml(d.pogo_comp || '')}</td>
        <td>${manuf}</td>
        <td>${notesCount}</td>
        <td>${rootsCount}</td>
        <td>
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
      form.model.value = data.model || '';
      form.brand.value = data.brand || '';
      form.type.value = data.type || '';
      form.os.value = data.os || '';
      form.compatible.value = data.compatible ? '1' : '0';
      form.price_range.value = data.price_range || '';
      form.pogo_comp.value = data.pogo_comp || '';
      form.manufacturer_url.value = data.manufacturer_url || '';
      form.notes.value = Array.isArray(data.notes) ? data.notes.join('\n') : data.notes || '';
      form.root_links.value = Array.isArray(data.root_links)
        ? data.root_links.join('\n')
        : data.root_links || '';
      qs('#devDialogTitle').textContent = 'Device bearbeiten';
    } else {
      qs('#devDialogTitle').textContent = 'Device erstellen';
    }
    dlg.showModal();
  }

  async function saveDevice() {
    const form = qs('#devForm');
    const id = form.id.value ? Number(form.id.value) : null;
    const notes = (form.notes.value || '')
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const rootLinks = (form.root_links.value || '')
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      model: form.model.value.trim(),
      brand: form.brand.value.trim() || null,
      type: form.type.value.trim() || null,
      os: form.os.value.trim() || null,
      compatible: form.compatible.value === '1',
      price_range: form.price_range.value.trim() || null,
      pogo_comp: form.pogo_comp.value.trim() || null,
      manufacturer_url: form.manufacturer_url.value.trim() || null,
      notes,
      root_links: rootLinks,
      // legacy: backend falls back to name if provided
      name: form.model.value.trim(),
    };
    if (!payload.model) {
      showToast('Model ist erforderlich', 'error');
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
      const tags = Array.isArray(n.tags) ? n.tags.join(', ') : n.tags || '';
      tr.innerHTML = `<td>${escapeHtml(n.slug || '')}</td>
        <td>${escapeHtml(n.date || '')}</td>
        <td>${escapeHtml(n.title)}</td>
        <td>${escapeHtml(n.excerpt || '')}</td>
        <td>${escapeHtml(n.published_at || '')}</td>
        <td>${escapeHtml(n.updated_at_ext || '')}</td>
        <td>${escapeHtml(tags)}</td>
        <td>
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
      form.slug.value = data.slug || '';
      form.date.value = data.date || '';
      form.title.value = data.title || '';
      form.excerpt.value = data.excerpt || '';
      form.content.value = data.content || '';
      form.published_at.value = data.published_at ? data.published_at.replace('Z', '') : '';
      form.updated_at_ext.value = data.updated_at_ext ? data.updated_at_ext.replace('Z', '') : '';
      form.tags.value = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags || '';
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
      slug: form.slug.value.trim() || null,
      date: form.date.value || null,
      title: form.title.value.trim(),
      excerpt: form.excerpt.value.trim() || null,
      content: form.content.value.trim(),
      publishedAt: form.published_at.value || null,
      updatedAt: form.updated_at_ext.value || null,
      tags: (form.tags.value || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
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
    qs('#devCancel')?.addEventListener('click', () => qs('#devDialog')?.close());
    qs('#devSave')?.addEventListener('click', (e) => {
      e.preventDefault();
      saveDevice();
    });
    qs('#devTable')?.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.edit) {
        const id = Number(t.dataset.edit);
        const row = t.closest('tr');
        openDevDialog({
          id,
          model: row.children[1]?.textContent || '',
          brand: row.children[2]?.textContent || '',
          type: row.children[3]?.textContent || '',
          os: row.children[4]?.textContent || '',
          compatible: row.children[5]?.textContent === 'Yes',
          price_range: row.children[6]?.textContent || '',
          pogo_comp: row.children[7]?.textContent || '',
          manufacturer_url: row.children[8]?.querySelector('a')?.getAttribute('href') || '',
          notes: [],
          root_links: [],
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
    qs('#newsCancel')?.addEventListener('click', () => qs('#newsDialog')?.close());
    qs('#newsSave')?.addEventListener('click', (e) => {
      e.preventDefault();
      saveNews();
    });
    qs('#newsTable')?.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.editNews) {
        const id = Number(t.dataset.editNews);
        const row = t.closest('tr');
        openNewsDialog({
          id,
          slug: row.children[0]?.textContent || '',
          date: row.children[1]?.textContent || '',
          title: row.children[2]?.textContent || '',
          excerpt: row.children[3]?.textContent || '',
          published_at: row.children[4]?.textContent || '',
          updated_at_ext: row.children[5]?.textContent || '',
          tags: (row.children[6]?.textContent || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
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
    qs('#coordsCancel')?.addEventListener('click', () => qs('#coordsDialog')?.close());
    qs('#coordsSave')?.addEventListener('click', (e) => {
      e.preventDefault();
      saveCoord();
    });
    qs('#coordsTable')?.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.editCoord) {
        const id = Number(t.dataset.editCoord);
        try {
          // Hol vollständige Daten vom Server
          const res = await fetch(`/admin/api/coords/${id}`);
          if (res.ok) {
            const data = await res.json();
            openCoordsDialog(data);
          } else {
            // Fallback: aus Tabellenzeile lesen
            const row = t.closest('tr');
            const tagsTxt = row.children[5]?.textContent || '';
            openCoordsDialog({
              id,
              category: row.children[1].textContent,
              name: row.children[2].textContent,
              lat: row.children[3].textContent,
              lng: row.children[4].textContent,
              note: '',
              tags: tagsTxt
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }
        } catch {
          // bei Fehlern ebenfalls Fallback aus Zeile
          const row = t.closest('tr');
          const tagsTxt = row.children[5]?.textContent || '';
          openCoordsDialog({
            id,
            category: row.children[1].textContent,
            name: row.children[2].textContent,
            lat: row.children[3].textContent,
            lng: row.children[4].textContent,
            note: '',
            tags: tagsTxt
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          });
        }
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

    // Close dialogs on backdrop click (CSP-safe, no inline handlers)
    const initDialogClose = (dlg) => {
      if (!dlg) return;
      // Some browsers fire click on <dialog> when clicking backdrop
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) dlg.close();
      });
      // Fallback: check bounds on mousedown
      dlg.addEventListener('mousedown', (e) => {
        const rect = dlg.getBoundingClientRect();
        const inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (!inside) dlg.close();
      });
    };
    initDialogClose(qs('#devDialog'));
    initDialogClose(qs('#newsDialog'));
    initDialogClose(qs('#coordsDialog'));
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
