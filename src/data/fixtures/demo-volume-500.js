import { relativeDay } from './demo-dates.js';
import { routingOperations } from './routings.js';

const PRODUCT_ROUTES = [
  ['prod_bici', 'bom_bici', 'rt_bici', 'wh_pt'],
  ['prod_cargo', 'bom_cargo', 'rt_cargo', 'wh_pt'],
  ['prod_rueda', 'bom_rueda', 'rt_rueda', 'wh_wip'],
  ['prod_cuadro', 'bom_cuadro', 'rt_cuadro', 'wh_wip'],
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function monthDate(offset, day) {
  const anchor = new Date(`${relativeDay(0)}T12:00:00Z`);
  const target = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const safeDay = Math.max(1, Math.min(day, lastDay));
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(safeDay)}`;
}

function statusFor(index) {
  if (index < 125) return 'completed';
  if (index < 225) return 'in_progress';
  if (index < 325) return 'released';
  if (index < 450) return 'planned';
  return 'cancelled';
}

function monthOffsetFor(index) {
  if (index < 150) return -1;
  if (index < 350) return 0;
  return 1;
}

function makeOrder(index) {
  const [productId, bomId, routingId, warehouseId] = PRODUCT_ROUTES[index % PRODUCT_ROUTES.length];
  const monthOffset = monthOffsetFor(index);
  const day = 1 + (index % 27);
  const status = statusFor(index);
  const isDone = status === 'completed';
  const isStarted = status === 'in_progress';
  return {
    id: `po_5_${pad(index + 1)}`,
    company_id: 'cmp_1',
    order_number: `OP-V500-${pad(index + 1)}`,
    product_id: productId,
    bom_id: bomId,
    routing_id: routingId,
    sales_order_id: null,
    warehouse_id: warehouseId,
    quantity_planned: 5 + (index % 20),
    status,
    planned_start_date: monthDate(monthOffset, day),
    planned_end_date: monthDate(monthOffset, day + 2),
    actual_start_date: isDone || isStarted ? monthDate(monthOffset, day + 1) : null,
    actual_end_date: isDone ? monthDate(monthOffset, day + 2) : null,
    priority: index % 7 === 0 ? 'urgent' : index % 5 === 0 ? 'high' : 'normal',
    notes: `Orden sintética ${index + 1} del dataset de 500.`,
  };
}

function makeOperations(order) {
  if (!['released', 'in_progress', 'completed'].includes(order.status)) return [];
  return routingOperations
    .filter((op) => op.routing_id === order.routing_id)
    .map((route, index) => {
      const planned =
        route.setup_time_minutes + route.run_time_per_unit_minutes * order.quantity_planned;
      const status =
        order.status === 'completed' || (order.status === 'in_progress' && index === 0)
          ? 'completed'
          : 'pending';
      return {
        id: `poo_5_${order.id.slice(5)}_${index + 1}`,
        production_order_id: order.id,
        routing_operation_id: route.id,
        work_center_id: route.work_center_id,
        sequence: route.sequence,
        status,
        planned_time_minutes: planned,
        actual_time_minutes: status === 'completed' ? planned : null,
        quantity_completed: status === 'completed' ? order.quantity_planned : 0,
        scrap_quantity: 0,
        operator_id: null,
        started_at: status === 'completed' ? `${order.planned_start_date}T08:00:00Z` : null,
        completed_at: status === 'completed' ? `${order.planned_end_date}T12:00:00Z` : null,
      };
    });
}

export function buildDemoVolume500() {
  const productionOrders = Array.from({ length: 500 }, (_, index) => makeOrder(index));
  return {
    productionOrders,
    productionOrderOperations: productionOrders.flatMap(makeOperations),
  };
}

export const demoVolume500 = buildDemoVolume500();
