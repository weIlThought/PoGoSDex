function qs(s) {
  return document.querySelector(s);
}
function qsa(s) {
  return Array.from(document.querySelectorAll(s));
}
function esc(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

// Debug wrapper - gate console output behind a flag
const DEBUG = false;
function debug(...args) {
  if (DEBUG) console.log(...args);
}

// Lightweight HTML sanitizer (fallback) — removes script/style and on* attributes
function sanitizeHtml(html) {
  // Prefer DOMPurify when available (loaded from CDN in index.html). Falls back to a lightweight sanitizer.
  try {
    if (
      typeof window !== 'undefined' &&
      window.DOMPurify &&
      typeof window.DOMPurify.sanitize === 'function'
    ) {
      try {
        return window.DOMPurify.sanitize(html);
      } catch (e) {
        // fallthrough to internal sanitizer
      }
    }

    const template = document.createElement('template');
    template.innerHTML = html;
    const walk = (node) => {
      if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') {
          node.remove();
          return;
        }
        Array.from(node.attributes).forEach((attr) => {
          if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
          if (attr.name === 'src' && /^javascript:/i.test(attr.value))
            node.removeAttribute(attr.name);
        });
      }
      node.childNodes && Array.from(node.childNodes).forEach(walk);
    };
    Array.from(template.content.childNodes).forEach(walk);
    return template.innerHTML;
  } catch (e) {
    return '';
  }
}

function dash() {
  return t('placeholder_dash', '—');
}

// Normalize different representations of "compatible" values to a boolean.
// Handles booleans, numbers (1/0), and strings like "true", "yes", "1", "false".
function isCompatible(val) {
  if (val === true) return true;
  if (val === false) return false;
  if (val == null) return false;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'compatible'].includes(v);
  }
  return Boolean(val);
}

let devices = [];
let news = [];
let newsSearch = '';
let newsSelectedTags = new Set();

const newsSearchInput = qs('#newsSearchInput');
const newsTagFilterWrap = qs('#newsTagFilter');

let i18n = {};
// Supported languages - keep in sync with /lang/*.json
const SUPPORTED_LANGS = ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru', 'hi'];
let currentLang =
  new URLSearchParams(window.location.search).get('lang') ||
  localStorage.getItem('lang') ||
  (navigator.language || 'en').slice(0, 2);
if (!SUPPORTED_LANGS.includes(currentLang)) currentLang = 'en';

let dateFormatter = new Intl.DateTimeFormat(currentLang, {
  dateStyle: 'medium',
});

function t(key, fallback) {
  return (i18n && i18n[key]) || fallback || key;
}

function renderNews(items) {
  const wrap = qs('#newsWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  const filtered = items.filter((item) => {
    const title = item.title?.toLowerCase() || '';
    const excerpt = item.excerpt?.toLowerCase() || '';
    const content = item.content?.toLowerCase() || '';
    const matchesSearch =
      !newsSearch ||
      title.includes(newsSearch) ||
      excerpt.includes(newsSearch) ||
      content.includes(newsSearch);
    const itemTags = (item.tags || []).map((tag) => tag.toLowerCase());
    const matchesTags = !newsSelectedTags.size || itemTags.some((tag) => newsSelectedTags.has(tag));
    return matchesSearch && matchesTags;
  });
  if (!filtered.length) {
    wrap.innerHTML = sanitizeHtml(
      `<div class="border border-slate-800 bg-slate-900 rounded-lg p-6 text-center text-slate-400">${t(
        'news_empty',
        'No news available yet.'
      )}</div>`
    );
    return;
  }
  const publishedLabel = t('news_published', 'Published');
  const updatedLabel = t('news_updated', 'Updated');
  filtered.forEach((item) => {
    const title = item.title;
    const excerpt = item.excerpt;
    const tags = item.tags || [];
    const content = item.content || item.excerpt || '';

    const pub = item.publishedAt ? dateFormatter.format(new Date(item.publishedAt)) : dash();
    const upd =
      item.updatedAt && item.updatedAt !== item.publishedAt
        ? dateFormatter.format(new Date(item.updatedAt))
        : null;

    const article = document.createElement('article');
    article.className =
      'bg-slate-900 border border-slate-800 rounded-lg p-6 cursor-pointer card-hover transition';
    article.tabIndex = 0;
    article.setAttribute('role', 'button');
    article.innerHTML = sanitizeHtml(`
      <h3 class="text-xl font-semibold">${esc(title)}</h3>
      <div class="text-xs text-slate-400 mt-2 space-x-3">
        <span>${publishedLabel}: ${esc(pub)}</span>
        ${upd ? `<span>${updatedLabel}: ${esc(upd)}</span>` : ''}
      </div>
      ${excerpt ? `<p class="text-sm text-slate-300 mt-3">${esc(excerpt)}</p>` : ''}
      ${
        tags.length
          ? `<div class="flex flex-wrap gap-2 mt-3">${tags
              .map(
                (tag) =>
                  `<span class="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs">${esc(
                    tag
                  )}</span>`
              )
              .join('')}</div>`
          : ''
      }
    `);
    const open = () => openNewsModal(item, { content });
    article.addEventListener('click', open);
    article.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        open();
      }
    });
    wrap.appendChild(article);
  });
}

