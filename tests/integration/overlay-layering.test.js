import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { ProductionSchedulingPanel } from '../../src/components/ProductionSchedulingPanel.js';

const css = readFileSync(resolve('src/styles/manufacturing.css'), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  expect(match, `Regla CSS no encontrada: ${selector}`).toBeTruthy();
  return match[1];
}

function zIndex(selector) {
  const match = rule(selector).match(/z-index:\s*(\d+)/);
  expect(match, `z-index no encontrado en ${selector}`).toBeTruthy();
  return Number(match[1]);
}

let dom;

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  vi.resetModules();
});

afterEach(() => {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
});

describe('FR-19: jerarquía de capas', () => {
  it('define la escala estricta de capas', () => {
    expect(rule('.data-table thead th')).toMatch(/position:\s*sticky/);
    expect(zIndex('.data-table thead th')).toBe(1);
    expect(zIndex('.topbar')).toBe(20);
    expect(zIndex('.sidebar')).toBe(30);
    expect(zIndex('.scheduling-focus-backdrop')).toBe(40);
    expect(zIndex('.scheduling-floating-card')).toBe(60);
    expect(zIndex('.schedule-popup')).toBe(1001);
    expect(zIndex('.modal-backdrop')).toBe(1000);
    expect(zIndex('.modal')).toBe(1001);
    expect(zIndex('.confirm-dialog')).toBe(1100);
    expect(zIndex('.confirm-dialog::backdrop')).toBe(1100);
    expect(zIndex('.confirm-dialog--fallback')).toBe(1100);
    expect(zIndex('.toast-region')).toBe(1200);
  });

  it('no crea contextos de apilamiento en vistas, contenido ni paneles', () => {
    for (const selector of ['.view', '.content', '.panel', '.content > .view']) {
      expect(rule(selector)).not.toMatch(
        /(?:^|[;\s])(?:transform|filter|perspective|will-change)\s*:/,
      );
      expect(rule(selector)).not.toMatch(/contain:\s*paint/);
    }
    expect(css).not.toContain('animation: view-enter');
    expect(css).not.toContain('@keyframes view-enter');
  });

  it('monta confirmDialog en document.body y conserva su API', async () => {
    const { confirmDialog, notifyDialog } = await import('../../src/components/ConfirmDialog.js');
    const pending = confirmDialog({ title: 'Cambiar rol', message: '¿Continuar?' });
    const dialog = document.querySelector('[data-role="confirm-dialog"]');

    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.textContent).toContain('¿Continuar?');
    expect(typeof notifyDialog).toBe('function');

    document.querySelector('[data-role="cancel"]').click();
    await expect(pending).resolves.toBe(false);
  });
});

describe('FR-17: capas y modales del calendario (US-13)', () => {
  function memoryStorage() {
    const map = new Map();
    return {
      getItem(key) {
        return map.has(key) ? map.get(key) : null;
      },
      setItem(key, value) {
        map.set(key, String(value));
      },
      removeItem(key) {
        map.delete(key);
      },
      clear() {
        map.clear();
      },
    };
  }

  function mount(role) {
    document.body.innerHTML = '';
    const store = new ManufacturingStore({ storage: memoryStorage() });
    const panel = ProductionSchedulingPanel(store, { role, operatorId: 'emp_op_01' });
    document.body.appendChild(panel);
    return store;
  }

  function clickNode(node) {
    expect(node).toBeTruthy();
    node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  function pressEscape() {
    document.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  }

  it('reserva las capas 40/50/60 y 1000/1001 sin layout de dos columnas', () => {
    expect(zIndex('.scheduling-focus-backdrop')).toBe(40);
    expect(zIndex('.calendar-main')).toBe(50);
    expect(rule('.calendar-main')).toMatch(
      /background(?:-color)?:\s*(?:#fff(?:fff)?|white|rgb\(255,\s*255,\s*255\))/,
    );
    expect(zIndex('.scheduling-floating-card')).toBe(60);
    expect(zIndex('.modal-backdrop')).toBe(1000);
    expect(zIndex('.modal')).toBe(1001);
    expect(rule('.calendar-grid.is-selecting')).toMatch(/user-select:\s*none/);
    expect(rule('.calendar-layout')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).not.toMatch(/\.calendar-layout\s*\{[^}]*minmax\(\s*\d+px/);
  });

  it('monta menú diario, detalle y popup de horario como modales en body', () => {
    mount('supervisor');
    const chip = document.querySelector('[data-event-kind]');
    expect(chip).toBeTruthy();
    clickNode(chip.closest('.calendar-day'));
    let modal = document.querySelector('.modal-backdrop');
    expect(modal.dataset.role).toBe('day-menu-backdrop');
    expect(modal.parentElement).toBe(document.body);
    expect(document.querySelector('.calendar-main .modal-backdrop')).toBeNull();
    pressEscape();

    clickNode(document.querySelector('[data-event-kind]'));
    modal = document.querySelector('.modal-backdrop');
    expect(modal.dataset.role).toBe('event-dialog-backdrop');
    expect(modal.parentElement).toBe(document.body);
    clickNode(modal);

    mount('planner');
    clickNode(document.querySelector('.pending-tray__row'));
    const day = document.querySelector(
      `[data-date="${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-24"]`,
    );
    expect(day).toBeTruthy();
    day.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    modal = document.querySelector('.modal-backdrop');
    expect(modal.dataset.role).toBe('schedule-popup-backdrop');
    expect(modal.parentElement).toBe(document.body);
    expect(document.querySelector('.calendar-main .modal-backdrop')).toBeNull();
  });
});
