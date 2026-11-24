import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { ProductionSchedulingPanel } from '../../src/components/ProductionSchedulingPanel.js';

const css = readFileSync(resolve('src/styles/manufacturing.css'), 'utf8');

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  expect(match, `Regla CSS no encontrada: ${selector}`).toBeTruthy();
  return match[1];
}

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

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

let dom;
let store;

function mount(role, options = {}) {
  document.body.innerHTML = '';
  const panel = ProductionSchedulingPanel(store, { role, ...options });
  document.body.appendChild(panel);
  return panel;
}

function clickNode(node) {
  expect(node).toBeTruthy();
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

function changeNode(node) {
  expect(node).toBeTruthy();
  node.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function dispatchMouse(node, type, options = {}) {
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

function day(date) {
  return document.querySelector(`[data-date="${date}"]`);
}

function grid() {
  return document.querySelector('[data-role="calendar-grid"]');
}

function backdrop() {
  return document.querySelector('[data-role="focus-backdrop"]');
}

function floatingCard() {
  return document.querySelector('[data-role="floating-card"]');
}

function startSelection() {
  const row = document.querySelector('.pending-tray__row');
  expect(row).toBeTruthy();
  clickNode(row);
  return row.dataset.pendingOrder;
}

function mouseUpOnDocument() {
  document.dispatchEvent(
    new window.MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }),
  );
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.FormData = dom.window.FormData;
  store = new ManufacturingStore({ storage: memoryStorage() });
});

afterEach(() => {
  vi.restoreAllMocks();
  dom.window.close();
});

