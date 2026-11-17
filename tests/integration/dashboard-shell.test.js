import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { DashboardOverview } from '../../src/components/DashboardOverview.js';

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
let storage;
let store;

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  storage = memoryStorage();
  store = new ManufacturingStore({ storage });
});

afterEach(() => {
  dom.window.close();
});

describe('Panel inicial con datos de demostración', () => {
  it('muestra contexto por rol, accesos rápidos y actividad sin mutar el snapshot', () => {
    const snapshotBefore = storage.getItem('erp.manufacturing.v2');
    const onNavigate = vi.fn();
    const view = DashboardOverview(store, {
      role: 'supervisor',
      modules: [
        { id: 'supervision', label: 'Supervisión' },
        { id: 'maintenance', label: 'Mantenimiento' },
        { id: 'orders', label: 'Órdenes' },
      ],
      onNavigate,
    });
    document.body.appendChild(view);

    expect(document.body.textContent).toContain('Supervisor de línea');
    expect(document.body.textContent).toContain('Datos de demostración');
    expect(document.body.textContent).toContain('Actividad reciente');
    expect(document.querySelectorAll('[data-quick-action]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-activity]')).toHaveLength(4);

    document.querySelector('[data-quick-action="supervision"]').click();
    document.querySelector('[data-attention="maintenance"]').click();
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'supervision');
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'maintenance');
    expect(storage.getItem('erp.manufacturing.v2')).toBe(snapshotBefore);
  });

  it('usa Operador como etiqueta y deniega accesos no permitidos', () => {
    const view = DashboardOverview(store, {
      role: 'operator',
      modules: [{ id: 'operator', label: 'Estación' }],
      onNavigate: vi.fn(),
    });
    document.body.appendChild(view);

    expect(document.querySelector('.role-badge').textContent).toBe('Operador de Máquina');
    expect(document.querySelector('[data-quick-action="operator"]')).toBeTruthy();
    expect(document.querySelector('[data-quick-action="scheduling"]')).toBeNull();
    expect(document.querySelector('[data-attention="supervision"]')).toBeNull();
    expect(document.querySelector('[data-attention="scheduling"]')).toBeNull();
    expect(document.body.textContent).not.toContain('Operario');
  });
});
