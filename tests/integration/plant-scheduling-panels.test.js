import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { DashboardOverview } from '../../src/components/DashboardOverview.js';
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
    expect(document.querySelectorAll('[data-wc]')).toHaveLength(6);

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
    expect(document.body.textContent).toContain('Umbral actualizado');
  });

  it('cambia prioridad y cancela una orden desde el panel', () => {
    document.body.appendChild(PlantPerformancePanel(store));
    change('[data-priority="po_3004"]', 'high');
    expect(store.orderById('po_3004').priority).toBe('high');
    expect(document.body.textContent).toContain('Prioridad actualizada');

    click('[data-cancel="po_3004"]');
    fill('[data-role="cancel-form"] [name="reason"]', 'Cambio de demanda');
    submit('[data-role="cancel-form"]');
    expect(store.orderById('po_3004').status).toBe('cancelled');
    expect(document.querySelector('[data-order="po_3004"]')).toBeNull();
    expect(document.body.textContent).toContain('Orden cancelada');
  });
});

describe('Planificación de producción (US-10)', () => {
  it('filtra, guarda fechas y muestra errores de rango', () => {
    document.body.appendChild(ProductionSchedulingPanel(store));
    expect(document.querySelector('[data-summary="planned"]').textContent).toBe('Planificadas: 7');

    change('[data-role="filter-status"]', 'planned');
    expect(document.querySelectorAll('tr[data-order]')).toHaveLength(1);

    fill('[data-date="start"][data-order="po_3004"]', '2026-11-01');
    fill('[data-date="end"][data-order="po_3004"]', '2026-11-10');
    click('[data-save="po_3004"]');
    expect(store.orderById('po_3004').planned_start_date).toBe('2026-11-01');
    expect(document.body.textContent).toContain('Fechas guardadas');

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
    expect(document.querySelectorAll('[data-wc]')).toHaveLength(6);
    expect(document.querySelectorAll('[data-wc].is-bottleneck')).toHaveLength(1);
    expect(document.querySelector('[data-bottleneck]').textContent).toContain('Cuello de botella:');
    expect(document.querySelector('[data-unscheduled]').textContent).toContain(
      'Órdenes sin fechas excluidas: 0',
    );

    change('[data-role="order-select"]', 'po_3004');
    expect(document.querySelectorAll('[data-order-wc]')).toHaveLength(6);
    expect(document.querySelector('[data-order-wc="wc_corte"]')).toBeTruthy();
  });

  it('muestra KPIs, semáforo, holgura y barras de utilización', () => {
    document.body.appendChild(LineBalancePanel(store));
    expect(document.querySelector('[data-role="load-section"] h3').textContent).toContain(
      'Octubre 2026 (22 días hábiles)',
    );
    const headers = [...document.querySelectorAll('.balance-table th')].map((th) =>
      th.textContent.trim(),
    );
    expect(headers).not.toContain('Días hábiles');
    expect(headers).toContain('Utilización del día');
    expect(headers.indexOf('Utilización del día')).toBeGreaterThan(headers.indexOf('Utilización'));
    expect(document.querySelector('[data-kpi="avg-utilization"]').textContent).toContain('%');
    expect(document.querySelector('[data-kpi="top-center"]').textContent).toContain(
      'Estación de Soldadura',
    );
    expect(document.querySelector('[data-kpi="top-center"]').textContent).toContain('Cuello');
    expect(document.querySelector('[data-kpi="balance-efficiency"]').textContent).toContain('%');
    expect(document.querySelector('[data-kpi="free-capacity"]').textContent).toContain(' h');

    const soldaRow = document.querySelector('[data-wc="wc_solda"]');
    expect(soldaRow.classList.contains('is-bottleneck')).toBe(true);
    expect(soldaRow.textContent).toContain('8.690 min');
    expect(soldaRow.textContent).toContain('144,8 h');
    expect(document.querySelector('[data-wc="wc_corte"]').dataset.status).toBe('normal');
    expect(document.querySelector('[data-wc="wc_pintura"]').dataset.status).toBe('tight');
    const daily = store
      .dailyUtilizationByWorkCenter()
      .find((row) => row.workCenter.id === 'wc_solda');
    const dailyIndex = headers.indexOf('Utilización del día');
    const periodCell = soldaRow.querySelectorAll('td')[headers.indexOf('Utilización')];
    const dailyCell = soldaRow.querySelectorAll('td')[dailyIndex];
    expect(dailyCell.textContent).toContain(`${(daily.utilization * 100).toFixed(1)}%`);
    expect(dailyCell.classList.contains('cell--bar')).toBe(false);
    expect(dailyCell.children.length).toBe(1);
    expect(dailyCell.querySelector('.cell--bar')).toBeTruthy();
    expect(dailyCell.querySelector('.bar').className).toBe(
      periodCell.querySelector('.bar').className,
    );
    expect(dailyCell.querySelector('.bar__label').className).toBe('bar__label');
    expect(dailyCell.querySelector('.bar__fill').style.width).toBe('100%');
    expect(document.querySelector('.balance-table .bar--over')).toBeNull();
    const armadoDailyCell = document.querySelectorAll('[data-wc="wc_armado"] td')[dailyIndex];
    expect(armadoDailyCell.querySelector('.bar').classList.contains('bar--tight')).toBe(true);
    expect(armadoDailyCell.querySelector('.bar__label').className).toBe('bar__label');
    expect(document.querySelectorAll('.bar__fill').length).toBe(12);
    expect(document.querySelectorAll('.balance-chart__fill').length).toBe(6);
    expect(document.querySelectorAll('.balance-chart__ref').length).toBe(6);
  });

  it('abre un popover compacto con las órdenes del centro al hacer clic en una fila', () => {
    document.body.appendChild(LineBalancePanel(store));
    expect(document.querySelector('[data-role="center-orders"]')).toBeNull();

    click('[data-wc="wc_solda"]');
    const popover = document.querySelector('[data-role="center-popover"]');
    expect(popover).toBeTruthy();
    expect(popover.style.left).toMatch(/px$/);
    expect(popover.style.top).toMatch(/px$/);
    expect(popover.textContent).toContain('Órdenes de Estación de Soldadura 1');
    expect(popover.textContent).toContain('Carga en el centro');
    expect(popover.textContent).toContain('OP-3003');
    expect(popover.textContent).toContain('OP-3007');
    expect(popover.textContent).not.toContain('OP-3001');
    expect(popover.querySelectorAll('[data-center-popover-order]')).toHaveLength(2);
    expect(popover.querySelector('[data-center-popover-order="po_3007"]').textContent).toContain(
      '%',
    );
    expect(document.querySelector('[data-wc="wc_solda"]').classList.contains('is-selected')).toBe(
      true,
    );
    expect(
      document.querySelector('[data-order-wc="wc_solda"]').classList.contains('is-selected'),
    ).toBe(true);

    click('[data-role="close-popover"]');
    expect(document.querySelector('[data-role="center-popover"]')).toBeNull();
    expect(document.querySelector('[data-wc="wc_solda"]').classList.contains('is-selected')).toBe(
      false,
    );

    click('[data-wc="wc_solda"]');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-role="center-popover"]')).toBeNull();

    const row = document.querySelector('[data-wc="wc_solda"]');
    row.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('[data-role="center-popover"]').textContent).toContain(
      'Estación de Soldadura 1',
    );
    document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('[data-role="center-popover"]')).toBeNull();
  });

  it('ordena el detalle por orden según la secuencia de la ruta', () => {
    document.body.appendChild(LineBalancePanel(store));
    change('[data-role="order-select"]', 'po_3003');
    const sequences = [...document.querySelectorAll('[data-order-wc]')].map(
      (row) => row.dataset.sequence,
    );
    expect(sequences.slice(0, 3)).toEqual(['10', '20', '30']);
    expect(document.querySelector('[data-order-wc="wc_solda"]').textContent).toContain('Sec. 20');
  });

  it('indica línea balanceada si ningún centro alcanza el umbral crítico', () => {
    document.body.appendChild(LineBalancePanel(store));
    change('[data-role="period"]', 'november');
    expect(document.querySelector('[data-bottleneck]').textContent).toBe(
      'Línea balanceada · Sin cuellos de botella críticos',
    );
    expect(document.querySelectorAll('[data-wc].is-bottleneck')).toHaveLength(0);
    expect(document.querySelector('[data-role="balance-suggestions"]').textContent).toContain(
      'Sin cuellos de botella críticos',
    );
  });

  it('muestra la reasignación simulada sin registrar solicitudes', () => {
    document.body.appendChild(LineBalancePanel(store));
    expect(document.querySelector('[data-request]')).toBeTruthy();
    expect(document.querySelector('[data-suggestion]').textContent).toContain(
      'Reasignar 6.865 min de OP-3007 desde Estación de Soldadura 1 a Estación de Soldadura 2 · Sec. 20.',
    );
    const routingSnapshot = JSON.stringify(store.routingOperations);
    const ordersSnapshot = JSON.stringify(store.productionOrders);

    click('[data-request]');
    expect(document.querySelector('[data-role="request-modal"]')).toBeTruthy();
    fill('[data-role="request-form"] textarea', 'Mover carga al centro con holgura');
    submit('[data-role="request-form"]');

    expect(document.querySelector('[data-role="request-modal"]')).toBeNull();
    expect(document.querySelector('[data-suggestion]').textContent).toContain('Solicitud simulada');
    expect(store.lineBalanceRequestsFor).toBeUndefined();
    expect(JSON.stringify(store.routingOperations)).toBe(routingSnapshot);
    expect(JSON.stringify(store.productionOrders)).toBe(ordersSnapshot);
  });
});