describe('Selección de horario y hitbox de bandeja (US-13 / AC-93 a AC-95)', () => {
  it('usa toda la fila pendiente como hitbox en planner', () => {
    mount('planner');
    const row = document.querySelector('.pending-tray__row');
    const label = row.querySelector('.pending-tray__main span');
    expect(label).toBeTruthy();

    clickNode(label);
    expect(grid().classList.contains('is-selecting')).toBe(true);
    expect(backdrop().hidden).toBe(false);
    expect(floatingCard().hidden).toBe(false);
  });

  it('deja operar los select y checkbox de plant_manager sin activar selección', () => {
    mount('plant_manager');
    const row = document.querySelector('.pending-tray__row');
    const orderId = row.dataset.pendingOrder;
    const select = row.querySelector('[data-priority-control]');
    const checkbox = row.querySelector('[data-critical-toggle]');
    expect(select).toBeTruthy();
    expect(checkbox).toBeTruthy();

    select.value = 'urgent';
    changeNode(select);
    const freshCheckbox = document.querySelector(`[data-critical-toggle="${orderId}"]`);
    freshCheckbox.checked = !freshCheckbox.checked;
    changeNode(freshCheckbox);

    expect(store.orderById(orderId).priority).toBe('urgent');
    expect(store.orderById(orderId).is_critical_urgent).toBe(freshCheckbox.checked);
    expect(grid().classList.contains('is-selecting')).toBe(false);
    expect(backdrop().hidden).toBe(true);

    clickNode(document.querySelector(`[data-pending-order="${orderId}"]`));
    expect(grid().classList.contains('is-selecting')).toBe(false);
    expect(backdrop().hidden).toBe(true);
  });

  it('desactiva el arrastre nativo en todas las celdas y roles', () => {
    for (const role of ['plant_manager', 'planner', 'supervisor', 'operator', 'maintenance']) {
      mount(role, { operatorId: 'emp_op_01' });
      const cells = [...document.querySelectorAll('.calendar-day')];
      expect(cells.length).toBeGreaterThan(27);
      for (const cell of cells) {
        expect(cell.getAttribute('draggable'), `${role} ${cell.dataset.date}`).toBe('false');
      }
      const drag = dispatchMouse(cells[0], 'dragstart');
      expect(drag.defaultPrevented).toBe(true);
    }
  });

  it('previene mousedown, colorea el rango completo en vivo y abre un solo modal al soltar', () => {
    mount('planner');
    const orderId = startSelection();
    const month = currentMonthKey();
    const dates = [24, 25, 26, 27, 28].map(
      (dayNumber) => `${month}-${String(dayNumber).padStart(2, '0')}`,
    );

    const down = dispatchMouse(day(dates[0]), 'mousedown');
    expect(down.defaultPrevented).toBe(true);
    expect(day(dates[0]).classList.contains('calendar-day--drag-range')).toBe(true);

    for (const date of dates.slice(1)) {
      dispatchMouse(day(date), 'mouseenter', { bubbles: false });
      dispatchMouse(day(date), 'mouseover');
    }

    for (const date of dates) {
      expect(day(date).classList.contains('calendar-day--drag-range'), date).toBe(true);
    }
    expect(day(`${month}-23`).classList.contains('calendar-day--drag-range')).toBe(false);
    expect(day(`${month}-29`).classList.contains('calendar-day--drag-range')).toBe(false);

    mouseUpOnDocument();
    mouseUpOnDocument();

    expect(document.querySelectorAll('[data-role="schedule-popup-backdrop"]')).toHaveLength(1);
    const modal = document.querySelector('[data-role="schedule-popup"]');
    expect(modal.querySelector('[data-schedule-time="start"]').value).toBe('08:00');
    expect(modal.querySelector('[data-schedule-time="end"]').value).toBe('16:00');
    expect(modal.querySelector('[data-role="schedule-range"]').textContent).toContain('24');
    expect(modal.querySelector('[data-role="schedule-range"]').textContent).toContain('28');
    expect(document.querySelector('.calendar-main [data-role="schedule-popup"]')).toBeNull();
    expect(grid().classList.contains('is-selecting')).toBe(false);
    expect(backdrop().hidden).toBe(true);
    expect(floatingCard().hidden).toBe(true);

    modal.querySelector('[data-schedule-time="start"]').value = '09:30';
    modal.querySelector('[data-schedule-time="end"]').value = '17:30';
    clickNode(modal.querySelector('[data-schedule-save]'));
    expect(store.orderById(orderId).planned_start_date).toBe(dates[0]);
    expect(store.orderById(orderId).planned_end_date).toBe(dates[dates.length - 1]);
  });

  it('eleva solo el bloque calendario durante el modo selección', () => {
    mount('planner');
    startSelection();
    const main = document.querySelector('.calendar-main');
    const tray = document.querySelector('.pending-tray');
    const header = document.querySelector('.view__header');

    expect(main.classList.contains('calendar-main--focused')).toBe(true);
    expect(tray.classList.contains('calendar-main--focused')).toBe(false);
    expect(header.classList.contains('calendar-main--focused')).toBe(false);
    expect(backdrop().parentElement).toBe(document.body);
    expect(floatingCard().parentElement).toBe(document.body);

    const dates = [24, 28].map(
      (dayNumber) => `${currentMonthKey()}-${String(dayNumber).padStart(2, '0')}`,
    );
    dispatchMouse(day(dates[0]), 'mousedown');
    dispatchMouse(day(dates[1]), 'mouseover');
    mouseUpOnDocument();

    expect(main.classList.contains('calendar-main--focused')).toBe(false);
    expect(tray.classList.contains('calendar-main--focused')).toBe(false);
  });

  it('define en CSS las capas 40/50/60 y user-select: none', () => {
    expect(cssRule('.scheduling-focus-backdrop')).toMatch(/z-index:\s*40/);
    expect(cssRule('.calendar-main')).toMatch(/z-index:\s*50/);
    expect(cssRule('.calendar-main')).toMatch(
      /background(?:-color)?:\s*(?:#fff(?:fff)?|white|rgb\(255,\s*255,\s*255\))/,
    );
    expect(cssRule('.scheduling-floating-card')).toMatch(/z-index:\s*60/);
    expect(cssRule('.calendar-grid.is-selecting')).toMatch(/user-select:\s*none/);
  });
});