async function loadLang(lang) {
  try {
    const res = await fetch(`/lang/${lang}.json`);
    if (!res.ok) throw new Error('lang not found');
    i18n = await res.json();
    currentLang = lang;
    localStorage.setItem('lang', lang);
    dateFormatter = new Intl.DateTimeFormat(currentLang, {
      dateStyle: 'medium',
    });
    applyTranslations();
    renderNews(news);
    applyFilters();
  } catch (e) {
    console.warn('Failed to load lang:', lang, e);
  }
}

const sections = {
  overview: qs('#overviewSection'),
  devices: qs('#devicesSection'),
  news: qs('#newsSection'),
  pgsharp: qs('#pgsharpSection'),
};
let activeSection = 'overview';

let navButtons = [];

function showSection(name = 'overview') {
  if (!sections[name]) return;
  Object.entries(sections).forEach(([key, node]) => {
    if (!node) return;
    if (key === name) {
      node.classList.remove('hidden');
    } else {
      node.classList.add('hidden');
    }
  });
  navButtons.forEach((btn) => {
    const isActive = btn.dataset.section === name;
    btn.setAttribute('aria-selected', String(isActive));
    btn.classList.toggle('border-slate-700', isActive);
    btn.classList.toggle('bg-slate-800', isActive);
    btn.classList.toggle('bg-slate-800/60', !isActive);
    btn.classList.toggle('border-transparent', !isActive);
  });
  activeSection = name;
  if (name === 'devices') applyFilters();
  if (name === 'news') renderNews(news);
}
function bindNavigation() {
  navButtons = qsa('[data-section]');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      showSection(btn.dataset.section);
    });
  });
}

async function loadDevices() {
  try {
    const res = await fetch('/data/devices.json');
    devices = await res.json();
  } catch (e) {
    devices = [];
    console.error('Failed to load devices.json', e);
  }
  applyFilters();
}

async function loadNews() {
  try {
    const res = await fetch('/data/news.json');
    news = await res.json();
  } catch (e) {
    news = [];
    console.error('Failed to load news.json', e);
  }
  populateNewsTagFilter(news);
  if (activeSection === 'news') renderNews(news);
}

