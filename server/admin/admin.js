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
    current: { devices: [], news: [], coords: [], issues: [], pulls: [], archive: [] },
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
    // Toggle border color classes instead of inline styles for CSP compliance
    t.classList.remove('border-red-500', 'border-sky-500', 'border-emerald-500');
    if (type === 'error') t.classList.add('border-red-500');
    else if (type === 'success') t.classList.add('border-emerald-500');
    else t.classList.add('border-sky-500');
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

  function loadSavedPageSize(key, def = 25) {
    try {
      const v = Number(localStorage.getItem(`adminPS_${key}`) || def);
      return Math.max(1, Math.min(100, Number.isFinite(v) ? v : def));
    } catch {
      return def;
    }
  }

  const state = {
    csrf: null,
    // Holds the currently loaded table data so export buttons and other UI can access it safely
    current: {
      devices: [],
      news: [],
      coords: [],
      issues: [],
      pulls: [],
      archive: [],
    },
    paging: {
      devices: {
        limit: loadSavedPageSize('devices'),
        offset: 0,
        lastCount: 0,
        hasMore: false,
        total: 0,
      },
      news: { limit: loadSavedPageSize('news'), offset: 0, lastCount: 0, hasMore: false, total: 0 },
      coords: {
        limit: loadSavedPageSize('coords'),
        offset: 0,
        lastCount: 0,
        hasMore: false,
        total: 0,
      },
      issues: {
        limit: loadSavedPageSize('issues'),
        offset: 0,
        lastCount: 0,
        hasMore: false,
        total: 0,
      },
      pulls: {
        limit: loadSavedPageSize('pulls'),
        offset: 0,
        lastCount: 0,
        hasMore: false,
        total: 0,
      },
      archive: {
        limit: loadSavedPageSize('archive'),
        offset: 0,
        lastCount: 0,
        hasMore: false,
        total: 0,
      },
    },
  };

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
    try {
      localStorage.setItem('adminTab', name);
    } catch {}
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

  // Sort-Settings aus localStorage laden
  (function loadSavedSorts() {
    const load = (key) => {
      try {
        const raw = localStorage.getItem(`adminSort_${key}`);
        if (!raw) return;
        const val = JSON.parse(raw);
        if (val && typeof val.key === 'string' && (val.dir === 'asc' || val.dir === 'desc')) {
          sortState[key] = { key: val.key, dir: val.dir };
        }
      } catch {}
    };
    ['issues', 'devices', 'news', 'coords', 'pulls', 'archive'].forEach(load);
  })();

  function applySortIndicators(tableId, { key, dir }) {
    qsa(`#${tableId} thead th[data-sort]`).forEach((th) => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      th.setAttribute('aria-sort', 'none');
      if (th.dataset.sort === key) {
        const isAsc = dir === 'asc';
        th.classList.add(isAsc ? 'sorted-asc' : 'sorted-desc');
        th.setAttribute('aria-sort', isAsc ? 'ascending' : 'descending');
      }
    });
  }

  // Serverseitiges Sortieren; clientseitiges Sortieren wird nicht mehr benötigt
  function sortItems(items) {
    return items || [];
  }

  async function loadPulls() {
    const tb = qs('#pullsTable tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="9">Laden…</td></tr>';
    const q = (qs('#pullsSearch')?.value || '').trim();
    const url = new URL('/admin/api/proposals', location.origin);
    const pg = state.paging.pulls;
    url.searchParams.set('status', 'pending');
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('limit', String(pg.limit));
    url.searchParams.set('offset', String(pg.offset));
    const stPulls = sortState.pulls;
    if (stPulls?.key) {
      url.searchParams.set('sortBy', stPulls.key);
      url.searchParams.set('sortDir', stPulls.dir);
    }
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
    pg.lastCount = items.length;
    pg.hasMore = !!json.hasMore;
    pg.total = Number(json.total || 0);
    state.current.pulls = items;
    const tbody = qs('#pullsTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('pullsTable', sortState.pulls);
    if (items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="text-slate-400 text-center py-6">Keine Einträge gefunden</td></tr>';
    }
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
    const page = Math.floor(pg.offset / pg.limit) + 1;
    const info = qs('#pullsPageInfo');
    const totalCount = pg.total || items.length;
    const pages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pg.limit)) : page;
    if (info) {
      const base = `Seite ${page}${totalCount ? ' von ' + pages : ''} · ${totalCount} Einträge`;
      if (totalCount === 0) {
        info.innerHTML = `${base} · <a href="#" id="pullsPageResetLink">Filter zurücksetzen</a>`;
        info.querySelector('#pullsPageResetLink')?.addEventListener('click', (e) => {
          e.preventDefault();
          qs('#pullsReset')?.click();
        });
      } else {
        info.textContent = base;
      }
    }
    const prev = qs('#pullsPrev');
    const next = qs('#pullsNext');
    if (prev) prev.disabled = pg.offset <= 0;
    if (next) next.disabled = pg.total ? pg.offset + pg.limit >= pg.total : !pg.hasMore;
  }

  async function loadArchive() {
    const tb = qs('#archiveTable tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="6">Laden…</td></tr>';
    const q = (qs('#archiveSearch')?.value || '').trim();
    const url = new URL('/admin/api/proposals', location.origin);
    const pg = state.paging.archive;
    url.searchParams.set('status', 'rejected');
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('limit', String(pg.limit));
    url.searchParams.set('offset', String(pg.offset));
    const stArchive = sortState.archive;
    if (stArchive?.key) {
      url.searchParams.set('sortBy', stArchive.key);
      url.searchParams.set('sortDir', stArchive.dir);
    }
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
    pg.lastCount = items.length;
    pg.hasMore = !!json.hasMore;
    pg.total = Number(json.total || 0);
    state.current.archive = items;
    const tbody = qs('#archiveTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('archiveTable', sortState.archive);
    if (items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-slate-400 text-center py-6">Keine Einträge gefunden</td></tr>';
    }
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
    const page = Math.floor(pg.offset / pg.limit) + 1;
    const info = qs('#archivePageInfo');
    const totalCount = pg.total || items.length;
    const pages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pg.limit)) : page;
    if (info) {
      const base = `Seite ${page}${totalCount ? ' von ' + pages : ''} · ${totalCount} Einträge`;
      if (totalCount === 0) {
        info.innerHTML = `${base} · <a href="#" id="archivePageResetLink">Filter zurücksetzen</a>`;
        info.querySelector('#archivePageResetLink')?.addEventListener('click', (e) => {
          e.preventDefault();
          qs('#archiveReset')?.click();
        });
      } else {
        info.textContent = base;
      }
    }
    const prev = qs('#archivePrev');
    const next = qs('#archiveNext');
    if (prev) prev.disabled = pg.offset <= 0;
    if (next) next.disabled = pg.total ? pg.offset + pg.limit >= pg.total : !pg.hasMore;
  }

  async function loadDevices() {
    const tb = qs('#devTable tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="12">Laden…</td></tr>';
    const q = (qs('#devSearch')?.value || '').trim();
    const url = new URL('/admin/api/devices', location.origin);
    const pg = state.paging.devices;
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('limit', String(pg.limit));
    url.searchParams.set('offset', String(pg.offset));
    const stDevs = sortState.devices;
    if (stDevs?.key) {
      url.searchParams.set('sortBy', stDevs.key);
      url.searchParams.set('sortDir', stDevs.dir);
    }
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
    pg.lastCount = items.length;
    pg.hasMore = !!json.hasMore;
    pg.total = Number(json.total || 0);
    state.current.devices = items;
    const tbody = qs('#devTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('devTable', sortState.devices);
    if (items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="12" class="text-slate-400 text-center py-6">Keine Einträge gefunden</td></tr>';
    }
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
    const page = Math.floor(pg.offset / pg.limit) + 1;
    const info = qs('#devPageInfo');
    const totalCount = pg.total || items.length;
    const pages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pg.limit)) : page;
    if (info) {
      const base = `Seite ${page}${totalCount ? ' von ' + pages : ''} · ${totalCount} Einträge`;
      if (totalCount === 0) {
        info.innerHTML = `${base} · <a href="#" id="devPageResetLink">Filter zurücksetzen</a>`;
        info.querySelector('#devPageResetLink')?.addEventListener('click', (e) => {
          e.preventDefault();
          qs('#devReset')?.click();
        });
      } else {
        info.textContent = base;
      }
    }
    const prev = qs('#devPrev');
    const next = qs('#devNext');
    if (prev) prev.disabled = pg.offset <= 0;
    if (next) next.disabled = pg.total ? pg.offset + pg.limit >= pg.total : !pg.hasMore;
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
    const tb = qs('#newsTable tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="9">Laden…</td></tr>';
    const q = (qs('#newsSearch')?.value || '').trim();
    const url = new URL('/admin/api/news', location.origin);
    const pg = state.paging.news;
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('limit', String(pg.limit));
    url.searchParams.set('offset', String(pg.offset));
    const stNews = sortState.news;
    if (stNews?.key) {
      url.searchParams.set('sortBy', stNews.key);
      url.searchParams.set('sortDir', stNews.dir);
    }
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
    pg.lastCount = items.length;
    pg.hasMore = !!json.hasMore;
    pg.total = Number(json.total || 0);
    state.current.news = items;
    const tbody = qs('#newsTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('newsTable', sortState.news);
    if (items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="text-slate-400 text-center py-6">Keine Einträge gefunden</td></tr>';
    }
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
    const page = Math.floor(pg.offset / pg.limit) + 1;
    const info = qs('#newsPageInfo');
    const totalCount = pg.total || items.length;
    const pages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pg.limit)) : page;
    if (info) {
      const base = `Seite ${page}${totalCount ? ' von ' + pages : ''} · ${totalCount} Einträge`;
      if (totalCount === 0) {
        info.innerHTML = `${base} · <a href="#" id="newsPageResetLink">Filter zurücksetzen</a>`;
        info.querySelector('#newsPageResetLink')?.addEventListener('click', (e) => {
          e.preventDefault();
          qs('#newsReset')?.click();
        });
      } else {
        info.textContent = base;
      }
    }
    const prev = qs('#newsPrev');
    const next = qs('#newsNext');
    if (prev) prev.disabled = pg.offset <= 0;
    if (next) next.disabled = pg.total ? pg.offset + pg.limit >= pg.total : !pg.hasMore;
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

  // CSV Export Helpers (CSP-safe)
  function csvEscapeCell(v) {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCSV(headers, rows) {
    const head = headers.map(([h]) => csvEscapeCell(h)).join(',');
    const body = (rows || [])
      .map((row) => headers.map(([, get]) => csvEscapeCell(get(row))).join(','))
      .join('\n');
    return '\uFEFF' + head + (body ? '\n' + body : '');
  }
  function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    } catch {}
  }
  function todayStr() {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch {
      return 'export';
    }
  }
  function exportCSV(prefix, headers, rows) {
    const csv = toCSV(headers, rows);
    downloadText(`${prefix}-${todayStr()}.csv`, csv);
    showToast('CSV exportiert', 'success');
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
    qs('#devExport')?.addEventListener('click', () => {
      const headers = [
        ['ID', (d) => d.id],
        ['Model', (d) => d.model || d.name || ''],
        ['Brand', (d) => d.brand || ''],
        ['Type', (d) => d.type || ''],
        ['OS', (d) => d.os || ''],
        ['Compatible', (d) => (d.compatible ? 'Yes' : 'No')],
        ['PriceRange', (d) => d.price_range || ''],
        ['PoGoComp', (d) => d.pogo_comp || ''],
        ['ManufacturerURL', (d) => d.manufacturer_url || ''],
        ['NotesCount', (d) => (Array.isArray(d.notes) ? d.notes.length : d.notes ? 1 : 0)],
        [
          'RootLinksCount',
          (d) => (Array.isArray(d.root_links) ? d.root_links.length : d.root_links ? 1 : 0),
        ],
      ];
      exportCSV('devices', headers, state.current.devices || []);
    });
    qs('#devReset')?.addEventListener('click', () => {
      try {
        localStorage.removeItem('adminQ_devices');
        localStorage.removeItem('adminSort_devices');
        localStorage.setItem('adminPS_devices', '25');
      } catch {}
      const s = qs('#devSearch');
      if (s) s.value = '';
      const ps = qs('#devPageSize');
      if (ps) ps.value = '25';
      sortState.devices = { key: 'id', dir: 'desc' };
      const pg = state.paging.devices;
      pg.limit = 25;
      pg.offset = 0;
      loadDevices();
    });
    const debounce = (fn, ms = 300) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    };
    const onDevSearch = debounce(() => {
      try {
        localStorage.setItem('adminQ_devices', (qs('#devSearch')?.value || '').trim());
      } catch {}
      state.paging.devices.offset = 0;
      loadDevices();
    });
    qs('#devSearch')?.addEventListener('input', onDevSearch);
    qs('#devPrev')?.addEventListener('click', () => {
      const pg = state.paging.devices;
      pg.offset = Math.max(0, pg.offset - pg.limit);
      loadDevices();
    });
    qs('#devNext')?.addEventListener('click', () => {
      const pg = state.paging.devices;
      if (pg.hasMore) {
        pg.offset += pg.limit;
        loadDevices();
      }
    });
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
    qs('#newsExport')?.addEventListener('click', () => {
      const headers = [
        ['ID', (n) => n.id],
        ['Slug', (n) => n.slug || ''],
        ['Datum', (n) => n.date || ''],
        ['Titel', (n) => n.title || ''],
        ['Excerpt', (n) => n.excerpt || ''],
        ['PublishedAt', (n) => n.published_at || ''],
        ['UpdatedAt', (n) => n.updated_at_ext || ''],
        ['Tags', (n) => (Array.isArray(n.tags) ? n.tags.join('|') : n.tags || '')],
      ];
      exportCSV('news', headers, state.current.news || []);
    });
    qs('#newsReset')?.addEventListener('click', () => {
      try {
        localStorage.removeItem('adminQ_news');
        localStorage.removeItem('adminSort_news');
        localStorage.setItem('adminPS_news', '25');
      } catch {}
      const s = qs('#newsSearch');
      if (s) s.value = '';
      const ps = qs('#newsPageSize');
      if (ps) ps.value = '25';
      sortState.news = { key: 'id', dir: 'desc' };
      const pg = state.paging.news;
      pg.limit = 25;
      pg.offset = 0;
      loadNews();
    });
    const onNewsSearch = debounce(() => {
      try {
        localStorage.setItem('adminQ_news', (qs('#newsSearch')?.value || '').trim());
      } catch {}
      state.paging.news.offset = 0;
      loadNews();
    });
    qs('#newsSearch')?.addEventListener('input', onNewsSearch);
    qs('#newsPrev')?.addEventListener('click', () => {
      const pg = state.paging.news;
      pg.offset = Math.max(0, pg.offset - pg.limit);
      loadNews();
    });
    qs('#newsNext')?.addEventListener('click', () => {
      const pg = state.paging.news;
      if (pg.hasMore) {
        pg.offset += pg.limit;
        loadNews();
      }
    });
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
    qs('#coordsExport')?.addEventListener('click', () => {
      const headers = [
        ['ID', (c) => c.id],
        ['Kategorie', (c) => c.category || ''],
        ['Name', (c) => c.name || ''],
        ['Lat', (c) => c.lat],
        ['Lng', (c) => c.lng],
        ['Tags', (c) => (Array.isArray(c.tags) ? c.tags.join('|') : c.tags || '')],
      ];
      exportCSV('coords', headers, state.current.coords || []);
    });
    qs('#coordsReset')?.addEventListener('click', () => {
      try {
        localStorage.removeItem('adminQ_coords');
        localStorage.removeItem('adminCat_coords');
        localStorage.removeItem('adminSort_coords');
        localStorage.setItem('adminPS_coords', '25');
      } catch {}
      const s = qs('#coordsSearch');
      if (s) s.value = '';
      const cat = qs('#coordsCategory');
      if (cat) cat.value = '';
      const ps = qs('#coordsPageSize');
      if (ps) ps.value = '25';
      sortState.coords = { key: 'id', dir: 'desc' };
      const pg = state.paging.coords;
      pg.limit = 25;
      pg.offset = 0;
      loadCoords();
    });
    const onCoordsSearch = debounce(() => {
      try {
        localStorage.setItem('adminQ_coords', (qs('#coordsSearch')?.value || '').trim());
      } catch {}
      state.paging.coords.offset = 0;
      loadCoords();
    });
    qs('#coordsSearch')?.addEventListener('input', onCoordsSearch);
    qs('#coordsCategory')?.addEventListener('change', () => {
      try {
        localStorage.setItem('adminCat_coords', (qs('#coordsCategory')?.value || '').trim());
      } catch {}
      state.paging.coords.offset = 0;
      loadCoords();
    });
    qs('#coordsPrev')?.addEventListener('click', () => {
      const pg = state.paging.coords;
      pg.offset = Math.max(0, pg.offset - pg.limit);
      loadCoords();
    });
    qs('#coordsNext')?.addEventListener('click', () => {
      const pg = state.paging.coords;
      if (pg.hasMore) {
        pg.offset += pg.limit;
        loadCoords();
      }
    });
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
        try {
          localStorage.setItem('adminSort_devices', JSON.stringify(st));
        } catch {}
        loadDevices();
      })
    );
    qsa('#newsTable thead th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const st = sortState.news;
        st.dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
        st.key = key;
        try {
          localStorage.setItem('adminSort_news', JSON.stringify(st));
        } catch {}
        loadNews();
      })
    );
    qsa('#coordsTable thead th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const st = sortState.coords;
        st.dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
        st.key = key;
        try {
          localStorage.setItem('adminSort_coords', JSON.stringify(st));
        } catch {}
        loadCoords();
      })
    );

    // Pulls
    qs('#pullsRefresh')?.addEventListener('click', loadPulls);
    qs('#pullsExport')?.addEventListener('click', () => {
      const headers = [
        ['ID', (d) => d.id],
        ['Model', (d) => d.model || ''],
        ['Brand', (d) => d.brand || ''],
        ['Type', (d) => d.type || ''],
        ['OS', (d) => d.os || ''],
        ['Compatible', (d) => (d.compatible ? 'Yes' : 'No')],
        ['NotesCount', (d) => (Array.isArray(d.notes) ? d.notes.length : d.notes ? 1 : 0)],
        [
          'RootLinksCount',
          (d) => (Array.isArray(d.root_links) ? d.root_links.length : d.root_links ? 1 : 0),
        ],
      ];
      exportCSV('pulls', headers, state.current.pulls || []);
    });
    qs('#pullsReset')?.addEventListener('click', () => {
      try {
        localStorage.removeItem('adminQ_pulls');
        localStorage.removeItem('adminSort_pulls');
        localStorage.setItem('adminPS_pulls', '25');
      } catch {}
      const s = qs('#pullsSearch');
      if (s) s.value = '';
      const ps = qs('#pullsPageSize');
      if (ps) ps.value = '25';
      sortState.pulls = { key: 'id', dir: 'desc' };
      const pg = state.paging.pulls;
      pg.limit = 25;
      pg.offset = 0;
      loadPulls();
    });
    const onPullsSearch = debounce(() => {
      try {
        localStorage.setItem('adminQ_pulls', (qs('#pullsSearch')?.value || '').trim());
      } catch {}
      state.paging.pulls.offset = 0;
      loadPulls();
    });
    qs('#pullsSearch')?.addEventListener('input', onPullsSearch);
    qs('#pullsPrev')?.addEventListener('click', () => {
      const pg = state.paging.pulls;
      pg.offset = Math.max(0, pg.offset - pg.limit);
      loadPulls();
    });
    qs('#pullsNext')?.addEventListener('click', () => {
      const pg = state.paging.pulls;
      if (pg.hasMore) {
        pg.offset += pg.limit;
        loadPulls();
      }
    });
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
        try {
          localStorage.setItem('adminSort_pulls', JSON.stringify(st));
        } catch {}
        loadPulls();
      })
    );

    qs('#archiveRefresh')?.addEventListener('click', loadArchive);
    qs('#archiveExport')?.addEventListener('click', () => {
      const headers = [
        ['ID', (d) => d.id],
        ['Model', (d) => d.model || ''],
        ['Brand', (d) => d.brand || ''],
        ['Type', (d) => d.type || ''],
        ['OS', (d) => d.os || ''],
        ['RejectedAt', (d) => d.rejected_at || ''],
      ];
      exportCSV('archive', headers, state.current.archive || []);
    });
    qs('#archiveReset')?.addEventListener('click', () => {
      try {
        localStorage.removeItem('adminQ_archive');
        localStorage.removeItem('adminSort_archive');
        localStorage.setItem('adminPS_archive', '25');
      } catch {}
      const s = qs('#archiveSearch');
      if (s) s.value = '';
      const ps = qs('#archivePageSize');
      if (ps) ps.value = '25';
      sortState.archive = { key: 'id', dir: 'desc' };
      const pg = state.paging.archive;
      pg.limit = 25;
      pg.offset = 0;
      loadArchive();
    });
    const onArchiveSearch = debounce(() => {
      try {
        localStorage.setItem('adminQ_archive', (qs('#archiveSearch')?.value || '').trim());
      } catch {}
      state.paging.archive.offset = 0;
      loadArchive();
    });
    qs('#archiveSearch')?.addEventListener('input', onArchiveSearch);
    qs('#archivePrev')?.addEventListener('click', () => {
      const pg = state.paging.archive;
      pg.offset = Math.max(0, pg.offset - pg.limit);
      loadArchive();
    });
    qs('#archiveNext')?.addEventListener('click', () => {
      const pg = state.paging.archive;
      if (pg.hasMore) {
        pg.offset += pg.limit;
        loadArchive();
      }
    });
    qsa('#archiveTable thead th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const st = sortState.archive;
        st.dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
        st.key = key;
        try {
          localStorage.setItem('adminSort_archive', JSON.stringify(st));
        } catch {}
        loadArchive();
      })
    );

    // Page size selectors
    qs('#devPageSize')?.addEventListener('change', (e) => {
      const pg = state.paging.devices;
      pg.limit = Math.max(1, Number(e.target.value || 25));
      pg.offset = 0;
      try {
        localStorage.setItem('adminPS_devices', String(pg.limit));
      } catch {}
      loadDevices();
    });
    qs('#newsPageSize')?.addEventListener('change', (e) => {
      const pg = state.paging.news;
      pg.limit = Math.max(1, Number(e.target.value || 25));
      pg.offset = 0;
      try {
        localStorage.setItem('adminPS_news', String(pg.limit));
      } catch {}
      loadNews();
    });
    qs('#coordsPageSize')?.addEventListener('change', (e) => {
      const pg = state.paging.coords;
      pg.limit = Math.max(1, Number(e.target.value || 25));
      pg.offset = 0;
      try {
        localStorage.setItem('adminPS_coords', String(pg.limit));
      } catch {}
      loadCoords();
    });
    qs('#issuesPageSize')?.addEventListener('change', (e) => {
      const pg = state.paging.issues;
      pg.limit = Math.max(1, Number(e.target.value || 25));
      pg.offset = 0;
      try {
        localStorage.setItem('adminPS_issues', String(pg.limit));
      } catch {}
      loadIssues();
    });
    qs('#pullsPageSize')?.addEventListener('change', (e) => {
      const pg = state.paging.pulls;
      pg.limit = Math.max(1, Number(e.target.value || 25));
      pg.offset = 0;
      try {
        localStorage.setItem('adminPS_pulls', String(pg.limit));
      } catch {}
      loadPulls();
    });
    qs('#archivePageSize')?.addEventListener('change', (e) => {
      const pg = state.paging.archive;
      pg.limit = Math.max(1, Number(e.target.value || 25));
      pg.offset = 0;
      try {
        localStorage.setItem('adminPS_archive', String(pg.limit));
      } catch {}
      loadArchive();
    });

    qs('#dashRefresh')?.addEventListener('click', loadDashboard);
    qs('#dashResetAll')?.addEventListener('click', () => {
      try {
        // Entferne alle gespeicherten Präferenzen
        const keys = [
          'adminTab',
          'adminCat_coords',
          'adminStatus_issues',
          'adminQ_devices',
          'adminQ_news',
          'adminQ_coords',
          'adminQ_issues',
          'adminQ_pulls',
          'adminQ_archive',
          'adminSort_devices',
          'adminSort_news',
          'adminSort_coords',
          'adminSort_issues',
          'adminSort_pulls',
          'adminSort_archive',
          'adminPS_devices',
          'adminPS_news',
          'adminPS_coords',
          'adminPS_issues',
          'adminPS_pulls',
          'adminPS_archive',
        ];
        keys.forEach((k) => localStorage.removeItem(k));
      } catch {}

      // UI Felder zurücksetzen
      const setVal = (sel, v) => {
        const el = qs(sel);
        if (el) el.value = v;
      };
      setVal('#devSearch', '');
      setVal('#newsSearch', '');
      setVal('#coordsSearch', '');
      setVal('#coordsCategory', '');
      setVal('#issuesSearch', '');
      setVal('#issuesStatus', '');
      setVal('#pullsSearch', '');
      setVal('#archiveSearch', '');
      setVal('#devPageSize', '25');
      setVal('#newsPageSize', '25');
      setVal('#coordsPageSize', '25');
      setVal('#issuesPageSize', '25');
      setVal('#pullsPageSize', '25');
      setVal('#archivePageSize', '25');

      // State zurücksetzen
      sortState.devices = { key: 'id', dir: 'desc' };
      sortState.news = { key: 'id', dir: 'desc' };
      sortState.coords = { key: 'id', dir: 'desc' };
      sortState.issues = { key: 'id', dir: 'desc' };
      sortState.pulls = { key: 'id', dir: 'desc' };
      sortState.archive = { key: 'id', dir: 'desc' };
      const resetPg = (pg) => {
        pg.limit = 25;
        pg.offset = 0;
        pg.lastCount = 0;
        pg.hasMore = false;
        pg.total = 0;
      };
      resetPg(state.paging.devices);
      resetPg(state.paging.news);
      resetPg(state.paging.coords);
      resetPg(state.paging.issues);
      resetPg(state.paging.pulls);
      resetPg(state.paging.archive);

      // Aktiven Tab ermitteln und neu laden
      const active = document.querySelector('.tab.active')?.dataset.tab;
      if (active === 'devices') loadDevices();
      else if (active === 'news') loadNews();
      else if (active === 'coords') loadCoords();
      else if (active === 'issues') loadIssues();
      else if (active === 'pulls') loadPulls();
      else if (active === 'archive') loadArchive();
      else loadDashboard();
      showToast('Zurückgesetzt', 'success');
    });

    qs('#issuesRefresh')?.addEventListener('click', loadIssues);
    qs('#issuesExport')?.addEventListener('click', () => {
      const headers = [
        ['ID', (i) => i.id],
        ['Titel', (i) => i.title || ''],
        ['Status', (i) => i.status || ''],
        ['Tags', (i) => (Array.isArray(i.tags) ? i.tags.join('|') : i.tags || '')],
        ['UpdatedAt', (i) => i.updated_at || ''],
      ];
      exportCSV('issues', headers, state.current.issues || []);
    });
    qs('#issuesReset')?.addEventListener('click', () => {
      try {
        localStorage.removeItem('adminQ_issues');
        localStorage.removeItem('adminStatus_issues');
        localStorage.removeItem('adminSort_issues');
        localStorage.setItem('adminPS_issues', '25');
      } catch {}
      const s = qs('#issuesSearch');
      if (s) s.value = '';
      const st = qs('#issuesStatus');
      if (st) st.value = '';
      const ps = qs('#issuesPageSize');
      if (ps) ps.value = '25';
      sortState.issues = { key: 'id', dir: 'desc' };
      const pg = state.paging.issues;
      pg.limit = 25;
      pg.offset = 0;
      loadIssues();
    });
    const onIssuesSearch = debounce(() => {
      try {
        localStorage.setItem('adminQ_issues', (qs('#issuesSearch')?.value || '').trim());
      } catch {}
      state.paging.issues.offset = 0;
      loadIssues();
    });
    qs('#issuesSearch')?.addEventListener('input', onIssuesSearch);
    qs('#issuesStatus')?.addEventListener('change', () => {
      try {
        localStorage.setItem('adminStatus_issues', (qs('#issuesStatus')?.value || '').trim());
      } catch {}
      state.paging.issues.offset = 0;
      loadIssues();
    });
    qs('#issuesPrev')?.addEventListener('click', () => {
      const pg = state.paging.issues;
      pg.offset = Math.max(0, pg.offset - pg.limit);
      loadIssues();
    });
    qs('#issuesNext')?.addEventListener('click', () => {
      const pg = state.paging.issues;
      if (pg.hasMore) {
        pg.offset += pg.limit;
        loadIssues();
      }
    });
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
        try {
          localStorage.setItem('adminSort_issues', JSON.stringify(st));
        } catch {}
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
    const tb = qs('#coordsTable tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="7">Laden…</td></tr>';
    const q = (qs('#coordsSearch')?.value || '').trim();
    const category = (qs('#coordsCategory')?.value || '').trim();
    const url = new URL('/admin/api/coords', location.origin);
    const pg = state.paging.coords;
    if (q) url.searchParams.set('q', q);
    if (category) url.searchParams.set('category', category);
    url.searchParams.set('limit', String(pg.limit));
    url.searchParams.set('offset', String(pg.offset));
    const stCoords = sortState.coords;
    if (stCoords?.key) {
      url.searchParams.set('sortBy', stCoords.key);
      url.searchParams.set('sortDir', stCoords.dir);
    }
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
    pg.lastCount = items.length;
    pg.hasMore = !!json.hasMore;
    pg.total = Number(json.total || 0);
    state.current.coords = items;
    const tbody = qs('#coordsTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('coordsTable', sortState.coords);
    if (items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-slate-400 text-center py-6">Keine Einträge gefunden</td></tr>';
    }
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
    const page = Math.floor(pg.offset / pg.limit) + 1;
    const info = qs('#coordsPageInfo');
    const totalCount = pg.total || items.length;
    const pages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pg.limit)) : page;
    if (info) {
      const base = `Seite ${page}${totalCount ? ' von ' + pages : ''} · ${totalCount} Einträge`;
      if (totalCount === 0) {
        info.innerHTML = `${base} · <a href="#" id="coordsPageResetLink">Filter zurücksetzen</a>`;
        info.querySelector('#coordsPageResetLink')?.addEventListener('click', (e) => {
          e.preventDefault();
          qs('#coordsReset')?.click();
        });
      } else {
        info.textContent = base;
      }
    }
    const prev = qs('#coordsPrev');
    const next = qs('#coordsNext');
    if (prev) prev.disabled = pg.offset <= 0;
    if (next) next.disabled = pg.total ? pg.offset + pg.limit >= pg.total : !pg.hasMore;
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
        const statusEl = qs('#dashUptimeStatus');
        if (statusEl) {
          statusEl.textContent = state;
          statusEl.classList.remove('text-emerald-400', 'text-yellow-400', 'text-red-400');
          if (state === 'up') statusEl.classList.add('text-emerald-400');
          else if (state === 'degraded') statusEl.classList.add('text-yellow-400');
          else if (state === 'down') statusEl.classList.add('text-red-400');
        }
        qs('#dashUptimeRatio') && (qs('#dashUptimeRatio').textContent = ratio);
      }
    } catch {}
  }

  async function loadIssues() {
    const tb = qs('#issuesTable tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="6">Laden…</td></tr>';
    const q = (qs('#issuesSearch')?.value || '').trim();
    const status = (qs('#issuesStatus')?.value || '').trim();
    const url = new URL('/admin/api/issues', location.origin);
    const pg = state.paging.issues;
    if (q) url.searchParams.set('q', q);
    if (status) url.searchParams.set('status', status);
    url.searchParams.set('limit', String(pg.limit));
    url.searchParams.set('offset', String(pg.offset));
    const stIssues = sortState.issues;
    if (stIssues?.key) {
      url.searchParams.set('sortBy', stIssues.key);
      url.searchParams.set('sortDir', stIssues.dir);
    }
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
    pg.lastCount = items.length;
    pg.hasMore = !!json.hasMore;
    pg.total = Number(json.total || 0);
    state.current.issues = items;
    const tbody = qs('#issuesTable tbody');
    tbody.innerHTML = '';
    applySortIndicators('issuesTable', sortState.issues);
    if (items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-slate-400 text-center py-6">Keine Einträge gefunden</td></tr>';
    }
    const statusPill = (s) => {
      const st = String(s || '').toLowerCase();
      let cls = 'text-slate-300 border-slate-700';
      let label = st || '';
      if (st === 'open') {
        cls = 'text-yellow-400 border-yellow-500';
      } else if (st === 'in_progress') {
        cls = 'text-sky-400 border-sky-500';
        label = 'in_progress';
      } else if (st === 'resolved') {
        cls = 'text-emerald-400 border-emerald-500';
      } else if (st === 'blocked') {
        cls = 'text-red-400 border-red-500';
      } else if (st === 'closed') {
        cls = 'text-slate-400 border-slate-700';
      }
      return `<span class="pill border ${cls}">${escapeHtml(label)}</span>`;
    };
    for (const it of items) {
      const tr = document.createElement('tr');
      const tags = Array.isArray(it.tags) ? it.tags.join(', ') : it.tags || '';
      tr.innerHTML = `<td>${it.id}</td>
        <td>${escapeHtml(it.title || '')}</td>
        <td>${statusPill(it.status)}</td>
        <td>${escapeHtml(tags)}</td>
        <td>${escapeHtml(it.updated_at || '')}</td>
        <td>
          <button class="btn" data-edit-issue="${it.id}">Bearbeiten</button>
          <button class="btn danger" data-del-issue="${it.id}">Löschen</button>
        </td>`;
      tbody.appendChild(tr);
    }
    const page = Math.floor(pg.offset / pg.limit) + 1;
    const info = qs('#issuesPageInfo');
    const totalCount = pg.total || items.length;
    const pages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pg.limit)) : page;
    if (info) {
      const base = `Seite ${page}${totalCount ? ' von ' + pages : ''} · ${totalCount} Einträge`;
      if (totalCount === 0) {
        info.innerHTML = `${base} · <a href="#" id="issuesPageResetLink">Filter zurücksetzen</a>`;
        info.querySelector('#issuesPageResetLink')?.addEventListener('click', (e) => {
          e.preventDefault();
          qs('#issuesReset')?.click();
        });
      } else {
        info.textContent = base;
      }
    }
    const prev = qs('#issuesPrev');
    const next = qs('#issuesNext');
    if (prev) prev.disabled = pg.offset <= 0;
    if (next) next.disabled = pg.total ? pg.offset + pg.limit >= pg.total : !pg.hasMore;
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

  // Removed inline style color manipulation for CSP; color is set in loadDashboard via classes.
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

      // Init page size selects from saved values
      const setIf = (sel, val) => {
        const el = qs(sel);
        if (el) el.value = String(val);
      };
      setIf('#devPageSize', state.paging.devices.limit);
      setIf('#newsPageSize', state.paging.news.limit);
      setIf('#coordsPageSize', state.paging.coords.limit);
      setIf('#issuesPageSize', state.paging.issues.limit);
      setIf('#pullsPageSize', state.paging.pulls.limit);
      setIf('#archivePageSize', state.paging.archive.limit);

      // Wiederherstellen: Suchfelder/Filter
      try {
        const setVal = (sel, key) => {
          const v = localStorage.getItem(key);
          if (v != null) {
            const el = qs(sel);
            if (el) el.value = v;
          }
        };
        setVal('#devSearch', 'adminQ_devices');
        setVal('#newsSearch', 'adminQ_news');
        setVal('#coordsSearch', 'adminQ_coords');
        setVal('#coordsCategory', 'adminCat_coords');
        setVal('#issuesSearch', 'adminQ_issues');
        setVal('#issuesStatus', 'adminStatus_issues');
        setVal('#pullsSearch', 'adminQ_pulls');
        setVal('#archiveSearch', 'adminQ_archive');
      } catch {}

      let initialTab = 'dashboard';
      try {
        const saved = localStorage.getItem('adminTab');
        if (saved) initialTab = saved;
      } catch {}
      switchTab(initialTab);
    }
  });
})();
