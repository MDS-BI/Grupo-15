import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { OperatorWorkstationPanel } from '../../src/components/OperatorWorkstationPanel.js';
import { SupervisorLinePanel } from '../../src/components/SupervisorLinePanel.js';
import { ProductionOrders } from '../../src/components/ProductionOrders.js';
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

function dragOrderTo(orderId, status) {
  const card = document.querySelector(`[data-order="${orderId}"]`);
  const column = document.querySelector(`.kanban-col[data-status="${status}"] .kanban-col__body`);
  expect(card).toBeTruthy();
  expect(column).toBeTruthy();
  const dataTransfer = {
    values: {},
    setData(type, value) {
      this.values[type] = value;
    },
    getData(type) {
      return this.values[type] || '';
    },
    effectAllowed: '',
    dropEffect: '',
  };
  const event = (name) => {
    const evt = new window.Event(name, { bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'dataTransfer', { value: dataTransfer });
    return evt;
  };
  card.dispatchEvent(event('dragstart'));
  const dragover = event('dragover');
  column.dispatchEvent(dragover);
  column.dispatchEvent(event('drop'));
  card.dispatchEvent(event('dragend'));
  return dragover;
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

describe('Estación del operador (US-06)', () => {
  it('muestra la operación activa, cierra el atraso y finaliza con confirmación', () => {
    document.body.appendChild(OperatorWorkstationPanel(store));
    expect(document.body.textContent).toContain('no evaluación de desempeño');
    expect(document.body.textContent).not.toMatch(/ranking/i);
    expect(document.querySelector('[data-role="operation-select"]').value).toBe('poo_3002_2');
    expect(document.body.textContent).toContain('Operación 20');
    expect(document.querySelector('[data-delay-row]')).toBeTruthy();
    expect(document.querySelector('[data-delay-row] td[title]').getAttribute('title')).toBe(
      'od_1001',
    );
    expect(document.querySelector('[data-role="close-delay"]').disabled).toBe(false);

    click('[data-role="close-delay"]');
    expect(store.openDelayFor('poo_3002_2')).toBeNull();
    expect(document.body.textContent).toContain('Atraso cerrado');

    click('[data-role="toggle"]');
    expect(document.querySelector('[data-role="finish-confirmation"]')).toBeTruthy();
    click('[data-role="confirm-finish"]');
    expect(store.productionOrderOperations.find((op) => op.id === 'poo_3002_2').status).toBe(
      'completed',
    );
    expect(document.querySelector('[data-role="finish-confirmation"]')).toBeNull();
  });

  it('inicia turno, actualiza contador y abre el diálogo de corrección al cerrar', () => {
    document.body.appendChild(OperatorWorkstationPanel(store));
    change('[data-role="operation-select"]', 'poo_3003_1');

    click('[data-role="toggle"]');
    const shift = store.activeShiftFor('poo_3003_1');
    expect(shift).toBeTruthy();
    expect(document.querySelector('[data-role="toggle"]').getAttribute('aria-pressed')).toBe(
      'true',
    );

    click('[data-counter="inc"]');
    expect(document.querySelector('[data-role="shift-counter"]').textContent).toBe('1');
    expect(document.querySelector('[data-role="toast"]').textContent).toContain(
      'Contador del turno actualizado',
    );

    change('[data-role="delay-reason"]', 'dr_falta_material');
    click('[data-role="start-delay"]');
    expect(store.openDelayFor('poo_3003_1')).toBeTruthy();

    click('[data-role="toggle"]');
    click('[data-role="confirm-finish"]');
    expect(document.querySelector('[data-role="delay-correction"]')).toBeTruthy();
    expect(document.querySelector('[data-correction-form]')).toBeTruthy();
  });

  it('rechaza fijar un acumulado superior al planificado', () => {
    document.body.appendChild(OperatorWorkstationPanel(store));
    change('[data-role="operation-select"]', 'poo_3003_1');
    click('[data-role="toggle"]');

    fill('[data-role="counter-input"]', '101');
    click('[data-role="set-counter"]');

    expect(document.querySelector('[data-role="error"]').textContent).toContain('superar');
    expect(
      store.productionOrderOperations.find((op) => op.id === 'poo_3003_1').quantity_completed,
    ).toBe(0);
  });
});

describe('Tablero de órdenes', () => {
  it('permite arrastrar una orden a la siguiente columna válida', () => {
    document.body.appendChild(ProductionOrders(store));
    expect(store.orderById('po_3004').status).toBe('planned');

    const dragover = dragOrderTo('po_3004', 'released');

    expect(dragover.defaultPrevented).toBe(true);
    expect(store.orderById('po_3004').status).toBe('released');
    expect(
      document.querySelector('[data-order="po_3004"]').closest('.kanban-col').dataset.status,
    ).toBe('released');
  });

  it('no permite saltos de estado inválidos', () => {
    document.body.appendChild(ProductionOrders(store));
    const dragover = dragOrderTo('po_3004', 'completed');

    expect(dragover.defaultPrevented).toBe(false);
    expect(store.orderById('po_3004').status).toBe('planned');
  });

  it('filtra el kanban por número, producto y prioridad', () => {
    document.body.appendChild(ProductionOrders(store));
    const search = document.querySelector('[data-role="kanban-search"]');
    const priority = document.querySelector('[data-role="kanban-priority"]');

    search.value = 'OP-3004';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(document.querySelectorAll('[data-order]')).toHaveLength(1);
    expect(document.querySelector('[data-order="po_3004"]')).toBeTruthy();

    search.value = 'Rueda Armada';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(document.querySelectorAll('[data-order]')).toHaveLength(1);
    expect(document.querySelector('[data-order="po_3004"]')).toBeTruthy();

    search.value = '';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    priority.value = 'high';
    priority.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(document.querySelectorAll('[data-order]')).toHaveLength(3);

    search.value = 'OP-3004';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(document.querySelectorAll('[data-order]')).toHaveLength(0);
  });
});

describe('Supervisión de línea (US-07)', () => {
  it('muestra semáforos, asigna operario y escala un incidente', () => {
    document.body.appendChild(SupervisorLinePanel(store));
    expect(document.querySelectorAll('[data-wc]')).toHaveLength(6);
    const activeCell = document.querySelector('[data-wc="wc_armado"] td[title]');
    expect(activeCell.getAttribute('title')).toContain('poo_');
    expect(document.querySelector('[data-light="wc_corte"]').textContent).toBe('En fallo');
    expect(document.querySelector('[data-light="wc_armado"]').textContent).toBe('En operación');

    change('[data-role="assign-form"] [name="work_center_id"]', 'wc_pintura');
    change('[data-role="assign-form"] [name="ext_hr_employee_id"]', 'emp_op_05');
    change('[data-role="assign-form"] [name="shift_band"]', 'morning');
    submit('[data-role="assign-form"]');
    expect(store.activeAssignmentForWorkCenter('wc_pintura').ext_hr_employee_id).toBe('emp_op_05');
    expect(document.body.textContent).toContain('Operador asignado');

    click('[data-escalate="wc_pintura"]');
    fill('[data-role="escalate-form"] [name="description"]', 'Fuga de pintura');
    submit('[data-role="escalate-form"]');
    expect(
      store.maintenanceTickets.some(
        (ticket) => ticket.priority === 'urgent' && ticket.description === 'Fuga de pintura',
      ),
    ).toBe(true);
    expect(store.workCenterById('wc_pintura').operational_status).toBe('fault');
    expect(document.body.textContent).toContain('Incidente escalado');
  });

  it('valida un cierre pendiente desde la bandeja', () => {
    document.body.appendChild(SupervisorLinePanel(store));
    store.finishOperation('poo_3002_2', { now: '2026-10-17T12:00:00Z' });
    store.correctOpenDelay('od_1001', { endedAt: '2026-10-17T11:00:00Z' });

    expect(document.querySelector('[data-shift-row="sh_3002_2"]')).toBeTruthy();
    click('[data-validate="sh_3002_2"]');
    expect(
      store.productionShifts.find((shift) => shift.id === 'sh_3002_2').supervisor_validated,
    ).toBe(true);
  });
});

describe('Integración de estación y supervisión en órdenes (T021/T031)', () => {
  it('abre ambos paneles embebidos desde el detalle de una orden', () => {
    document.body.appendChild(ProductionOrders(store));
    click('[data-order="po_3002"]');
    const operationRow = document.querySelector('[data-op]');
    expect(operationRow.querySelector('td[title]').getAttribute('title')).toBe(
      operationRow.dataset.op,
    );
    click('[data-role="open-operator"]');
    expect(document.querySelector('[data-role="embedded-panel"]')).toBeTruthy();
    expect(document.querySelector('[data-role="embedded-body"]').textContent).toContain(
      'Estación del Operador',
    );
    click('[data-role="close-embedded"]');
    expect(document.querySelector('[data-role="embedded-panel"]')).toBeNull();

    click('[data-role="open-supervisor"]');
    expect(document.querySelector('[data-role="embedded-body"]').textContent).toContain(
      'Supervisión de Línea',
    );
  });
});

describe('Estaciones derivadas del BOM (US-14)', () => {
  function orderEvent() {
    const order = store.orderById('po_3002');
    return {
      kind: 'order',
      sourceId: order.id,
      title: `${order.order_number} · Bicicleta`,
      status: order.status,
      priority: order.priority,
      start_date: order.planned_start_date,
      end_date: order.planned_end_date,
      start_time: '08:00',
      end_time: '16:00',
      work_center_id: 'wc_corte',
      work_center_name: 'Estación de Corte',
      operator_name: 'Diego Fuentes',
    };
  }

  it('muestra Secuencia <N> sin doble numeración y abre la edición solo para roles permitidos', () => {
    store.ensureBomStationsForOrder('po_3002');
    store.setOrderStationStaffing('po_3002', [
      {
        work_center_id: 'wc_corte',
        sequence: 10,
        operator_ext_hr_employee_ids: ['emp_op_01', 'emp_op_02'],
      },
      {
        work_center_id: 'wc_armado',
        sequence: 20,
        operator_ext_hr_employee_ids: ['emp_op_03'],
      },
      {
        work_center_id: 'wc_calidad',
        sequence: 30,
        operator_ext_hr_employee_ids: [],
      },
    ]);
    const event = orderEvent();

    document.body.appendChild(CalendarEventDialog({ event, role: 'supervisor', store }));
    const stations = document.querySelectorAll('[data-role="order-station"]');
    expect(stations).toHaveLength(3);
    expect(stations[0].getAttribute('title')).toContain('Estación de Corte');
    expect(stations[0].textContent).toContain('Secuencia 10');
    expect(stations[0].textContent).toContain('2 trabajadores');
    expect(stations[0].textContent).not.toMatch(/\b1\.\s/);

    click('[data-role="edit-stations"]');
    expect(window.location.hash).toBe('#/supervision');
    expect(store.focusedStationOrderId).toBe('po_3002');

    document.body.innerHTML = '';
    document.body.appendChild(CalendarEventDialog({ event, role: 'planner', store }));
    expect(document.querySelector('[data-role="edit-stations"]')).toBeNull();
  });

  it('edita dotación desde supervisión y mantiene órdenes sin controles de dotación', () => {
    store.ensureBomStationsForOrder('po_3002');
    store.focusedStationOrderId = 'po_3002';
    document.body.appendChild(SupervisorLinePanel(store));

    expect(document.querySelector('[data-role="station-editor"]')).toBeTruthy();
    expect(document.body.textContent).toContain('OP-3002');
    expect(document.querySelectorAll('[data-station-id]')).toHaveLength(3);

    const operatorSelect = document.querySelector('[data-station-operators="wc_calidad"]');
    expect(operatorSelect).toBeTruthy();
    Array.from(operatorSelect.options).forEach((option) => {
      option.selected = option.value === 'emp_op_04';
    });
    operatorSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    click('[data-role="save-stations"]');

    const calidad = store
      .orderStationsFor('po_3002')
      .find((row) => row.work_center_id === 'wc_calidad');
    expect(calidad.operator_ext_hr_employee_ids).toEqual(['emp_op_04']);
    expect(document.body.textContent).toContain('Estaciones guardadas');

    document.body.innerHTML = '';
    document.body.appendChild(ProductionOrders(store));
    expect(document.querySelector('[data-role="kanban-search"]')).toBeTruthy();
    expect(document.querySelector('[data-role="kanban-priority"]')).toBeTruthy();
    expect(
      document.querySelector(
        '[data-role="station-editor"], [data-role="edit-stations"], [data-role="order-station"], [data-station-id], [data-station-operators]',
      ),
    ).toBeNull();
  });
});
