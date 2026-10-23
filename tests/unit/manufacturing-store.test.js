import { describe, it, expect, beforeEach } from 'vitest';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';

let store;
beforeEach(() => {
  store = new ManufacturingStore();
});

describe('ManufacturingStore', () => {
  it('carga los fixtures de manufactura', () => {
    expect(store.productionOrders.length).toBeGreaterThan(0);
    expect(store.billOfMaterials.length).toBe(3);
    expect(store.workCenters.length).toBe(5);
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
      product_id: 'prod_rueda', bom_id: 'bom_rueda', routing_id: 'rt_rueda',
      warehouse_id: 'wh_wip', quantity_planned: 5,
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
    expect(() => store.completeOperation(ops[1].id, { actual_time_minutes: 0 })).toThrow(/mayor que 0/);
  });

  it('registra consumo y debita inventario', () => {
    const before = store.inventory.getBalance('wh_mp', 'comp_tubo');
    store.recordConsumption({
      production_order_id: 'po_3002', component_product_id: 'comp_tubo',
      bom_component_id: 'bc_6', warehouse_id: 'wh_mp', quantity_consumed: 10, uom_id: 'uom_m',
    });
    expect(store.inventory.getBalance('wh_mp', 'comp_tubo')).toBe(before - 10);
  });

  it('registra salida y acredita inventario', () => {
    const before = store.inventory.getBalance('wh_pt', 'prod_bici');
    store.recordOutput({
      production_order_id: 'po_3002', product_id: 'prod_bici', warehouse_id: 'wh_pt',
      quantity_produced: 5, scrap_quantity: 1, uom_id: 'uom_un',
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
    expect(kpis.totalOrders).toBe(6);
    expect(kpis.activeOrders).toBeGreaterThanOrEqual(3);
    const loads = store.workCenterLoads();
    expect(loads.length).toBe(5);
    expect(loads.find((l) => l.workCenter.id === 'wc_corte').loadMinutes).toBeGreaterThan(0);
  });

  it('reconcilia plan-vs-real de una orden', () => {
    const variances = store.reconcile('po_3001');
    expect(variances.length).toBeGreaterThan(0);
    expect(store.reconciliationNeedsReview('po_3001')).toBe(true);
  });
});