describe('Panel de producción (US-06)', () => {
  it('muestra las operaciones que generan la carga al hacer clic en un centro', () => {
    document.body.appendChild(DashboardOverview(store));
    expect(document.querySelector('[data-role="capacity-popover"]')).toBeNull();

    click('[data-capacity-wc="wc_solda"]');
    const popover = document.querySelector('[data-role="capacity-popover"]');
    expect(popover).toBeTruthy();
    expect(popover.textContent).toContain('Estación de Soldadura 1');

    const load = store.workCenterLoads().find((row) => row.workCenter.id === 'wc_solda');
    expect(popover.textContent).toContain(`${load.pendingOperations} operaciones`);
    expect(popover.textContent).toContain('min de carga pendiente');
    const operations = store.productionOrderOperations.filter(
      (op) => op.work_center_id === 'wc_solda' && op.status !== 'completed',
    );
    expect(popover.querySelectorAll('[data-capacity-operation]')).toHaveLength(operations.length);
    operations.forEach((op) => {
      expect(popover.textContent).toContain(store.orderById(op.production_order_id).order_number);
    });

    click('[data-role="close-capacity-popover"]');
    expect(document.querySelector('[data-role="capacity-popover"]')).toBeNull();

    click('[data-capacity-wc="wc_solda"]');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-role="capacity-popover"]')).toBeNull();

    click('[data-capacity-wc="wc_solda"]');
    document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('[data-role="capacity-popover"]')).toBeNull();
  });
});
