/**
 * @file Fixtures de órdenes de producción y sus operaciones congeladas.
 * Ver data-model.md §3.11–3.12. Los `planned_time_minutes` se calculan con la
 * ruta y la cantidad; aquí se materializan para una demo determinista.
 */

export const productionOrders = [
  {
    id: 'po_3001', company_id: 'cmp_1', order_number: 'OP-3001', product_id: 'prod_bici',
    bom_id: 'bom_bici', routing_id: 'rt_bici', sales_order_id: 'so_1001', warehouse_id: 'wh_pt',
    quantity_planned: 50, status: 'completed', planned_start_date: '2026-10-01',
    planned_end_date: '2026-10-10', actual_start_date: '2026-10-02', actual_end_date: '2026-10-09',
    priority: 'normal', notes: 'Pedido make-to-order PV-1001.',
  },
  {
    id: 'po_3002', company_id: 'cmp_1', order_number: 'OP-3002', product_id: 'prod_bici',
    bom_id: 'bom_bici', routing_id: 'rt_bici', sales_order_id: null, warehouse_id: 'wh_pt',
    quantity_planned: 30, status: 'in_progress', planned_start_date: '2026-10-15',
    planned_end_date: '2026-10-25', actual_start_date: '2026-10-16', actual_end_date: null,
    priority: 'high', notes: 'Reposición de stock.',
  },
  {
    id: 'po_3003', company_id: 'cmp_1', order_number: 'OP-3003', product_id: 'prod_cuadro',
    bom_id: 'bom_cuadro', routing_id: 'rt_cuadro', sales_order_id: null, warehouse_id: 'wh_wip',
    quantity_planned: 100, status: 'released', planned_start_date: '2026-10-20',
    planned_end_date: '2026-10-30', actual_start_date: null, actual_end_date: null,
    priority: 'normal', notes: 'Sub-ensamble para bicicletas.',
  },
  {
    id: 'po_3004', company_id: 'cmp_1', order_number: 'OP-3004', product_id: 'prod_rueda',
    bom_id: 'bom_rueda', routing_id: 'rt_rueda', sales_order_id: null, warehouse_id: 'wh_wip',
    quantity_planned: 200, status: 'planned', planned_start_date: '2026-10-28',
    planned_end_date: '2026-11-05', actual_start_date: null, actual_end_date: null,
    priority: 'low', notes: '',
  },
  {
    id: 'po_3005', company_id: 'cmp_1', order_number: 'OP-3005', product_id: 'prod_bici',
    bom_id: 'bom_bici', routing_id: 'rt_bici', sales_order_id: 'so_1002', warehouse_id: 'wh_pt',
    quantity_planned: 25, status: 'released', planned_start_date: '2026-10-22',
    planned_end_date: '2026-11-02', actual_start_date: null, actual_end_date: null,
    priority: 'high', notes: 'Pedido make-to-order PV-1002.',
  },
  {
    id: 'po_3006', company_id: 'cmp_1', order_number: 'OP-3006', product_id: 'prod_cuadro',
    bom_id: 'bom_cuadro', routing_id: 'rt_cuadro', sales_order_id: null, warehouse_id: 'wh_wip',
    quantity_planned: 40, status: 'cancelled', planned_start_date: '2026-10-05',
    planned_end_date: '2026-10-12', actual_start_date: null, actual_end_date: null,
    priority: 'normal', notes: 'Cancelada por cambio de diseño.',
  },
];

/**
 * Operaciones congeladas (production_order_operations).
 * planned_time_minutes: setup + run × quantity_planned de la orden.
 */
