(() => {
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const $toast = () => qs('#toast');

  
  const ADMIN_I18N = {
    de: {
      toast_pulls_failed: 'Pull Requests laden fehlgeschlagen',
      toast_archive_failed: 'Archiv laden fehlgeschlagen',
      toast_devices_list_failed: 'Geräteliste fehlgeschlagen: {err}',
      toast_devices_list_failed_generic: 'Geräteliste fehlgeschlagen',
      toast_model_required: 'Model ist erforderlich',
      toast_saved: 'Gespeichert',
      toast_save_failed: 'Speichern fehlgeschlagen',
      toast_deleted: 'Gelöscht',
      toast_delete_failed: 'Löschen fehlgeschlagen',
      toast_news_list_failed: 'News-Laden fehlgeschlagen: {err}',
      toast_news_list_failed_generic: 'News-Laden fehlgeschlagen',
      toast_news_required: 'Titel und Inhalt sind erforderlich',
      toast_coords_list_failed: 'Coords-Laden fehlgeschlagen: {err}',
      toast_coords_list_failed_generic: 'Coords-Laden fehlgeschlagen',
      toast_proposal_accepted: 'Vorschlag angenommen',
      toast_proposal_accepted_with_id: 'Vorschlag angenommen – Gerät ID: {id}',
      toast_accept_failed: 'Annehmen fehlgeschlagen',
      toast_reject_ok: 'Vorschlag abgelehnt',
      toast_reject_failed: 'Ablehnen fehlgeschlagen',
    },
    en: {
      toast_pulls_failed: 'Failed to load pull requests',
      toast_archive_failed: 'Failed to load archive',
      toast_devices_list_failed: 'Failed to load devices: {err}',
      toast_devices_list_failed_generic: 'Failed to load devices',
      toast_model_required: 'Model is required',
      toast_saved: 'Saved',
      toast_save_failed: 'Save failed',
      toast_deleted: 'Deleted',
      toast_delete_failed: 'Delete failed',
      toast_news_list_failed: 'Failed to load news: {err}',
      toast_news_list_failed_generic: 'Failed to load news',
      toast_news_required: 'Title and content are required',
      toast_coords_list_failed: 'Failed to load coords: {err}',
      toast_coords_list_failed_generic: 'Failed to load coords',
      toast_proposal_accepted: 'Proposal approved',
      toast_proposal_accepted_with_id: 'Proposal approved – Device ID: {id}',
      toast_accept_failed: 'Approve failed',
      toast_reject_ok: 'Proposal rejected',
      toast_reject_failed: 'Reject failed',
    },
  };
  const adminLang = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
  function tAdmin(key, fallback, params = {}) {
    const dict = ADMIN_I18N[adminLang] || ADMIN_I18N.en;
    let out = (dict && dict[key]) || ADMIN_I18N.en[key] || fallback || key;
    if (out && params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return out;
  }

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
    if (name === 'dashboard') loadDashboard();
    if (name === 'issues') loadIssues();
    if (name === 'devices') loadDevices();
    if (name === 'news') loadNews();
    if (name === 'coords') loadCoords();
    if (name === 'pulls') loadPulls();
    if (name === 'archive') loadArchive();
  }

  
  const sortState = {
    issues: { key: 'id', dir: 'desc' },
    devices: { key: 'id', dir: 'desc' },
    news: { key: 'id', dir: 'desc' },
    coords: { key: 'id', dir: 'desc' },
    pulls: { key: 'id', dir: 'desc' },
    archive: { key: 'id', dir: 'desc' },
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

  
  async function loadPulls() {
    const q = (qs('#pullsSearch')?.value || '').trim();
    const url = new URL('/admin/api/proposals', location.origin);
    url.searchParams.set('status', 'pending');
    if (q) url.searchParams.set('q', q);
    const res = await fetch(url);
    if (res.status === 401) {
      location.href = '/login.html';
      return;
    }
    if (!res.ok) {
      showToast(tAdmin('toast_pulls_failed'), 'error');
      return;
    }
    const json = await res.json();
    const items = sortItems(json.items, sortState.pulls);
    const tbody = qs('#pullsTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('pullsTable', sortState.pulls);
    for (const d of items) {
      const notesCount = Array.isArray(d.notes) ? d.notes.length : d.notes ? 1 : 0;
      const rootsCount = Array.isArray(d.root_links) ? d.root_links.length : d.root_links ? 1 : 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.id}</td>
        <td>${escapeHtml(d.model || '')}</td>
        <td>${escapeHtml(d.brand || '')}</td>
        <td>${escapeHtml(d.type || '')}</td>
        <td>${escapeHtml(d.os || '')}</td>
        <td>${d.compatible ? 'Yes' : 'No'}</td>
        <td>${notesCount}</td>
        <td>${rootsCount}</td>
        <td>
          <button class="btn" data-approve="${d.id}">Annehmen</button>
          <button class="btn danger" data-reject="${d.id}">Ablehnen</button>
        </td>`;
      tbody.appendChild(tr);
    }
  }

  async function loadArchive() {
    const q = (qs('#archiveSearch')?.value || '').trim();
    const url = new URL('/admin/api/proposals', location.origin);
    url.searchParams.set('status', 'rejected');
    if (q) url.searchParams.set('q', q);
    const res = await fetch(url);
    if (res.status === 401) {
      location.href = '/login.html';
      return;
    }
    if (!res.ok) {
      showToast(tAdmin('toast_archive_failed'), 'error');
      return;
    }
    const json = await res.json();
    const items = sortItems(json.items, sortState.archive);
    const tbody = qs('#archiveTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('archiveTable', sortState.archive);
    for (const d of items) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.id}</td>
        <td>${escapeHtml(d.model || '')}</td>
        <td>${escapeHtml(d.brand || '')}</td>
        <td>${escapeHtml(d.type || '')}</td>
        <td>${escapeHtml(d.os || '')}</td>
        <td>${escapeHtml(d.rejected_at || '')}</td>`;
      tbody.appendChild(tr);
    }
  }

  
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
        showToast(
          tAdmin('toast_devices_list_failed', undefined, { err: msg.slice(0, 120) }),
          'error'
        );
      } catch {
        showToast(tAdmin('toast_devices_list_failed_generic'), 'error');
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
      const $id = qs('#devDialogId');
      if ($id) $id.textContent = data.id ? `ID: ${data.id}` : '';
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
      const $id = qs('#devDialogId');
      if ($id) $id.textContent = '';
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
      
      name: form.model.value.trim(),
    };
    if (!payload.model) {
      showToast(tAdmin('toast_model_required'), 'error');
      return;
    }
    try {
      if (id) {
        await putJson(`/admin/api/devices/${id}`, payload, { csrf: state.csrf });
      } else {
        await postJson('/admin/api/devices', payload, { csrf: state.csrf });
      }
      qs('#devDialog').close();
      showToast(tAdmin('toast_saved'));
      await loadDevices();
    } catch (e) {
      showToast(tAdmin('toast_save_failed'), 'error');
    }
  }

  async function deleteDevice(id) {
    if (!confirm('Wirklich löschen?')) return;
    try {
      await del(`/admin/api/devices/${id}`, { csrf: state.csrf });
      showToast(tAdmin('toast_deleted'));
      await loadDevices();
    } catch (e) {
      showToast(tAdmin('toast_delete_failed'), 'error');
    }
  }

  
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
        showToast(tAdmin('toast_news_list_failed', undefined, { err: msg.slice(0, 120) }), 'error');
      } catch {
        showToast(tAdmin('toast_news_list_failed_generic'), 'error');
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
      tr.innerHTML = `<td>${n.id}</td>
        <td>${escapeHtml(n.slug || '')}</td>
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
      const $id = qs('#newsDialogId');
      if ($id) $id.textContent = data.id ? `ID: ${data.id}` : '';
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
      const $id = qs('#newsDialogId');
      if ($id) $id.textContent = '';
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
      showToast(tAdmin('toast_news_required'), 'error');
      return;
    }
    try {
      if (id) {
        await putJson(`/admin/api/news/${id}`, payload, { csrf: state.csrf });
      } else {
        await postJson('/admin/api/news', payload, { csrf: state.csrf });
      }
      qs('#newsDialog').close();
      showToast(tAdmin('toast_saved'));
      await loadNews();
    } catch (e) {
      showToast(tAdmin('toast_save_failed'), 'error');
    }
  }

  async function deleteNews(id) {
    if (!confirm('Wirklich löschen?')) return;
    try {
      await del(`/admin/api/news/${id}`, { csrf: state.csrf });
      showToast(tAdmin('toast_deleted'));
      await loadNews();
    } catch (e) {
      showToast(tAdmin('toast_delete_failed'), 'error');
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
          slug: row.children[1]?.textContent || '',
          date: row.children[2]?.textContent || '',
          title: row.children[3]?.textContent || '',
          excerpt: row.children[4]?.textContent || '',
          published_at: row.children[5]?.textContent || '',
          updated_at_ext: row.children[6]?.textContent || '',
          tags: (row.children[7]?.textContent || '')
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

    // Pulls
    qs('#pullsRefresh')?.addEventListener('click', loadPulls);
    qs('#pullsSearch')?.addEventListener('change', loadPulls);
    qs('#pullsTable')?.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.approve) {
        try {
          const resp = await postJson(
            `/admin/api/proposals/${Number(t.dataset.approve)}/approve`,
            {},
            { csrf: state.csrf }
          );
          const id = resp?.device_id || resp?.deviceId || resp?.device || null;
          showToast(
            id
              ? tAdmin('toast_proposal_accepted_with_id', undefined, { id })
              : tAdmin('toast_proposal_accepted')
          );
          await loadPulls();
          
          switchTab('devices');
          await loadDevices();
        } catch (e) {
          showToast(tAdmin('toast_accept_failed'), 'error');
        }
      }
      if (t.dataset.reject) {
        try {
          await postJson(
            `/admin/api/proposals/${Number(t.dataset.reject)}/reject`,
            {},
            { csrf: state.csrf }
          );
          showToast(tAdmin('toast_reject_ok'));
          await loadPulls();
        } catch (e) {
          showToast(tAdmin('toast_reject_failed'), 'error');
        }
      }
    });

    qsa('#pullsTable thead th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const st = sortState.pulls;
        st.dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
        st.key = key;
        loadPulls();
      })
    );

    
    qs('#archiveRefresh')?.addEventListener('click', loadArchive);
    qs('#archiveSearch')?.addEventListener('change', loadArchive);
    qsa('#archiveTable thead th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const st = sortState.archive;
        st.dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
        st.key = key;
        loadArchive();
      })
    );

    
    qs('#dashRefresh')?.addEventListener('click', loadDashboard);

    
    qs('#issuesRefresh')?.addEventListener('click', loadIssues);
    qs('#issuesSearch')?.addEventListener('change', loadIssues);
    qs('#issuesStatus')?.addEventListener('change', loadIssues);
    qs('#issuesNew')?.addEventListener('click', () => openIssuesDialog(null));
    qs('#issuesCancel')?.addEventListener('click', () => qs('#issuesDialog')?.close());
    qs('#issuesSave')?.addEventListener('click', (e) => {
      e.preventDefault();
      saveIssue();
    });
    qs('#issuesTable')?.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.editIssue) {
        const id = Number(t.dataset.editIssue);
        try {
          const res = await fetch(`/admin/api/issues/${id}`);
          if (res.ok) {
            const data = await res.json();
            openIssuesDialog(data);
          }
        } catch {}
      }
      if (t.dataset.delIssue) {
        await deleteIssue(Number(t.dataset.delIssue));
      }
    });
    qsa('#issuesTable thead th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const st = sortState.issues;
        st.dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
        st.key = key;
        loadIssues();
      })
    );

    
    const initDialogClose = (dlg) => {
      if (!dlg) return;
      
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) dlg.close();
      });
      
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
    initDialogClose(qs('#issuesDialog'));
  }

  
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
        showToast(
          tAdmin('toast_coords_list_failed', undefined, { err: msg.slice(0, 120) }),
          'error'
        );
      } catch {
        showToast(tAdmin('toast_coords_list_failed_generic'), 'error');
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

  // Dashboard
  async function loadDashboard() {
    try {
      const res = await fetch('/admin/api/dashboard');
      if (res.status === 401) {
        location.href = '/login.html';
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      qs('#dashDevices') && (qs('#dashDevices').textContent = String(data.counts?.devices ?? '–'));
      qs('#dashNews') && (qs('#dashNews').textContent = String(data.counts?.news ?? '–'));
      qs('#dashCoords') && (qs('#dashCoords').textContent = String(data.counts?.coords ?? '–'));
      qs('#dashIssues') && (qs('#dashIssues').textContent = String(data.counts?.issues ?? '–'));
      qs('#dashVisitorsToday') &&
        (qs('#dashVisitorsToday').textContent = String(data.visitors?.today ?? '–'));
      qs('#dashVisitors7') &&
        (qs('#dashVisitors7').textContent = String(data.visitors?.last7d ?? '–'));
      qs('#dashVisitors30') &&
        (qs('#dashVisitors30').textContent = String(data.visitors?.last30d ?? '–'));
      qs('#dashVisitorsTotal') &&
        (qs('#dashVisitorsTotal').textContent = String(data.visitors?.totalHits ?? '–'));
      qs('#dashVisitorsDays') &&
        (qs('#dashVisitorsDays').textContent = String(data.visitors?.totalDays ?? '–'));
    } catch (e) {
      showToast('Dashboard laden fehlgeschlagen', 'error');
    }
    try {
      const up = await fetch('/status/uptime');
      if (up.ok) {
        const j = await up.json();
        const state = j.state || 'unknown';
        const ratio = Number.isFinite(j.uptimeRatio) ? `${j.uptimeRatio.toFixed(2)}%` : '–';
        qs('#dashUptimeStatus') && (qs('#dashUptimeStatus').textContent = state);
        qs('#dashUptimeRatio') && (qs('#dashUptimeRatio').textContent = ratio);
      }
    } catch {}
  }

  
  async function loadIssues() {
    const q = (qs('#issuesSearch')?.value || '').trim();
    const status = (qs('#issuesStatus')?.value || '').trim();
    const url = new URL('/admin/api/issues', location.origin);
    if (q) url.searchParams.set('q', q);
    if (status) url.searchParams.set('status', status);
    const res = await fetch(url);
    if (res.status === 401) {
      location.href = '/login.html';
      return;
    }
    if (!res.ok) {
      showToast('Issues laden fehlgeschlagen', 'error');
      return;
    }
    const json = await res.json();
    const items = sortItems(json.items, sortState.issues);
    const tbody = qs('#issuesTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('issuesTable', sortState.issues);
    for (const it of items) {
      const tr = document.createElement('tr');
      const tags = Array.isArray(it.tags) ? it.tags.join(', ') : it.tags || '';
      tr.innerHTML = `<td>${it.id}</td>
        <td>${escapeHtml(it.title || '')}</td>
        <td>${escapeHtml(it.status || '')}</td>
        <td>${escapeHtml(tags)}</td>
        <td>${escapeHtml(it.updated_at || '')}</td>
        <td>
          <button class="btn" data-edit-issue="${it.id}">Bearbeiten</button>
          <button class="btn danger" data-del-issue="${it.id}">Löschen</button>
        </td>`;
      tbody.appendChild(tr);
    }
  }

  function openIssuesDialog(data) {
    const dlg = qs('#issuesDialog');
    const form = qs('#issuesForm');
    form.reset();
    if (data) {
      form.id.value = data.id;
      const $id = qs('#issuesDialogId');
      if ($id) $id.textContent = data.id ? `ID: ${data.id}` : '';
      form.title.value = data.title || '';
      form.status.value = data.status || 'open';
      form.tags.value = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags || '';
      form.content.value = data.content || '';
      qs('#issuesDialogTitle').textContent = 'Issue bearbeiten';
    } else {
      qs('#issuesDialogTitle').textContent = 'Issue erstellen';
      const $id = qs('#issuesDialogId');
      if ($id) $id.textContent = '';
    }
    dlg.showModal();
  }

  async function saveIssue() {
    const form = qs('#issuesForm');
    const id = form.id.value ? Number(form.id.value) : null;
    const payload = {
      title: form.title.value.trim(),
      content: form.content.value.trim(),
      status: form.status.value,
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
        await putJson(`/admin/api/issues/${id}`, payload, { csrf: state.csrf });
        qs('#dashUniquesToday') &&
          (qs('#dashUniquesToday').textContent = String(data.visitors?.uniqueToday ?? '–'));
        qs('#dashUniques7') &&
          (qs('#dashUniques7').textContent = String(data.visitors?.unique7d ?? '–'));
        qs('#dashUniques30') &&
          (qs('#dashUniques30').textContent = String(data.visitors?.unique30d ?? '–'));
        
        const days = data.visitors?.series7?.days || [];
        const hits7 = data.visitors?.series7?.hits || [];
        const uniq7 = data.visitors?.series7?.uniques || [];
        drawSparkline('#dashSparkHits', hits7, { color: '#3b82f6', height: 40, days });
        drawSparkline('#dashSparkUniques', uniq7, { color: '#22c55e', height: 40, days });
      } else {
        await postJson('/admin/api/issues', payload, { csrf: state.csrf });
      }
      qs('#issuesDialog').close();
      showToast(tAdmin('toast_saved'));
      await loadIssues();
    } catch (e) {
      showToast(tAdmin('toast_save_failed'), 'error');
    }
  }

  
  const el = qs('#dashUptimeStatus');
  if (el) {
    let color = '#94a3b8';
    if (state === 'up') color = '#22c55e';
    else if (state === 'degraded') color = '#f59e0b';
    else if (state === 'down') color = '#ef4444';
    el.style.color = color;
  }
  async function deleteIssue(id) {
    if (!confirm('Wirklich löschen?')) return;
    try {
      function drawSparkline(
        sel,
        values,
        { width = 220, height = 40, color = '#3b82f6', days = [] } = {}
      ) {
        const mount = qs(sel);
        if (!mount) return;
        const vals = Array.isArray(values) ? values.map((v) => Number(v || 0)) : [];
        if (!vals.length) {
          mount.innerHTML = '';
          return;
        }
        const max = Math.max(...vals, 1);
        const stepX = width / Math.max(vals.length - 1, 1);
        const points = vals.map((v, i) => {
          const x = i * stepX;
          const y = height - (v / max) * height;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sparkline">
        <polyline fill="none" stroke="${color}" stroke-width="2" points="${points.join(' ')}" />
      </svg>`;
        mount.innerHTML = svg;
      }
      await del(`/admin/api/issues/${id}`, { csrf: state.csrf });
      showToast(tAdmin('toast_deleted'));
      await loadIssues();
    } catch (e) {
      showToast(tAdmin('toast_delete_failed'), 'error');
    }
  }

  function openCoordsDialog(data) {
    const dlg = qs('#coordsDialog');
    const form = qs('#coordsForm');
    form.reset();
    if (data) {
      form.id.value = data.id;
      const $id = qs('#coordsDialogId');
      if ($id) $id.textContent = data.id ? `ID: ${data.id}` : '';
      form.category.value = data.category || 'top10';
      form.name.value = data.name || '';
      form.lat.value = data.lat ?? '';
      form.lng.value = data.lng ?? '';
      form.note.value = data.note || '';
      form.tags.value = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags || '';
      qs('#coordsDialogTitle').textContent = 'Coord bearbeiten';
    } else {
      qs('#coordsDialogTitle').textContent = 'Coord erstellen';
      const $id = qs('#coordsDialogId');
      if ($id) $id.textContent = '';
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
      
      switchTab('dashboard');
    }
  });
})();
