import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { CalendarEventDialog } from '../../src/components/calendar/CalendarEventDialog.js';
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

function eventOfKind(kind) {
  const event = store
    .calendarEventsForMonth(currentMonthKey())
    .find((candidate) => candidate.kind === kind);
  expect(event).toBeTruthy();
  return event;
}

function render(event, role, options = {}) {
  const dialog = CalendarEventDialog({ event, role, store, ...options });
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
  vi.restoreAllMocks();
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
  it('muestra detalle de orden, horas editables y cierre sin botón de volver', () => {
    const event = eventOfKind('order');
    const dialog = render(event, 'planner');

    expect(dialog.textContent).toContain(event.title);
    expect(dialog.querySelector('[data-dialog-time="start"]').value).toBe(event.start_time);
    expect(dialog.querySelector('[data-dialog-time="end"]').value).toBe(event.end_time);
    expect(dialog.querySelector('[data-dialog-save]')).toBeTruthy();
    expect(dialog.querySelector('[data-role="event-back"]')).toBeNull();
    expect(dialog.parentElement.querySelector('[data-role="event-dialog-close"]')).toBeTruthy();
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
    const dialog = render(event, 'operator', { operatorId: 'emp_op_01' });

    expect(dialog.textContent).toContain('Solo lectura');
    expect(dialog.querySelector('input, select, textarea, [data-dialog-save]')).toBeNull();
  });

  it('el menú del día enumera todas las tareas resumidas y el popup queda sobre la tabla', () => {
    const date = `${currentMonthKey()}-16`;
    const events = Array.from({ length: 5 }, (_, index) => ({
      id: `overflow:${index}`,
      sourceId: `overflow_${index}`,
      kind: index % 2 === 0 ? 'order' : 'maintenance',
      title: `Tarea completa ${index + 1}`,
      start_date: date,
      end_date: date,
      start_time: '09:00',
      end_time: '18:00',
      is_critical_urgent: false,
    }));
    vi.spyOn(store, 'calendarEventsForMonth').mockReturnValue(events);
    const panel = ProductionSchedulingPanel(store, { role: 'supervisor' });
    document.body.append(panel);

    const day = document.querySelector(`[data-date="${date}"]`);
    expect(day.querySelectorAll('.calendar-event-chip')).toHaveLength(3);
    expect(day.querySelector('.calendar-day__more').textContent.trim()).toBe('+2 más');
    day
      .querySelector('.calendar-day__more')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const menuItems = [...document.querySelectorAll('[data-role="day-menu"] [data-event-id]')];
    expect(menuItems.map((item) => item.textContent)).toEqual(
      events.map((event) => expect.stringContaining(event.title)),
    );

    expect(cssRule('.data-table thead th')).toMatch(/position:\s*sticky/);
    expect(cssRule('.schedule-popup')).toMatch(/z-index:\s*1001/);
    expect(cssRule('.confirm-dialog')).toMatch(/z-index:\s*1100/);
  });
});

