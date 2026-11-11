import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { MaintenancePanel } from '../../src/components/MaintenancePanel.js';
import { SNAPSHOT_KEY } from '../../src/data/persistence.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
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

function click(selector) {
  const node = document.querySelector(selector);
  expect(node).toBeTruthy();
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function submit(formSelector) {
  const form = document.querySelector(formSelector);
  expect(form).toBeTruthy();
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

function fill(formSelector, name, value) {
  const input = document.querySelector(`${formSelector} [name="${name}"]`);
  expect(input).toBeTruthy();
  input.value = value;
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.alert = vi.fn();
  globalThis.prompt = vi.fn(() => 'Motivo de prueba');
  storage = memoryStorage();
  store = new ManufacturingStore({ storage });
  document.body.appendChild(MaintenancePanel(store));
});

afterEach(() => {
  dom.window.close();
});

describe('Panel de mantenimiento (US-09)', () => {
  it('muestra la bandeja priorizada y filtra por estado', () => {
    const rows = [...document.querySelectorAll('[data-ticket-row]')].map((row) =>
      row.getAttribute('data-ticket-row'),
    );
    expect(rows[0]).toBe('mt_1001');
    expect(rows[1]).toBe('mt_1005');

    const statusFilter = document.querySelector('[data-role="filter-status"]');
    statusFilter.value = 'open';
    statusFilter.dispatchEvent(new window.Event('change', { bubbles: true }));

    const openRows = [...document.querySelectorAll('[data-ticket-row]')].map((row) =>
      row.getAttribute('data-ticket-row'),
    );
    expect(openRows).toEqual(expect.arrayContaining(['mt_1001', 'mt_1003', 'mt_1005']));
    expect(openRows).not.toContain('mt_1002');
  });

  it('toma una intervención, la resuelve y conserva el estado tras recargar', () => {
    click('[data-take="mt_1001"]');
    expect(document.querySelector('[data-role="take-form"]')).toBeTruthy();
    fill('[data-role="take-form"]', 'technician_ext_hr_employee_id', 'ext_hr_tec_01');
    submit('[data-role="take-form"]');

    const taken = store.maintenanceTickets.find((t) => t.id === 'mt_1001');
    expect(taken.ticket_status).toBe('in_progress');
    expect(store.workCenterById('wc_solda').operational_status).toBe('fault');

    click('[data-resolve="mt_1001"]');
    expect(document.querySelector('[data-role="resolve-form"]')).toBeTruthy();
    fill('[data-role="resolve-form"]', 'resolvedAt', '2030-01-01T10:00');
    fill('[data-role="resolve-form"]', 'downtimeStartedAt', '2030-01-01T09:00');
    fill('[data-role="resolve-form"]', 'downtimeEndedAt', '2030-01-01T10:00');
    fill('[data-role="resolve-form"]', 'causeReasonId', 'dr_mecanico');
    submit('[data-role="resolve-form"]');

    expect(taken.ticket_status).toBe('resolved');
    expect(taken.downtime_minutes).toBe(60);
    expect(store.workCenterById('wc_solda').operational_status).toBe('available');

    expect(JSON.parse(storage.getItem(SNAPSHOT_KEY)).data.maintenanceTickets).toBeDefined();
    const reloaded = new ManufacturingStore({ storage });
    const persisted = reloaded.maintenanceTickets.find((t) => t.id === 'mt_1001');
    expect(persisted.ticket_status).toBe('resolved');
    expect(persisted.downtime_minutes).toBe(60);
  });

  it('muestra el error inline y no muta el ticket ante un cierre inválido', () => {
    click('[data-resolve="mt_1002"]');
    fill('[data-role="resolve-form"]', 'resolvedAt', '2030-01-01T10:00');
    fill('[data-role="resolve-form"]', 'downtimeStartedAt', '2030-01-01T10:00');
    fill('[data-role="resolve-form"]', 'downtimeEndedAt', '2030-01-01T09:00');
    submit('[data-role="resolve-form"]');

    const error = document.querySelector('[data-role="resolve-form"] [data-role="error"]');
    expect(error.textContent).toMatch(/anterior/);
    expect(store.maintenanceTickets.find((t) => t.id === 'mt_1002').ticket_status).toBe(
      'in_progress',
    );
  });

  it('crea una orden preventiva y recorre sus transiciones', () => {
    click('[data-preventive-create]');
    expect(document.querySelector('[data-role="preventive-form"]')).toBeTruthy();
    fill('[data-role="preventive-form"]', 'plannedDate', '2026-12-15');
    fill('[data-role="preventive-form"]', 'title', 'Preventiva de prueba');
    submit('[data-role="preventive-form"]');

    const order = store.preventiveMaintenanceOrders.find((o) => o.title === 'Preventiva de prueba');
    expect(order).toBeTruthy();
    expect(order.status).toBe('planned');

    click(`[data-preventive-action="start"][data-order="${order.id}"]`);
    expect(order.status).toBe('in_progress');
    click(`[data-preventive-action="complete"][data-order="${order.id}"]`);
    expect(order.status).toBe('completed');
    expect(order.completed_at).toBeTruthy();
  });
});
