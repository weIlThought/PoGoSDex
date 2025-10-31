function qs(s) {
  return document.querySelector(s);
}
function qsa(s) {
  return Array.from(document.querySelectorAll(s));
}
// Unified HTML escaping and sanitization utility
function sanitizeAndEscape(input, options = {}) {
  if (typeof input !== 'string') {
    input = String(input || '');
  }

  // Fast HTML escape for simple strings
  if (!options.allowHtml) {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Use existing sanitizeHtml for complex HTML content
  return sanitizeHtml(input);
}

// Backward compatibility aliases
function esc(t) {
  return sanitizeAndEscape(t);
}

function escapeHtml(s) {
  return sanitizeAndEscape(s);
}

// Application Configuration - centralized constants
const CONFIG = {
  // Timing constants
  FOCUS_DELAY: 0, // setTimeout delay for focus management
  CLOCK_UPDATE_INTERVAL: 1000, // 1 second for time updates
  API_REFRESH_INTERVAL: 30 * 60 * 1000, // 30 minutes for version checks
  TIMEZONE_OFFSET_MS: 60 * 60 * 1000, // 1 hour in milliseconds

  // UI constants
  HEADER_SHRINK_THRESHOLD: 64, // Scroll Y position for header shrinking

  // Feature flags
  DEBUG: false,
  LANG_LOCK: true, // Temporarily lock language to English

  // Supported languages
  SUPPORTED_LANGS: ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru'],
};

// Generic DataLoader - eliminates repetitive async patterns
class DataLoader {
  static async loadJSON(url, fallbackValue = null, errorContext = 'data') {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (e) {
      console.error(`Failed to load ${errorContext} from ${url}:`, e);
      if (fallbackValue !== null) {
        debug(`Using fallback value for ${errorContext}:`, fallbackValue);
        return fallbackValue;
      }
      throw e;
    }
  }

  static async loadWithRetry(loadFn, maxRetries = 2, delay = 1000) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await loadFn();
      } catch (e) {
        if (attempt === maxRetries) throw e;
        debug(`Load attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}

// DOM Element Cache - reduces repeated querySelector calls
class DOMCache {
  constructor() {
    this.cache = new Map();
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    // Cache frequently used elements
    const elements = {
      // Sections
      overviewSection: '#overviewSection',
      devicesSection: '#devicesSection',
      newsSection: '#newsSection',
      pgsharpSection: '#pgsharpSection',

      // Modals
      modalBackdrop: '#modalBackdrop',
      coordsModalBackdrop: '#coordsModalBackdrop',
      newsModalBackdrop: '#newsModalBackdrop',
      closeModal: '#closeModal',
      coordsModalClose: '#coordsModalClose',
      closeNewsModal: '#closeNewsModal',

      // Modal content
      modalTitle: '#modalTitle',
      modalMeta: '#modalMeta',
      modalDesc: '#modalDesc',
      modalNotesList: '#modalNotesList',
      modalRootLinks: '#modalRootLinks',
      modalPriceRange: '#modalPriceRange',
      modalPoGoComp: '#modalPoGoComp',

      // Coords modal
      coordsModalTitle: '#coordsModalTitle',
      coordsModalMeta: '#coordsModalMeta',
      coordsModalNote: '#coordsModalNote',
      coordsModalTags: '#coordsModalTags',
      coordsModalMaps: '#coordsModalMaps',

      // News modal
      newsModalTitle: '#newsModalTitle',
      newsModalMeta: '#newsModalMeta',
      newsModalBody: '#newsModalBody',
      newsModalTagsWrap: '#newsModalTagsWrap',
      newsModalTags: '#newsModalTags',

      // Search and filters
      searchInput: '#searchInput',
      newsSearchInput: '#newsSearchInput',
      newsTagFilter: '#newsTagFilter',
      newsWrap: '#newsWrap',

      // Other frequently used
      coordsTime: '#coords-time',
    };

    Object.entries(elements).forEach(([key, selector]) => {
      this.cache.set(key, document.querySelector(selector));
    });

    this.initialized = true;
    debug('DOM Cache initialized with', this.cache.size, 'elements');
  }

  get(key) {
    if (!this.initialized) this.init();
    return this.cache.get(key);
  }

  // Fallback for non-cached selectors
  query(selector) {
    return document.querySelector(selector);
  }
}

// Global DOM cache instance
const domCache = new DOMCache();

// Device Filter System - manages complex device filtering logic
class DeviceFilter {
  constructor() {
    this.devices = [];
    this.searchQuery = '';
    this.typeFilter = 'all';
    this.sortOrder = 'default';
    this.initialized = false;
  }

  init(devices = []) {
    this.devices = devices;
    this.bindEventListeners();
    this.initialized = true;
    debug('DeviceFilter initialized with', devices.length, 'devices');
  }

  bindEventListeners() {
    const searchInput = domCache.query('#searchInput');
    const typeFilter = domCache.query('#typeFilter');
    const sortSelect = domCache.query('#sortSelect');

    searchInput?.addEventListener('input', () => this.handleSearch(searchInput.value));
    typeFilter?.addEventListener('change', () => this.handleTypeFilter(typeFilter.value));
    sortSelect?.addEventListener('change', () => this.handleSort(sortSelect.value));
  }

  handleSearch(query) {
    this.searchQuery = (query || '').trim().toLowerCase();
    this.applyFilters();
  }

  handleTypeFilter(type) {
    this.typeFilter = type || 'all';
    this.applyFilters();
  }

  handleSort(sort) {
    this.sortOrder = sort || 'default';
    this.applyFilters();
  }

  filterDevices() {
    return this.devices.filter((device) => {
      const searchText = [device.model, device.brand, device.os, (device.notes || []).join(' ')]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !this.searchQuery || searchText.includes(this.searchQuery);
      const matchesType = this.typeFilter === 'all' || device.type === this.typeFilter;

      return matchesSearch && matchesType;
    });
  }

  sortDevices(devices) {
    if (this.sortOrder === 'default') return devices;

    return devices.sort((a, b) => {
      switch (this.sortOrder) {
        case 'brand':
          return a.brand.localeCompare(b.brand);
        case 'model':
          return a.model.localeCompare(b.model);
        case 'os':
          return a.os.localeCompare(b.os);
        case 'compatibility':
          const aComp = Boolean(a.compatible);
          const bComp = Boolean(b.compatible);
          if (aComp === bComp) {
            const byBrand = String(a.brand || '').localeCompare(String(b.brand || ''));
            if (byBrand !== 0) return byBrand;
            return String(a.model || '').localeCompare(String(b.model || ''));
          }
          return aComp ? -1 : 1;
        default:
          return 0;
      }
    });
  }

  applyFilters() {
    if (!this.initialized) return;

    const filtered = this.filterDevices();
    const sorted = this.sortDevices(filtered);

    debug('Device filter applied:', {
      total: this.devices.length,
      filtered: filtered.length,
      query: this.searchQuery,
      type: this.typeFilter,
      sort: this.sortOrder,
    });

    renderDevices(sorted);
  }

  updateDevices(devices) {
    this.devices = devices;
    this.applyFilters();
  }
}

// Global device filter instance
const deviceFilter = new DeviceFilter();

// Event Management System - centralizes all event handling
class EventManager {
  constructor() {
    this.listeners = new Map();
    this.delegated = new Map();
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.setupGlobalDelegation();
    this.setupGlobalKeyboardHandlers();
    this.initialized = true;
    debug('EventManager initialized');
  }

  setupGlobalDelegation() {
    // Single click handler for the entire document
    document.addEventListener('click', (e) => {
      this.handleGlobalClick(e);
    });

    // Single change handler for forms
    document.addEventListener('change', (e) => {
      this.handleGlobalChange(e);
    });

    // Single input handler for search fields
    document.addEventListener('input', (e) => {
      this.handleGlobalInput(e);
    });

    // Single keydown handler for interactive elements
    document.addEventListener('keydown', (e) => {
      this.handleGlobalKeydown(e);
    });

    // Single submit handler for forms
    document.addEventListener('submit', (e) => {
      this.handleGlobalSubmit(e);
    });
  }

  setupGlobalKeyboardHandlers() {
    // Global ESC key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleEscapeKey(e);
      }
    });
  }

  handleGlobalClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const param = target.dataset.param;

    switch (action) {
      case 'close-modal':
        this.handleCloseModal(target, param);
        break;
      case 'open-modal':
        this.handleOpenModal(target, param);
        break;
      case 'section-nav':
        this.handleSectionNav(target, param);
        break;
      case 'copy-json':
        this.handleCopyJson(target, param);
        break;
      case 'toggle-device-modal':
        this.handleToggleDeviceModal(target, param);
        break;
      case 'clear-form':
        this.handleClearForm(target, param);
        break;
      default:
        debug('Unknown action:', action);
    }
  }

  handleGlobalChange(e) {
    const target = e.target;

    if (target.matches('#langSelect')) {
      this.handleLanguageChange(target);
    } else if (target.matches('#newsTagFilter input[type="checkbox"]')) {
      this.handleNewsTagFilter(target);
    }
  }

  handleGlobalInput(e) {
    const target = e.target;

    if (target.matches('#newsSearchInput')) {
      this.handleNewsSearch(target);
    }
  }

  handleGlobalKeydown(e) {
    const target = e.target;

    // Handle Enter/Space on interactive elements
    if ((e.key === 'Enter' || e.key === ' ') && target.matches('[role="button"]')) {
      e.preventDefault();
      target.click();
    }
  }

  handleGlobalSubmit(e) {
    const target = e.target;

    if (target.matches('#deviceBuilderForm')) {
      this.handleDeviceBuilderSubmit(e);
    } else if (target.matches('#pgsharp-report-form')) {
      this.handlePgsharpReportSubmit(e);
    }
  }

  handleEscapeKey(e) {
    // Close all modals on ESC
    coordsModalManager.close();
    newsModalManager.close();
    if (typeof closeModal === 'function') closeModal();
  }

  // Specific action handlers
  handleCloseModal(target, param) {
    if (param === 'coords') coordsModalManager.close();
    else if (param === 'news') newsModalManager.close();
    else if (typeof closeModal === 'function') closeModal();
  }

  handleOpenModal(target, param) {
    // Implementation depends on modal type and data
    debug('Open modal:', param);
  }

  handleSectionNav(target, param) {
    if (param) showSection(param);
  }

  handleCopyJson(target, param) {
    // Copy device JSON implementation
    debug('Copy JSON for:', param);
  }

  handleToggleDeviceModal(target, param) {
    const modal = domCache.query('#deviceModal');
    const isOpen = param === 'open';

    if (modal) {
      modal.classList.toggle('hidden', !isOpen);
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  }

  handleClearForm(target, param) {
    const form = domCache.query(`#${param}`);
    if (form) form.reset();
  }

  handleLanguageChange(target) {
    const lang = target.value;
    const params = new URLSearchParams(window.location.search);
    params.set('lang', lang);
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    loadLang(lang);
  }

  handleNewsTagFilter(target) {
    const tag = target.value.toLowerCase();
    if (target.checked) {
      newsSelectedTags.add(tag);
    } else {
      newsSelectedTags.delete(tag);
    }
    renderNews(news);
  }

  handleNewsSearch(target) {
    newsSearch = target.value.toLowerCase();
    renderNews(news);
  }

  handleDeviceBuilderSubmit(e) {
    e.preventDefault();
    // Existing device builder logic
    debug('Device builder form submitted');
  }

  handlePgsharpReportSubmit(e) {
    e.preventDefault();
    const email = domCache.query('#pgsharp-report-email')?.value || '';
    const message = domCache.query('#pgsharp-report-message')?.value || '';
    const form = e.target;

    form.innerHTML = sanitizeHtml(
      `<div class="text-green-400">${t(
        'pgsharp_report_local_success',
        'Thanks — your message was processed locally.'
      )}</div>`
    );
    debug('PGSharp report (local):', { email, message });
  }

  // Legacy method for backward compatibility
  addEventListener(element, event, handler) {
    if (element && typeof element.addEventListener === 'function') {
      element.addEventListener(event, handler);

      // Track for potential cleanup
      const key = `${element.id || 'anonymous'}-${event}`;
      if (!this.listeners.has(key)) {
        this.listeners.set(key, []);
      }
      this.listeners.get(key).push({ element, event, handler });
    }
  }

  removeEventListener(element, event, handler) {
    if (element && typeof element.removeEventListener === 'function') {
      element.removeEventListener(event, handler);
    }
  }

  cleanup() {
    // Clean up all tracked listeners
    this.listeners.forEach((handlers, key) => {
      handlers.forEach(({ element, event, handler }) => {
        this.removeEventListener(element, event, handler);
      });
    });
    this.listeners.clear();
    debug('EventManager cleanup completed');
  }
}

// Global event manager instance
const eventManager = new EventManager();

// Enhanced Error Handling System with User Feedback
class ErrorHandler {
  constructor() {
    this.errorQueue = [];
    this.isShowingError = false;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.init();
  }

  init() {
    // Global error handlers
    window.addEventListener('error', (e) => this.handleGlobalError(e));
    window.addEventListener('unhandledrejection', (e) => this.handleUnhandledRejection(e));

    // Network error detection
    window.addEventListener('online', () => this.handleNetworkRestore());
    window.addEventListener('offline', () => this.handleNetworkLoss());

    debug('ErrorHandler initialized');
  }

  handleGlobalError(event) {
    const error = {
      type: 'javascript',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: new Date().toISOString(),
    };

    this.logError(error);
    this.showUserFriendlyError('An unexpected error occurred. The page may need to be refreshed.');
  }

  handleUnhandledRejection(event) {
    const error = {
      type: 'promise',
      message: event.reason?.message || 'Promise rejection',
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
    };

    this.logError(error);

    // Don't show user feedback for fetch errors - they're handled elsewhere
    if (!event.reason?.message?.includes('fetch')) {
      this.showUserFriendlyError('Something went wrong. Please try again.');
    }

    event.preventDefault(); // Prevent console spam
  }

  handleNetworkLoss() {
    this.showUserFriendlyError(
      'You appear to be offline. Some features may not work.',
      'warning',
      0
    );
  }

  handleNetworkRestore() {
    this.showUserFriendlyError('Connection restored!', 'success', 3000);
  }

  async handleAsyncError(operation, context = 'operation') {
    const key = `${context}-${Date.now()}`;
    const attempts = this.retryAttempts.get(context) || 0;

    try {
      const result = await operation();
      this.retryAttempts.delete(context); // Reset on success
      return result;
    } catch (error) {
      this.logError({
        type: 'async',
        context,
        message: error.message,
        stack: error.stack,
        attempts: attempts + 1,
        timestamp: new Date().toISOString(),
      });

      if (attempts < this.maxRetries) {
        this.retryAttempts.set(context, attempts + 1);
        const delay = Math.pow(2, attempts) * 1000; // Exponential backoff

        this.showUserFriendlyError(
          `${context} failed. Retrying in ${delay / 1000} seconds... (${attempts + 1}/${
            this.maxRetries
          })`,
          'warning',
          delay
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.handleAsyncError(operation, context);
      } else {
        this.retryAttempts.delete(context);
        this.showUserFriendlyError(
          `${context} failed after ${this.maxRetries} attempts. Please refresh the page.`,
          'error'
        );
        throw error;
      }
    }
  }

  logError(error) {
    console.error('Application Error:', error);

    // In production, send to monitoring service
    if (!CONFIG.DEBUG) {
      this.sendToMonitoring(error);
    }
  }

  sendToMonitoring(error) {
    // Placeholder for error monitoring service (e.g., Sentry, LogRocket)
    debug('Would send to monitoring:', error);
  }

  showUserFriendlyError(message, type = 'error', duration = 5000) {
    if (this.isShowingError && type !== 'success') return;

    const error = { message, type, duration, id: Date.now() };
    this.errorQueue.push(error);

    if (!this.isShowingError) {
      this.displayNextError();
    }
  }

  displayNextError() {
    if (this.errorQueue.length === 0) {
      this.isShowingError = false;
      return;
    }

    const error = this.errorQueue.shift();
    this.isShowingError = true;

    const toast = this.createToast(error);
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-dismiss
    if (error.duration > 0) {
      setTimeout(() => {
        this.dismissToast(toast);
      }, error.duration);
    }
  }

  createToast(error) {
    const toast = document.createElement('div');
    toast.className = `error-toast error-toast-${error.type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const colors = {
      error: 'bg-red-900 border-red-500 text-red-100',
      warning: 'bg-yellow-900 border-yellow-500 text-yellow-100',
      success: 'bg-green-900 border-green-500 text-green-100',
      info: 'bg-blue-900 border-blue-500 text-blue-100',
    };

    toast.innerHTML = sanitizeHtml(`
      <div class="flex items-center justify-between p-4 rounded-lg border ${
        colors[error.type]
      } shadow-lg max-w-md">
        <div class="flex items-center">
          <div class="mr-3">
            ${this.getIcon(error.type)}
          </div>
          <p class="text-sm font-medium">${esc(error.message)}</p>
        </div>
        <button class="ml-4 text-current hover:opacity-75" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    `);

    // Position toast
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease-in-out;
    `;

    toast.classList.add('error-toast');

    return toast;
  }

  getIcon(type) {
    const icons = {
      error: '⚠️',
      warning: '⚡',
      success: '✅',
      info: 'ℹ️',
    };
    return icons[type] || icons.info;
  }

  dismissToast(toast) {
    toast.classList.remove('show');
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.displayNextError(); // Show next error in queue
    }, 300);
  }

  // Enhanced DataLoader with error handling
  static enhanceDataLoader() {
    const originalLoadJSON = DataLoader.loadJSON;
    DataLoader.loadJSON = async function (url, fallbackValue = null, errorContext = 'data') {
      return errorHandler.handleAsyncError(async () => {
        return originalLoadJSON.call(this, url, fallbackValue, errorContext);
      }, `Loading ${errorContext}`);
    };
  }
}

