import { describe, it, expect, beforeEach } from 'vitest';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
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

let store;
beforeEach(() => {
  store = new ManufacturingStore();
});

describe('ManufacturingStore - US-06 turnos y atrasos', () => {
  it('ejecuta el ciclo de turno con contador y atraso cerrado', () => {
    const { shift } = store.startShift('poo_3003_1', {
      operator_id: 'emp_op_03',
      now: '2026-11-03T08:00:00Z',
    });
    expect(shift.status).toBe('in_progress');
    expect(shift.shift_number).toBe(1);
    expect(store.orderById('po_3003').status).toBe('in_progress');

    expect(store.reasonsForShift(shift.id).map((reason) => reason.id)).toContain(
      'dr_falta_material',
    );

    const delay = store.startDelay('poo_3003_1', {
      reasonId: 'dr_falta_material',
      note: 'Espera de tubos',
      now: '2026-11-03T09:00:00Z',
    });
    expect(store.openDelayFor('poo_3003_1').id).toBe(delay.id);
    expect(() => store.startDelay('poo_3003_1', { reasonId: 'dr_falla_maquina' })).toThrow(
      /ya existe un atraso abierto/i,
    );

    expect(store.adjustShiftCounter('poo_3003_1', 5)).toEqual({
      shiftQuantity: 5,
      cumulativeQuantity: 5,
    });
    expect(() => store.adjustShiftCounter('poo_3003_1', -6)).toThrow(/negativo/);
    store.setShiftCounter('poo_3003_1', 8);

    store.closeDelay(delay.id, { endedAt: '2026-11-03T09:30:00Z' });
    expect(delay.duration_minutes).toBe(30);
    expect(
      store.productionOrderOperations.find((op) => op.id === 'poo_3003_1').delay_time_minutes,
    ).toBe(30);

    const result = store.finishOperation('poo_3003_1', { now: '2026-11-03T11:00:00Z' });
    expect(result.openDelays).toEqual([]);
    expect(result.operation.actual_time_minutes).toBe(150);
    expect(store.activeShiftFor('poo_3003_1')).toBeNull();
  });

  it('rechaza contadores que superan la cantidad planificada', () => {
    store.startShift('poo_3003_1', { operator_id: 'emp_op_03' });
    store.adjustShiftCounter('poo_3003_1', 99);

    expect(() => store.adjustShiftCounter('poo_3003_1', 2)).toThrow(/superar/);
    expect(() => store.setShiftCounter('poo_3003_1', 101)).toThrow(/superar/);
    expect(store.activeShiftFor('poo_3003_1').quantity_counted).toBe(99);
    expect(
      store.productionOrderOperations.find((op) => op.id === 'poo_3003_1').quantity_completed,
    ).toBe(99);
  });

  it('conserva el acumulado al completar una operación', () => {
    const opId = 'poo_3001_1';
    const before = store.productionOrderOperations.find((op) => op.id === opId).quantity_completed;
    store.completeOperation(opId, { actual_time_minutes: 10, quantity_completed: 0 });
    expect(store.productionOrderOperations.find((op) => op.id === opId).quantity_completed).toBe(
      before,
    );
  });

  it('finaliza con atraso abierto y permite corregirlo después', () => {
    const result = store.finishOperation('poo_3002_2', { now: '2026-10-17T12:00:00Z' });
    expect(result.openDelays.map((delay) => delay.id)).toEqual(['od_1001']);
    expect(store.shiftsPendingValidation().map((shift) => shift.id)).not.toContain('sh_3002_2');

    const corrected = store.correctOpenDelay('od_1001', {
      endedAt: '2026-10-17T11:00:00Z',
      note: 'Corrección de cierre',
      correctedBy: 'emp_sup_01',
    });
    expect(corrected.status).toBe('closed');
    expect(corrected.duration_minutes).toBe(120);
    expect(corrected.correction_note).toBe('Corrección de cierre');
    expect(
      store.productionOrderOperations.find((op) => op.id === 'poo_3002_2').actual_time_minutes,
    ).toBe(120);
    expect(store.shiftsPendingValidation().map((shift) => shift.id)).toContain('sh_3002_2');
  });

  it('rechaza correcciones fuera de la operación finalizada', () => {
    expect(() => store.correctOpenDelay('od_1001', { endedAt: '2026-10-17T13:00:00Z' })).toThrow(
      /finalizadas/,
    );
    store.finishOperation('poo_3002_2', { now: '2026-10-17T12:00:00Z' });
    expect(() => store.correctOpenDelay('od_1001', { endedAt: '2026-10-17T13:00:00Z' })).toThrow(
      /posterior/,
    );
  });
});

