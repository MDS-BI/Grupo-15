import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { MaintenancePanel } from '../../src/components/MaintenancePanel.js';
import { SNAPSHOT_KEY } from '../../src/data/persistence.js';
import { daysFromNow, relativeDay } from '../../src/data/fixtures/demo-dates.js';

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

function activateTab(tab) {
  click(`[data-role="maintenance-tab"][data-tab="${tab}"]`);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function search(selector, value) {
  const input = document.querySelector(selector);
  expect(input).toBeTruthy();
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
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

function scheduleTicket(ticketId = 'mt_1001') {
  activateTab('tickets');
  click(`[data-schedule-ticket="${ticketId}"]`);
  expect(document.querySelector('[data-role="schedule-form"]')).toBeTruthy();
  fill('[data-role="schedule-form"]', 'technician_ext_hr_employee_id', 'ext_hr_tec_01');
  fill('[data-role="schedule-form"]', 'scheduledStartDate', relativeDay(0));
  fill('[data-role="schedule-form"]', 'scheduledEndDate', daysFromNow(1));
  submit('[data-role="schedule-form"]');
}

describe('Panel de mantenimiento (US-15)', () => {
  it('muestra exactamente tres subpestañas con buscadores propios', () => {
    expect(
      [...document.querySelectorAll('[data-role="maintenance-tab"]')].map((tab) =>
        tab.textContent.trim(),
      ),
    ).toEqual(['Máquinas', 'Tickets', 'Mantenimientos']);

    expect(document.querySelector('[data-role="maintenance-search-machines"]')).toBeTruthy();
    expect(document.querySelector('[data-role="maintenance-search-tickets"]')).toBeTruthy();
    activateTab('maintenances');
    expect(document.querySelectorAll('[data-role="maintenance-block-search"]')).toHaveLength(3);
  });

  it('busca máquinas, tickets y mantenciones por nombre o código', () => {
    activateTab('machines');
    search('[data-role="maintenance-search-machines"]', 'Armado');
    expect(document.querySelectorAll('[data-role="machine-row"]')).toHaveLength(1);
    expect(document.querySelector('[data-role="machine-row"]').getAttribute('data-center')).toBe(
      'wc_armado',
    );

    activateTab('tickets');
    search('[data-role="maintenance-search-tickets"]', 'MTO-1001');
    expect(document.querySelectorAll('[data-ticket-row]')).toHaveLength(1);

    activateTab('maintenances');
    search('[data-role="maintenance-search-active"]', 'PM-2001');
    search('[data-role="maintenance-search-history"]', 'Corte');
    expect(document.body.textContent).toContain('Sin mantenciones');
  });

  it('Revisar históricas cambia de pestaña y prellena el buscador con la máquina', () => {
    activateTab('machines');
    click('[data-role="review-history"][data-center="wc_armado"]');

    expect(
      document
        .querySelector('[data-role="maintenance-tab"][data-tab="maintenances"]')
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(document.querySelector('[data-role="maintenance-search-history"]').value).toBe(
      'Línea de Armado',
    );
    expect(document.querySelector('[data-role="maintenance-block-history"]').textContent).toContain(
      'Línea de Armado',
    );
  });

  it('programa una mantención desde un ticket y la sincroniza con calendario y Activos', () => {
    scheduleTicket('mt_1001');

    const ticket = store.maintenanceTickets.find((row) => row.id === 'mt_1001');
    expect(ticket.ticket_status).toBe('in_progress');
    expect(store.workCenterById(ticket.work_center_id).operational_status).toBe('fault');
    expect(ticket.scheduled_start_date).toBe(relativeDay(0));
    expect(ticket.scheduled_end_date).toBe(daysFromNow(1));

    const event = store.maintenanceFeed().find((row) => row.id === 'maintenance:mt_1001');
    expect(event).toBeTruthy();
    expect(
      store
        .calendarEventsForMonth(currentMonthKey())
        .some((row) => row.id === 'maintenance:mt_1001'),
    ).toBe(true);

    activateTab('maintenances');
    expect(document.querySelector('[data-maintenance-row="maintenance:mt_1001"]')).toBeTruthy();
    expect(document.querySelector('[data-role="maintenance-block-active"]').textContent).toContain(
      'MTO-1001',
    );
  });

  it('elimina una histórica confirmada de v2 y del calendario', async () => {
    scheduleTicket('mt_1001');
    store.resolveScheduledMaintenance(
      'maintenance:mt_1001',
      { resolvedAt: new Date(Date.now() + 60000).toISOString() },
      'maintenance',
    );

    activateTab('maintenances');
    click('[data-delete-maintenance="maintenance:mt_1001"]');

    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeTruthy(),
    );
    click('[data-role="confirm-dialog"] [data-role="confirm"]');

    await vi.waitFor(() =>
      expect(store.maintenanceTickets.some((row) => row.id === 'mt_1001')).toBe(false),
    );
    const persisted = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    expect(persisted.data.maintenanceTickets.some((row) => row.id === 'mt_1001')).toBe(false);
    expect(
      store
        .calendarEventsForMonth(currentMonthKey())
        .some((row) => row.id === 'maintenance:mt_1001'),
    ).toBe(false);
  });
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

  it('muestra nombres legibles con el ID de auditoría en el título', () => {
    const fault = document.querySelector('[data-fault-ticket="mt_1002"]');
    expect(fault.textContent).toContain('Bruno Díaz');
    expect(fault.textContent).toMatch(/\d+ d \d+ h \d+ min/);

    const eventCell = document.querySelector('[data-ticket-row="mt_1002"] td:nth-child(6)');
    expect(eventCell.getAttribute('title')).toBe('od_1002');
    expect(eventCell.textContent).not.toContain('od_1002');

    const sourceTicket = store.maintenanceTickets.find((ticket) => ticket.id === 'mt_1004');
    const originCell = document.querySelector('[data-preventive-row="pmo_2001"] td:nth-child(6)');
    expect(originCell.getAttribute('title')).toBe('mt_1004');
    expect(originCell.textContent).toContain(sourceTicket.ticket_code);
  });

  it('toma una intervención, la resuelve y conserva el estado tras recargar', () => {
    click('[data-take="mt_1001"]');
    expect(document.querySelector('[data-role="take-form"]')).toBeTruthy();
    fill('[data-role="take-form"]', 'technician_ext_hr_employee_id', 'ext_hr_tec_01');
    submit('[data-role="take-form"]');

    const taken = store.maintenanceTickets.find((t) => t.id === 'mt_1001');
    expect(taken.ticket_status).toBe('in_progress');
    expect(store.workCenterById('wc_solda').operational_status).toBe('fault');
    expect(document.body.textContent).toContain('Ana Soto');
    expect(document.body.textContent).toContain('Intervención iniciada');

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
    expect(document.body.textContent).toContain('Ticket resuelto');

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
    expect(document.body.textContent).toContain('Orden preventiva completada');
  });
});