// Global error handler instance
const errorHandler = new ErrorHandler();

// Add CSS for error toasts
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  .error-toast.show {
    opacity: 1 !important;
    transform: translateX(0) !important;
  }
`;
document.head.appendChild(toastStyles);

// Performance Monitoring and Metrics System
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.startTime = performance.now();
    this.init();
  }

  init() {
    if (!window.performance) {
      debug('Performance API not available');
      return;
    }

    this.trackPageLoad();
    this.trackUserInteractions();
    this.trackResourceUsage();
    this.setupPerformanceObservers();

    debug('PerformanceMonitor initialized');
  }

  trackPageLoad() {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');

      const metrics = {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint:
          paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,
        domInteractive: navigation.domInteractive - navigation.navigationStart,
        resourcesLoaded: navigation.loadEventStart - navigation.navigationStart,
      };

      this.recordMetric('pageLoad', metrics);
      this.logPerformanceReport();
    });
  }

  trackUserInteractions() {
    const interactionTypes = ['click', 'input', 'scroll', 'keydown'];

    interactionTypes.forEach((type) => {
      document.addEventListener(
        type,
        (e) => {
          this.recordInteraction(type, e);
        },
        { passive: true }
      );
    });
  }

  trackResourceUsage() {
    // Monitor memory usage (if available)
    if (performance.memory) {
      setInterval(() => {
        const memory = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
          timestamp: Date.now(),
        };
        this.recordMetric('memory', memory);
      }, CONFIG.API_REFRESH_INTERVAL); // Every 30 minutes
    }
  }

  setupPerformanceObservers() {
    // Long Task Observer
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) {
              // Tasks longer than 50ms
              this.recordMetric('longTask', {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name,
              });
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longTask', longTaskObserver);
      } catch (e) {
        debug('Long task observer not supported');
      }

      // Layout Shift Observer
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.value > 0.1) {
              // Significant layout shifts
              this.recordMetric('layoutShift', {
                value: entry.value,
                startTime: entry.startTime,
                hadRecentInput: entry.hadRecentInput,
              });
            }
          });
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('layoutShift', layoutShiftObserver);
      } catch (e) {
        debug('Layout shift observer not supported');
      }
    }
  }

  recordMetric(name, data) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const entry = {
      ...data,
      timestamp: performance.now(),
      datetime: new Date().toISOString(),
    };

    this.metrics.get(name).push(entry);

    // Keep only last 100 entries per metric
    const entries = this.metrics.get(name);
    if (entries.length > 100) {
      entries.splice(0, entries.length - 100);
    }

    if (CONFIG.DEBUG) {
      debug(`Metric recorded - ${name}:`, entry);
    }
  }

  recordInteraction(type, event) {
    const interaction = {
      type,
      target: event.target?.tagName || 'unknown',
      targetId: event.target?.id || null,
      targetClass: event.target?.className || null,
      timestamp: performance.now(),
    };

    this.recordMetric('interactions', interaction);
  }

  measureFunction(name, fn) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.recordMetric('functionPerformance', {
      name,
      duration,
      type: typeof result === 'object' && result?.then ? 'async' : 'sync',
    });

    if (duration > 100) {
      debug(`Slow function detected: ${name} took ${duration.toFixed(2)}ms`);
    }

    return result;
  }

  async measureAsyncFunction(name, asyncFn) {
    const start = performance.now();
    try {
      const result = await asyncFn();
      const duration = performance.now() - start;

      this.recordMetric('functionPerformance', {
        name,
        duration,
        type: 'async',
        success: true,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      this.recordMetric('functionPerformance', {
        name,
        duration,
        type: 'async',
        success: false,
        error: error.message,
      });

      throw error;
    }
  }

  getMetrics(name = null) {
    if (name) {
      return this.metrics.get(name) || [];
    }

    const allMetrics = {};
    this.metrics.forEach((value, key) => {
      allMetrics[key] = value;
    });
    return allMetrics;
  }

  getPerformanceSummary() {
    const summary = {
      uptime: performance.now() - this.startTime,
      metricsCollected: this.metrics.size,
      totalInteractions: this.getMetrics('interactions').length,
      averageMemoryUsage: this.calculateAverageMemory(),
      slowFunctions: this.getSlowFunctions(),
      layoutShifts: this.getMetrics('layoutShift').length,
      longTasks: this.getMetrics('longTask').length,
    };

    return summary;
  }

  calculateAverageMemory() {
    const memoryEntries = this.getMetrics('memory');
    if (memoryEntries.length === 0) return null;

    const avgUsed =
      memoryEntries.reduce((sum, entry) => sum + entry.used, 0) / memoryEntries.length;
    return {
      averageUsed: Math.round(avgUsed / 1024 / 1024), // MB
      entries: memoryEntries.length,
    };
  }

  getSlowFunctions() {
    const perfEntries = this.getMetrics('functionPerformance');
    return perfEntries
      .filter((entry) => entry.duration > 100)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }

  logPerformanceReport() {
    const summary = this.getPerformanceSummary();
    const pageLoadMetrics = this.getMetrics('pageLoad')[0];

    console.group('🚀 Performance Report');
    console.log('Page Load Metrics:', pageLoadMetrics);
    console.log('Performance Summary:', summary);

    if (summary.slowFunctions.length > 0) {
      console.warn('Slow Functions Detected:', summary.slowFunctions);
    }

    if (summary.layoutShifts > 0) {
      console.warn('Layout Shifts Detected:', summary.layoutShifts);
    }

    console.groupEnd();
  }

  exportMetrics() {
    const data = {
      summary: this.getPerformanceSummary(),
      metrics: this.getMetrics(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  cleanup() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.metrics.clear();
  }
}

// Global performance monitor instance
const performanceMonitor = new PerformanceMonitor();

// Add global performance measurement helpers
window.measurePerformance = (name, fn) => performanceMonitor.measureFunction(name, fn);
window.measureAsyncPerformance = (name, fn) => performanceMonitor.measureAsyncFunction(name, fn);
window.getPerformanceMetrics = () => performanceMonitor.getMetrics();
window.exportPerformanceReport = () => performanceMonitor.exportMetrics();

// Debug wrapper - gate console output behind a flag
function debug(...args) {
  if (CONFIG.DEBUG) console.log(...args);
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

let devices = [];
let news = [];
let newsSearch = '';
let newsSelectedTags = new Set();

const newsSearchInput = qs('#newsSearchInput');
const newsTagFilterWrap = qs('#newsTagFilter');

// Generic Modal Manager - eliminates code duplication
class ModalManager {
  constructor(backdropId, closeButtonId, focusElementId = null) {
    this.backdrop = qs(backdropId);
    this.closeButton = qs(closeButtonId);
    this.focusElement = focusElementId ? qs(focusElementId) : this.closeButton;
    this.lastFocus = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => this.close());
    }
    if (this.backdrop) {
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });
    }
  }

  open() {
    if (!this.backdrop) return;
    try {
      this.lastFocus = document.activeElement;
    } catch (e) {
      this.lastFocus = null;
    }
    this.backdrop.setAttribute('aria-hidden', 'false');
    this.backdrop.classList.remove('hidden');
    this.backdrop.classList.add('flex');
    document.body.style.overflow = 'hidden';
    setTimeout(() => this.focusElement?.focus(), CONFIG.FOCUS_DELAY);
  }

  close() {
    if (!this.backdrop) return;
    this.backdrop.setAttribute('aria-hidden', 'true');
    this.backdrop.classList.add('hidden');
    this.backdrop.classList.remove('flex');
    document.body.style.overflow = '';
    try {
      if (this.lastFocus && typeof this.lastFocus.focus === 'function') {
        this.lastFocus.focus();
      }
    } catch (e) {}
  }
}

let i18n = {};
let currentLang =
  new URLSearchParams(window.location.search).get('lang') ||
  localStorage.getItem('lang') ||
  (navigator.language || 'en').slice(0, 2);
if (!CONFIG.SUPPORTED_LANGS.includes(currentLang)) currentLang = 'en';
if (CONFIG.LANG_LOCK) currentLang = 'en';

let dateFormatter = new Intl.DateTimeFormat(currentLang, {
  dateStyle: 'medium',
});

function t(key, fallback) {
  return (i18n && i18n[key]) || fallback || key;
}

// News filtering logic - separated for better maintainability
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

// Generate HTML for a single news card
function generateNewsCard(item) {
  const title = item.title;
  const excerpt = item.excerpt;
  const tags = item.tags || [];
  const content = item.content || item.excerpt || '';

  const pub = item.publishedAt ? dateFormatter.format(new Date(item.publishedAt)) : dash();
  const upd =
    item.updatedAt && item.updatedAt !== item.publishedAt
      ? dateFormatter.format(new Date(item.updatedAt))
      : null;

  const publishedLabel = t('news_published', 'Published');
  const updatedLabel = t('news_updated', 'Updated');

  const article = document.createElement('article');
  article.className =
    'bg-slate-900 border border-slate-800 rounded-lg p-6 cursor-pointer transition-transform hover:-translate-y-1 shadow-lg';
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

  return { article, content };
}

// Bind event listeners to news card
function bindNewsCardEvents(article, item, content) {
  const openModal = () => openNewsModal(item, { content });
  article.addEventListener('click', openModal);
  article.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      openModal();
    }
  });
}

// Main news rendering function - now much cleaner and focused
function renderNews(items) {
  return performanceMonitor.measureFunction('renderNews', () => {
    const wrap = domCache.get('newsWrap');
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

    filtered.forEach((item) => {
      const { article, content } = generateNewsCard(item);
      bindNewsCardEvents(article, item, content);
      wrap.appendChild(article);
    });
  });
}
async function loadLang(lang) {
  if (CONFIG.LANG_LOCK) lang = 'en';
  try {
    i18n = await DataLoader.loadJSON(`/lang/${lang}.json`, {}, `language ${lang}`);
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
  overview: () => domCache.get('overviewSection'),
  devices: () => domCache.get('devicesSection'),
  news: () => domCache.get('newsSection'),
  pgsharp: () => domCache.get('pgsharpSection'),
};
let activeSection = 'overview';

let navButtons = [];

function showSection(name = 'overview') {
  if (!sections[name]) return;
  Object.entries(sections).forEach(([key, getNode]) => {
    const node = getNode();
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
  return performanceMonitor.measureAsyncFunction('loadDevices', async () => {
    devices = await DataLoader.loadJSON('/data/devices.json', [], 'devices');
    deviceFilter.updateDevices(devices);
  });
}

async function loadNews() {
  return performanceMonitor.measureAsyncFunction('loadNews', async () => {
    news = await DataLoader.loadJSON('/data/news.json', [], 'news');
    populateNewsTagFilter(news);
    if (activeSection === 'news') renderNews(news);
  });
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
      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ' +
      'hover:bg-slate-700/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ' +
      (newsSelectedTags.has(tagKey)
        ? 'bg-emerald-600 text-white border-emerald-400'
        : 'bg-slate-800/80 text-slate-200 border-slate-700');
    newsTagFilterWrap.appendChild(btn);
  });
}

function cardHtml(d) {
  // build a short preview of notes (first note) if present
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

let deviceRenderLimit = 50;

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
  // accessibility: remember focused element and set aria-hidden
  try {
    openModal._lastFocus = document.activeElement;
  } catch (e) {
    openModal._lastFocus = null;
  }
  const mb = qs('#modalBackdrop');
  mb.setAttribute('aria-hidden', 'false');
  mb.classList.remove('hidden');
  mb.classList.add('flex');
  qs('#modalTitle').textContent = d.model;
  qs('#modalMeta').textContent = `${d.brand} • ${d.type} • ${d.os}`;
  qs('#modalDesc').textContent = d.compatible
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
  // focus the close button for keyboard users
  setTimeout(() => qs('#closeModal')?.focus(), 0);
}

function closeModal() {
  const mb = qs('#modalBackdrop');
  if (mb) mb.setAttribute('aria-hidden', 'true');
  mb.classList.add('hidden');
  mb.classList.remove('flex');
  document.body.style.overflow = '';
  // restore focus
  try {
    const last = openModal._lastFocus;
    if (last && typeof last.focus === 'function') last.focus();
  } catch (e) {
    // ignore
  }
}

// Modal event handlers now managed by EventManager and data-action attributes

// Legacy function for backward compatibility
function applyFilters() {
  deviceFilter.applyFilters();
}

const langSelect = qs('#langSelect');
if (!LANG_LOCK && langSelect) {
  langSelect.addEventListener('change', (e) => {
    const lang = e.target.value;
    const params = new URLSearchParams(window.location.search);
    params.set('lang', lang);
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    loadLang(lang);
  });
}

function applyTranslations() {
  // Allow pages to opt-out from i18n replacement
  if (
    document.body?.hasAttribute('data-no-i18n') ||
    document.documentElement?.hasAttribute('data-no-i18n')
  ) {
    return;
  }
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
  const local = new Date(now.getTime() + hoursOffset * CONFIG.TIMEZONE_OFFSET_MS);
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
      <div data-idx="${idx}" class="py-3 border-b border-slate-700 cursor-pointer">
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

  // Attach click handlers using the data-idx attribute (avoid relying on legacy class names)
  Array.from(container.querySelectorAll('[data-idx]')).forEach((el) => {
    const i = Number(el.getAttribute('data-idx'));
    el.addEventListener('click', () => {
      const item = filtered[i];
      if (item) openCoordsModal(item);
    });
  });
}

function openCoordsModal(item) {
  if (!coordsModalManager.backdrop) {
    console.error('openCoordsModal: modal backdrop not found');
    return;
  }

  // Populate modal content
  qs('#coordsModalTitle').textContent = item.name || '—';
  qs('#coordsModalMeta').textContent = `Lat: ${item.lat ?? '—'} • Lng: ${item.lng ?? '—'}`;
  qs('#coordsModalNote').textContent = item.note || '';

  const tagsWrap = qs('#coordsModalTags');
  if (tagsWrap) {
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
  }

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

  coordsModalManager.open();
}

// closeCoordsModal function removed - now handled by coordsModalManager.close()

// Initialize Modal Managers
const coordsModalManager = new ModalManager('#coordsModalBackdrop', '#coordsModalClose');
const newsModalManager = new ModalManager('#newsModalBackdrop', '#closeNewsModal');

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
  if (!updateCoordsTime._interval)
    updateCoordsTime._interval = setInterval(tick, CONFIG.CLOCK_UPDATE_INTERVAL);
}
// News Modal DOM References - using cache for better performance
const newsModalTitle = () => domCache.get('newsModalTitle');
const newsModalMeta = () => domCache.get('newsModalMeta');
const newsModalBody = () => domCache.get('newsModalBody');
const newsModalTagsWrap = () => domCache.get('newsModalTagsWrap');
const newsModalTags = () => domCache.get('newsModalTags');

function openNewsModal(original, translated = {}) {
  if (!newsModalManager.backdrop) {
    console.error('openNewsModal: modal backdrop not found');
    return;
  }

  const merged = {
    ...original,
    ...translated,
    tags: original.tags || [],
  };

  // Populate modal content
  newsModalTitle().textContent = merged.title;

  const pub = merged.publishedAt ? dateFormatter.format(new Date(merged.publishedAt)) : dash();
  const upd =
    merged.updatedAt && merged.updatedAt !== merged.publishedAt
      ? dateFormatter.format(new Date(merged.updatedAt))
      : null;

  const publishedLabel = t('news_published', 'Published');
  const updatedLabel = t('news_updated', 'Updated');
  newsModalMeta().innerHTML = sanitizeHtml(`
    <span>${publishedLabel}: ${esc(pub)}</span>
    ${upd ? `<span class="ml-3">${updatedLabel}: ${esc(upd)}</span>` : ''}
  `);

  const body = merged.content || merged.excerpt || '';
  if (body) {
    newsModalBody().innerHTML = sanitizeHtml(
      body
        .split(/\n{2,}/)
        .map(
          (block) => `<p>${esc(block).replace(/\n/g, '<br>').replace(/ {2}/g, '&nbsp;&nbsp;')}</p>`
        )
        .join('')
    );
  } else {
    newsModalBody().innerHTML = sanitizeHtml(
      `<p>${esc(t('news_modal_no_content', 'No additional details provided.'))}</p>`
    );
  }

  if (merged.tags && merged.tags.length) {
    newsModalTags().innerHTML = sanitizeHtml(
      merged.tags
        .map(
          (tag) =>
            `<span class="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">${esc(
              tag
            )}</span>`
        )
        .join('')
    );
    newsModalTagsWrap().classList.remove('hidden');
  } else {
    newsModalTagsWrap().classList.add('hidden');
    newsModalTags().innerHTML = '';
  }

  newsModalManager.open();
}

// closeNewsModal function removed - now handled by newsModalManager.close()
// Global ESC handler now managed by EventManager

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
    const inner = header.querySelector('.max-w-6xl');
    const logo = header.querySelector('img');
    if (window.scrollY > CONFIG.HEADER_SHRINK_THRESHOLD) {
      if (inner) {
        inner.classList.add('h-12', 'transition-all', 'duration-150', 'ease-in-out');
        inner.classList.remove('h-16');
      }
      if (logo) {
        logo.classList.add('w-10', 'h-10');
        logo.classList.remove('w-12', 'h-12');
      }
    } else {
      if (inner) {
        inner.classList.remove('h-12');
        inner.classList.add('h-16');
      }
      if (logo) {
        logo.classList.remove('w-10', 'h-10');
        logo.classList.add('w-12', 'h-12');
      }
    }
  }
  window.addEventListener('scroll', update, { passive: true });
  // initial
  update();
})();

// escapeHtml function removed - now using unified sanitizeAndEscape()

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
  // Initialize core systems first for better performance
  domCache.init();
  eventManager.init();

  // Enhance DataLoader with error handling
  ErrorHandler.enhanceDataLoader();

  // Initialize device filter system
  deviceFilter.init(devices);

  hydrateTranslations();
  hydrateGrid();
  bindNavigation();
  setupPgSharpTabs();
  updateCoordsTime();
  loadCoords();
  // Initialize live service status from backend
  initServiceStatus();

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
  setInterval(loadPgsharpVersion, CONFIG.API_REFRESH_INTERVAL);
  setInterval(loadPokeminersVersion, CONFIG.API_REFRESH_INTERVAL);
});

// ---------- Service Status (UptimeRobot) UI ----------
const STATUS_COLORS = {
  up: 'bg-emerald-400',
  degraded: 'bg-yellow-400',
  down: 'bg-red-400',
  unknown: 'bg-slate-400',
};

function setStatusUI({ state = 'unknown', uptimeRatio = null } = {}) {
  const indicator = document.getElementById('statusIndicator');
  const message = document.getElementById('statusMessage');
  const uptime = document.getElementById('statusUptime');
  if (!indicator || !message || !uptime) return;

  // Reset indicator color classes and pulse
  indicator.classList.remove('animate-pulse');
  Object.values(STATUS_COLORS).forEach((cls) => indicator.classList.remove(cls));
  indicator.classList.add(STATUS_COLORS[state] || STATUS_COLORS.unknown);

  // Message by state
  let msg = t('status_unknown', 'Status unknown');
  if (state === 'up') msg = t('status_up', 'All systems operational');
  else if (state === 'degraded') msg = t('status_degraded', 'Degraded performance');
  else if (state === 'down') msg = t('status_down', 'Service interruption');
  message.textContent = msg;

  // Uptime text
  const label = t('status_uptime_label', 'Uptime');
  if (typeof uptimeRatio === 'number' && Number.isFinite(uptimeRatio)) {
    uptime.textContent = `${label}: ${uptimeRatio.toFixed(2)} %`;
  } else {
    uptime.textContent = `${label}: ${t('status_uptime_na', '— %')}`;
  }
}

async function fetchServiceStatus() {
  try {
    const res = await fetch('/status/uptime', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !('state' in data)) throw new Error('Invalid payload');
    setStatusUI({ state: data.state || 'unknown', uptimeRatio: data.uptimeRatio ?? null });
  } catch (err) {
    // Leave previous UI, but ensure we don't show endless loading
    setStatusUI({ state: 'unknown', uptimeRatio: null });
    debug('Service status fetch failed:', err);
  }
}

function initServiceStatus() {
  // Show loading pulse until first update happens
  const indicator = document.getElementById('statusIndicator');
  if (indicator) indicator.classList.add('animate-pulse');
  fetchServiceStatus();
  // Server caches for 3 minutes; poll accordingly
  if (!initServiceStatus._interval) {
    initServiceStatus._interval = setInterval(fetchServiceStatus, 3 * 60 * 1000);
  }
}
