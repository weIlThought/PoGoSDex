// Simple modal manager used across modules
export class ModalManager {
  constructor(backdropId, closeButtonId, focusElementId = null) {
    this.backdrop = document.querySelector(backdropId);
    this.closeButton = document.querySelector(closeButtonId);
    this.focusElement = focusElementId ? document.querySelector(focusElementId) : this.closeButton;
    this.lastFocus = null;
    this._bind();
  }
  _bind() {
    if (this.closeButton) this.closeButton.addEventListener('click', () => this.close());
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
    } catch {}
    this.backdrop.setAttribute('aria-hidden', 'false');
    this.backdrop.classList.remove('hidden');
    this.backdrop.classList.add('flex');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => this.focusElement?.focus(), 0);
  }
  close() {
    if (!this.backdrop) return;
    try {
      const fallback =
        this.lastFocus ||
        document.querySelector('[data-section][aria-selected="true"]') ||
        document.body;
      if (fallback && typeof fallback.focus === 'function') fallback.focus();
    } catch {}
    this.backdrop.setAttribute('aria-hidden', 'true');
    this.backdrop.classList.add('hidden');
    this.backdrop.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
  }
}