export const productionOrderOperations = [
  // OP-3001 (completed): Bicicleta ×50 → corte, armado, QC
  { id: 'poo_3001_1', production_order_id: 'po_3001', routing_operation_id: 'ro_bici_1', work_center_id: 'wc_corte', sequence: 10, status: 'completed', planned_time_minutes: 165, actual_time_minutes: 172, quantity_completed: 50, scrap_quantity: 1, operator_id: null, started_at: '2026-10-02T08:00:00Z', completed_at: '2026-10-02T11:00:00Z' },
  { id: 'poo_3001_2', production_order_id: 'po_3001', routing_operation_id: 'ro_bici_2', work_center_id: 'wc_armado', sequence: 20, status: 'completed', planned_time_minutes: 610, actual_time_minutes: 640, quantity_completed: 50, scrap_quantity: 0, operator_id: null, started_at: '2026-10-03T08:00:00Z', completed_at: '2026-10-06T15:00:00Z' },
  { id: 'poo_3001_3', production_order_id: 'po_3001', routing_operation_id: 'ro_bici_3', work_center_id: 'wc_calidad', sequence: 30, status: 'completed', planned_time_minutes: 105, actual_time_minutes: 98, quantity_completed: 49, scrap_quantity: 0, operator_id: null, started_at: '2026-10-08T08:00:00Z', completed_at: '2026-10-09T10:00:00Z' },
  // OP-3002 (in_progress): Bicicleta ×30
  { id: 'poo_3002_1', production_order_id: 'po_3002', routing_operation_id: 'ro_bici_1', work_center_id: 'wc_corte', sequence: 10, status: 'completed', planned_time_minutes: 105, actual_time_minutes: 110, quantity_completed: 30, scrap_quantity: 0, operator_id: null, started_at: '2026-10-16T08:00:00Z', completed_at: '2026-10-16T10:30:00Z' },
  { id: 'poo_3002_2', production_order_id: 'po_3002', routing_operation_id: 'ro_bici_2', work_center_id: 'wc_armado', sequence: 20, status: 'in_progress', planned_time_minutes: 370, actual_time_minutes: 180, quantity_completed: 12, scrap_quantity: 0, operator_id: null, started_at: '2026-10-17T08:00:00Z', completed_at: null },
  { id: 'poo_3002_3', production_order_id: 'po_3002', routing_operation_id: 'ro_bici_3', work_center_id: 'wc_calidad', sequence: 30, status: 'pending', planned_time_minutes: 65, actual_time_minutes: null, quantity_completed: 0, scrap_quantity: 0, operator_id: null, started_at: null, completed_at: null },
  // OP-3003 (released): Cuadro ×100
  { id: 'poo_3003_1', production_order_id: 'po_3003', routing_operation_id: 'ro_cuadro_1', work_center_id: 'wc_corte', sequence: 10, status: 'pending', planned_time_minutes: 520, actual_time_minutes: null, quantity_completed: 0, scrap_quantity: 0, operator_id: null, started_at: null, completed_at: null },
  { id: 'poo_3003_2', production_order_id: 'po_3003', routing_operation_id: 'ro_cuadro_2', work_center_id: 'wc_solda', sequence: 20, status: 'pending', planned_time_minutes: 1825, actual_time_minutes: null, quantity_completed: 0, scrap_quantity: 0, operator_id: null, started_at: null, completed_at: null },
  { id: 'poo_3003_3', production_order_id: 'po_3003', routing_operation_id: 'ro_cuadro_3', work_center_id: 'wc_pintura', sequence: 30, status: 'pending', planned_time_minutes: 830, actual_time_minutes: null, quantity_completed: 0, scrap_quantity: 0, operator_id: null, started_at: null, completed_at: null },
  // OP-3005 (released): Bicicleta ×25
  { id: 'poo_3005_1', production_order_id: 'po_3005', routing_operation_id: 'ro_bici_1', work_center_id: 'wc_corte', sequence: 10, status: 'pending', planned_time_minutes: 90, actual_time_minutes: null, quantity_completed: 0, scrap_quantity: 0, operator_id: null, started_at: null, completed_at: null },
  { id: 'poo_3005_2', production_order_id: 'po_3005', routing_operation_id: 'ro_bici_2', work_center_id: 'wc_armado', sequence: 20, status: 'pending', planned_time_minutes: 310, actual_time_minutes: null, quantity_completed: 0, scrap_quantity: 0, operator_id: null, started_at: null, completed_at: null },
  { id: 'poo_3005_3', production_order_id: 'po_3005', routing_operation_id: 'ro_bici_3', work_center_id: 'wc_calidad', sequence: 30, status: 'pending', planned_time_minutes: 55, actual_time_minutes: null, quantity_completed: 0, scrap_quantity: 0, operator_id: null, started_at: null, completed_at: null },
];

/** Consumo real de material (muestra para OP-3001 y OP-3002). */
export const materialConsumption = [
  { id: 'mc_1', production_order_id: 'po_3001', po_operation_id: 'poo_3001_1', component_product_id: 'comp_tubo', bom_component_id: 'bc_6', warehouse_id: 'wh_mp', quantity_consumed: 306, uom_id: 'uom_m', lot_number: 'LOTE-TUBO-101', consumed_at: '2026-10-02T08:30:00Z', consumed_by: null },
  { id: 'mc_2', production_order_id: 'po_3001', po_operation_id: 'poo_3001_2', component_product_id: 'comp_llanta', bom_component_id: 'bc_3', warehouse_id: 'wh_mp', quantity_consumed: 102, uom_id: 'uom_un', lot_number: 'LOTE-LLANTA-55', consumed_at: '2026-10-03T09:00:00Z', consumed_by: null },
  { id: 'mc_3', production_order_id: 'po_3001', po_operation_id: 'poo_3001_2', component_product_id: 'rm_pintura', bom_component_id: 'bc_7', warehouse_id: 'wh_mp', quantity_consumed: 44, uom_id: 'uom_kg', lot_number: 'LOTE-PINT-9', consumed_at: '2026-10-04T09:00:00Z', consumed_by: null },
  { id: 'mc_4', production_order_id: 'po_3002', po_operation_id: 'poo_3002_1', component_product_id: 'comp_tubo', bom_component_id: 'bc_6', warehouse_id: 'wh_mp', quantity_consumed: 185, uom_id: 'uom_m', lot_number: 'LOTE-TUBO-102', consumed_at: '2026-10-16T08:30:00Z', consumed_by: null },
];

/** Salida real de bien terminado (muestra). */
export const productionOutput = [
  { id: 'out_1', production_order_id: 'po_3001', product_id: 'prod_bici', warehouse_id: 'wh_pt', quantity_produced: 49, scrap_quantity: 1, lot_number: 'PT-BICI-3001', uom_id: 'uom_un', produced_at: '2026-10-09T11:00:00Z', recorded_by: null },
];
