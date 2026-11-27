import * as demoDates from './demo-dates.js';
import { refreshableArray } from './master-data.js';
import { routingOperations } from './routings.js';

const { relativeDay, relativeTimestamp } = demoDates;

function pad(value) {
  return String(value).padStart(2, '0');
}

function monthTarget(offset) {
  if (typeof demoDates.relativeMonth === 'function') {
    const value = String(demoDates.relativeMonth(offset)).slice(0, 7);
    const [year, month] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
  }
  const anchor = new Date(`${relativeDay(0)}T12:00:00Z`);
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1));
}

function monthDate(offset, day) {
  const target = monthTarget(offset);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const safeDay = Math.max(1, Math.min(day, lastDay));
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(safeDay)}`;
}

function idleDates(status) {
  return status === 'completed'
    ? { actual_start_date: null, actual_end_date: null }
    : { actual_start_date: null, actual_end_date: null };
}

function coreOrders() {
  return [
    {
      id: 'po_3001',
      company_id: 'cmp_1',
      order_number: 'OP-3001',
      product_id: 'prod_bici',
      bom_id: 'bom_bici',
      routing_id: 'rt_bici',
      sales_order_id: 'so_1001',
      warehouse_id: 'wh_pt',
      quantity_planned: 50,
      status: 'completed',
      planned_start_date: relativeDay(-52),
      planned_end_date: relativeDay(-43),
      actual_start_date: relativeDay(-51),
      actual_end_date: relativeDay(-44),
      priority: 'normal',
      notes: 'Pedido make-to-order PV-1001.',
    },
    {
      id: 'po_3002',
      company_id: 'cmp_1',
      order_number: 'OP-3002',
      product_id: 'prod_bici',
      bom_id: 'bom_bici',
      routing_id: 'rt_bici',
      sales_order_id: null,
      warehouse_id: 'wh_pt',
      quantity_planned: 30,
      status: 'in_progress',
      planned_start_date: monthDate(0, 17),
      planned_end_date: monthDate(0, 24),
      actual_start_date: relativeDay(-5),
      actual_end_date: null,
      priority: 'high',
      notes: 'Reposición de stock.',
    },
    {
      id: 'po_3003',
      company_id: 'cmp_1',
      order_number: 'OP-3003',
      product_id: 'prod_cuadro',
      bom_id: 'bom_cuadro',
      routing_id: 'rt_cuadro',
      sales_order_id: null,
      warehouse_id: 'wh_wip',
      quantity_planned: 100,
      status: 'released',
      planned_start_date: relativeDay(-33),
      planned_end_date: relativeDay(-23),
      ...idleDates('released'),
      priority: 'normal',
      notes: 'Lote de cuadros para la demanda de bicicletas.',
    },
    {
      id: 'po_3004',
      company_id: 'cmp_1',
      order_number: 'OP-3004',
      product_id: 'prod_rueda',
      bom_id: 'bom_rueda',
      routing_id: 'rt_rueda',
      sales_order_id: null,
      warehouse_id: 'wh_wip',
      quantity_planned: 200,
      status: 'planned',
      planned_start_date: null,
      planned_end_date: null,
      ...idleDates('planned'),
      priority: 'low',
      notes: 'Pendiente de horario.',
    },
    {
      id: 'po_3005',
      company_id: 'cmp_1',
      order_number: 'OP-3005',
      product_id: 'prod_bici',
      bom_id: 'bom_bici',
      routing_id: 'rt_bici',
      sales_order_id: 'so_1002',
      warehouse_id: 'wh_pt',
      quantity_planned: 25,
      status: 'released',
      planned_start_date: relativeDay(-3),
      planned_end_date: relativeDay(4),
      ...idleDates('released'),
      priority: 'high',
      notes: 'Pedido make-to-order PV-1002.',
    },
    {
      id: 'po_3006',
      company_id: 'cmp_1',
      order_number: 'OP-3006',
      product_id: 'prod_cuadro',
      bom_id: 'bom_cuadro',
      routing_id: 'rt_cuadro',
      sales_order_id: null,
      warehouse_id: 'wh_wip',
      quantity_planned: 40,
      status: 'cancelled',
      planned_start_date: relativeDay(-48),
      planned_end_date: relativeDay(-41),
      ...idleDates('cancelled'),
      priority: 'normal',
      notes: 'Cancelada por cambio de diseño.',
    },
    {
      id: 'po_3007',
      company_id: 'cmp_1',
      order_number: 'OP-3007',
      product_id: 'prod_cuadro',
      bom_id: 'bom_cuadro',
      routing_id: 'rt_cuadro',
      sales_order_id: null,
      warehouse_id: 'wh_wip',
      quantity_planned: 380,
      status: 'completed',
      planned_start_date: relativeDay(-48),
      planned_end_date: relativeDay(-23),
      actual_start_date: relativeDay(-47),
      actual_end_date: relativeDay(-24),
      priority: 'high',
      notes: 'Lote de cuadros cancelado por cierre de demanda.',
    },
    {
      id: 'po_3008',
      company_id: 'cmp_1',
      order_number: 'OP-3008',
      product_id: 'prod_bici',
      bom_id: 'bom_bici',
      routing_id: 'rt_bici',
      sales_order_id: null,
      warehouse_id: 'wh_pt',
      quantity_planned: 5,
      status: 'in_progress',
      planned_start_date: relativeDay(-2),
      planned_end_date: relativeDay(2),
      actual_start_date: relativeDay(-2),
      actual_end_date: null,
      priority: 'normal',
      notes: 'Reposición urgente de bicicletas.',
    },
    {
      id: 'po_3009',
      company_id: 'cmp_1',
      order_number: 'OP-3009',
      product_id: 'prod_bici',
      bom_id: 'bom_bici',
      routing_id: 'rt_bici',
      sales_order_id: null,
      warehouse_id: 'wh_pt',
      quantity_planned: 8,
      status: 'released',
      planned_start_date: relativeDay(-1),
      planned_end_date: relativeDay(3),
      ...idleDates('released'),
      priority: 'normal',
      notes: 'Pedido de bicicletas liberado.',
    },
    {
      id: 'po_3010',
      company_id: 'cmp_1',
      order_number: 'OP-3010',
      product_id: 'prod_bici',
      bom_id: 'bom_bici',
      routing_id: 'rt_bici',
      sales_order_id: null,
      warehouse_id: 'wh_pt',
      quantity_planned: 6,
      status: 'in_progress',
      planned_start_date: relativeDay(0),
      planned_end_date: relativeDay(4),
      actual_start_date: relativeDay(0),
      actual_end_date: null,
      priority: 'normal',
      notes: 'Lote corto en ejecución.',
    },
    {
      id: 'po_3011',
      company_id: 'cmp_1',
      order_number: 'OP-3011',
      product_id: 'prod_bici',
      bom_id: 'bom_bici',
      routing_id: 'rt_bici',
      sales_order_id: null,
      warehouse_id: 'wh_pt',
      quantity_planned: 10,
      status: 'released',
      planned_start_date: relativeDay(1),
      planned_end_date: relativeDay(5),
      ...idleDates('released'),
      priority: 'normal',
      notes: 'Lote de bicicletas programado.',
    },
    {
      id: 'po_3012',
      company_id: 'cmp_1',
      order_number: 'OP-3012',
      product_id: 'prod_bici',
      bom_id: 'bom_bici',
      routing_id: 'rt_bici',
      sales_order_id: null,
      warehouse_id: 'wh_pt',
      quantity_planned: 12,
      status: 'planned',
      planned_start_date: null,
      planned_end_date: null,
      ...idleDates('planned'),
      priority: 'low',
      notes: 'Pendiente de horario.',
    },
    {
      id: 'po_3013',
      company_id: 'cmp_1',
      order_number: 'OP-3013',
      product_id: 'prod_bici',
      bom_id: 'bom_bici',
      routing_id: 'rt_bici',
      sales_order_id: null,
      warehouse_id: 'wh_pt',
      quantity_planned: 15,
      status: 'planned',
      planned_start_date: null,
      planned_end_date: null,
      ...idleDates('planned'),
      priority: 'low',
      notes: 'Pendiente de horario.',
    },
    {
      id: 'po_3014',
      company_id: 'cmp_1',
      order_number: 'OP-3014',
      product_id: 'prod_cargo',
      bom_id: 'bom_cargo',
      routing_id: 'rt_cargo',
      sales_order_id: 'so_1003',
      warehouse_id: 'wh_pt',
      quantity_planned: 18,
      status: 'planned',
      planned_start_date: null,
      planned_end_date: null,
      ...idleDates('planned'),
      priority: 'low',
      notes: 'Pedido de stock sin fecha asignada.',
    },
  ];
}

const EXTRA_ORDER_SPECS = [
  ['po_3015', 'current_completed', 'prod_bici', 6, 3, 'normal'],
  ['po_3016', 'current_completed', 'prod_rueda', 18, 6, 'normal'],
  ['po_3017', 'current_completed', 'prod_cargo', 9, 9, 'high'],
  ['po_3018', 'current_completed', 'prod_bici', 12, 12, 'normal'],
  ['po_3019', 'current_completed', 'prod_rueda', 24, 15, 'normal'],
  ['po_3020', 'current_completed', 'prod_cargo', 7, 18, 'normal'],
  ['po_3021', 'current_in_progress', 'prod_bici', 8, -2, 'normal'],
  ['po_3022', 'current_in_progress', 'prod_cargo', 11, -1, 'urgent'],
  ['po_3023', 'current_in_progress', 'prod_rueda', 28, 0, 'normal'],
  ['po_3024', 'current_released', 'prod_cargo', 14, 2, 'high'],
  ['po_3025', 'prev_completed', 'prod_bici', 10, 4, 'normal'],
  ['po_3026', 'prev_completed', 'prod_rueda', 32, 8, 'normal'],
  ['po_3027', 'prev_completed', 'prod_bici', 14, 12, 'normal'],
  ['po_3028', 'prev_completed', 'prod_rueda', 26, 16, 'normal'],
  ['po_3029', 'prev_completed', 'prod_bici', 9, 20, 'normal'],
  ['po_3030', 'prev_cancelled', 'prod_cargo', 6, 24, 'normal'],
  ['po_3031', 'next_completed', 'prod_rueda', 22, 5, 'normal'],
  ['po_3032', 'next_released', 'prod_bici', 16, 10, 'high'],
];

const PRODUCT_CONFIG = {
  prod_bici: ['bom_bici', 'rt_bici', 'wh_pt'],
  prod_cargo: ['bom_cargo', 'rt_cargo', 'wh_pt'],
  prod_cuadro: ['bom_cuadro', 'rt_cuadro', 'wh_wip'],
  prod_rueda: ['bom_rueda', 'rt_rueda', 'wh_wip'],
};

function extraOrder([id, group, productId, quantity, day, priority]) {
  const [bomId, routingId, warehouseId] = PRODUCT_CONFIG[productId];
  let startDate;
  let endDate;
  let status;
  let actualStart = null;
  let actualEnd = null;

  if (group === 'current_completed') {
    status = 'completed';
    startDate = monthDate(0, day);
    endDate = monthDate(0, day + 2);
    actualStart = monthDate(0, day + 1);
    actualEnd = endDate;
  } else if (group === 'current_in_progress') {
    status = 'in_progress';
    startDate = relativeDay(day);
    endDate = relativeDay(day + 4);
    actualStart = relativeDay(day);
  } else if (group === 'current_released') {
    status = 'released';
    startDate = relativeDay(day);
    endDate = relativeDay(day + 5);
  } else if (group === 'prev_completed') {
    status = 'completed';
    startDate = monthDate(-1, day);
    endDate = monthDate(-1, day + 3);
    actualStart = monthDate(-1, day + 1);
    actualEnd = endDate;
  } else if (group === 'prev_cancelled') {
    status = 'cancelled';
    startDate = monthDate(-1, day);
    endDate = monthDate(-1, day + 4);
  } else if (group === 'next_completed') {
    status = 'completed';
    startDate = monthDate(1, day);
    endDate = monthDate(1, day + 4);
    actualStart = monthDate(1, day + 1);
    actualEnd = endDate;
  } else {
    status = 'released';
    startDate = monthDate(1, day);
    endDate = monthDate(1, day + 5);
  }

  return {
    id,
    company_id: 'cmp_1',
    order_number: `OP-${id.slice(3)}`,
    product_id: productId,
    bom_id: bomId,
    routing_id: routingId,
    sales_order_id: null,
    warehouse_id: warehouseId,
    quantity_planned: quantity,
    status,
    planned_start_date: startDate,
    planned_end_date: endDate,
    actual_start_date: actualStart,
    actual_end_date: actualEnd,
    priority,
    notes: `Lote ${id} del dataset de demostración.`,
  };
}

function plannedNextOrders() {
  const products = ['prod_bici', 'prod_cargo', 'prod_rueda', 'prod_bici'];
  return Array.from({ length: 8 }, (_, index) => {
    const id = `po_${3033 + index}`;
    const productId = products[index % products.length];
    const [bomId, routingId, warehouseId] = PRODUCT_CONFIG[productId];
    const day = 3 + index * 2;
    return {
      id,
      company_id: 'cmp_1',
      order_number: `OP-${id.slice(3)}`,
      product_id: productId,
      bom_id: bomId,
      routing_id: routingId,
      sales_order_id: null,
      warehouse_id: warehouseId,
      quantity_planned: 10 + index * 3,
      status: 'planned',
      planned_start_date: monthDate(1, day),
      planned_end_date: monthDate(1, day + 2),
      actual_start_date: null,
      actual_end_date: null,
      priority: index === 3 ? 'high' : 'normal',
      notes: `Orden planificada ${id} para el mes siguiente.`,
    };
  });
}

function buildOrders() {
  return [...coreOrders(), ...EXTRA_ORDER_SPECS.map(extraOrder), ...plannedNextOrders()];
}

const OPERATION_OVERRIDES = {
  poo_3001_1: { scrap_quantity: 1 },
  poo_3001_3: { quantity_completed: 49 },
  poo_3002_2: {
    status: 'in_progress',
    actual_time_minutes: 180,
    quantity_completed: 12,
    started_at: relativeTimestamp(-36, '08:00'),
  },
  poo_3002_3: { status: 'pending' },
  poo_3008_1: {
    status: 'pending',
    actual_time_minutes: null,
    quantity_completed: 0,
    started_at: null,
    completed_at: null,
  },
  poo_3008_2: {
    status: 'pending',
    actual_time_minutes: null,
    quantity_completed: 0,
    started_at: null,
    completed_at: null,
  },
  poo_3008_3: {
    status: 'pending',
    actual_time_minutes: null,
    quantity_completed: 0,
    started_at: null,
    completed_at: null,
  },
  poo_3010_1: {
    status: 'pending',
    actual_time_minutes: null,
    quantity_completed: 0,
    started_at: null,
    completed_at: null,
  },
  poo_3010_2: {
    status: 'pending',
    actual_time_minutes: null,
    quantity_completed: 0,
    started_at: null,
    completed_at: null,
  },
  poo_3010_3: {
    status: 'pending',
    actual_time_minutes: null,
    quantity_completed: 0,
    started_at: null,
    completed_at: null,
  },
};

const OPERATION_DAYS = {
  po_3001: -51,
  po_3002: -37,
  po_3003: -33,
  po_3005: -3,
  po_3007: -47,
  po_3008: -2,
  po_3009: -1,
  po_3010: 0,
  po_3011: 1,
  po_3015: -19,
  po_3016: -16,
  po_3017: -13,
  po_3018: -10,
  po_3019: -7,
  po_3020: -4,
  po_3021: -2,
  po_3022: -1,
  po_3023: 0,
  po_3024: 2,
  po_3025: -44,
  po_3026: -40,
  po_3027: -36,
  po_3028: -32,
  po_3029: -28,
  po_3031: 15,
  po_3032: 20,
};

function operationsForOrder(order) {
  if (!['released', 'in_progress', 'completed'].includes(order.status)) return [];
  const routes = routingOperations.filter((op) => op.routing_id === order.routing_id);
  const quantity = order.quantity_planned;
  const baseDay = OPERATION_DAYS[order.id] ?? 0;
  return routes.map((route, index) => {
    const id = `poo_${order.id.slice(3)}_${index + 1}`;
    const planned = route.setup_time_minutes + route.run_time_per_unit_minutes * quantity;
    const override = OPERATION_OVERRIDES[id] || {};
    const status =
      override.status ||
      (order.status === 'completed'
        ? 'completed'
        : order.status === 'in_progress' && index === 0
          ? 'completed'
          : 'pending');
    const isDone = status === 'completed';
    const isActive = status === 'in_progress';
    const day = isDone ? baseDay + index : isActive ? baseDay + index : null;
    return {
      id,
      production_order_id: order.id,
      routing_operation_id: route.id,
      work_center_id: route.work_center_id,
      sequence: route.sequence,
      status,
      planned_time_minutes: planned,
      actual_time_minutes: isDone ? planned + 2 + index : isActive ? Math.round(planned / 2) : null,
      quantity_completed: isDone ? quantity : isActive ? Math.floor(quantity / 2) : 0,
      scrap_quantity: 0,
      operator_id: null,
      started_at: day === null ? null : relativeTimestamp(day, '08:00'),
      completed_at: isDone ? relativeTimestamp(day, '12:00') : null,
      ...override,
    };
  });
}

export const productionOrders = refreshableArray(buildOrders);

export const productionOrderOperations = refreshableArray(() =>
  buildOrders().flatMap(operationsForOrder),
);

export const materialConsumption = refreshableArray(() => [
  {
    id: 'mc_1',
    production_order_id: 'po_3001',
    po_operation_id: 'poo_3001_1',
    component_product_id: 'comp_tubo',
    bom_component_id: 'bc_6',
    warehouse_id: 'wh_mp',
    quantity_consumed: 306,
    uom_id: 'uom_m',
    lot_number: 'LOTE-TUBO-101',
    consumed_at: relativeTimestamp(-51, '08:30'),
    consumed_by: null,
  },
  {
    id: 'mc_2',
    production_order_id: 'po_3001',
    po_operation_id: 'poo_3001_2',
    component_product_id: 'comp_llanta',
    bom_component_id: 'bc_3',
    warehouse_id: 'wh_mp',
    quantity_consumed: 102,
    uom_id: 'uom_un',
    lot_number: 'LOTE-LLANTA-55',
    consumed_at: relativeTimestamp(-50, '09:00'),
    consumed_by: null,
  },
  {
    id: 'mc_3',
    production_order_id: 'po_3001',
    po_operation_id: 'poo_3001_2',
    component_product_id: 'rm_pintura',
    bom_component_id: 'bc_7',
    warehouse_id: 'wh_mp',
    quantity_consumed: 44,
    uom_id: 'uom_kg',
    lot_number: 'LOTE-PINT-9',
    consumed_at: relativeTimestamp(-49, '09:00'),
    consumed_by: null,
  },
  {
    id: 'mc_4',
    production_order_id: 'po_3002',
    po_operation_id: 'poo_3002_1',
    component_product_id: 'comp_tubo',
    bom_component_id: 'bc_6',
    warehouse_id: 'wh_mp',
    quantity_consumed: 185,
    uom_id: 'uom_m',
    lot_number: 'LOTE-TUBO-102',
    consumed_at: relativeTimestamp(-37, '08:30'),
    consumed_by: null,
  },
]);

export const productionOutput = refreshableArray(() => [
  {
    id: 'out_1',
    production_order_id: 'po_3001',
    product_id: 'prod_bici',
    warehouse_id: 'wh_pt',
    quantity_produced: 49,
    scrap_quantity: 1,
    lot_number: 'PT-BICI-3001',
    uom_id: 'uom_un',
    produced_at: relativeTimestamp(-44, '11:00'),
    recorded_by: null,
  },
]);

export const orderStations = [];
