import { sanitizeHtml, esc, t, DataLoader } from './core.js';
import { ModalManager } from './modals.js';

let coords = [];
let coordsFilterTag = null;
let modal;

export async function initCoords() {
  if (window.__esmCoords) return; // prevent double init
  window.__esmCoords = true;

  modal = new ModalManager('#coordsModalBackdrop', '#coordsModalClose');

  startClock();
  await loadCoords();
  renderTags(coords);
  renderList(coords);
}

async function loadCoords() {
  try {
    // Bypass client cache to reflect latest data
    const ts = Date.now();
    coords = await DataLoader.loadJSON(`/api/coords?ts=${ts}`, [], 'coords');
  } catch (err) {
    console.error('[coords] load failed:', err);
    coords = [];
  }
}

function startClock() {
  const el = document.getElementById('coords-time');
  if (!el) return;
  function tick() {
    try {
      const now = new Date();
      el.textContent = `${t('coords_time_label', 'Current time')}: ${now.toLocaleTimeString()} (${t(
        'coords_time_user_suffix',
        'Local time'
      )})`;
    } catch {}
  }
  tick();
  if (!startClock._int) startClock._int = setInterval(tick, 1000);
}

function renderTags(list) {
  const wrap = document.getElementById('coords-tags');
  if (!wrap) return;
  const tags = Array.from(
    new Set((list || []).flatMap((c) => (c.tags || []).map((t) => t.trim())))
  ).sort((a, b) => a.localeCompare(b));

  wrap.innerHTML = '';
  const addBtn = (label, tag) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.tag = tag || '';
    btn.textContent = label;
    const active = (tag || '') === (coordsFilterTag || '');
    btn.className =
      'px-3 py-1 text-xs rounded-full border mr-2 ' +
      (active ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-800 border-slate-700');
    wrap.appendChild(btn);
  };

  addBtn(t('coords_filter_all', 'All'), '');
  tags.forEach((tag) => addBtn(tag, tag));

  wrap.onclick = (evt) => {
    const btn = evt.target.closest('button[data-tag]');
    if (!btn) return;
    coordsFilterTag = btn.dataset.tag || '';
    renderTags(list);
    renderList(list);
  };
}

function renderList(list) {
  const container = document.getElementById('coords-list');
  if (!container) return;
  const filtered =
    coordsFilterTag || ''
      ? (list || []).filter((c) => Array.isArray(c.tags) && c.tags.includes(coordsFilterTag))
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
        const tagsHtml = (c.tags || [])
          .map(
            (tag) =>
              `<span class="px-2 py-0.5 mr-1 text-xs rounded bg-slate-800 border border-slate-700">${esc(
                tag
              )}</span>`
          )
          .join('');
        return `
          <div data-idx="${idx}" class="py-3 border-b border-slate-700 cursor-pointer">
            <div class="flex items-baseline justify-between">
              <div class="font-semibold text-slate-200">${esc(c.name || '(Unbenannt)')}</div>
            </div>
            <div class="text-slate-400 text-sm mt-1">${esc(String(c.lat ?? '—'))}, ${esc(
          String(c.lng ?? '—')
        )}</div>
            <div class="mt-2">${tagsHtml}</div>
            ${c.note ? `<div class="text-xs text-slate-500 italic mt-2">${esc(c.note)}</div>` : ''}
          </div>`;
      })
      .join('')
  );

  Array.from(container.querySelectorAll('[data-idx]')).forEach((el) => {
    const i = Number(el.getAttribute('data-idx'));
    el.addEventListener('click', () => {
      const item = filtered[i];
      if (item) openModal(item);
    });
  });
}

function openModal(item) {
  try {
    const title = document.getElementById('coordsModalTitle');
    const meta = document.getElementById('coordsModalMeta');
    const tags = document.getElementById('coordsModalTags');
    const note = document.getElementById('coordsModalNote');
    const maps = document.getElementById('coordsModalMaps');

    if (title) title.textContent = item.name || '—';
    if (meta) meta.textContent = `Lat: ${item.lat ?? '—'} • Lng: ${item.lng ?? '—'}`;
    if (note) note.textContent = item.note || '';
    if (tags)
      tags.innerHTML = sanitizeHtml(
        (item.tags || [])
          .map(
            (t) =>
              `<span class="px-2 py-0.5 text-xs rounded bg-slate-800 border border-slate-700">${esc(
                t
              )}</span>`
          )
          .join(' ')
      );
    if (maps) {
      if (typeof item.lat !== 'undefined' && typeof item.lng !== 'undefined') {
        maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          item.lat + ',' + item.lng
        )}`;
      } else {
        maps.removeAttribute('href');
      }
    }
  } catch {}
  modal.open();
}
