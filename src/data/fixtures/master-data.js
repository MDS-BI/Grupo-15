/**
 * @file Fixtures de datos maestros de frontera (Core / Logística / Ventas / Calidad).
 * Solo lectura para el módulo de manufactura. Ver data-model.md §3.1–3.5, §3.15.
 */

export const companies = [
  { id: 'cmp_1', name: 'Acero del Biobío S.A.', tax_id: 'CL-76.111.222-3', default_currency: 'CLP' },
];

export const unitsOfMeasure = [
  { id: 'uom_un', code: 'UN', name: 'Unidad', category: 'conteo', company_id: null },
  { id: 'uom_kg', code: 'KG', name: 'Kilogramo', category: 'masa', company_id: null },
  { id: 'uom_l', code: 'L', name: 'Litro', category: 'volumen', company_id: null },
  { id: 'uom_m', code: 'M', name: 'Metro', category: 'longitud', company_id: null },
];

export const warehouses = [
  { id: 'wh_mp', company_id: 'cmp_1', code: 'BD-MP', name: 'Bodega Materias Primas', warehouse_type: 'raw_materials' },
  { id: 'wh_wip', company_id: 'cmp_1', code: 'BD-WIP', name: 'Bodega En Proceso (WIP)', warehouse_type: 'wip' },
  { id: 'wh_pt', company_id: 'cmp_1', code: 'BD-PT', name: 'Bodega Producto Terminado', warehouse_type: 'finished_goods' },
];

/**
 * Productos. `finished_good` = bien terminado; `component`/`raw_material` = consumible.
 */
export const products = [
  // Bienes terminados
  { id: 'prod_bici', company_id: 'cmp_1', code: 'FG-BICI-01', name: 'Bicicleta Urbana 700c', product_type: 'finished_good', uom_id: 'uom_un', unit_cost: 85000 },
  { id: 'prod_cuadro', company_id: 'cmp_1', code: 'FG-CUADRO-01', name: 'Cuadro Soldado (sub-ensamble)', product_type: 'finished_good', uom_id: 'uom_un', unit_cost: 32000 },
  { id: 'prod_rueda', company_id: 'cmp_1', code: 'FG-RUEDA-01', name: 'Rueda Armada (sub-ensamble)', product_type: 'finished_good', uom_id: 'uom_un', unit_cost: 18000 },
  // Componentes fabricados intermedios
  { id: 'comp_tubo', company_id: 'cmp_1', code: 'CP-TUBO-01', name: 'Tubo de acero cromoly', product_type: 'component', uom_id: 'uom_m', unit_cost: 6500 },
  { id: 'comp_llanta', company_id: 'cmp_1', code: 'CP-LLANTA-01', name: 'Llanta 700c', product_type: 'component', uom_id: 'uom_un', unit_cost: 9000 },
  { id: 'comp_rayos', company_id: 'cmp_1', code: 'CP-RAYOS-01', name: 'Juego de rayos', product_type: 'component', uom_id: 'uom_un', unit_cost: 2500 },
  { id: 'comp_maza', company_id: 'cmp_1', code: 'CP-MAZA-01', name: 'Maza de eje', product_type: 'component', uom_id: 'uom_un', unit_cost: 4200 },
  // Materias primas
  { id: 'rm_pintura', company_id: 'cmp_1', code: 'RM-PINT-01', name: 'Pintura en polvo', product_type: 'raw_material', uom_id: 'uom_kg', unit_cost: 12000 },
  { id: 'rm_soldadura', company_id: 'cmp_1', code: 'RM-SOLD-01', name: 'Hilo de soldadura', product_type: 'raw_material', uom_id: 'uom_kg', unit_cost: 3800 },
];

export const salesOrders = [
  { id: 'so_1001', company_id: 'cmp_1', customer_id: null, order_number: 'PV-1001', status: 'confirmed', make_to_order: true, requested_date: '2026-11-15' },
  { id: 'so_1002', company_id: 'cmp_1', customer_id: null, order_number: 'PV-1002', status: 'confirmed', make_to_order: true, requested_date: '2026-11-22' },
  { id: 'so_1003', company_id: 'cmp_1', customer_id: null, order_number: 'PV-1003', status: 'open', make_to_order: false, requested_date: '2026-12-01' },
];

export const qualityInspections = [
  { id: 'qi_1', company_id: 'cmp_1', inspection_type: 'final', production_order_id: 'po_3001', po_operation_id: null, product_id: 'prod_bici', status: 'passed' },
  { id: 'qi_2', company_id: 'cmp_1', inspection_type: 'in_process', production_order_id: 'po_3002', po_operation_id: 'poo_3002_2', product_id: null, status: 'pending' },
  { id: 'qi_3', company_id: 'cmp_1', inspection_type: 'final', production_order_id: 'po_3002', po_operation_id: null, product_id: 'prod_bici', status: 'pending' },
];
