import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { ProductionSchedulingPanel } from '../../src/components/ProductionSchedulingPanel.js';

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

let dom;
let store;

function click(selector) {
  const node = document.querySelector(selector);
  expect(node, `Nodo no encontrado: ${selector}`).toBeTruthy();
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function input(selector, value, type = 'input') {
  const node = document.querySelector(selector);
  expect(node, `Nodo no encontrado: ${selector}`).toBeTruthy();
  node.value = value;
  node.dispatchEvent(new window.Event(type, { bubbles: true }));
}

function mount() {
  document.body.appendChild(ProductionSchedulingPanel(store, { role: 'maintenance' }));
  click('[data-view="list"]');
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  store = new ManufacturingStore({ storage: memoryStorage() });
});

afterEach(() => {
  dom.window.close();
  vi.restoreAllMocks();
});

describe('Listado de mantenimientos activos en scheduling (US-13 / AC-112)', () => {
  it('muestra mantenciones activas con búsqueda, vigencia y Resolver sin campos de producción', () => {
    mount();
    const list = document.querySelector('#list-view');

    expect(list.querySelector('[data-role="maintenance-list-title"]').textContent).toContain(
      'Mantenimientos activos',
    );
    expect(list.querySelector('[data-role="maintenance-list-search"]')).toBeTruthy();
    expect(
      [...list.querySelectorAll('[data-role="maintenance-list-status"] option')].map((option) =>
        option.textContent.trim(),
      ),
    ).toEqual(['Todos', 'Vigentes', 'Vencidos']);
    expect(list.querySelector('[data-resolve-scheduled]').textContent).toContain('Resolver');
    expect(list.querySelector('[data-role="filter-status"]')).toBeNull();
    expect(list.querySelector('[data-role="filter-from"]')).toBeNull();
    expect(list.querySelector('[data-role="filter-to"]')).toBeNull();
    expect(list.querySelector('input[type="date"]')).toBeNull();
    expect(list.querySelector('thead th').textContent).not.toContain('Orden');

    input('[data-role="maintenance-list-search"]', 'no-existe');
    expect(list.querySelector('[data-resolve-scheduled]')).toBeNull();
    input('[data-role="maintenance-list-search"]', '');
    input('[data-role="maintenance-list-status"]', 'vencidos', 'change');
    expect(list.querySelectorAll('[data-maintenance-row]').length).toBeGreaterThan(0);
  });

  it('resuelve una mantención activa desde Listado', async () => {
    mount();
    const button = document.querySelector('[data-resolve-scheduled]');
    const id = button.dataset.resolveScheduled;
    const resolve = vi.spyOn(store, 'resolveScheduledMaintenance');

    click('[data-resolve-scheduled]');
    await vi.waitFor(() => document.querySelector('[data-role="confirm-dialog"]'));
    click('[data-role="confirm-dialog"] [data-role="confirm"]');
    await vi.waitFor(() => expect(resolve).toHaveBeenCalled());

    expect(resolve.mock.calls[0][0]).toBe(id);
    expect(resolve.mock.calls[0][2]).toBe('maintenance');
  });
});
