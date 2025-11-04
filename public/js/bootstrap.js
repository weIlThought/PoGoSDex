// Orchestrator: bind Navigation, lazy-load sections, minimal Overview/Status wiring
import {
  qs,
  qsa,
  sanitizeHtml,
  esc,
  t,
  loadLang,
  applyTranslations,
  getDateFormatter,
} from './core.js';
import { ModalManager } from './modals.js';

let activeSection = 'overview';
let newsLoaded = false;
let devicesLoaded = false;
let pgsharpInitialized = false;

// -------- Overview: Issues (public) --------
const issuesModal = new ModalManager('#issuesModalBackdrop', '#closeIssuesModal');

function issueStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'open') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (s === 'in_progress' || s === 'in-progress') return 'bg-sky-100 text-sky-800 border-sky-200';
  if (s === 'resolved') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s === 'closed') return 'bg-slate-200 text-slate-800 border-slate-300';
  if (s === 'blocked') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-slate-200 text-slate-800 border-slate-300';
}

function openIssueModal(item) {
  const df = getDateFormatter();
  const titleEl = qs('#issuesModalTitle');
  const metaEl = qs('#issuesModalMeta');
  const bodyEl = qs('#issuesModalBody');
  const tagsWrap = qs('#issuesModalTagsWrap');
  const tagsEl = qs('#issuesModalTags');
  if (titleEl) titleEl.textContent = item.title || '—';

  const pub = item.createdAt ? df.format(new Date(item.createdAt)) : '—';
  const upd =
    item.updatedAt && item.updatedAt !== item.createdAt
      ? df.format(new Date(item.updatedAt))
      : null;
  const statusText = item.status ? String(item.status) : 'open';
  const createdLabel = t('issues_created', 'Created');
  const updatedLabel = t('issues_updated', 'Updated');
  const statusLabel = t('issues_status', 'Status');
  const badgeClass = issueStatusBadgeClass(statusText);
  if (metaEl)
    metaEl.innerHTML = sanitizeHtml(`
      <span>${createdLabel}: ${esc(pub)}</span>
      ${upd ? `<span class="ml-3">${updatedLabel}: ${esc(upd)}</span>` : ''}
      <span class="ml-3">${statusLabel}:
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}">
          <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
          <span class="uppercase tracking-wide">${esc(statusText)}</span>
        </span>
      </span>
    `);

  const body = item.content || '';
  if (bodyEl)
    bodyEl.innerHTML = body
      ? sanitizeHtml(
          body
            .split(/\n{2,}/)
            .map(
              (block) =>
                `<p>${esc(block).replace(/\n/g, '<br>').replace(/ {2}/g, '&nbsp;&nbsp;')}</p>`
            )
            .join('')
        )
      : sanitizeHtml(`<p>${esc(t('issues_no_details', 'No additional details provided.'))}</p>`);

  const tags = Array.isArray(item.tags) ? item.tags : [];
  if (tags.length) {
    if (tagsEl)
      tagsEl.innerHTML = sanitizeHtml(
        tags
          .map(
            (tag) =>
              `<span class="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">${esc(
                tag
              )}</span>`
          )
          .join('')
      );
    tagsWrap && tagsWrap.classList.remove('hidden');
  } else {
    tagsWrap && tagsWrap.classList.add('hidden');
    if (tagsEl) tagsEl.innerHTML = '';
  }

  issuesModal.open();
}

function renderIssues(items) {
  const list = document.getElementById('issuesList');
  if (!list) return;
  list.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    const li = document.createElement('li');
    li.className = 'text-slate-400';
    li.textContent = t('issues_empty', 'No known issues at the moment.');
    list.appendChild(li);
    return;
  }
  items.slice(0, 5).forEach((it) => {
    const li = document.createElement('li');
    li.classList.add('cursor-pointer');
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.innerHTML = sanitizeHtml(`
      <strong>${esc(it.title || '')}</strong>
      ${
        it.content
          ? `<p class="text-slate-400">${esc(it.content.slice(0, 180))}${
              it.content.length > 180 ? '…' : ''
            }</p>`
          : ''
      }
      <div class="mt-1 text-xs text-slate-500">${esc(it.status || 'open')}</div>
    `);
    const open = () => openIssueModal(it);
    li.addEventListener('click', open);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    list.appendChild(li);
  });
}

async function loadIssues() {
  try {
    const res = await fetch('/api/issues?status=open', { cache: 'no-store' });
    const data = res.ok ? await res.json() : [];
    renderIssues(Array.isArray(data) ? data : []);
  } catch {
    renderIssues([]);
  }
}

// -------- Service Status (UptimeRobot proxy) --------
const STATUS_COLORS = {
  up: 'bg-emerald-400',
  degraded: 'bg-yellow-400',
  down: 'bg-red-400',
  unknown: 'bg-slate-400',
};