function populateNewsTagFilter(items) {
  if (!newsTagFilterWrap) return;

  const tags = [
    ...new Set(items.flatMap((item) => (item.tags || []).map((tag) => tag.trim()))),
  ].sort((a, b) => a.localeCompare(b));

  if (newsTagFilterWrap.tagName === 'SELECT') {
    newsTagFilterWrap.innerHTML = sanitizeHtml(
      `<option value="all">${t('news_filter_all', 'All')}</option>` +
        (tags.length
          ? tags
              .map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`)
              .join('')
          : `<option value="none" disabled>${t(
              'news_filter_no_tags',
              'No tags available.'
            )}</option>`)
    );
    return;
  }

  newsTagFilterWrap.innerHTML = '';
  if (!tags.length) {
    newsTagFilterWrap.innerHTML = sanitizeHtml(
      `<span class="text-xs text-slate-500" data-i18n="news_filter_no_tags">No tags available.</span>`
    );
    return;
  }
  tags.forEach((tag) => {
    const tagKey = tag.toLowerCase();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = tag;
    btn.dataset.tag = tagKey;
    btn.className =
      'px-3 py-1 text-xs rounded-full border transition-colors ' +
      (newsSelectedTags.has(tagKey)
        ? 'bg-emerald-600 border-emerald-400'
        : 'bg-slate-800 border-slate-700');
    newsTagFilterWrap.appendChild(btn);
  });
}

function cardHtml(d) {
  // build a short preview of notes (first note) if present
  const notePreview = d.notes && d.notes.length ? esc(String(d.notes[0]).slice(0, 130)) : '';
  const badgeClass = isCompatible(d.compatible) ? 'badge-compat good' : 'badge-compat unknown';
  return `<article class="card-hover bg-slate-800 border border-slate-700 rounded-lg p-6 h-full flex flex-col justify-between cursor-pointer" data-id="${esc(
    d.id
  )}">
    <div>
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-lg font-semibold">${esc(d.model)}</h3>
          <p class="text-sm text-slate-400">${esc(d.brand)} • ${esc(d.type)}</p>
        </div>
  <div><span class="${badgeClass}">${
    isCompatible(d.compatible) ? 'Compatible' : 'Unknown'
  }</span></div>
      </div>
      <p class="mt-3 text-slate-300 text-sm">${esc(d.os)}</p>
      <p class="card-note">${notePreview}</p>
    </div>
    <div class="mt-4 text-xs text-slate-400">&nbsp;</div>
  </article>`;
}

const deviceLimitSelect = qs('[data-device-limit]');
let deviceRenderLimit = 50;

if (deviceLimitSelect) {
  deviceLimitSelect.addEventListener('change', () => {
    const value = deviceLimitSelect.value;
    deviceRenderLimit =
      value === 'all' ? Infinity : Number.parseInt(value, 10) || deviceRenderLimit;
    renderDevices(devices);
  });
}

function renderDevices(list) {
  const container = qs('[data-devices-grid]');
  if (!container) return;

  const limited = deviceRenderLimit === Infinity ? list : list.slice(0, deviceRenderLimit);
  container.innerHTML = '';
  if (!limited.length) {
    container.innerHTML = sanitizeHtml(
      `<div class="col-span-full text-center text-slate-400">${t(
        'no_devices_found',
        'No devices found'
      )}</div>`
    );
    return;
  }
  limited.forEach((d) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = sanitizeHtml(cardHtml(d));
    const card = tmp.firstElementChild;
    card.addEventListener('click', () => openModal(d));
    container.appendChild(card);
  });
}

function hydrateGrid() {
  renderDevices(devices);
}

function openModal(d) {
  qs('#modalBackdrop').classList.remove('hidden');
  qs('#modalBackdrop').classList.add('flex');
  qs('#modalTitle').textContent = d.model;
  qs('#modalMeta').textContent = `${d.brand} • ${d.type} • ${d.os}`;
  qs('#modalDesc').textContent = isCompatible(d.compatible)
    ? t('modal_compatibility_confirmed', 'Compatibility: confirmed')
    : t('modal_compatibility_unknown', 'Compatibility: unknown or not verified');
  qs('#modalNotesList').innerHTML = sanitizeHtml(
    (d.notes || []).map((n) => `<div class="text-sm">• ${esc(n)}</div>`).join('')
  );
  const links = (d.rootLinks || [])
    .map(
      (u) =>
        `<div class="text-sm"><a href="${u}" target="_blank" rel="noopener noreferrer nofollow" class="text-sky-400 hover:underline">${esc(
          u
        )}</a></div>`
    )
    .join('');
  qs('#modalRootLinks').innerHTML = links
    ? sanitizeHtml(
        `<h4 class="text-sm font-semibold mt-3">${t('modal_root_links', 'Root Links')}</h4>${links}`
      )
    : '';
  qs('#modalPriceRange').textContent = d.priceRange || dash();
  const pogoDetails = [d.pogo, d.pgsharp].filter(Boolean).join(' • ');
  qs('#modalPoGoComp').textContent = pogoDetails || dash();
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  qs('#modalBackdrop').classList.add('hidden');
  qs('#modalBackdrop').classList.remove('flex');
  document.body.style.overflow = '';
}

qs('#closeModal')?.addEventListener('click', closeModal);
qs('#modalBackdrop')?.addEventListener('click', (e) => {
  if (e.target === qs('#modalBackdrop')) closeModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

const searchInput = qs('#searchInput');
const typeFilter = qs('#typeFilter');
const sortSelect = qs('#sortSelect');

searchInput?.addEventListener('input', applyFilters);
typeFilter?.addEventListener('change', applyFilters);
sortSelect?.addEventListener('change', applyFilters);

function applyFilters() {
  const wrap = qs('#gridWrap');
  if (!wrap) return;
  const q = (searchInput?.value || '').trim().toLowerCase();
  const type = typeFilter?.value || 'all';
  const sort = sortSelect?.value || 'default';
  let filtered = devices.filter((d) => {
    const hay = [d.model, d.brand, d.os, (d.notes || []).join(' ')].join(' ').toLowerCase();
    const matchesSearch = q ? hay.includes(q) : true;
    const matchesType = type === 'all' ? true : d.type === type;
    return matchesSearch && matchesType;
  });
  if (sort !== 'default') {
    filtered.sort((a, b) => {
      if (sort === 'brand') return a.brand.localeCompare(b.brand);
      if (sort === 'model') return a.model.localeCompare(b.model);
      if (sort === 'os') return a.os.localeCompare(b.os);
      if (sort === 'compatibility') {
        const aComp = Boolean(a.compatible);
        const bComp = Boolean(b.compatible);
        if (aComp === bComp) {
          const byBrand = String(a.brand || '').localeCompare(String(b.brand || ''));
          if (byBrand !== 0) return byBrand;
          return String(a.model || '').localeCompare(String(b.model || ''));
        }
        return aComp ? -1 : 1;
      }
      return 0;
    });
  }
  renderDevices(filtered);
}

const langSelect = qs('#langSelect');
langSelect?.addEventListener('change', (e) => {
  const lang = e.target.value;
  const params = new URLSearchParams(window.location.search);
  params.set('lang', lang);
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
  loadLang(lang);
});

function applyTranslations() {
  document.title = t('title', 'Pokémon GO Compatible Devices & PGSharp Updates');

  qs('#siteTitle') && (qs('#siteTitle').textContent = t('site_name', qs('#siteTitle').textContent));
  qs('#siteSubtitle') &&
    (qs('#siteSubtitle').textContent = t('site_subtitle', qs('#siteSubtitle').textContent));

  qsa('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const target = el.getAttribute('data-i18n-target') || 'text';
    const fallback =
      target === 'placeholder' ? el.getAttribute('placeholder') || '' : el.textContent || '';
    const value = t(key, fallback);
    if (target === 'text') el.textContent = value;
    if (target === 'html') el.innerHTML = sanitizeHtml(value);
    if (target === 'placeholder') el.setAttribute('placeholder', value);
    if (target === 'title') el.setAttribute('title', value);
    if (target === 'value') el.setAttribute('value', value);
  });

  const statusEl = qs('#deviceBuilderStatus');
  if (statusEl?.dataset.i18nKey) {
    statusEl.textContent = t(statusEl.dataset.i18nKey, statusEl.textContent);
  }

  if (langSelect) langSelect.value = currentLang;
}

function hydrateTranslations() {
  applyTranslations();
}

const deviceBuilderForm = qs('#deviceBuilderForm');
const deviceJsonOutput = qs('#deviceJsonOutput');
const copyDeviceJsonBtn = qs('#copyDeviceJson');
const deviceBuilderStatus = qs('#deviceBuilderStatus');
const deviceModal = qs('#deviceModal');
const deviceModalOpenBtn = qs('#deviceModalOpen');
const deviceModalCloseBtn = qs('#deviceModalClose');
const deviceFormClearBtn = qs('#deviceFormClear');

function setBuilderStatus(key) {
  if (!deviceBuilderStatus) return;
  deviceBuilderStatus.dataset.i18nKey = key;
  deviceBuilderStatus.textContent = t(key, deviceBuilderStatus.textContent);
}

function setupDeviceBuilder() {
  if (!deviceBuilderForm) return;
  copyDeviceJsonBtn.disabled = true;
  setBuilderStatus('device_builder_empty');
  deviceJsonOutput.textContent = '';

  deviceBuilderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const entry = {
      id: `${qs('#builderBrand').value}-${qs('#builderModel').value}`
        .toLowerCase()
        .replace(/\s+/g, '-'),
      brand: qs('#builderBrand').value.trim(),
      model: qs('#builderModel').value.trim(),
      os: qs('#builderOs').value.trim(),
      type: qs('#builderType').value.trim() || 'Phone',
      compatible: qs('#builderCompatible').checked,
      priceRange: qs('#builderPrice')?.value.trim() || undefined,
      notes: qs('#builderNotes')
        .value.split(',')
        .map((n) => n.trim())
        .filter(Boolean),
      rootLinks: qs('#builderRootLinks')
        .value.split(',')
        .map((n) => n.trim())
        .filter(Boolean),
    };
    if (!entry.brand || !entry.model) {
      setBuilderStatus('device_builder_empty');
      copyDeviceJsonBtn.disabled = true;
      deviceJsonOutput.textContent = '';
      return;
    }
    if (!entry.priceRange) delete entry.priceRange;
    const jsonString = JSON.stringify(entry, null, 2);
    deviceJsonOutput.textContent = jsonString;
    copyDeviceJsonBtn.disabled = false;
    setBuilderStatus('device_builder_result_hint');
  });

  copyDeviceJsonBtn?.addEventListener('click', async () => {
    if (!deviceJsonOutput.textContent) return;
    try {
      await navigator.clipboard.writeText(deviceJsonOutput.textContent);
      setBuilderStatus('device_builder_copied');
    } catch (err) {
      console.error('Clipboard copy failed', err);
    }
  });

  deviceModalOpenBtn?.addEventListener('click', () => {
    deviceModal?.classList.remove('hidden');
    deviceModal?.classList.add('flex');
  });

  deviceModalCloseBtn?.addEventListener('click', () => {
    deviceModal?.classList.add('hidden');
    deviceModal?.classList.remove('flex');
  });

  deviceModal?.addEventListener('click', (evt) => {
    if (evt.target === deviceModal) {
      deviceModal.classList.add('hidden');
      deviceModal.classList.remove('flex');
    }
  });

  deviceFormClearBtn?.addEventListener('click', () => {
    deviceBuilderForm?.reset();
    if (deviceJsonOutput) deviceJsonOutput.textContent = '';
    if (deviceBuilderStatus)
      deviceBuilderStatus.textContent = t(
        'device_builder_empty',
        'Fill in the form to generate JSON.'
      );
  });
}

function init() {
  newsSearchInput?.addEventListener('input', (evt) => {
    newsSearch = evt.target.value.trim().toLowerCase();
    renderNews(news);
  });
  if (newsTagFilterWrap) {
    if (newsTagFilterWrap.tagName === 'SELECT') {
      newsTagFilterWrap.addEventListener('change', (evt) => {
        const v = evt.target.value;
        newsSelectedTags.clear();
        if (v && v !== 'all' && v !== 'none') newsSelectedTags.add(v.toLowerCase());
        renderNews(news);
      });
    } else {
      newsTagFilterWrap.addEventListener('click', (evt) => {
        const btn = evt.target.closest('[data-tag]');
        if (!btn) return;
        const tag = btn.getAttribute('data-tag');
        if (newsSelectedTags.has(tag)) {
          newsSelectedTags.delete(tag);
          btn.classList.remove('bg-emerald-600', 'border-emerald-400');
          btn.classList.add('bg-slate-800', 'border-slate-700');
        } else {
          newsSelectedTags.add(tag);
          btn.classList.remove('bg-slate-800', 'border-slate-700');
          btn.classList.add('bg-emerald-600', 'border-emerald-400');
        }
        renderNews(news);
      });
    }
  }
}

const COORDS_DEBUG = false;
function clog(...args) {
  if (COORDS_DEBUG) console.log('[coords]', ...args);
}
function cerr(...args) {
  console.error('[coords]', ...args);
}

let coordsData = [];
let coordsFilterTag = null;

// `flattenCoords` was removed because it's not used — keep helper small and avoid unused-vars lint errors.

async function loadCoords() {
  debug('📡 Lade /data/coords.json ...');
  try {
    const res = await fetch(`/data/coords.json?ts=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    clog('json empfangen:', json);

    let coords = [];
    if (Array.isArray(json)) {
      coords = json;
    } else if (json && typeof json === 'object') {
      coords = Object.values(json).flat();
    }

    if (!coords.length) {
      console.warn(t('coords_load_none', '⚠️ No coordinates found in coords.json.'));
      return;
    }

    coordsData = coords;
    debug(`[coords] ${coords.length} Einträge geladen.`);

    renderCoords(coordsData);
    renderCoordsTags(coordsData);
  } catch (err) {
    console.error('[coords] Failed to load:', err);
  }
}

