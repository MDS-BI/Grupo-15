import { describe, it, expect, beforeEach } from 'vitest';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { LEGACY_SNAPSHOT_KEY, SNAPSHOT_KEY } from '../../src/data/persistence.js';

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

describe('ManufacturingStore', () => {
  it('carga los fixtures de manufactura', () => {
    expect(store.productionOrders.length).toBeGreaterThan(0);
    expect(store.billOfMaterials.length).toBe(3);
    expect(store.workCenters.length).toBe(6);
  });

  it('construye el árbol de BOM y aplana el consumo teórico', () => {
    const flat = store.flattenedBom('bom_bici');
    const tubo = flat.find((f) => f.product_id === 'comp_tubo');
    expect(tubo.total_quantity).toBe(6);
  });

  it('crea una orden y genera operaciones congeladas (planned_time_minutes)', () => {
    const order = store.createOrder({
      product_id: 'prod_bici',
      bom_id: 'bom_bici',
      routing_id: 'rt_bici',
      warehouse_id: 'wh_pt',
      quantity_planned: 10,
    });
    expect(order.status).toBe('planned');
    const ops = store.operationsForOrder(order.id);
    expect(ops.length).toBe(3);
    // corte: 15 + 3×10 = 45
    expect(ops[0].planned_time_minutes).toBe(45);
  });

  it('respeta la máquina de estados al liberar y ejecutar', () => {
    const order = store.createOrder({
      product_id: 'prod_rueda',
      bom_id: 'bom_rueda',
      routing_id: 'rt_rueda',
      warehouse_id: 'wh_wip',
      quantity_planned: 5,
    });
    store.transitionOrder(order.id, 'released');
    expect(order.status).toBe('released');
    const ops = store.operationsForOrder(order.id);
    store.startOperation(ops[0].id);
    expect(store.orderById(order.id).status).toBe('in_progress');
    expect(() => store.transitionOrder(order.id, 'planned')).toThrow(/inválida/);
  });

  it('rechaza actual_time_minutes = 0 al completar', () => {
    const ops = store.operationsForOrder('po_3002');
    expect(() => store.completeOperation(ops[1].id, { actual_time_minutes: 0 })).toThrow(
      /mayor que 0/,
    );
  });

  it('registra consumo y debita inventario', () => {
    const before = store.inventory.getBalance('wh_mp', 'comp_tubo');
    store.recordConsumption({
      production_order_id: 'po_3002',
      component_product_id: 'comp_tubo',
      bom_component_id: 'bc_6',
      warehouse_id: 'wh_mp',
      quantity_consumed: 10,
      uom_id: 'uom_m',
    });
    expect(store.inventory.getBalance('wh_mp', 'comp_tubo')).toBe(before - 10);
  });

  it('registra salida y acredita inventario', () => {
    const before = store.inventory.getBalance('wh_pt', 'prod_bici');
    store.recordOutput({
      production_order_id: 'po_3002',
      product_id: 'prod_bici',
      warehouse_id: 'wh_pt',
      quantity_produced: 5,
      scrap_quantity: 1,
      uom_id: 'uom_un',
    });
    expect(store.inventory.getBalance('wh_pt', 'prod_bici')).toBe(before + 5);
  });

  it('deriva el estado de calidad desde quality_inspections', () => {
    expect(store.orderQualityStatus('po_3001')).toBe('passed');
    expect(store.orderQualityStatus('po_3002')).toBe('pending');
    expect(store.orderQualityStatus('po_3005')).toBe('none');
  });

  it('calcula KPIs y carga por centro de trabajo', () => {
    const kpis = store.kpis();
    expect(kpis.totalOrders).toBe(7);
    expect(kpis.activeOrders).toBeGreaterThanOrEqual(3);
    const loads = store.workCenterLoads();
    expect(loads.length).toBe(6);
    expect(loads.find((l) => l.workCenter.id === 'wc_corte').loadMinutes).toBeGreaterThan(0);
  });

  it('reconcilia plan-vs-real de una orden', () => {
    const variances = store.reconcile('po_3001');
    expect(variances.length).toBeGreaterThan(0);
    expect(store.reconciliationNeedsReview('po_3001')).toBe(true);
  });
});

