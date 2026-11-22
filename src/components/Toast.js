const REGION_ID = 'toast-region';
const ALLOWED_TONES = new Set(['info', 'success', 'warning', 'danger']);
let activeTimer = null;

export function mountToastRegion() {
  const existing = document.getElementById(REGION_ID);
  if (existing) return existing;

  const region = document.createElement('div');
  region.id = REGION_ID;
  region.className = 'toast-region';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.appendChild(region);
  return region;
}

export function showToast(message, { tone = 'info', duration = 3000 } = {}) {
  const region = mountToastRegion();
  const previous = region.querySelector('[data-role="toast"]');
  if (previous) previous.remove();
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }

  const toast = document.createElement('div');
  const selectedTone = ALLOWED_TONES.has(tone) ? tone : 'info';
  toast.className = `toast toast--${selectedTone}`;
  toast.dataset.tone = selectedTone;
  toast.setAttribute('data-role', 'toast');

  const text = document.createElement('span');
  text.className = 'toast__message';
  text.textContent = String(message ?? '');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast__close';
  close.setAttribute('data-role', 'toast-close');
  close.setAttribute('aria-label', 'Cerrar aviso');
  close.textContent = '×';
  close.addEventListener('click', () => {
    if (activeTimer) clearTimeout(activeTimer);
    activeTimer = null;
    toast.remove();
  });

  toast.append(text, close);
  region.appendChild(toast);

  const mediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia
      : typeof globalThis.matchMedia === 'function'
        ? globalThis.matchMedia
        : null;
  if (mediaQuery?.('(prefers-reduced-motion: reduce)').matches) {
    toast.dataset.reducedMotion = 'true';
    toast.classList.add('toast--no-motion');
  }

  if (Number(duration) > 0) {
    activeTimer = setTimeout(() => {
      toast.remove();
      activeTimer = null;
    }, Number(duration));
  }

  return toast;
}
