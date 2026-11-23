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
  dom.window.close();
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
