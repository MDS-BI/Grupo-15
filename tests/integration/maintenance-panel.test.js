import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

function clickNode(node) {
  expect(node).toBeTruthy();
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function click(selector) {
  clickNode(document.querySelector(selector));
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

function selectMachine(id = 'wc_solda') {
  activateTab('machines');
  click(`[data-role="machine-row"][data-machine-id="${id}"]`);
}

function search(selector, value) {
  const input = document.querySelector(selector);
  expect(input).toBeTruthy();
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function change(selector, value) {
  const input = document.querySelector(selector);
  expect(input).toBeTruthy();
  input.value = value;
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function scheduleTicket(ticketId = 'mt_1001') {
  activateTab('tickets');
  click(`[data-schedule-ticket="${ticketId}"]`);
  expect(document.querySelector('[data-role="schedule-form"]')).toBeTruthy();
  fill('[data-role="schedule-form"]', 'technician_ext_hr_employee_id', 'ext_hr_tec_01');
  fill('[data-role="schedule-form"]', 'scheduledStartDate', relativeDay(0));
  fill('[data-role="schedule-form"]', 'scheduledEndDate', daysFromNow(1));
  submit('[data-role="schedule-form"]');
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

describe('Panel de mantenimiento · cabecera y máquinas (T242, T266-T271)', () => {
  it('elimina los filtros globales y conserva las tres subpestañas', () => {
    expect(document.querySelector('.maintenance-filters')).toBeNull();
    expect(document.querySelector('[data-role="filter-status"]')).toBeNull();
    expect(document.querySelector('[data-role="filter-priority"]')).toBeNull();
    expect(document.querySelector('[data-role="filter-work-center"]')).toBeNull();
    expect(document.querySelector('.view__header h1').textContent).toBe('Mantenimiento');
    expect(
      [...document.querySelectorAll('[data-role="maintenance-tab"]')].map((tab) =>
        tab.textContent.trim(),
      ),
    ).toEqual(['Máquinas', 'Tickets', 'Mantenimientos']);
  });

  it('muestra dos paneles con el detalle vacío y la alerta dentro de la lista', () => {
    const layout = document.querySelector('.maintenance-machines-layout');
    expect(layout).toBeTruthy();
    const list = layout.querySelector('.maintenance-machines-list');
    const detail = layout.querySelector('.maintenance-machine-detail');
    expect(list).toBeTruthy();
    expect(detail).toBeTruthy();
    expect(detail.innerHTML.trim()).toBe('');
    expect(list.querySelector('[data-role="machine-alert"]')).toBeTruthy();
    expect(document.querySelector('.fault-banner')).toBeNull();
    expect(document.querySelector('[data-role="history"]')).toBeNull();
    expect(document.querySelector('[data-role="preventive-list"]')).toBeNull();
    expect(document.querySelector('.machine-calendar')).toBeNull();
  });

  it('busca por nombre o código, filtra por sección y por los cinco estados exactos', () => {
    expect(
      [...document.querySelectorAll('[data-role="machine-status-filter"] option')].map((option) =>
        option.textContent.trim(),
      ),
    ).toEqual(['Todos', 'Disponible', 'En operación', 'En mantención', 'Detenida / En fallo']);

    search('[data-role="maintenance-search-machines"]', 'Armado');
    expect([...document.querySelectorAll('[data-role="machine-row"]')]).toHaveLength(1);
    expect(document.querySelector('[data-role="machine-row"]').dataset.machineId).toBe('wc_armado');

    search('[data-role="maintenance-search-machines"]', 'CT-ARM');
    expect(document.querySelectorAll('[data-role="machine-row"]')).toHaveLength(1);

    search('[data-role="maintenance-search-machines"]', '');
    change('[data-role="machine-section-filter"]', 'soldadura');
    expect(document.querySelectorAll('[data-role="machine-row"]')).toHaveLength(2);

    change('[data-role="machine-section-filter"]', '');
    change('[data-role="machine-status-filter"]', 'fault');
    expect(
      [...document.querySelectorAll('[data-role="machine-row"]')].map(
        (row) => row.dataset.machineId,
      ),
    ).toEqual(['wc_corte']);
  });

  it('selecciona, expande el detalle consolidado y restaura el estado al deseleccionar', async () => {
    selectMachine('wc_solda');
    const layout = document.querySelector('.maintenance-machines-layout');
    expect(layout.classList.contains('is-selected')).toBe(true);
    const row = document.querySelector('[data-machine-id="wc_solda"]');
    expect(row.getAttribute('aria-expanded')).toBe('true');

    const detail = document.querySelector('.maintenance-machine-detail');
    expect(detail.textContent).toContain('Estación de Soldadura 1');
    expect(detail.textContent).toContain('Disponible');
    expect(detail.textContent).toContain('Cada cuánto se recomienda mantención');
    expect(detail.querySelector('[data-role="frequency-input"]')).toBeTruthy();
    expect(detail.textContent).toMatch(/Desgaste|Indicador de desgaste/);
    expect(detail.textContent).toMatch(/Bajo|Medio|Alto/);
    expect(detail.textContent).toContain('Historial de fallas');
    expect(
      [...detail.querySelectorAll('button')].some((button) =>
        button.textContent.includes('Programar preventiva'),
      ),
    ).toBe(true);
    expect(
      [...detail.querySelectorAll('button')].some((button) =>
        button.textContent.includes('Revisar históricas'),
      ),
    ).toBe(true);

    const deselect = [...detail.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Deseleccionar'),
    );
    clickNode(deselect);
    expect(
      document.querySelector('.maintenance-machines-layout').classList.contains('is-selected'),
    ).toBe(false);
    expect(document.querySelector('.maintenance-machine-detail').innerHTML.trim()).toBe('');
    expect(
      document.querySelector('[data-machine-id="wc_solda"]').getAttribute('aria-expanded'),
    ).toBe('false');
    expect(document.activeElement.dataset.machineId).toBe('wc_solda');
  });

  it('deselecciona al hacer clic fuera, pero no en modales ni en la navegación del mini-calendario', () => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal';
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    selectMachine('wc_armado');
    click('.modal');
    expect(
      document.querySelector('.maintenance-machines-layout').classList.contains('is-selected'),
    ).toBe(true);

    click('[data-machine-calendar-nav="prev"]');
    expect(
      document.querySelector('.maintenance-machines-layout').classList.contains('is-selected'),
    ).toBe(true);

    clickNode(document.body);
    expect(
      document.querySelector('.maintenance-machines-layout').classList.contains('is-selected'),
    ).toBe(false);
    expect(document.querySelector('.maintenance-machine-detail').innerHTML.trim()).toBe('');
    backdrop.remove();
  });
});

describe('Mini-calendario de máquina (T243, T272)', () => {
  it('aparece solo con selección, con meses navegables, columnas y celdas informativas', () => {
    activateTab('machines');
    expect(document.querySelector('.machine-calendar')).toBeNull();
    selectMachine('wc_solda');

    const calendar = document.querySelector('.machine-calendar');
    expect(calendar).toBeTruthy();
    expect(document.querySelector('.maintenance-machines-layout').nextElementSibling).toBe(
      calendar,
    );
    expect(
      calendar.querySelector('[data-role="machine-calendar-label"]').textContent.trim(),
    ).not.toBe('');
    expect(calendar.querySelectorAll('[data-machine-calendar-nav]')).toHaveLength(2);
    expect(
      [...calendar.querySelectorAll('.machine-calendar__weekday')].map((node) => node.textContent),
    ).toEqual(['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D']);

    const cells = [...calendar.querySelectorAll('[data-machine-calendar-cell]')];
    expect(cells.length).toBeGreaterThanOrEqual(28);
    cells.forEach((cell) => {
      expect(cell.querySelector('button')).toBeNull();
      expect(cell.hasAttribute('onclick')).toBe(false);
      expect(cell.getAttribute('role')).not.toBe('button');
      expect(cell.getAttribute('tabindex')).toBeNull();
    });

    const label = calendar.querySelector('[data-role="machine-calendar-label"]').textContent;
    click('[data-machine-calendar-nav="next"]');
    expect(document.querySelector('[data-role="machine-calendar-label"]').textContent).not.toBe(
      label,
    );
    expect(
      document.querySelector('.maintenance-machines-layout').classList.contains('is-selected'),
    ).toBe(true);
  });

  it('muestra la leyenda visible de los cuatro estados', () => {
    selectMachine('wc_armado');
    const legend = document.querySelector('.machine-calendar__legend');
    expect(legend).toBeTruthy();
    expect(legend.textContent).toContain('Sin plan');
    expect(legend.textContent).toContain('Correctiva / Fallo');
    expect(legend.textContent).toContain('Orden de trabajo');
    expect(legend.textContent).toContain('Preventiva');
    expect(legend.querySelector('.machine-calendar__legend-swatch--none')).toBeTruthy();
    expect(legend.querySelector('.machine-calendar__legend-swatch--corrective')).toBeTruthy();
    expect(legend.querySelector('.machine-calendar__legend-swatch--planned_use')).toBeTruthy();
    expect(legend.querySelector('.machine-calendar__legend-swatch--preventive')).toBeTruthy();
  });
});

describe('Tickets y mantenciones (T244, T245, T273, T274)', () => {
  it('muestra tabla con buscador y detalle desplegable sin acciones obsoletas', () => {
    activateTab('tickets');
    const panel = document.querySelector('[data-panel="tickets"]');
    expect(panel.textContent).not.toContain('Resolver');
    expect(panel.textContent).not.toContain('Tomar intervención');
    expect([...panel.querySelectorAll('thead th')].map((th) => th.textContent)).not.toContain(
      'Acción',
    );
    expect(document.querySelectorAll('[data-schedule-ticket]')).toHaveLength(
      store.maintenanceTickets.length,
    );

    click('[data-ticket-row="mt_1001"]');
    const detail = document.querySelector('[data-role="ticket-detail"]');
    expect(detail.textContent).toContain('MTO-1001');
    expect(detail.textContent).toContain('Historial de fallas');
    expect(detail.textContent).toContain('Historial completo de mantenciones');
    expect(detail.textContent).toMatch(/Indicador de desgaste|Bajo|Medio|Alto/);
    expect(detail.textContent).not.toContain('Tomar intervención');
    expect(detail.textContent).not.toContain('Resolver');
    expect(detail.textContent).toContain('Programar mantención');
  });

  it('programa la mantención de un ticket y la refleja en calendario y activos', () => {
    scheduleTicket('mt_1001');

    const ticket = store.maintenanceTickets.find((row) => row.id === 'mt_1001');
    expect(ticket.ticket_status).toBe('in_progress');
    expect(store.workCenterById(ticket.work_center_id).operational_status).toBe('fault');
    expect(ticket.scheduled_start_date).toBe(relativeDay(0));
    expect(ticket.scheduled_end_date).toBe(daysFromNow(1));
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

  it('tiene exactamente dos listas buscables con filtro de vigencia', () => {
    activateTab('maintenances');
    expect(document.querySelectorAll('[data-role="maintenance-block-search"]')).toHaveLength(2);
    expect(document.querySelector('[data-role="maintenance-block-active"] h2').textContent).toBe(
      'Mantenimientos activos',
    );
    expect(document.querySelector('[data-role="maintenance-block-history"] h2').textContent).toBe(
      'Mantenimientos históricos',
    );
    expect(
      [...document.querySelectorAll('[data-role="maintenance-status-filter"] option')].map(
        (option) => option.textContent.trim(),
      ),
    ).toEqual(['Todos', 'Vigentes', 'Vencidos']);

    search('[data-role="maintenance-search-active"]', 'MTO-1001');
    expect(
      document.querySelectorAll('[data-role="maintenance-block-active"] [data-maintenance-row]'),
    ).toHaveLength(1);
    expect(document.body.textContent).toContain('MTO-1001');

    search('[data-role="maintenance-search-active"]', '');
    change('[data-role="maintenance-status-filter"]', 'vencidos');
    expect(document.querySelectorAll('[data-maintenance-row]').length).toBeGreaterThan(0);
    change('[data-role="maintenance-status-filter"]', 'todos');
  });

  it('mueve una activa resuelta al histórico y elimina una histórica confirmada', async () => {
    scheduleTicket('mt_1001');
    activateTab('maintenances');
    click('[data-resolve-scheduled="maintenance:mt_1001"]');
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeTruthy(),
    );
    click('[data-role="confirm-dialog"] [data-role="confirm"]');
    await vi.waitFor(() =>
      expect(document.querySelector('[data-maintenance-row="maintenance:mt_1001"]')).toBeTruthy(),
    );
    expect(document.querySelector('[data-role="maintenance-block-history"]').textContent).toContain(
      'MTO-1001',
    );

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

  it('prellena y enfoca el buscador histórico desde Revisar históricas', () => {
    selectMachine('wc_armado');
    click('.maintenance-machine-detail [data-role="review-history"]');

    expect(
      document
        .querySelector('[data-role="maintenance-tab"][data-tab="maintenances"]')
        .getAttribute('aria-selected'),
    ).toBe('true');
    const searchEl = document.querySelector('[data-role="maintenance-search-history"]');
    expect(searchEl.value).toBe('Línea de Armado');
    expect(document.activeElement).toBe(searchEl);
    expect(document.querySelector('[data-role="maintenance-block-history"]').textContent).toContain(
      'Línea de Armado',
    );
  });
});

describe('Estilos requeridos por el rediseño (T275)', () => {
  const css = () => readFileSync(resolve(process.cwd(), 'src/styles/manufacturing.css'), 'utf8');

  it('define la transición y la proporción 0.85fr 1.15fr al seleccionar', () => {
    const styles = css();
    expect(styles).toMatch(
      /\.maintenance-machines-layout\s*\{[^}]*transition\s*:\s*[^;}]*grid-template-columns/,
    );
    expect(styles).toMatch(
      /\.maintenance-machines-layout\.is-selected\s*\{[^}]*grid-template-columns\s*:\s*0\.85fr\s+1\.15fr/,
    );
  });

  it('define los colores exactos de la leyenda del mini-calendario', () => {
    const styles = css();
    expect(styles).toMatch(
      /\.machine-calendar__legend-swatch--corrective\s*\{[^}]*background-color\s*:\s*#dc2626/,
    );
    expect(styles).toMatch(
      /\.machine-calendar__legend-swatch--planned_use\s*\{[^}]*background-color\s*:\s*#2563eb/,
    );
    expect(styles).toMatch(
      /\.machine-calendar__legend-swatch--preventive\s*\{[^}]*background-color\s*:\s*#7c3aed/,
    );
  });
});
