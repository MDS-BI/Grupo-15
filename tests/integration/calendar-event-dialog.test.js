import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { CalendarEventDialog } from '../../src/components/calendar/CalendarEventDialog.js';

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

function eventOfKind(kind) {
  const event = store
    .calendarEventsForMonth(currentMonthKey())
    .find((candidate) => candidate.kind === kind);
  expect(event).toBeTruthy();
  return event;
}

function render(event, role, onBack = vi.fn(), options = {}) {
  const dialog = CalendarEventDialog({ event, role, store, onBack, ...options });
  document.body.appendChild(dialog);
  return dialog;
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.FormData = dom.window.FormData;
  store = new ManufacturingStore({ storage: memoryStorage() });
});

afterEach(() => {
  vi.useRealTimers();
  dom.window.close();
});

function localInput(date) {
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function activeMaintenanceEvent(overrides = {}) {
  return {
    id: 'maintenance:mt_1002',
    kind: 'maintenance',
    sourceId: 'mt_1002',
    title: 'MTO-1002 · Vibración anómala',
    maintenanceType: 'ticket',
    status: 'in_progress',
    work_center_id: 'wc_corte',
    work_center_name: 'Estación de Corte',
    technician_name: 'Bruno Díaz',
    technician_ext_hr_employee_id: 'ext_hr_tec_02',
    priority: 'high',
    start_date: '2030-05-01',
    end_date: '2030-05-02',
    start_time: '08:00',
    end_time: '16:00',
    scheduled_start_date: '2030-05-01',
    scheduled_end_date: '2030-05-02',
    intervention_started_at: '2030-05-01T08:00:00Z',
    downtime_minutes: 45,
    ...overrides,
  };
}

describe('CalendarEventDialog - resolución de mantenciones (US-15)', () => {
  it('muestra tiempo parado, técnico y prioridad solo para maintenance con acción Resolver', () => {
    const dialog = render(activeMaintenanceEvent(), 'maintenance');
    expect(dialog.textContent).toContain('0 d 0 h 45 min');
    expect(dialog.textContent).toContain('Bruno Díaz');
    expect(dialog.textContent).toContain('Alta');
    expect(dialog.querySelector('[data-role="resolve-maintenance"]')).toBeTruthy();
  });

  it('abre el popup con mensaje exacto y hora actual editable al hacer clic', () => {
    const now = new Date(2030, 4, 6, 14, 35, 0);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const dialog = render(activeMaintenanceEvent(), 'maintenance');
    dialog
      .querySelector('[data-role="resolve-maintenance"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    const popup = dialog.querySelector('[data-role="resolve-popup"]');
    expect(popup).toBeTruthy();
    expect(popup.querySelector('[data-role="resolve-message"]').textContent).toBe(
      '¿Está seguro que quiere resolver esta mantención?',
    );
    const input = popup.querySelector('[name="resolvedAt"]');
    expect(input.type).toBe('datetime-local');
    expect(input.value).toBe(localInput(now));
    expect(input.value).not.toBe('2030-05-02T08:00');
  });

  it('resuelve con la marca elegida y deja el evento en solo lectura', () => {
    const now = new Date(2030, 4, 6, 14, 35, 0);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const dialog = render(activeMaintenanceEvent(), 'maintenance');
    dialog
      .querySelector('[data-role="resolve-maintenance"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const input = dialog.querySelector('[data-role="resolve-popup"] [name="resolvedAt"]');
    input.value = '2030-05-06T15:00';
    dialog
      .querySelector('[data-role="resolve-form"]')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    expect(store.maintenanceTickets.find((row) => row.id === 'mt_1002').ticket_status).toBe(
      'resolved',
    );
    expect(dialog.querySelector('[data-role="resolve-maintenance"]')).toBeNull();
    expect(dialog.textContent).toContain('Solo lectura');
  });

  it('no ofrece Resolver a otros roles ni a eventos ya resueltos', () => {
    expect(
      render(activeMaintenanceEvent(), 'plant_manager').querySelector(
        '[data-role="resolve-maintenance"]',
      ),
    ).toBeNull();
    const resolved = render(
      activeMaintenanceEvent({ status: 'resolved', resolved_at: '2030-05-02T10:00:00Z' }),
      'maintenance',
    );
    expect(resolved.querySelector('[data-role="resolve-maintenance"]')).toBeNull();
    expect(resolved.textContent).toContain('Solo lectura');
  });
});

describe('CalendarEventDialog (US-13)', () => {
  it('muestra detalle de orden, horas editables y botón de volver', () => {
    const event = eventOfKind('order');
    const onBack = vi.fn();
    const dialog = render(event, 'planner', onBack);

    expect(dialog.textContent).toContain(event.title);
    expect(dialog.querySelector('[data-dialog-time="start"]').value).toBe(event.start_time);
    expect(dialog.querySelector('[data-dialog-time="end"]').value).toBe(event.end_time);
    expect(dialog.querySelector('[data-dialog-save]')).toBeTruthy();

    dialog
      .querySelector('[data-role="event-back"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('muestra detalle de mantención en modo solo lectura', () => {
    const event = eventOfKind('maintenance');
    const dialog = render(event, 'maintenance');

    expect(dialog.textContent).toContain(event.title);
    expect(dialog.textContent).toContain('Mantención');
    expect(dialog.querySelector('[data-dialog-save]')).toBeNull();
  });

  it('supervisor ve nombres con etiqueta SC-08, alerta y sin inputs de guardar', () => {
    const event = { ...eventOfKind('order'), operator_name: null };
    const dialog = render(event, 'supervisor');

    expect(dialog.textContent).toContain('solo contexto operativo — no evaluación de desempeño');
    expect(dialog.textContent).toContain('sin operador asignado');
    expect(
      dialog.querySelector('input, select, textarea, [data-schedule-save], [data-dialog-save]'),
    ).toBeNull();
  });

  it('operator ve el detalle en solo lectura', () => {
    const event = eventOfKind('order');
    const dialog = render(event, 'operator', vi.fn(), { operatorId: 'emp_op_01' });

    expect(dialog.textContent).toContain('Solo lectura');
    expect(dialog.querySelector('input, select, textarea, [data-dialog-save]')).toBeNull();
  });
});
