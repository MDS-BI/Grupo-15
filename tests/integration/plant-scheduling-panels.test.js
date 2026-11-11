import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { PlantPerformancePanel } from '../../src/components/PlantPerformancePanel.js';
import { ProductionSchedulingPanel } from '../../src/components/ProductionSchedulingPanel.js';
import { LineBalancePanel } from '../../src/components/LineBalancePanel.js';

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
  expect(node).toBeTruthy();
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function change(selector, value) {
  const node = document.querySelector(selector);
  expect(node).toBeTruthy();
  node.value = value;
  node.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function fill(selector, value) {
  const node = document.querySelector(selector);
  expect(node).toBeTruthy();
  node.value = value;
}

function submit(selector) {
  const node = document.querySelector(selector);
  expect(node).toBeTruthy();
  node.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.FormData = dom.window.FormData;
  globalThis.alert = vi.fn();
  store = new ManufacturingStore({ storage: memoryStorage() });
});

afterEach(() => {
  dom.window.close();
});

describe('Panel de desempeño de planta (US-08)', () => {
  it('muestra KPIs, aplica permisos por rol y actualiza umbrales', () => {
    document.body.appendChild(PlantPerformancePanel(store));
    expect(document.body.textContent).toContain('no evaluación de desempeño');
    expect(document.body.textContent).not.toMatch(/ranking/i);
    expect(document.querySelector('[data-kpi="load"]').textContent).toContain('%');
    expect(document.querySelectorAll('[data-wc]')).toHaveLength(5);

    change('[data-role="role"]', 'operator');
    expect(
      document.querySelector('[data-role="threshold-form"] button[type="submit"]').disabled,
    ).toBe(true);
    expect(document.querySelector('[data-export="csv"]').disabled).toBe(true);

    change('[data-role="role"]', 'plant_manager');
    expect(document.querySelector('[data-export="csv"]').disabled).toBe(false);

    change('[data-role="threshold-form"] [name="indicator"]', 'downtime');
    fill('[data-role="threshold-form"] [name="threshold"]', '100');
    change('[data-role="threshold-form"] [name="comparison"]', 'gt');
    submit('[data-role="threshold-form"]');
    expect(store.thresholdSettings.find((row) => row.indicator === 'downtime').threshold).toBe(100);
  });

  it('cambia prioridad y cancela una orden desde el panel', () => {
    document.body.appendChild(PlantPerformancePanel(store));
    change('[data-priority="po_3004"]', 'high');
    expect(store.orderById('po_3004').priority).toBe('high');

    click('[data-cancel="po_3004"]');
    fill('[data-role="cancel-form"] [name="reason"]', 'Cambio de demanda');
    submit('[data-role="cancel-form"]');
    expect(store.orderById('po_3004').status).toBe('cancelled');
    expect(document.querySelector('[data-order="po_3004"]')).toBeNull();
  });
});

describe('Planificación de producción (US-10)', () => {
  it('filtra, guarda fechas y muestra errores de rango', () => {
    document.body.appendChild(ProductionSchedulingPanel(store));
    expect(document.querySelector('[data-summary="planned"]').textContent).toBe('Planificadas: 6');

    change('[data-role="filter-status"]', 'planned');
    expect(document.querySelectorAll('tr[data-order]')).toHaveLength(1);

    fill('[data-date="start"][data-order="po_3004"]', '2026-11-01');
    fill('[data-date="end"][data-order="po_3004"]', '2026-11-10');
    click('[data-save="po_3004"]');
    expect(store.orderById('po_3004').planned_start_date).toBe('2026-11-01');

    fill('[data-date="start"][data-order="po_3004"]', '2026-11-20');
    click('[data-save="po_3004"]');
    expect(document.querySelector('[data-error="po_3004"]').textContent).toContain('anterior');
  });

  it('deshabilita la edición de órdenes cerradas', () => {
    document.body.appendChild(ProductionSchedulingPanel(store));
    change('[data-role="filter-status"]', 'completed');
    expect(document.querySelector('[data-date="start"][data-order="po_3001"]').disabled).toBe(true);
    expect(document.querySelector('[data-save="po_3001"]').disabled).toBe(true);
  });
});

describe('Balance de líneas (US-11)', () => {
  it('muestra utilización, cuello de botella y detalle por orden', () => {
    document.body.appendChild(LineBalancePanel(store));
    expect(document.body.textContent).toContain('no evaluación de desempeño');
    expect(document.body.textContent).not.toMatch(/ranking/i);
    expect(document.querySelectorAll('[data-wc]')).toHaveLength(5);
    expect(document.querySelectorAll('[data-wc].is-bottleneck')).toHaveLength(1);
    expect(document.querySelector('[data-bottleneck]').textContent).toContain('Cuello de botella:');
    expect(document.querySelector('[data-unscheduled]').textContent).toContain(
      'Órdenes sin fechas excluidas: 0',
    );

    change('[data-role="order-select"]', 'po_3004');
    expect(document.querySelectorAll('[data-order-wc]')).toHaveLength(5);
    expect(document.querySelector('[data-order-wc="wc_corte"]')).toBeTruthy();
  });
});