function setStatusUI({ state = 'unknown', uptimeRatio = null, uptimeText = null } = {}) {
  const indicator = document.getElementById('statusIndicator');
  const message = document.getElementById('statusMessage');
  const uptime = document.getElementById('statusUptime');
  if (!indicator || !message || !uptime) return;

  indicator.classList.remove('animate-pulse');
  Object.values(STATUS_COLORS).forEach((cls) => indicator.classList.remove(cls));
  indicator.classList.add(STATUS_COLORS[state] || STATUS_COLORS.unknown);

  let msg = t('status_unknown', 'Status unknown');
  if (state === 'up') msg = t('status_up', 'All systems operational');
  else if (state === 'degraded') msg = t('status_degraded', 'Degraded performance');
  else if (state === 'down') msg = t('status_down', 'Service interruption');
  message.textContent = msg;

  const label = t('status_uptime_label', 'Uptime');
  if (typeof uptimeText === 'string') {
    uptime.textContent = `${label}: ${uptimeText}`;
  } else if (typeof uptimeRatio === 'number' && Number.isFinite(uptimeRatio)) {
    uptime.textContent = `${label}: ${uptimeRatio.toFixed(2)} %`;
  } else {
    uptime.textContent = `${label}: ${t('status_uptime_na', '— %')}`;
  }
}

async function fetchServiceStatus() {
  try {
    const res = await fetch('/status/uptime', { cache: 'no-store' });
    if (res.status === 501) {
      setStatusUI({
        state: 'unknown',
        uptimeText: t('status_uptime_not_configured', 'Not configured'),
      });
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || (!('state' in data) && !('uptimeRatio' in data)))
      throw new Error('Invalid payload');
    setStatusUI({ state: data.state || 'unknown', uptimeRatio: data.uptimeRatio ?? null });
  } catch (err) {
    setStatusUI({ state: 'unknown', uptimeRatio: null });
    // optional debug
    // console.debug('Service status fetch failed:', err);
  }
}

function initServiceStatus() {
  const indicator = document.getElementById('statusIndicator');
  if (indicator) indicator.classList.add('animate-pulse');
  fetchServiceStatus();
  if (!initServiceStatus._interval)
    initServiceStatus._interval = setInterval(fetchServiceStatus, 180_000);
}

// -------- Navigation / Sections --------
function showSectionByName(name) {
  const id = name && name.endsWith && name.endsWith('Section') ? name : `${name}Section`;
  const target = document.getElementById(id) || document.getElementById(name);
  if (!target) return;

  document.querySelectorAll('main section[id$="Section"], main .page, .page').forEach((s) => {
    if (s === target) {
      s.classList.remove('hidden');
      s.setAttribute('aria-hidden', 'false');
    } else {
      s.classList.add('hidden');
      s.setAttribute('aria-hidden', 'true');
    }
  });

  const plain = (id || '').replace(/Section$/, '');
  try {
    history.replaceState(null, '', `#${plain}`);
  } catch {}

  // Lazy-load per section
  if (plain === 'devices' && !devicesLoaded) {
    import('/js/section-devices.js')
      .then((m) => m.initDevices && m.initDevices())
      .then(() => (devicesLoaded = true))
      .catch((e) => console.error('devices init failed:', e));
  }
  if (plain === 'news' && !newsLoaded) {
    import('/js/section-news.js')
      .then((m) => m.initNews && m.initNews())
      .then(() => (newsLoaded = true))
      .catch((e) => console.error('news init failed:', e));
  }
  if (plain === 'pgsharp' && !pgsharpInitialized) {
    import('/js/pgsharp-init.js')
      .then((m) => m.initPgsharp && m.initPgsharp())
      .then(() => (pgsharpInitialized = true))
      .catch((e) => console.error('pgsharp init failed:', e));
  }

  // Toggle header nav state
  document.querySelectorAll('[data-section]').forEach((btn) => {
    const isActive = btn.getAttribute('data-section') === plain;
    btn.setAttribute('aria-selected', String(isActive));
  });

  activeSection = plain;

  // Show legal/status only on overview
  const overviewActive = plain === 'overview';
  [document.getElementById('legalSection'), document.getElementById('statusSection')].forEach(
    (el) => {
      if (!el) return;
      if (overviewActive) {
        el.classList.remove('hidden');
        el.setAttribute('aria-hidden', 'false');
      } else {
        el.classList.add('hidden');
        el.setAttribute('aria-hidden', 'true');
      }
    }
  );
}

function bindNavigation() {
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest && ev.target.closest('[data-section]');
    if (!btn) return;
    ev.preventDefault();
    const name = btn.getAttribute('data-section');
    if (name) showSectionByName(name);
  });
}

// -------- Boot --------
document.addEventListener('DOMContentLoaded', async () => {
  await loadLang('en'); // LANG_LOCK in core erzwingt ggf. en
  applyTranslations();

  bindNavigation();
  initServiceStatus();

  // Initial section
  const h = (location.hash || '').replace('#', '');
  showSectionByName(h || 'overview');

  // Load overview issues
  loadIssues();
});
