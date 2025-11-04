// Lightweight lazy initializer for the PGSharp section.
// Now imports the Coords module to align with the PGSharp HTML structure.

export function initPgsharp() {
  try {
    typeof setupPgSharpTabs === 'function' && setupPgSharpTabs();
  } catch {}

  // Initialize coordinates UI via ESM (once)
  try {
    if (!window.__esmCoords) {
      import('/js/section-coords.js')
        .then((m) => typeof m.initCoords === 'function' && m.initCoords())
        .catch((e) => console.error('coords module init failed:', e));
    }
  } catch {}

  // Versions ticker (reuse existing globals)
  try {
    typeof loadPgsharpVersion === 'function' && loadPgsharpVersion();
  } catch {}
  try {
    typeof loadPokeminersVersion === 'function' && loadPokeminersVersion();
  } catch {}
  try {
    if (!initPgsharp._intervals) {
      setInterval(
        () => typeof loadPgsharpVersion === 'function' && loadPgsharpVersion(),
        CONFIG.API_REFRESH_INTERVAL
      );
      setInterval(
        () => typeof loadPokeminersVersion === 'function' && loadPokeminersVersion(),
        CONFIG.API_REFRESH_INTERVAL
      );
      initPgsharp._intervals = true;
    }
  } catch {}
}
