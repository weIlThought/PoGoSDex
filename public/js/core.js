// Core utilities, i18n, sanitization, lightweight data loader

export const CONFIG = {
  DEBUG: false,
  LANG_LOCK: true,
  SUPPORTED_LANGS: ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru'],
  API_REFRESH_INTERVAL: 30 * 60 * 1000,
  TIMEZONE_OFFSET_MS: 60 * 60 * 1000,
};

export const qs = (s, r = document) => r.querySelector(s);
export const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

export function debug(...args) {
  try {
    if (
      typeof window !== 'undefined' &&
      window.__Debug &&
      typeof window.__Debug.log === 'function'
    ) {
      window.__Debug.log(...args);
      return;
    }
  } catch {}
  if (CONFIG.DEBUG) console.log(...args);
}

// Sanitization helpers (no external CDN)
export function sanitizeHtml(html) {
  try {
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

export function sanitizeAndEscape(input, options = {}) {
  if (typeof input !== 'string') input = String(input || '');
  if (!options.allowHtml) {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  return sanitizeHtml(input);
}
export const esc = (t) => sanitizeAndEscape(t);

// i18n
let i18n = {};
let currentLang = 'en';
let dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
export function t(key, fallback) {
  return (i18n && i18n[key]) || fallback || key;
}
export async function loadLang(lang) {
  if (CONFIG.LANG_LOCK) lang = 'en';
  try {
    const res = await fetch(`/lang/${lang}.json`, { cache: 'no-store' });
    const json = await res.json();
    i18n = json || {};
    currentLang = lang;
    localStorage.setItem('lang', lang);
    dateFormatter = new Intl.DateTimeFormat(currentLang, { dateStyle: 'medium' });
    applyTranslations();
  } catch (e) {
    console.warn('Failed to load lang:', lang, e);
  }
}
export function getDateFormatter() {
  return dateFormatter;
}
export function applyTranslations() {
  document.title = t('title', document.title);
  qsa('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const target = el.getAttribute('data-i18n-target') || 'text';
    const fallback =
      target === 'placeholder'
        ? el.getAttribute('placeholder') || ''
        : target === 'html'
        ? el.innerHTML
        : el.textContent || '';
    const value = t(key, fallback);
    if (target === 'text') el.textContent = value;
    if (target === 'html') el.innerHTML = sanitizeHtml(value);
    if (target === 'placeholder') el.setAttribute('placeholder', value);
    if (target === 'title') el.setAttribute('title', value);
    if (target === 'value') el.setAttribute('value', value);
  });
}

// DataLoader with tiny in-memory cache
export class DataLoader {
  static _cache = new Map();
  static _ttl = 60 * 1000; // 60s
  static async loadJSON(url, fallbackValue = null, errorContext = 'data') {
    try {
      const noCache = /[?&](?:nocache|ts|_)=/i.test(String(url));
      if (!noCache) {
        const c = DataLoader._cache.get(url);
        if (c && Date.now() - c.time < DataLoader._ttl) return c.value;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      if (!noCache) DataLoader._cache.set(url, { time: Date.now(), value: json });
      return json;
    } catch (e) {
      console.error(`Failed to load ${errorContext} from ${url}:`, e);
      if (fallbackValue !== null) return fallbackValue;
      throw e;
    }
  }
}