function formatLocalTimeAtLng(lng) {
  if (typeof lng !== 'number' || Number.isNaN(lng)) return '—';
  const hoursOffset = Math.round(lng / 15);
  const now = new Date();
  const local = new Date(now.getTime() + hoursOffset * 60 * 60 * 1000);
  try {
    return local.toLocaleTimeString(currentLang, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (e) {
    return local.toTimeString().split(' ')[0];
  }
}

function renderCoordsTags(list) {
  const wrap = qs('#coords-tags');
  if (!wrap) return;
  const tags = Array.from(
    new Set((list || []).flatMap((c) => (c.tags || []).map((t) => t.trim())))
  ).sort((a, b) => a.localeCompare(b));
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.dataset.tag = '';
  allBtn.textContent = t('coords_filter_all', 'All');
  allBtn.className =
    'px-3 py-1 text-xs rounded-full border mr-2 ' +
    (!coordsFilterTag ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-800 border-slate-700');
  wrap.innerHTML = '';
  wrap.appendChild(allBtn);

  tags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.tag = tag;
    btn.textContent = tag;
    btn.className =
      'px-3 py-1 text-xs rounded-full border mr-2 ' +
      (coordsFilterTag === tag
        ? 'bg-emerald-600 border-emerald-400'
        : 'bg-slate-800 border-slate-700');
    wrap.appendChild(btn);
  });

  wrap.onclick = (evt) => {
    const btn = evt.target.closest('button[data-tag]');
    if (!btn) return;
    const tag = btn.dataset.tag || null;
    coordsFilterTag = tag || null;
    Array.from(wrap.querySelectorAll('button[data-tag]')).forEach((b) => {
      const isActive = (b.dataset.tag || '') === (coordsFilterTag || '');
      b.classList.toggle('bg-emerald-600', isActive);
      b.classList.toggle('border-emerald-400', isActive);
      b.classList.toggle('bg-slate-800', !isActive);
      b.classList.toggle('border-slate-700', !isActive);
    });
    renderCoords(coordsData);
  };
}

function renderCoords(list) {
  const container = document.getElementById('coords-list');
  if (!container) {
    console.warn('⚠️ Kein #coords-list Element gefunden');
    return;
  }
  const filtered =
    coordsFilterTag && coordsFilterTag.length
      ? (list || []).filter(
          (c) => Array.isArray(c.tags) && c.tags.some((t) => t === coordsFilterTag)
        )
      : list || [];

  if (!filtered.length) {
    container.innerHTML = sanitizeHtml(
      `<div class="text-slate-400 py-4">${t(
        'no_coords_found',
        'Keine Koordinaten gefunden.'
      )}</div>`
    );
    return;
  }

  container.innerHTML = sanitizeHtml(
    filtered
      .map((c, idx) => {
        const localTime = typeof c.lng === 'number' ? formatLocalTimeAtLng(c.lng) : '—';
        const tagsHtml = (c.tags || [])
          .map(
            (tag) =>
              `<span class="px-2 py-0.5 mr-1 text-xs rounded bg-slate-800 border border-slate-700">${esc(
                tag
              )}</span>`
          )
          .join('');
        return `
      <div class="coords-item py-3 border-b border-slate-700 cursor-pointer" data-idx="${idx}">
        <div class="flex items-baseline justify-between">
          <div class="font-semibold text-slate-200">${esc(c.name || '(Unbenannt)')}</div>
          <div class="text-xs text-slate-400 ml-4">${esc(localTime)}</div>
        </div>
        <div class="text-slate-400 text-sm mt-1">${esc(String(c.lat ?? '—'))}, ${esc(
          String(c.lng ?? '—')
        )}</div>
        <div class="mt-2">${tagsHtml}</div>
        ${c.note ? `<div class="text-xs text-slate-500 italic mt-2">${esc(c.note)}</div>` : ''}
      </div>
    `;
      })
      .join('')
  );

  Array.from(container.querySelectorAll('.coords-item')).forEach((el, i) => {
    el.addEventListener('click', () => {
      const item = filtered[i];
      if (item) openCoordsModal(item);
    });
  });
}

function openCoordsModal(item) {
  const backdrop = qs('#coordsModalBackdrop');
  if (!backdrop) {
    cerr('openCoordsModal: modal backdrop not found');
    return;
  }
  qs('#coordsModalTitle').textContent = item.name || '—';
  qs('#coordsModalMeta').textContent = `Lat: ${item.lat ?? '—'} • Lng: ${item.lng ?? '—'}`;
  qs('#coordsModalNote').textContent = item.note || '';
  const tagsWrap = qs('#coordsModalTags');
  if (tagsWrap)
    tagsWrap.innerHTML = sanitizeHtml(
      (item.tags || [])
        .map(
          (t) =>
            `<span class="px-2 py-0.5 text-xs rounded bg-slate-800 border border-slate-700">${esc(
              t
            )}</span>`
        )
        .join(' ')
    );
  const mapsLink = qs('#coordsModalMaps');
  if (mapsLink) {
    if (typeof item.lat !== 'undefined' && typeof item.lng !== 'undefined') {
      mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        item.lat + ',' + item.lng
      )}`;
    } else {
      mapsLink.removeAttribute('href');
    }
  }
  backdrop.classList.remove('hidden');
  backdrop.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeCoordsModal() {
  const backdrop = qs('#coordsModalBackdrop');
  if (!backdrop) return;
  backdrop.classList.add('hidden');
  backdrop.classList.remove('flex');
  document.body.style.overflow = '';
}

qs('#coordsModalClose')?.addEventListener('click', closeCoordsModal);
qs('#coordsModalBackdrop')?.addEventListener('click', (e) => {
  if (e.target === qs('#coordsModalBackdrop')) closeCoordsModal();
});

function updateCoordsTime() {
  const el = qs('#coords-time');
  if (!el) return;
  function tick() {
    const now = new Date();
    // Use i18n keys for the coords time label so translations work
    const label = t('coords_time_label', 'Current time');
    const suffix = t('coords_time_user_suffix', 'Local time');
    el.textContent = `${label}: ${now.toLocaleTimeString()} (${suffix})`;
  }
  tick();
  if (!updateCoordsTime._interval) updateCoordsTime._interval = setInterval(tick, 1000);
}
const newsModalBackdrop = qs('#newsModalBackdrop');
const closeNewsModalBtn = qs('#closeNewsModal');
const newsModalTitle = qs('#newsModalTitle');
const newsModalMeta = qs('#newsModalMeta');
const newsModalBody = qs('#newsModalBody');
const newsModalTagsWrap = qs('#newsModalTagsWrap');
const newsModalTags = qs('#newsModalTags');

function openNewsModal(original, translated = {}) {
  const merged = {
    ...original,
    ...translated,
    tags: original.tags || [],
  };
  newsModalTitle.textContent = merged.title;
  const pub = merged.publishedAt ? dateFormatter.format(new Date(merged.publishedAt)) : dash();
  const upd =
    merged.updatedAt && merged.updatedAt !== merged.publishedAt
      ? dateFormatter.format(new Date(merged.updatedAt))
      : null;

  const publishedLabel = t('news_published', 'Published');
  const updatedLabel = t('news_updated', 'Updated');
  newsModalMeta.innerHTML = `
    <span>${publishedLabel}: ${esc(pub)}</span>
    ${upd ? `<span class="ml-3">${updatedLabel}: ${esc(upd)}</span>` : ''}
  `;
  newsModalMeta.innerHTML = sanitizeHtml(newsModalMeta.innerHTML);

  const body = merged.content || merged.excerpt || '';
  if (body) {
    newsModalBody.innerHTML = sanitizeHtml(
      body
        .split(/\n{2,}/)
        .map(
          (block) => `<p>${esc(block).replace(/\n/g, '<br>').replace(/ {2}/g, '&nbsp;&nbsp;')}</p>`
        )
        .join('')
    );
  } else {
    newsModalBody.innerHTML = sanitizeHtml(
      `<p>${esc(t('news_modal_no_content', 'No additional details provided.'))}</p>`
    );
  }

  if (merged.tags && merged.tags.length) {
    newsModalTags.innerHTML = sanitizeHtml(
      merged.tags
        .map(
          (tag) =>
            `<span class="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">${esc(
              tag
            )}</span>`
        )
        .join('')
    );
    newsModalTagsWrap.classList.remove('hidden');
  } else {
    newsModalTagsWrap.classList.add('hidden');
    newsModalTags.innerHTML = '';
  }

  newsModalBackdrop.classList.remove('hidden');
  newsModalBackdrop.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeNewsModal() {
  newsModalBackdrop.classList.add('hidden');
  newsModalBackdrop.classList.remove('flex');
  document.body.style.overflow = '';
}

closeNewsModalBtn?.addEventListener('click', closeNewsModal);
newsModalBackdrop?.addEventListener('click', (evt) => {
  if (evt.target === newsModalBackdrop) closeNewsModal();
});
window.addEventListener('keydown', (evt) => {
  if (evt.key === 'Escape') {
    closeModal();
    closeNewsModal();
  }
});

function setupPgSharpTabs() {
  const root = qs('#pgsharpSection');
  if (!root) return;
  const tabBtns = Array.from(root.querySelectorAll('[data-pgsharp-tab]'));
  const tabContents = Array.from(root.querySelectorAll('[data-pgsharp-content]'));
  let active = 'faq';

  function activate(tab) {
    tabBtns.forEach((btn) => {
      const isActive = btn.dataset.pgsharpTab === tab;
      btn.classList.toggle('bg-emerald-400', isActive);
      btn.classList.toggle('text-slate-900', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    tabContents.forEach((content) => {
      if (content.dataset.pgsharpContent === tab) {
        content.classList.remove('hidden');
        content.classList.add('active');
        content.classList.remove('fade');
      } else {
        content.classList.add('hidden');
        content.classList.remove('active');
        content.classList.add('fade');
      }
    });
    active = tab;
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.pgsharpTab));
  });

  activate(active);
}

function showSectionByName(name) {
  const id = name && name.endsWith && name.endsWith('Section') ? name : `${name}Section`;
  const target = document.getElementById(id) || document.getElementById(name);
  if (!target) {
    console.warn('showSectionByName: no target for', name, id);
    return;
  }

  document.querySelectorAll('main section[id$="Section"], main .page, .page').forEach((s) => {
    if (s === target) {
      s.classList.remove('hidden');
      s.style.display = '';
      s.setAttribute('aria-hidden', 'false');
    } else {
      s.classList.add('hidden');
      s.style.display = 'none';
      s.setAttribute('aria-hidden', 'true');
    }
  });

  const plain = (id || '').replace(/Section$/, '');
  try {
    history.replaceState(null, '', `#${plain}`);
  } catch (e) {
    // ignore history.replaceState errors in older browsers
    void e;
  }

  if (plain === 'devices' && typeof loadDevices === 'function') {
    loadDevices().catch((e) => console.error('loadDevices:', e));
  }
  if (plain === 'pgsharp') {
    const pg = document.getElementById('pgsharpSection');
    if (pg) {
      pg.classList.remove('hidden');
      pg.style.display = '';
    }
    if (typeof setupPgSharpTabs === 'function') {
      try {
        setupPgSharpTabs();
      } catch (e) {
        console.error('setupPgSharpTabs', e);
      }
    }
  }
  if (plain === 'news' && typeof window.initNewsFilters === 'function') {
    try {
      // Some pages may add an optional initNewsFilters hook; call it if available.
      window.initNewsFilters();
    } catch (e) {
      console.warn('initNewsFilters', e);
    }
  }
}

