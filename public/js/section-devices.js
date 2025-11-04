import { qs, qsa, sanitizeHtml, esc, t, DataLoader, debug } from './core.js';
import { ModalManager } from './modals.js';

let devices = [];
let deviceRenderLimit = 50;
let devicesLoaded = false;
let deviceObserver;
let deviceModal;

export async function initDevices() {
  if (devicesLoaded) return;
  deviceModal = new ModalManager('#modalBackdrop', '#closeModal');
  await loadDevices();
  bindFilters();
  setupDeviceBuilder();
  renderDevices(devices);
  devicesLoaded = true;
}

async function loadDevices() {
  devices = await DataLoader.loadJSON('/api/devices', [], 'devices');
}

function bindFilters() {
  const searchInput = qs('#searchInput');
  const typeFilter = qs('#typeFilter');
  const sortSelect = qs('#sortSelect');

  searchInput?.addEventListener('input', () => applyFilters());
  typeFilter?.addEventListener('change', () => applyFilters());
  sortSelect?.addEventListener('change', () => applyFilters());
}

function getFilterState() {
  const search = (qs('#searchInput')?.value || '').trim().toLowerCase();
  const type = qs('#typeFilter')?.value || 'all';
  const sort = qs('#sortSelect')?.value || 'default';
  return { search, type, sort };
}

function filterSort(devs) {
  const { search, type, sort } = getFilterState();
  const filtered = devs.filter((d) => {
    const txt = [d.model, d.brand, d.os, (d.notes || []).join(' ')].join(' ').toLowerCase();
    const q = !search || txt.includes(search);
    const t = type === 'all' || d.type === type;
    return q && t;
  });
  if (sort === 'default') return filtered;
  return filtered.sort((a, b) => {
    switch (sort) {
      case 'brand':
        return String(a.brand || '').localeCompare(String(b.brand || ''));
      case 'model':
        return String(a.model || '').localeCompare(String(b.model || ''));
      case 'os':
        return String(a.os || '').localeCompare(String(b.os || ''));
      case 'compatibility': {
        const aa = !!a.compatible,
          bb = !!b.compatible;
        if (aa === bb)
          return (
            String(a.brand || '').localeCompare(String(b.brand || '')) ||
            String(a.model || '').localeCompare(String(b.model || ''))
          );
        return aa ? -1 : 1;
      }
      default:
        return 0;
    }
  });
}

function cardHtml(d) {
  const notePreview = d.notes && d.notes.length ? esc(String(d.notes[0]).slice(0, 130)) : '';
  const badgeClass = d.compatible
    ? 'inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200'
    : 'inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200';
  const titleId = `device-title-${esc(d.id)}`;
  return `<article class="bg-linear-to-br from-slate-800 to-slate-900 border border-slate-800 rounded-lg p-6 h-full flex flex-col justify-between cursor-pointer transform transition hover:-translate-y-1 shadow-lg" data-id="${esc(
    d.id
  )}" role="article" aria-labelledby="${titleId}">
    <div>
      <div class="flex items-start justify-between">
        <div>
          <h3 id="${titleId}" class="text-lg font-semibold text-slate-100">${esc(d.model)}</h3>
          <p class="text-sm text-slate-400">${esc(d.brand)} • ${esc(d.type)}</p>
        </div>
        <div><span class="${badgeClass}">${d.compatible ? 'Compatible' : 'Unknown'}</span></div>
      </div>
      <p class="mt-3 text-slate-300 text-sm">${esc(d.os)}</p>
      <p class="mt-2 text-sm text-slate-400">${notePreview}</p>
    </div>
    <div class="mt-4 text-xs text-slate-400">&nbsp;</div>
  </article>`;
}

export function renderDevices(list) {
  const container = qs('[data-devices-grid]');
  if (!container) return;
  const sorted = filterSort(list);
  const limited = deviceRenderLimit === Infinity ? sorted : sorted.slice(0, deviceRenderLimit);
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
    card.addEventListener('click', () => openDeviceModal(d));
    container.appendChild(card);
  });
  setupDeviceVirtualScroll();
}

function setupDeviceVirtualScroll() {
  const container = qs('[data-devices-grid]');
  if (!container) return;
  let sentinel = document.getElementById('gridSentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'gridSentinel';
    sentinel.className = 'col-span-full h-4';
    container.appendChild(sentinel);
  }
  if (deviceObserver) return;
  deviceObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        const prev = deviceRenderLimit;
        deviceRenderLimit = Math.min(devices.length, deviceRenderLimit + 50);
        if (deviceRenderLimit !== prev) renderDevices(devices);
      }
    },
    { rootMargin: '200px' }
  );
  deviceObserver.observe(sentinel);
}

function openDeviceModal(d) {
  const mb = qs('#modalBackdrop');
  if (!mb) return;
  qs('#modalTitle').textContent = d.model;
  qs('#modalMeta').textContent = `${d.brand} • ${d.type} • ${d.os}`;
  qs('#modalDesc').textContent = d.compatible
    ? 'Compatibility: confirmed'
    : 'Compatibility: unknown or not verified';
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
    ? sanitizeHtml(`<h4 class="text-sm font-semibold mt-3">Root Links</h4>${links}`)
    : '';
  qs('#modalPriceRange').textContent = d.priceRange || '—';
  const pogoDetails = [d.pogo, d.pgsharp].filter(Boolean).join(' • ');
  qs('#modalPoGoComp').textContent = pogoDetails || '—';
  deviceModal?.open();
}

function applyFilters() {
  renderDevices(devices);
}

// Device proposal form & modal wiring (moved from bootstrap orchestrator)
function setupDeviceBuilder() {
  const form = qs('#deviceBuilderForm');
  const statusEl = qs('#deviceBuilderStatus');
  if (!form) return;
  const setStatus = (key, fallback) => {
    if (!statusEl) return;
    statusEl.dataset.i18nKey = key;
    statusEl.textContent = t(key, fallback || statusEl.textContent);
  };
  setStatus('device_proposal_empty', 'Fill out the form and submit.');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      brand: qs('#builderBrand')?.value.trim(),
      model: qs('#builderModel')?.value.trim(),
      os: qs('#builderOs')?.value.trim(),
      type: qs('#builderType')?.value.trim() || 'Phone',
      compatible: !!qs('#builderCompatible')?.checked,
      priceRange: qs('#builderPrice')?.value.trim() || undefined,
      notes: (qs('#builderNotes')?.value || '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean),
      rootLinks: (qs('#builderRootLinks')?.value || '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean),
      hp: qs('#builderHP')?.value?.trim() || '',
    };
    if (!payload.model) return setStatus('device_proposal_empty');
    try {
      const res = await fetch('/api/device-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setStatus('device_proposal_success', 'Thanks! Your proposal was submitted.');
      form.reset();
    } catch (err) {
      setStatus('device_proposal_error', 'Submission failed. Please try again later.');
    }
  });

  qs('#deviceModalOpen')?.addEventListener('click', () => {
    qs('#deviceModal')?.classList.remove('hidden');
    qs('#deviceModal')?.classList.add('flex');
  });
  qs('#deviceModalClose')?.addEventListener('click', () => {
    qs('#deviceModal')?.classList.add('hidden');
    qs('#deviceModal')?.classList.remove('flex');
  });
  qs('#deviceModal')?.addEventListener('click', (evt) => {
    const modal = qs('#deviceModal');
    if (evt.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  });
  qs('#deviceFormClear')?.addEventListener('click', () => {
    form.reset();
    setStatus('device_proposal_empty', 'Fill out the form and submit.');
  });
}
