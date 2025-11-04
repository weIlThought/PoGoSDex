import { qs, sanitizeHtml, esc, t, getDateFormatter, DataLoader } from './core.js';
import { ModalManager } from './modals.js';

let news = [];
let newsModal;
let newsSearch = '';
let newsSelectedTags = new Set();

export async function initNews() {
  newsModal = new ModalManager('#newsModalBackdrop', '#closeNewsModal');
  await loadNews();
  bindFilters();
  renderNews(news);
}

async function loadNews() {
  news = await DataLoader.loadJSON('/api/news', [], 'news');
  populateNewsTagFilter(news);
}

function bindFilters() {
  const input = document.getElementById('newsSearchInput');
  const tagsWrap = document.getElementById('newsTagFilter');
  input?.addEventListener('input', (evt) => {
    newsSearch = (evt.target.value || '').toLowerCase();
    renderNews(news);
  });
  if (tagsWrap) {
    tagsWrap.addEventListener('click', (evt) => {
      const btn = evt.target.closest('[data-tag]');
      if (!btn) return;
      const tag = btn.getAttribute('data-tag');
      if (newsSelectedTags.has(tag)) newsSelectedTags.delete(tag);
      else newsSelectedTags.add(tag);
      renderNews(news);
    });
  }
}

function filterNews(items) {
  return items.filter((item) => {
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
}

function generateNewsCard(item) {
  const { title, excerpt } = item;
  const tags = item.tags || [];
  const df = getDateFormatter();
  const pub = item.publishedAt ? df.format(new Date(item.publishedAt)) : '—';
  const upd =
    item.updatedAt && item.updatedAt !== item.publishedAt
      ? df.format(new Date(item.updatedAt))
      : null;

  const article = document.createElement('article');
  article.className =
    'bg-slate-900 border border-slate-800 rounded-lg p-6 cursor-pointer transition-transform hover:-translate-y-1 shadow-lg';
  article.tabIndex = 0;
  article.setAttribute('role', 'button');
  article.innerHTML = sanitizeHtml(`
    <h3 class="text-xl font-semibold">${esc(title)}</h3>
    <div class="text-xs text-slate-400 mt-2 space-x-3">
      <span>${t('news_published', 'Published')}: ${esc(pub)}</span>
      ${upd ? `<span>${t('news_updated', 'Updated')}: ${esc(upd)}</span>` : ''}
    </div>
    ${excerpt ? `<p class="text-sm text-slate-300 mt-3">${esc(excerpt)}</p>` : ''}
    ${
      tags.length
        ? `<div class="flex flex-wrap gap-2 mt-3">${tags
            .map(
              (tag) =>
                `<span class=\"px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs\">${esc(
                  tag
                )}</span>`
            )
            .join('')}</div>`
        : ''
    }
  `);
  article.addEventListener('click', () => openNewsModal(item));
  article.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      openNewsModal(item);
    }
  });
  return article;
}

function renderNews(items) {
  const wrap = document.getElementById('newsWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  const filtered = filterNews(items);
  if (!filtered.length) {
    wrap.innerHTML = sanitizeHtml(
      `<div class="border border-slate-800 bg-slate-900 rounded-lg p-6 text-center text-slate-400">${t(
        'news_empty',
        'No news available yet.'
      )}</div>`
    );
    return;
  }
  filtered.forEach((item) => wrap.appendChild(generateNewsCard(item)));
}

function openNewsModal(original) {
  const merged = { ...original, tags: original.tags || [] };
  const df = getDateFormatter();
  const titleEl = document.querySelector('#newsModalTitle');
  const metaEl = document.querySelector('#newsModalMeta');
  const bodyEl = document.querySelector('#newsModalBody');
  const tagsWrap = document.querySelector('#newsModalTagsWrap');
  const tagsEl = document.querySelector('#newsModalTags');

  titleEl.textContent = merged.title;
  const pub = merged.publishedAt ? df.format(new Date(merged.publishedAt)) : '—';
  const upd =
    merged.updatedAt && merged.updatedAt !== merged.publishedAt
      ? df.format(new Date(merged.updatedAt))
      : null;
  metaEl.innerHTML = sanitizeHtml(`
    <span>${t('news_published', 'Published')}: ${esc(pub)}</span>
    ${upd ? `<span class=\"ml-3\">${t('news_updated', 'Updated')}: ${esc(upd)}</span>` : ''}
  `);
  const body = merged.content || merged.excerpt || '';
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
    : sanitizeHtml(`<p>${esc(t('news_modal_no_content', 'No additional details provided.'))}</p>`);
  if (merged.tags.length) {
    tagsEl.innerHTML = sanitizeHtml(
      merged.tags
        .map(
          (tag) =>
            `<span class=\"px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs\">${esc(
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
  newsModal.open();
}

function populateNewsTagFilter(items) {
  const wrap = document.getElementById('newsTagFilter');
  if (!wrap) return;
  const tags = [...new Set(items.flatMap((i) => (i.tags || []).map((t) => t.trim())))].sort(
    (a, b) => a.localeCompare(b)
  );
  wrap.innerHTML = '';
  if (!tags.length) {
    wrap.innerHTML = sanitizeHtml(
      `<span class="text-xs text-slate-500" data-i18n="news_filter_no_tags">No tags available.</span>`
    );
    return;
  }
  tags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = tag;
    btn.dataset.tag = tag.toLowerCase();
    btn.className =
      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/40';
    wrap.appendChild(btn);
  });
}