document.addEventListener('click', (ev) => {
  const btn = ev.target.closest && ev.target.closest('[data-section]');
  if (!btn) return;
  ev.preventDefault();
  const name = btn.getAttribute('data-section');
  if (name) showSectionByName(name);
});

window.addEventListener('load', () => {
  const h = (location.hash || '').replace('#', '');
  if (h) showSectionByName(h);
  else showSectionByName('overview');
});

// Header shrink on scroll for better focus (compact header)
(function setupHeaderShrink() {
  const header = document.querySelector('header');
  if (!header) return;
  function update() {
    if (window.scrollY > 64) header.classList.add('header--compact');
    else header.classList.remove('header--compact');
  }
  window.addEventListener('scroll', update, { passive: true });
  // initial
  update();
})();

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadPokeminersVersion() {
  const pkApkEl = document.getElementById('pk-apk');

  try {
    const res = await fetch('/api/pokeminers/version', { cache: 'no-store' });
    const data = await res.json();

    if (data.ok) {
      pkApkEl.textContent = data.apkVersion || '–';
    } else {
      pkApkEl.textContent = '–';
      console.warn('Pokeminers fetch error:', data.error);
    }
  } catch (err) {
    pkApkEl.textContent = '–';
    console.error('Failed to load Pokeminers version:', err);
  }
}