describe('Modales centrados del calendario (US-13 / AC-92)', () => {
  function mountPanel(role = 'supervisor') {
    document.body.innerHTML = '';
    const panel = ProductionSchedulingPanel(store, { role, operatorId: 'emp_op_01' });
    document.body.appendChild(panel);
    return panel;
  }

  function clickNode(node) {
    expect(node).toBeTruthy();
    node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  function pressEscape() {
    document.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  }

  function dayWithEvent() {
    const chip = document.querySelector('[data-event-kind]');
    expect(chip).toBeTruthy();
    return chip.closest('.calendar-day');
  }

  function openDayMenu() {
    const day = dayWithEvent();
    clickNode(day);
    return day;
  }

  function openEventFromMenu() {
    openDayMenu();
    const item = document.querySelector('[data-role="day-menu"] [data-event-id]');
    expect(item).toBeTruthy();
    clickNode(item);
  }

  function openScheduleModal() {
    mountPanel('planner');
    clickNode(document.querySelector('.pending-tray__row'));
    const day = document.querySelector(`[data-date="${currentMonthKey()}-24"]`);
    expect(day).toBeTruthy();
    day.dispatchEvent(
      new window.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }),
    );
    document.dispatchEvent(
      new window.MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }),
    );
  }

  it('abre el menú diario como modal en body y lo cierra por botón, Escape y clic fuera', () => {
    mountPanel();
    openDayMenu();
    let backdrop = document.querySelector('[data-role="day-menu-backdrop"]');
    expect(backdrop.classList.contains('modal-backdrop')).toBe(true);
    expect(backdrop.parentElement).toBe(document.body);
    expect(backdrop.querySelector('.modal[data-role="day-menu"]')).toBeTruthy();
    expect(document.querySelector('.calendar-main [data-role="day-menu"]')).toBeNull();
    expect(document.querySelector('.calendar-grid [data-role="day-menu"]')).toBeNull();

    clickNode(backdrop.querySelector('[data-day-menu-close]'));
    expect(document.querySelector('[data-role="day-menu-backdrop"]')).toBeNull();

    clickNode(dayWithEvent());
    pressEscape();
    expect(document.querySelector('[data-role="day-menu-backdrop"]')).toBeNull();

    clickNode(dayWithEvent());
    backdrop = document.querySelector('[data-role="day-menu-backdrop"]');
    clickNode(backdrop);
    expect(document.querySelector('[data-role="day-menu-backdrop"]')).toBeNull();
  });

  it('abre el detalle como modal en body sin Volver y cierra con ×, Escape y clic fuera', () => {
    mountPanel();
    openEventFromMenu();
    let backdrop = document.querySelector('[data-role="event-dialog-backdrop"]');
    expect(backdrop.classList.contains('modal-backdrop')).toBe(true);
    expect(backdrop.parentElement).toBe(document.body);
    expect(backdrop.querySelector('.modal [data-role="event-dialog"]')).toBeTruthy();
    expect(backdrop.querySelector('[data-role="event-dialog"]').getAttribute('draggable')).toBe(
      'false',
    );
    expect(backdrop.textContent).not.toContain('Volver a la lista del día');
    expect(backdrop.querySelector('[data-role="event-back"]')).toBeNull();
    expect(document.querySelector('.calendar-main [data-role="event-dialog"]')).toBeNull();

    clickNode(backdrop.querySelector('[data-role="event-dialog-close"]'));
    expect(document.querySelector('[data-role="event-dialog-backdrop"]')).toBeNull();
    expect(document.querySelector('[data-role="day-menu-backdrop"]')).toBeNull();

    openDayMenu();
    clickNode(document.querySelector('[data-role="day-menu"] [data-event-id]'));
    pressEscape();
    expect(document.querySelector('[data-role="event-dialog-backdrop"]')).toBeNull();
    expect(document.querySelector('[data-role="day-menu-backdrop"]')).toBeNull();

    openDayMenu();
    clickNode(document.querySelector('[data-role="day-menu"] [data-event-id]'));
    backdrop = document.querySelector('[data-role="event-dialog-backdrop"]');
    clickNode(backdrop);
    expect(document.querySelector('[data-role="event-dialog-backdrop"]')).toBeNull();
    expect(document.querySelector('[data-role="day-menu-backdrop"]')).toBeNull();
  });

  it('abre el popup de horario como modal en body y lo cierra por botón, Escape y clic fuera', () => {
    openScheduleModal();
    let backdrop = document.querySelector('[data-role="schedule-popup-backdrop"]');
    expect(backdrop.classList.contains('modal-backdrop')).toBe(true);
    expect(backdrop.parentElement).toBe(document.body);
    expect(backdrop.querySelector('.modal[data-role="schedule-popup"]')).toBeTruthy();
    expect(backdrop.querySelector('[data-schedule-time="start"]').value).toBe('08:00');
    expect(backdrop.querySelector('[data-schedule-time="end"]').value).toBe('16:00');
    expect(document.querySelector('.calendar-main [data-role="schedule-popup"]')).toBeNull();

    clickNode(backdrop.querySelector('[data-role="schedule-popup-close"]'));
    expect(document.querySelector('[data-role="schedule-popup-backdrop"]')).toBeNull();

    openScheduleModal();
    pressEscape();
    expect(document.querySelector('[data-role="schedule-popup-backdrop"]')).toBeNull();

    openScheduleModal();
    backdrop = document.querySelector('[data-role="schedule-popup-backdrop"]');
    clickNode(backdrop);
    expect(document.querySelector('[data-role="schedule-popup-backdrop"]')).toBeNull();
  });

  it('reserva las capas 1000 y 1001 para los modales', () => {
    expect(cssRule('.modal-backdrop')).toMatch(/z-index:\s*1000/);
    expect(cssRule('.modal')).toMatch(/z-index:\s*1001/);
  });
});
