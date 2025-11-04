import { qs, sanitizeHtml, esc, t, getDateFormatter, DataLoader } from './core.js';
import { ModalManager } from './modals.js';

let issues = [];
let issuesModal;

export async function initOverview() {
  issuesModal = new ModalManager('#issuesModalBackdrop', '#closeIssuesModal');
  await loadIssues();
}

async function loadIssues() {
  try {
    issues = await DataLoader.loadJSON('/api/issues?status=open', [], 'issues');
  } catch (e) {
    issues = [];
  }
  renderIssues(issues);
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
  items.slice(0, 5).forEach((it) => list.appendChild(generateIssueItem(it)));
}

function generateIssueItem(item) {
  const li = document.createElement('li');
  li.innerHTML = sanitizeHtml(`
    <strong>${esc(item.title || '')}</strong>
    ${
      item.content
        ? `<p class="text-slate-400">${esc(item.content.slice(0, 180))}${
            item.content.length > 180 ? '…' : ''
          }</p>`
        : ''
    }
    <div class="mt-1 text-xs text-slate-500">${esc(item.status || 'open')}</div>
  `);
  li.tabIndex = 0;
  li.setAttribute('role', 'button');
  li.classList.add('cursor-pointer');
  const open = () => openIssueModal(item);
  li.addEventListener('click', open);
  li.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      open();
    }
  });
  return li;
}

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
  if (!issuesModal) return;
  const df = getDateFormatter();

  const titleEl = qs('#issuesModalTitle');
  const metaEl = qs('#issuesModalMeta');
  const bodyEl = qs('#issuesModalBody');
  const tagsWrap = qs('#issuesModalTagsWrap');
  const tagsEl = qs('#issuesModalTags');

  titleEl.textContent = item.title || '—';

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
  if (body) {
    bodyEl.innerHTML = sanitizeHtml(
      body
        .split(/\n{2,}/)
        .map(
          (block) => `<p>${esc(block).replace(/\n/g, '<br>').replace(/ {2}/g, '&nbsp;&nbsp;')}</p>`
        )
        .join('')
    );
  } else {
    bodyEl.innerHTML = sanitizeHtml(
      `<p>${esc(t('issues_no_details', 'No additional details provided.'))}</p>`
    );
  }

  const tags = Array.isArray(item.tags) ? item.tags : [];
  if (tags.length) {
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
    tagsWrap.classList.remove('hidden');
  } else {
    tagsWrap.classList.add('hidden');
    tagsEl.innerHTML = '';
  }

  issuesModal.open();
}
