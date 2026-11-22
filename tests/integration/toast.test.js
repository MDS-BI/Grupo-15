import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { mountToastRegion, showToast } from '../../src/components/Toast.js';

function findToast() {
  return document.querySelector('[data-role="toast"]');
}

describe('Toast accesible', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('monta una región aria-live una sola vez', () => {
    const region = mountToastRegion();

    expect(region.id).toBe('toast-region');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(mountToastRegion()).toBe(region);
  });

  it('muestra mensajes con tono y permite cerrarlos', () => {
    const toast = showToast('Orden actualizada', { tone: 'success', duration: 0 });

    expect(toast.textContent).toContain('Orden actualizada');
    expect(toast.dataset.tone).toBe('success');
    toast.querySelector('[data-role="toast-close"]').click();
    expect(findToast()).toBeNull();
  });

  it('oculta automáticamente el mensaje a los 3 segundos', () => {
    showToast('Cambios guardados', { duration: 3000 });

    vi.advanceTimersByTime(2999);
    expect(findToast()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(findToast()).toBeNull();
  });

  it('desactiva la animación con prefers-reduced-motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    const toast = showToast('Sin movimiento', { duration: 0 });

    expect(toast.dataset.reducedMotion).toBe('true');
    expect(toast.classList.contains('toast--no-motion')).toBe(true);
  });
});
