import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const css = readFileSync(resolve('src/styles/manufacturing.css'), 'utf8');

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  expect(match, `Regla CSS no encontrada: ${selector}`).toBeTruthy();
  return match[1];
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

function mountScheduling(role = 'planner', options = {}) {
  const panel = ProductionSchedulingPanel(store, { role, ...options });
  document.body.appendChild(panel);
  return panel;
}

function dispatchMouse(selector, type, options = {}) {
  const node = document.querySelector(selector);
  expect(node).toBeTruthy();
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...options,
  });
  node.dispatchEvent(event);
  return event;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
  vi.restoreAllMocks();
  dom.window.close();
});

describe('Panel de desempeño de planta (US-08)', () => {
  it('muestra KPIs, aplica permisos por rol y actualiza umbrales', () => {
    store.setSessionRole('plant_manager', 'operator');
    document.body.appendChild(PlantPerformancePanel(store, { role: 'operator' }));
    expect(document.body.textContent).toContain('no evaluación de desempeño');
    expect(document.body.textContent).not.toMatch(/ranking/i);
    expect(document.querySelector('[data-kpi="load"]').textContent).toContain('%');
    expect(document.querySelectorAll('[data-wc]')).toHaveLength(10);
    expect(document.querySelector('[data-role="role-select"]')).toBeNull();
    expect(
      document.querySelector('[data-role="threshold-form"] button[type="submit"]').disabled,
    ).toBe(true);
    expect(document.querySelector('[data-export="csv"]').disabled).toBe(true);

    store.setSessionRole('plant_manager', 'plant_manager');
    document.body.replaceChildren(PlantPerformancePanel(store, { role: 'plant_manager' }));
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
    expect(document.querySelector('[data-summary="planned"]').textContent).toBe('Planificadas: 36');

    change('[data-role="filter-status"]', 'planned');
    expect(document.querySelectorAll('tr[data-order]')).toHaveLength(12);

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

describe('Calendario mensual por rol (US-13)', () => {
  it('abre el mes actual, recuerda el mes entre pestañas y vuelve al actual', () => {
    mountScheduling('planner');
    const monthLabel = () => document.querySelector('[data-month-label]').textContent;
    const initial = monthLabel();

    expect(initial).toContain(String(new Date().getFullYear()));
    expect(document.querySelector('[data-role="calendar-filter"]').value).toBe('Ambos');
    expect(document.querySelectorAll('.calendar-day').length).toBeGreaterThan(27);

    click('[data-view="list"]');
    click('[data-view="calendar"]');
    expect(monthLabel()).toBe(initial);

    click('[data-month-nav="next"]');
    const next = monthLabel();
    expect(next).not.toBe(initial);
    click('[data-view="list"]');
    click('[data-view="calendar"]');
    expect(monthLabel()).toBe(next);

    click('[data-month-nav="today"]');
    expect(monthLabel()).toBe(initial);
  });

  it('filtra órdenes, mantenciones y ambos tipos', () => {
    mountScheduling('planner');
    expect(document.querySelectorAll('[data-event-kind="order"]').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-event-kind="maintenance"]').length).toBeGreaterThan(0);

    change('[data-role="calendar-filter"]', 'Solo Órdenes de Trabajo');
    expect(document.querySelectorAll('[data-event-kind="maintenance"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-event-kind="order"]').length).toBeGreaterThan(0);

    change('[data-role="calendar-filter"]', 'Solo Mantenciones');
    expect(document.querySelectorAll('[data-event-kind="order"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-event-kind="maintenance"]').length).toBeGreaterThan(0);
  });

  it('muestra la bandeja y los controles críticos solo según el rol', () => {
    document.body.innerHTML = '';
    mountScheduling('planner');
    const pending = store.pendingSchedulingOrders();
    expect(pending.length).toBeGreaterThan(0);
    const orderId = pending[0].id;
    expect(document.querySelector('[data-role="pending-tray"]')).toBeTruthy();
    expect(document.querySelector(`[data-pending-order="${orderId}"]`).textContent).toContain(
      '% de avance',
    );
    expect(document.querySelector(`[data-priority-control="${orderId}"]`)).toBeNull();
    expect(document.querySelector(`[data-critical-toggle="${orderId}"]`)).toBeNull();

    document.body.innerHTML = '';
    mountScheduling('plant_manager');
    expect(document.querySelector('[data-role="pending-tray"]')).toBeTruthy();
    expect(document.querySelector(`[data-priority-control="${orderId}"]`)).toBeTruthy();
    expect(document.querySelector(`[data-critical-toggle="${orderId}"]`)).toBeTruthy();
    change(`[data-priority-control="${orderId}"]`, 'urgent');
    expect(store.orderById(orderId).priority).toBe('urgent');

    document.body.innerHTML = '';
    mountScheduling('supervisor');
    expect(document.querySelector('[data-role="pending-tray"]').hidden).toBe(true);
    expect(document.querySelector('[data-view="list"]')).toBeTruthy();
    expect(document.querySelectorAll('input[type="time"], [data-schedule-save]')).toHaveLength(0);

    document.body.innerHTML = '';
    mountScheduling('operator', { operatorId: 'emp_op_01' });
    expect(document.querySelector('[data-view="list"]')).toBeNull();
    expect(document.querySelector('[data-role="calendar-grid"]')).toBeTruthy();
    expect(document.querySelector('.calendar-day').draggable).toBe(false);
  });

  it('aplica foco, cancela con clic derecho y guarda un rango con horas editables', () => {
    mountScheduling('planner');
    const pending = store.pendingSchedulingOrders();
    expect(pending.length).toBeGreaterThan(0);
    const orderId = pending[0].id;
    const month = currentMonthKey();
    const startDate = `${month}-09`;
    const endDate = `${month}-11`;

    click(`[data-focus-order="${orderId}"]`);
    expect(document.querySelector('.scheduling-focus-backdrop').hidden).toBe(false);
    expect(document.querySelector('.scheduling-floating-card')).toBeTruthy();
    expect(document.querySelector('[data-role="drag-hint"]').textContent).toMatch(/clic derecho/i);

    const cancelled = dispatchMouse(`[data-date="${startDate}"]`, 'contextmenu');
    expect(cancelled.defaultPrevented).toBe(true);
    expect(document.querySelector('[data-role="schedule-popup"]')).toBeNull();
    expect(document.querySelector('.scheduling-focus-backdrop').hidden).toBe(true);

    click(`[data-focus-order="${orderId}"]`);
    dispatchMouse(`[data-date="${startDate}"]`, 'mousedown');
    dispatchMouse(`[data-date="${endDate}"]`, 'mouseover');
    expect(
      document
        .querySelector(`[data-date="${startDate}"]`)
        .classList.contains('calendar-day--drag-range'),
    ).toBe(true);
    expect(
      document
        .querySelector(`[data-date="${endDate}"]`)
        .classList.contains('calendar-day--drag-range'),
    ).toBe(true);

    dispatchMouse(`[data-date="${endDate}"]`, 'mouseup');
    expect(document.querySelector('[data-role="schedule-popup"]')).toBeTruthy();
    expect(document.querySelector('[data-schedule-time="start"]').value).toBe('08:00');
    expect(document.querySelector('[data-schedule-time="end"]').value).toBe('16:00');

    fill('[data-schedule-time="start"]', '09:30');
    fill('[data-schedule-time="end"]', '17:30');
    click('[data-schedule-save]');

    const order = store.orderById(orderId);
    expect(order.planned_start_date).toBe(startDate);
    expect(order.planned_end_date).toBe(endDate);
    expect(order.scheduled_start_time).toBe('09:30');
    expect(order.scheduled_end_time).toBe('17:30');
    expect(document.querySelector('[data-role="schedule-popup"]')).toBeNull();
  });

  it('abre el menú diario por tarea y cierra el detalle sin volver al menú', () => {
    mountScheduling('supervisor');
    const chip = document.querySelector('[data-event-kind]');
    expect(chip).toBeTruthy();
    const date = chip.closest('.calendar-day').dataset.date;
    const eventId = chip.dataset.eventId;

    click(`[data-date="${date}"]`);
    expect(document.querySelector('[data-role="day-menu"]')).toBeTruthy();
    expect(document.querySelector(`[data-event-id="${eventId}"]`)).toBeTruthy();

    click(`[data-event-id="${eventId}"]`);
    const dialog = document.querySelector('[data-role="event-dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).not.toContain('Volver a la lista del día');
    expect(dialog.querySelector('[data-role="event-back"]')).toBeNull();
    expect(
      dialog.querySelector('input, select, textarea, [data-schedule-save], [data-dialog-save]'),
    ).toBeNull();

    click('[data-role="event-dialog-close"]');
    expect(document.querySelector('[data-role="day-menu"]')).toBeNull();
    expect(document.querySelector('[data-role="event-dialog"]')).toBeNull();
  });

  it('presenta Calendario y Listado como pestañas integradas', () => {
    mountScheduling('planner');
    const tabs = [...document.querySelectorAll('[data-role="view-tabs"] [role="tab"]')];

    expect(tabs.map((tab) => tab.textContent.trim())).toEqual(['Calendario', 'Listado']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    for (const tab of tabs) {
      expect(tab.classList.contains('scheduling-tabs__tab')).toBe(true);
      expect(tab.classList.contains('maintenance-tabs__tab')).toBe(true);
    }

    click('[data-view="list"]');
    expect(document.querySelector('[data-view="calendar"]').getAttribute('aria-selected')).toBe(
      'false',
    );
    expect(document.querySelector('[data-view="list"]').getAttribute('aria-selected')).toBe('true');

    document.body.innerHTML = '';
    mountScheduling('operator', { operatorId: 'emp_op_01' });
    expect(document.querySelectorAll('[data-role="view-tabs"] [role="tab"]')).toHaveLength(1);
    expect(document.querySelector('[data-view="list"]')).toBeNull();
  });

  it('ocupa todo el ancho con siete columnas y títulos legibles', () => {
    expect(cssRule('.calendar-layout')).toMatch(/width:\s*100%/);
    expect(cssRule('.calendar-main')).toMatch(/width:\s*100%/);
    expect(cssRule('.calendar-grid')).toMatch(/width:\s*100%/);
    expect(cssRule('.calendar-grid')).toMatch(
      /grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(cssRule('.calendar-event-chip span')).toMatch(/white-space:\s*normal/);
    expect(cssRule('.calendar-event-chip span')).not.toMatch(/text-overflow:\s*ellipsis/);

    mountScheduling('supervisor');
    const chip = document.querySelector('[data-event-kind]');
    expect(chip.querySelector('span').textContent.trim()).toBe(chip.getAttribute('title'));
  });

  it('limita a tres eventos por día y enumera todos desde "+N más"', () => {
    const date = `${currentMonthKey()}-15`;
    const events = Array.from({ length: 5 }, (_, index) => ({
      id: `fixture:${index}`,
      sourceId: `fixture_${index}`,
      kind: index % 2 === 0 ? 'order' : 'maintenance',
      title: `Tarea ${index + 1}`,
      start_date: date,
      end_date: date,
      start_time: '08:00',
      end_time: '16:00',
      is_critical_urgent: false,
    }));
    vi.spyOn(store, 'calendarEventsForMonth').mockReturnValue(events);
    mountScheduling('supervisor');

    const day = document.querySelector(`[data-date="${date}"]`);
    expect(day.querySelectorAll('.calendar-event-chip')).toHaveLength(3);
    const more = day.querySelector('.calendar-day__more');
    expect(more.textContent.trim()).toBe('+2 más');

    more.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const items = [...document.querySelectorAll('[data-role="day-menu"] [data-event-id]')];
    expect(items).toHaveLength(5);
    expect(items.map((item) => item.dataset.eventId)).toEqual(events.map((event) => event.id));
  });
});

describe('Distribución ancha del calendario (US-13 / AC-91)', () => {
  const roles = ['plant_manager', 'planner', 'supervisor', 'operator', 'maintenance'];

  it('sitúa la bandeja después de .calendar-main y conserva su visibilidad por rol', () => {
    for (const role of roles) {
      document.body.innerHTML = '';
      mountScheduling(role, { operatorId: 'emp_op_01' });
      const layout = document.querySelector('.calendar-layout');
      const children = [...layout.children];
      const tray = children.find((node) => node.classList.contains('pending-tray'));
      const main = children.find((node) => node.classList.contains('calendar-main'));
      const withTray = ['planner', 'plant_manager'].includes(role);
      expect(tray, `bandeja ausente para ${role}`).toBeTruthy();
      expect(main, `calendario ausente para ${role}`).toBeTruthy();
      expect(children.indexOf(tray)).toBeGreaterThan(children.indexOf(main));
      expect(tray.hidden).toBe(!withTray);
      expect(layout.classList.contains('calendar-layout--with-tray')).toBe(withTray);
      expect(document.querySelectorAll('.calendar-day').length).toBeGreaterThan(27);
    }
  });

  it('define una columna sin bandeja, dos con bandeja y tarjetas verticales', () => {
    expect(cssRule('.calendar-layout')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(cssRule('.calendar-layout')).not.toMatch(/minmax\(\s*\d+px/);
    expect(cssRule('.calendar-layout--with-tray')).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+280px/,
    );
    expect(cssRule('.calendar-main')).toMatch(/width:\s*100%/);
    expect(cssRule('.pending-tray')).toMatch(/display:\s*flex/);
    expect(cssRule('.pending-tray')).toMatch(/flex-direction:\s*column/);
    expect(cssRule('.pending-tray__row')).toMatch(/border:\s*1px/);
    expect(cssRule('.pending-tray__row')).toMatch(/border-radius:\s*\d+px/);
    expect(cssRule('.calendar-day')).toMatch(/min-height:\s*(?:9[6-9]|[1-9]\d{2,})px/);
  });
});

describe('Balance de líneas (US-11)', () => {
  it('muestra utilización, cuello de botella y detalle por orden', () => {
    document.body.appendChild(LineBalancePanel(store));
    expect(document.body.textContent).toContain('no evaluación de desempeño');
    expect(document.body.textContent).not.toMatch(/ranking/i);
    expect(document.querySelectorAll('[data-wc]')).toHaveLength(10);
    expect(document.querySelectorAll('[data-wc].is-bottleneck')).toHaveLength(1);
    expect(document.querySelector('[data-bottleneck]').textContent).toContain('Cuello de botella:');
    expect(document.querySelector('[data-unscheduled]').textContent).toContain(
      'Órdenes sin fechas excluidas: 4',
    );

    change('[data-role="order-select"]', 'po_3004');
    expect(document.querySelectorAll('[data-order-wc]')).toHaveLength(10);
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
    expect(armadoDailyCell.querySelector('.bar').classList.contains('bar--bottleneck')).toBe(true);
    expect(armadoDailyCell.querySelector('.bar__label').className).toBe('bar__label');
    expect(document.querySelectorAll('.bar__fill').length).toBe(20);
    expect(document.querySelectorAll('.balance-chart__fill').length).toBe(10);
    expect(document.querySelectorAll('.balance-chart__ref').length).toBe(10);
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
