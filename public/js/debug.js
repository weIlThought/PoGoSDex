// Centralized debug facility for browser ESM modules
// Usage:
//   import { Debug } from './debug.js';
//   Debug.enable(true);
//   Debug.log('hello'); Debug.warn('careful'); Debug.error('boom');
//   // Existing global function debug(...) will forward here if available.

const original = {
  log: console.log.bind(console),
  info: console.info ? console.info.bind(console) : console.log.bind(console),
  warn: console.warn ? console.warn.bind(console) : console.log.bind(console),
  error: console.error ? console.error.bind(console) : console.log.bind(console),
  group: console.group ? console.group.bind(console) : null,
  groupEnd: console.groupEnd ? console.groupEnd.bind(console) : null,
};

const state = {
  enabled: false,
  capture: true,
  buffer: [], // { level, time, args }
  maxBuffer: 5000,
};

function push(level, args) {
  try {
    if (!state.capture) return;
    state.buffer.push({ level, time: Date.now(), args: Array.from(args) });
    if (state.buffer.length > state.maxBuffer) state.buffer.shift();
  } catch {}
}

function forward(level, args) {
  const fn = original[level] || original.log;
  try {
    fn(...args);
  } catch {}
}

export const Debug = {
  enable(v = true) {
    state.enabled = !!v;
    return this;
  },
  isEnabled() {
    return !!state.enabled;
  },
  capture(v = true) {
    state.capture = !!v;
    return this;
  },
  clear() {
    state.buffer.length = 0;
    return this;
  },
  getBuffer() {
    return state.buffer.slice();
  },
  setMaxBuffer(n) {
    state.maxBuffer = Math.max(100, Number(n) || 1000);
    return this;
  },

  log(...args) {
    push('log', args);
    if (state.enabled) forward('log', args);
  },
  info(...args) {
    push('info', args);
    if (state.enabled) forward('info', args);
  },
  warn(...args) {
    push('warn', args);
    forward('warn', args);
  },
  error(...args) {
    push('error', args);
    forward('error', args);
  },

  printSummary({ sortBy = 'time', groupBy = 'level', limit = 200 } = {}) {
    const data = this.getBuffer();
    const sorted = data.sort((a, b) => {
      if (sortBy === 'level') return String(a.level).localeCompare(String(b.level));
      return a.time - b.time;
    });
    const items = limit ? sorted.slice(-limit) : sorted;

    if (original.group) original.group(`Debug Summary (${items.length}/${data.length})`);
    const groups = {};
    if (groupBy === 'level') {
      for (const it of items) {
        (groups[it.level] ||= []).push(it);
      }
      for (const [lvl, arr] of Object.entries(groups)) {
        if (original.group) original.group(lvl);
        arr.forEach((it) => forward(lvl, it.args));
        if (original.groupEnd) original.groupEnd();
      }
    } else {
      items.forEach((it) => forward(it.level, it.args));
    }
    if (original.groupEnd) original.groupEnd();
  },
};

// Attach to window for global forwarding from legacy callers
try {
  if (typeof window !== 'undefined') window.__Debug = Debug;
} catch {}
