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

let dom;
let store;
let date;

function click(selector) {
  const node = document.querySelector(selector);
  expect(node, `Nodo no encontrado: ${selector}`).toBeTruthy();
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function openDayMenu() {
  click(`[data-date="${date}"]`);
  expect(document.querySelector('[data-role="day-menu"]')).toBeTruthy();
}

function openEventDialog() {
  openDayMenu();
  click('[data-role="day-menu"] [data-event-id]');
  expect(document.querySelector('[data-role="event-dialog"]')).toBeTruthy();
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  store = new ManufacturingStore({ storage: memoryStorage() });
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  date = `${month}-15`;
  vi.spyOn(store, 'calendarEventsForMonth').mockReturnValue([
    {
      id: 'order:po_demo',
      kind: 'order',
      sourceId: 'po_3001',
      title: 'Orden de prueba',
      start_date: date,
      end_date: date,
      start_time: '08:00',
      end_time: '16:00',
      status: 'planned',
      priority: 'normal',
      is_critical_urgent: false,
    },
  ]);
  document.body.appendChild(ProductionSchedulingPanel(store, { role: 'supervisor' }));
});

afterEach(() => {
  dom.window.close();
  vi.restoreAllMocks();
});

describe('Menú diario y detalle para supervisor (US-13 / AC-115–AC-116)', () => {
  it('oscurece los ítems del menú diario y ofrece acceso a supervisión', () => {
    expect(cssRule('.calendar-day-menu__item:hover')).toMatch(/background-color:\s*#/);
    expect(cssRule('.calendar-day-menu__item:hover')).not.toMatch(/transform|width|height/);

    openDayMenu();
    const menu = document.querySelector('[data-role="day-menu"]');
    expect(menu.textContent).not.toContain('Volver a la lista del día');
    const supervisorButton = [...menu.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Ir a Supervisión de línea'),
    );
    expect(supervisorButton).toBeTruthy();

    supervisorButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(dom.window.location.hash).toBe('#/supervision');
  });

  it('cierra con × limpiando el día y el evento, y ofrece supervisión en el detalle', () => {
    openEventDialog();
    const dialog = document.querySelector('[data-role="event-dialog"]');
    expect(dialog.textContent).not.toContain('Volver a la lista del día');
    const supervisorButton = [...dialog.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Ir a Supervisión de línea'),
    );
    expect(supervisorButton).toBeTruthy();
    supervisorButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(dom.window.location.hash).toBe('#/supervision');

    click('[data-role="event-dialog-close"]');
    expect(document.querySelector('[data-role="event-dialog-backdrop"]')).toBeNull();
    expect(document.querySelector('[data-role="day-menu-backdrop"]')).toBeNull();
  });
});