describe('ManufacturingStore - US-07 supervisión de línea', () => {
  it('deriva semáforos y asigna operarios sin duplicar franja', () => {
    const lights = store.trafficLightForWorkCenters();
    const byCenter = Object.fromEntries(lights.map((row) => [row.work_center.id, row.status]));
    expect(byCenter.wc_corte).toBe('fault');
    expect(byCenter.wc_armado).toBe('in_operation');

    const assignment = store.assignOperatorToWorkCenter('wc_pintura', {
      ext_hr_employee_id: 'emp_op_05',
      shift_band: 'morning',
      now: '2026-11-03T07:00:00Z',
    });
    expect(assignment.active).toBe(true);
    expect(store.activeAssignmentForWorkCenter('wc_pintura').id).toBe(assignment.id);
    expect(() =>
      store.assignOperatorToWorkCenter('wc_corte', {
        ext_hr_employee_id: 'emp_op_05',
        shift_band: 'morning',
      }),
    ).toThrow(/ya está asignado/);
  });

  it('valida cierres sin atrasos abiertos y escala incidentes', () => {
    store.finishOperation('poo_3002_2', { now: '2026-10-17T12:00:00Z' });
    expect(() => store.validateShiftClosure('sh_3002_2')).toThrow(/atrasos abiertos/);
    store.correctOpenDelay('od_1001', { endedAt: '2026-10-17T11:00:00Z' });
    const shift = store.validateShiftClosure('sh_3002_2', {
      supervisor_notes: 'Cierre conforme',
      now: '2026-10-17T12:10:00Z',
    });
    expect(shift.supervisor_validated).toBe(true);
    expect(shift.supervisor_notes).toBe('Cierre conforme');
    expect(() => store.validateShiftClosure('sh_3002_2')).toThrow(/ya fue validado/);

    const ticket = store.escalateIncidentToMaintenance({
      workCenterId: 'wc_pintura',
      description: 'Fuga de pintura',
      reportedBy: 'emp_sup_01',
      now: '2026-11-03T10:00:00Z',
    });
    expect(ticket.priority).toBe('urgent');
    expect(ticket.ticket_status).toBe('open');
    expect(store.workCenterById('wc_pintura').operational_status).toBe('fault');
  });

  it('toma el ticket urgente más antiguo en menos de 30 s (SC-04)', () => {
    const started = performance.now();
    const tickets = store.maintenanceTicketsFor({ status: 'open' });
    expect(tickets[0].priority).toBe('urgent');
    store.startMaintenanceIntervention(tickets[0].id, {
      technician_ext_hr_employee_id: 'ext_hr_tec_01',
    });
    expect(performance.now() - started).toBeLessThan(30000);
  });
});

describe('ManufacturingStore - US-08 panel de planta', () => {
  it('calcula indicadores, umbrales y permisos por rol', () => {
    const data = store.plantPerformanceFor({ from: '2026-10-01', to: '2026-10-31' });
    expect(data.indicators.load).toBeGreaterThan(0);
    expect(data.thresholds).toHaveLength(4);
    expect(data.fulfillment.total_with_due_date).toBeGreaterThan(0);
    expect(store.canPerformActionFor('plant_manager', 'set_threshold')).toBe(true);
    expect(store.canPerformActionFor('operator', 'set_threshold')).toBe(false);

    const report = store.consolidatedReportFor(
      { from: '2026-10-01', to: '2026-10-31', label: 'Octubre' },
      '2026-11-01T00:00:00Z',
    );
    expect(report.generated_at).toBe('2026-11-01T00:00:00Z');
    expect(report.period.label).toBe('Octubre');

    const started = performance.now();
    const timed = store.consolidatedReportFor({ from: '2026-10-01', to: '2026-10-31' });
    expect(timed.load_by_work_center).toBeDefined();
    expect(performance.now() - started).toBeLessThan(10000);
  });

  it('actualiza umbrales y acciones sobre órdenes', () => {
    const updated = store.setIndicatorThreshold({
      indicator: 'load',
      threshold: 0.8,
      comparison: 'gt',
    });
    expect(updated.threshold).toBe(0.8);
    expect(() => store.setIndicatorThreshold({ indicator: 'desconocido', threshold: 1 })).toThrow(
      /Indicador desconocido/,
    );
    expect(() => store.setIndicatorThreshold({ indicator: 'oee', threshold: 2 })).toThrow(/rango/);

    expect(store.changeOrderPriority('po_3004', 'high').priority).toBe('high');
    expect(() => store.changeOrderPriority('po_3002', 'low')).toThrow(/planificada/);

    const cancelled = store.cancelOrderFromPanel('po_3004', { reason: 'Cambio de demanda' });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.notes).toContain('Cambio de demanda');
    expect(() => store.cancelOrderFromPanel('po_3001', { reason: 'x' })).toThrow(/cerrada/);
  });
});