describe('ManufacturingStore - US-09 mantenimiento', () => {
  it('toma una intervención y bloquea una segunda en el mismo centro sin mutar', () => {
    const { ticket, workCenter } = store.startMaintenanceIntervention('mt_1001', {
      technician_ext_hr_employee_id: 'ext_hr_tec_01',
    });
    expect(ticket.ticket_status).toBe('in_progress');
    expect(ticket.technician_ext_hr_employee_id).toBe('ext_hr_tec_01');
    expect(ticket.intervention_started_at).toBeTruthy();
    expect(workCenter.operational_status).toBe('fault');
    expect(store.activeInterventionForWorkCenter('wc_solda').id).toBe('mt_1001');

    const before = JSON.stringify(store.maintenanceTickets.find((t) => t.id === 'mt_1006'));
    expect(() =>
      store.startMaintenanceIntervention('mt_1006', {
        technician_ext_hr_employee_id: 'ext_hr_tec_02',
      }),
    ).toThrow(/intervención activa/);
    expect(JSON.stringify(store.maintenanceTickets.find((t) => t.id === 'mt_1006'))).toBe(before);
  });

  it('resuelve con marcas de parada y restablece la disponibilidad', () => {
    const { ticket, workCenter } = store.resolveMaintenanceTicket('mt_1002', {
      resolvedAt: '2026-11-02T09:40:00Z',
      downtimeStartedAt: '2026-11-02T08:40:00Z',
      downtimeEndedAt: '2026-11-02T09:10:00Z',
      causeReasonId: 'dr_mecanico',
      notes: 'Ajuste de guías.',
    });
    expect(ticket.ticket_status).toBe('resolved');
    expect(ticket.downtime_minutes).toBe(30);
    expect(ticket.resolved_at).toBe('2026-11-02T09:40:00.000Z');
    expect(workCenter.operational_status).toBe('available');
    expect(store.maintenanceHistoryForWorkCenter('wc_corte').map((t) => t.id)).toContain('mt_1002');
  });

  it('rechaza un cierre inválido sin mutar el ticket', () => {
    const before = JSON.stringify(store.maintenanceTickets.find((t) => t.id === 'mt_1002'));
    expect(() =>
      store.resolveMaintenanceTicket('mt_1002', {
        resolvedAt: '2026-11-02T09:40:00Z',
        downtimeStartedAt: '2026-11-02T09:00:00Z',
        downtimeEndedAt: '2026-11-02T08:00:00Z',
      }),
    ).toThrow(/anterior/);
    expect(JSON.stringify(store.maintenanceTickets.find((t) => t.id === 'mt_1002'))).toBe(before);
  });

  it('no reabre tickets resueltos', () => {
    expect(() =>
      store.startMaintenanceIntervention('mt_1004', {
        technician_ext_hr_employee_id: 'ext_hr_tec_01',
      }),
    ).toThrow(/reabrir/);
  });

  it('gestiona el ciclo de una orden preventiva', () => {
    const order = store.createPreventiveMaintenanceOrder({
      workCenterId: 'wc_armado',
      sourceTicketId: 'mt_1004',
      plannedDate: '2026-12-01',
      title: 'Preventiva trimestral',
      technician_ext_hr_employee_id: 'ext_hr_tec_01',
    });
    expect(order.status).toBe('planned');
    expect(order.order_code).toMatch(/^PM-\d+$/);
    expect(order.source_ticket_id).toBe('mt_1004');

    store.transitionPreventiveMaintenanceOrder(order.id, 'in_progress');
    expect(order.status).toBe('in_progress');
    store.transitionPreventiveMaintenanceOrder(order.id, 'completed');
    expect(order.status).toBe('completed');
    expect(order.completed_at).toBeTruthy();
    expect(() => store.cancelPreventiveMaintenanceOrder(order.id, { reason: 'x' })).toThrow(
      /no se puede cancelar/i,
    );
  });

  it('crea una preventiva cancelable y valida el ticket de origen', () => {
    const order = store.createPreventiveMaintenanceOrder({
      workCenterId: 'wc_pintura',
      plannedDate: '2026-12-05',
      title: 'Limpieza programada',
    });
    store.transitionPreventiveMaintenanceOrder(order.id, 'in_progress');
    store.cancelPreventiveMaintenanceOrder(order.id, { reason: 'Falta de repuestos' });
    expect(order.status).toBe('cancelled');
    expect(order.notes).toContain('Falta de repuestos');

    expect(() =>
      store.createPreventiveMaintenanceOrder({
        workCenterId: 'wc_solda',
        sourceTicketId: 'mt_1004',
        plannedDate: '2026-12-05',
        title: 'Inválida',
      }),
    ).toThrow(/otro centro/);
  });

  it('ordena la bandeja por prioridad y antigüedad', () => {
    const tickets = store.maintenanceTicketsFor({ status: 'open' });
    const priorities = tickets.map((t) => t.priority);
    const rank = { urgent: 0, high: 1, normal: 2 };
    const sorted = [...priorities].sort((a, b) => rank[a] - rank[b]);
    expect(priorities).toEqual(sorted);
  });
});