async function loadPgsharpVersion() {
  const pgPageEl = document.getElementById('pg-page');
  const pgApkEl = document.getElementById('pg-apk');
  const pgStatusEl = document.getElementById('pg-status');
  const pkApkEl = document.getElementById('pk-apk');

  try {
    const [pgRes, pkRes] = await Promise.all([
      fetch('/api/pgsharp/version', { cache: 'no-store' }),
      fetch('/api/pokeminers/version', { cache: 'no-store' }),
    ]);
    const [pgData, pkData] = await Promise.all([pgRes.json(), pkRes.json()]);

    if (pgData.ok) {
      pgPageEl.textContent = pgData.pageVersion || '–';
      pgApkEl.textContent = pgData.pogoVersion || '–';
    }

    if (pkData.ok) {
      pkApkEl.textContent = pkData.apkVersion || '–';
    }

    if (pgData.ok && pkData.ok) {
      const pgVer = parseFloat((pgData.pogoVersion || '0').replace(/[^\d.]/g, ''));
      const pkVer = parseFloat((pkData.apkVersion || '0').replace(/[^\d.]/g, ''));

      if (pgVer >= pkVer) {
        pgStatusEl.textContent =
          pgVer === pkVer
            ? t('pgsharp_status_compatible', 'Compatible')
            : t('pgsharp_status_pgsharp_newer', 'PGSharp newer than Pokeminers');
        pgStatusEl.className = 'font-semibold text-emerald-400';
      } else {
        pgStatusEl.textContent = t(
          'pgsharp_status_not_compatible',
          'Not compatible / Waiting for PGSharp update'
        );
        pgStatusEl.className = 'font-semibold text-red-400';
      }
    } else {
      pgStatusEl.textContent = '–';
      pgStatusEl.className = 'font-semibold text-yellow-400';
    }
  } catch (err) {
    console.error('Failed to load PGSharp or Pokeminers version:', err);
    pgStatusEl.textContent = t('pgsharp_status_error', 'Error');
    pgStatusEl.className = 'font-semibold text-red-400';
  }
}

