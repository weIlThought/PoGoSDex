// Lightweight lazy initializer for die PGSharp-Seite mit Tabs, Versions-Ticker und Koordinaten.
import { CONFIG, t } from './core.js';

function setupPgSharpTabs() {
  const root = document.getElementById('pgsharpSection');
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
      const match = content.dataset.pgsharpContent === tab;
      content.classList.toggle('hidden', !match);
      content.classList.toggle('active', match);
      content.classList.toggle('fade', !match);
    });
    active = tab;
  }

  tabBtns.forEach((btn) => btn.addEventListener('click', () => activate(btn.dataset.pgsharpTab)));
  activate(active);
}

async function loadPokeminersVersion() {
  const pkApkEl = document.getElementById('pk-apk');
  if (!pkApkEl) return;
  try {
    const res = await fetch('/api/pokeminers/version', { cache: 'no-store' });
    const data = await res.json();
    pkApkEl.textContent = data && data.ok ? data.apkVersion || '–' : '–';
  } catch {
    pkApkEl.textContent = '–';
  }
}

async function loadPgsharpVersion() {
  const pgRoot = document.getElementById('pgsharpSection');
  if (!pgRoot) return;
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

    if (pgData && pgData.ok) {
      if (pgPageEl) pgPageEl.textContent = pgData.pageVersion || '–';
      if (pgApkEl) pgApkEl.textContent = pgData.pogoVersion || '–';
    } else {
      if (pgPageEl) pgPageEl.textContent = '–';
      if (pgApkEl) pgApkEl.textContent = '–';
    }

    if (pkData && pkData.ok) {
      if (pkApkEl) pkApkEl.textContent = pkData.apkVersion || '–';
    } else if (pkApkEl) {
      pkApkEl.textContent = '–';
    }

    if (pgStatusEl) {
      if (pgData && pgData.ok && pkData && pkData.ok) {
        const pgVer = parseFloat(String(pgData.pogoVersion || '0').replace(/[^\d.]/g, ''));
        const pkVer = parseFloat(String(pkData.apkVersion || '0').replace(/[^\d.]/g, ''));
        if (Number.isFinite(pgVer) && Number.isFinite(pkVer)) {
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
      } else {
        pgStatusEl.textContent = '–';
        pgStatusEl.className = 'font-semibold text-yellow-400';
      }
    }
  } catch {
    if (pgStatusEl) {
      pgStatusEl.textContent = t('pgsharp_status_error', 'Error');
      pgStatusEl.className = 'font-semibold text-red-400';
    }
  }
}

export function initPgsharp() {
  // Tabs
  try {
    setupPgSharpTabs();
  } catch {}

  // Koordinaten initialisieren (einmalig)
  try {
    if (!window.__esmCoords) {
      import('/js/section-coords.js')
        .then((m) => typeof m.initCoords === 'function' && m.initCoords())
        .catch((e) => console.error('coords module init failed:', e));
    }
  } catch {}

  // Versions-Ticker: initial + Polling
  loadPgsharpVersion();
  loadPokeminersVersion();

  if (!initPgsharp._intervals) {
    initPgsharp._intervals = true;
    setInterval(loadPgsharpVersion, CONFIG.API_REFRESH_INTERVAL);
    setInterval(loadPokeminersVersion, CONFIG.API_REFRESH_INTERVAL);
  }
}
