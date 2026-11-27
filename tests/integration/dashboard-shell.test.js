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
  it('muestra contexto por rol y actividad sin accesos rápidos ni mutar el snapshot', () => {
    const snapshotBefore = storage.getItem('erp.manufacturing.v2');
    const onNavigate = vi.fn();
    const view = DashboardOverview(store, {
      role: 'supervisor',
      onNavigate,
    });
    document.body.appendChild(view);

    expect(document.body.textContent).toContain('Supervisor de Línea');
    expect(document.body.textContent).toContain('Datos de demostración');
    expect(document.body.textContent).toContain('Actividad reciente');
    expect(document.body.textContent).not.toContain('Accesos rápidos');
    expect(document.querySelectorAll('[data-quick-action]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-activity]')).toHaveLength(4);

    document.querySelector('[data-attention="maintenance"]').click();
    expect(onNavigate).toHaveBeenCalledWith('maintenance');
    expect(storage.getItem('erp.manufacturing.v2')).toBe(snapshotBefore);
  });

  it('usa Operador como etiqueta y deniega accesos no permitidos', () => {
    const view = DashboardOverview(store, {
      role: 'operator',
      onNavigate: vi.fn(),
    });
    document.body.appendChild(view);

    expect(document.querySelector('.context-banner__line').textContent).toContain('Operador');
    expect(document.querySelector('[data-attention="supervision"]')).toBeNull();
    expect(document.querySelector('[data-attention="scheduling"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Operario');
  });
});