window.loadCoords = loadCoords;

setupDeviceBuilder();
showSectionByName(activeSection);
loadLang(currentLang).then(() => {
  loadDevices();
  loadNews();
  init();
});

document.addEventListener('DOMContentLoaded', () => {
  hydrateTranslations();
  hydrateGrid();
  bindNavigation();
  setupPgSharpTabs();
  updateCoordsTime();
  loadCoords();
  fetch('/api/uptime')
    .then((res) => res.json())
    .then((data) => {
      const el = document.getElementById('uptime');
      if (el && data && typeof data.uptime === 'number') {
        el.textContent = `${t('uptime_label', 'Uptime')} : ${data.uptime.toFixed(2)} %`;
      }
    })
    .catch(() => {});

  const reportForm = qs('#pgsharp-report-form');
  if (reportForm) {
    reportForm.addEventListener('submit', (evt) => {
      evt.preventDefault();
      const email = qs('#pgsharp-report-email')?.value || '';
      const message = qs('#pgsharp-report-message')?.value || '';
      reportForm.innerHTML = sanitizeHtml(
        `<div class="text-green-400">${t(
          'pgsharp_report_local_success',
          'Thanks — your message was processed locally.'
        )}</div>`
      );
      debug('PGSharp report (local):', { email, message });
    });
  }

  loadPgsharpVersion();
  loadPokeminersVersion();
  setInterval(loadPgsharpVersion, 30 * 60 * 1000);
  setInterval(loadPokeminersVersion, 30 * 60 * 1000);
});