describe('ManufacturingStore - persistencia de mantenimiento', () => {
  it('escribe el snapshot v2 en cada mutación y rehidrata tras recargar', () => {
    const storage = memoryStorage();
    const first = new ManufacturingStore({ storage });
    first.startMaintenanceIntervention('mt_1001', {
      technician_ext_hr_employee_id: 'ext_hr_tec_01',
    });
    first.createPreventiveMaintenanceOrder({
      workCenterId: 'wc_solda',
      sourceTicketId: 'mt_1001',
      plannedDate: '2026-12-10',
      title: 'Revisión de cabezal',
    });

    const raw = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    expect(raw.version).toBe(2);
    expect(raw.data.maintenanceTickets).toBeDefined();
    expect(raw.data.preventiveMaintenanceOrders.length).toBe(
      first.preventiveMaintenanceOrders.length,
    );

    const reloaded = new ManufacturingStore({ storage });
    expect(reloaded.activeInterventionForWorkCenter('wc_solda').id).toBe('mt_1001');
    expect(reloaded.preventiveMaintenanceOrders.map((o) => o.title)).toContain(
      'Revisión de cabezal',
    );
  });

  it('migra un snapshot v1 a v2 e inicializa mantenimiento vacío', () => {
    const legacy = {
      version: 1,
      savedAt: '2026-10-01T00:00:00Z',
      data: {
        productionOrders: [{ id: 'po_legacy' }],
        workCenters: [{ id: 'wc_corte', name: 'Estación de Corte' }],
        productionOrderOperations: [],
      },
    };
    const storage = memoryStorage({ [LEGACY_SNAPSHOT_KEY]: JSON.stringify(legacy) });
    const migrated = new ManufacturingStore({ storage });

    expect(migrated.productionOrders.map((o) => o.id)).toEqual(['po_legacy']);
    expect(migrated.maintenanceTickets).toEqual([]);
    expect(migrated.preventiveMaintenanceOrders).toEqual([]);
    const raw = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    expect(raw.version).toBe(2);
    expect(raw.data.maintenanceTickets).toEqual([]);
  });

  it('completa un snapshot v2 sin colecciones de mantenimiento', () => {
    const payload = {
      version: 2,
      savedAt: '2026-10-01T00:00:00Z',
      data: {
        productionOrders: [],
        workCenters: [],
        productionOrderOperations: [],
      },
    };
    const storage = memoryStorage({ [SNAPSHOT_KEY]: JSON.stringify(payload) });
    const storeV2 = new ManufacturingStore({ storage });
    expect(storeV2.maintenanceTickets).toEqual([]);
    expect(storeV2.preventiveMaintenanceOrders).toEqual([]);
  });

  it('cae a fixtures con advertencia ante un snapshot corrupto', () => {
    const storage = memoryStorage({ [SNAPSHOT_KEY]: '{json corrupto' });
    const corrupted = new ManufacturingStore({ storage });
    expect(corrupted.persistenceWarning).toMatch(/corrupto|inválido/);
    expect(corrupted.maintenanceTickets.length).toBeGreaterThan(0);
  });
});