describe('ManufacturingStore - US-10 planificación', () => {
  it('actualiza fechas con validación y bloquea órdenes cerradas', () => {
    const updated = store.updatePlannedDates('po_3004', {
      planned_start_date: '2026-11-01',
      planned_end_date: '2026-11-10',
    });
    expect(updated.planned_start_date).toBe('2026-11-01');
    expect(() =>
      store.updatePlannedDates('po_3004', {
        planned_start_date: '2026-11-10',
        planned_end_date: '2026-11-01',
      }),
    ).toThrow(/anterior/);
    expect(() =>
      store.updatePlannedDates('po_3001', {
        planned_start_date: '2026-11-01',
        planned_end_date: '2026-11-10',
      }),
    ).toThrow(/cerrada/);
  });

  it('resume y ordena las órdenes para calendarización', () => {
    expect(store.orderScheduleSummary('2026-11-01')).toEqual({
      planned: 11,
      unplanned: 2,
      overdue: 3,
    });
    const openOrders = store.ordersForScheduling();
    expect(openOrders.map((order) => order.id)).not.toContain('po_3001');
    expect(openOrders.map((order) => order.id)).not.toContain('po_3006');
    expect(store.ordersForScheduling({ status: 'planned' }).map((order) => order.id)).toEqual([
      'po_3004',
      'po_3012',
      'po_3013',
    ]);
  });

  it('impide crear órdenes cuya ruta usa centros desactivados', () => {
    store.workCenterById('wc_corte').status = 'inactive';
    expect(() =>
      store.createOrder({
        product_id: 'prod_bici',
        bom_id: 'bom_bici',
        routing_id: 'rt_bici',
        warehouse_id: 'wh_pt',
        quantity_planned: 5,
      }),
    ).toThrow(/desactivado/);
  });
});

describe('ManufacturingStore - US-11 balance de líneas', () => {
  it('devuelve utilización, cuello de botella y detalle por orden', () => {
    const balance = store.lineBalanceFor({ from: '2026-10-01', to: '2026-10-31' });
    expect(balance.utilization_by_work_center).toHaveLength(6);
    expect(balance.bottleneck).toBeTruthy();
    expect(balance.standard_times.wc_corte.operation_count).toBeGreaterThan(0);
    expect(balance.suggestions[0].to_work_center_id).toBe('wc_solda_2');

    const detail = store.lineBalanceForOrder('po_3003');
    expect(detail.order.id).toBe('po_3003');
    expect(detail.load_by_work_center.wc_corte.load_minutes).toBeGreaterThan(0);
    expect(store.lineBalanceForOrder('no_existe')).toBeNull();
  });

  it('no registra solicitudes ni expone una API de aceptación', () => {
    const balance = store.lineBalanceFor({ from: '2026-10-01', to: '2026-10-31' });
    const routingSnapshot = JSON.stringify(store.routingOperations);
    const ordersSnapshot = JSON.stringify(store.productionOrders);
    expect(balance.suggestions.length).toBeGreaterThan(0);
    expect(store.lineBalanceRequestsFor).toBeUndefined();
    expect(store.acceptLineBalanceSuggestion).toBeUndefined();
    expect(JSON.stringify(store.routingOperations)).toBe(routingSnapshot);
    expect(JSON.stringify(store.productionOrders)).toBe(ordersSnapshot);
  });
});

describe('ManufacturingStore - persistencia de operaciones', () => {
  it('guarda turnos, atrasos y configuración en el snapshot v2', () => {
    const storage = memoryStorage();
    const first = new ManufacturingStore({ storage });
    first.startShift('poo_3003_1', {
      operator_id: 'emp_op_03',
      now: '2026-11-03T08:00:00Z',
    });
    first.startDelay('poo_3003_1', {
      reasonId: 'dr_falta_material',
      now: '2026-11-03T09:00:00Z',
    });

    const raw = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    expect(raw.version).toBe(2);
    expect(raw.data.productionShifts.length).toBe(first.productionShifts.length);
    expect(raw.data.operationDelays.length).toBe(first.operationDelays.length);
    expect(raw.data.thresholdSettings).toBeDefined();
    expect(raw.data.rolePermissions).toBeDefined();

    const reloaded = new ManufacturingStore({ storage });
    expect(reloaded.activeShiftFor('poo_3003_1').operator_id).toBe('emp_op_03');
    expect(reloaded.openDelayFor('poo_3003_1').delay_reason_id).toBe('dr_falta_material');
  });
});
