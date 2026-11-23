import { isValidIsoDate } from './order-scheduling.js';

export const CALENDAR_KIND_FILTERS = Object.freeze({
  ALL: 'Ambos',
  ORDERS: 'Solo Órdenes de Trabajo',
  MAINTENANCE: 'Solo Mantenciones',
});

export const DEFAULT_CALENDAR_FILTER = CALENDAR_KIND_FILTERS.ALL;

const DEFAULT_START_TIME = '08:00';
const DEFAULT_END_TIME = '16:00';
const PRIORITY_RANK = Object.freeze({ urgent: 0, high: 1, normal: 2, low: 3 });

function pad(value) {
  return String(value).padStart(2, '0');
}

function isoFromDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(isoDate, count) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return isoFromDate(new Date(Date.UTC(year, month - 1, day + count)));
}

function monthBounds(month) {
  const [year, rawMonth] = String(month).split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(rawMonth) || rawMonth < 1 || rawMonth > 12) {
    return null;
  }
  return {
    start: `${year}-${pad(rawMonth)}-01`,
    end: isoFromDate(new Date(Date.UTC(year, rawMonth, 0))),
  };
}

function orderedRange(startDate, endDate) {
  const first = startDate || endDate;
  const last = endDate || startDate;
  if (!first || !last) return null;
  return first <= last ? { start: first, end: last } : { start: last, end: first };
}

function overlapsMonth(startDate, endDate, bounds) {
  const range = orderedRange(startDate, endDate);
  if (!range || !bounds) return false;
  return range.start <= bounds.end && range.end >= bounds.start;
}

function orderWorkCenter(order, operations = []) {
  if (order.work_center_id) return order.work_center_id;
  const operation = operations.find((row) => row.production_order_id === order.id);
  return operation?.work_center_id || null;
}

function orderTitle(order) {
  return [order.order_number, order.product_name].filter(Boolean).join(' · ') || order.id;
}

export function buildCalendarRange(
  startDay,
  endDay,
  startTime = DEFAULT_START_TIME,
  endTime = DEFAULT_END_TIME,
) {
  if (
    typeof startDay !== 'string' ||
    typeof endDay !== 'string' ||
    !isValidIsoDate(startDay) ||
    !isValidIsoDate(endDay)
  ) {
    throw new Error('Las fechas del rango deben tener el formato YYYY-MM-DD y existir.');
  }
  const start_date = startDay <= endDay ? startDay : endDay;
  const end_date = startDay <= endDay ? endDay : startDay;
  const days = [];
  for (let day = start_date; day <= end_date; day = addDays(day, 1)) days.push(day);
  return {
    start_date,
    end_date,
    start_time: startTime || DEFAULT_START_TIME,
    end_time: endTime || DEFAULT_END_TIME,
    days,
  };
}

export function calendarEventsForMonth(month, sources = {}) {
  const bounds = monthBounds(month);
  if (!bounds) return [];
  const {
    orders = [],
    maintenanceTickets = [],
    preventiveMaintenanceOrders = [],
    productionOrderOperations = [],
  } = sources;

  const events = [];
  for (const order of orders) {
    const start_date = order.scheduled_start_date || order.planned_start_date;
    const end_date = order.scheduled_end_date || order.planned_end_date;
    if (!overlapsMonth(start_date, end_date, bounds)) continue;
    events.push({
      ...order,
      id: `order:${order.id}`,
      kind: 'order',
      sourceId: order.id,
      title: orderTitle(order),
      start_date,
      end_date,
      start_time: order.scheduled_start_time || DEFAULT_START_TIME,
      end_time: order.scheduled_end_time || DEFAULT_END_TIME,
      status: order.status,
      priority: order.priority,
      is_critical_urgent: Boolean(order.is_critical_urgent),
      work_center_id: orderWorkCenter(order, productionOrderOperations),
    });
  }

  const scheduledTicketIds = new Set(
    maintenanceTickets
      .filter((ticket) => ticket.scheduled_start_date || ticket.scheduled_end_date)
      .map((ticket) => ticket.source_ticket_id || ticket.id),
  );

  for (const ticket of maintenanceTickets) {
    const start_date = ticket.scheduled_start_date || ticket.scheduled_end_date;
    const end_date = ticket.scheduled_end_date || ticket.scheduled_start_date;
    if (!overlapsMonth(start_date, end_date, bounds)) continue;
    events.push({
      ...ticket,
      id: `maintenance:${ticket.id}`,
      kind: 'maintenance',
      sourceId: ticket.id,
      title: [ticket.ticket_code, ticket.description].filter(Boolean).join(' · ') || ticket.id,
      start_date,
      end_date,
      start_time: ticket.scheduled_start_time || DEFAULT_START_TIME,
      end_time: ticket.scheduled_end_time || DEFAULT_END_TIME,
      status: ticket.ticket_status,
      priority: ticket.priority,
      is_critical_urgent: false,
      maintenanceType: 'ticket',
    });
  }

  for (const preventive of preventiveMaintenanceOrders) {
    if (preventive.source_ticket_id && scheduledTicketIds.has(preventive.source_ticket_id))
      continue;
    const start_date =
      preventive.scheduled_start_date || preventive.scheduled_end_date || preventive.planned_date;
    const end_date =
      preventive.scheduled_end_date || preventive.scheduled_start_date || preventive.planned_date;
    if (!overlapsMonth(start_date, end_date, bounds)) continue;
    events.push({
      ...preventive,
      id: `maintenance:${preventive.id}`,
      kind: 'maintenance',
      sourceId: preventive.id,
      title: [preventive.order_code, preventive.title].filter(Boolean).join(' · ') || preventive.id,
      start_date,
      end_date,
      start_time: preventive.scheduled_start_time || DEFAULT_START_TIME,
      end_time: preventive.scheduled_end_time || DEFAULT_END_TIME,
      status: preventive.status,
      priority: preventive.priority,
      is_critical_urgent: false,
      maintenanceType: 'preventive',
    });
  }

  return events;
}

export function filterCalendarEvents(events = [], filter = {}) {
  const kind = filter.kind || DEFAULT_CALENDAR_FILTER;
  const wantedKind =
    kind === CALENDAR_KIND_FILTERS.ORDERS
      ? 'order'
      : kind === CALENDAR_KIND_FILTERS.MAINTENANCE
        ? 'maintenance'
        : null;
  return events.filter((event) => {
    if (wantedKind && event.kind !== wantedKind) return false;
    if (filter.workCenterId && event.work_center_id !== filter.workCenterId) return false;
    if (
      typeof filter.isCriticalUrgent === 'boolean' &&
      Boolean(event.is_critical_urgent) !== filter.isCriticalUrgent
    ) {
      return false;
    }
    return true;
  });
}

function progressFor(order) {
  if (Number.isFinite(order.progress_percent)) return order.progress_percent;
  if (Array.isArray(order.operations) && order.operations.length) {
    const planned = order.operations.reduce(
      (sum, row) => sum + Number(row.quantity_planned || 0),
      0,
    );
    const completed = order.operations.reduce(
      (sum, row) => sum + Number(row.quantity_completed || 0),
      0,
    );
    if (planned > 0) return Number(((completed / planned) * 100).toFixed(1));
  }
  const planned = Number(order.quantity_planned || 0);
  const completed = Number(order.quantity_completed || 0);
  if (planned <= 0) return 0;
  return Number(((completed / planned) * 100).toFixed(1));
}

export function sortPendingOrders(orders = []) {
  return [...orders]
    .sort((a, b) => {
      if (Boolean(a.is_critical_urgent) !== Boolean(b.is_critical_urgent)) {
        return a.is_critical_urgent ? -1 : 1;
      }
      const aRank = PRIORITY_RANK[a.priority] ?? 99;
      const bRank = PRIORITY_RANK[b.priority] ?? 99;
      if (aRank !== bRank) return aRank - bRank;
      const aDue = a.planned_end_date || a.planned_start_date || '';
      const bDue = b.planned_end_date || b.planned_start_date || '';
      if (aDue !== bDue) {
        if (!aDue) return 1;
        if (!bDue) return -1;
        return aDue.localeCompare(bDue);
      }
      return String(a.order_number || a.id).localeCompare(String(b.order_number || b.id));
    })
    .map((order) => {
      const progress = progressFor(order);
      return { ...order, progress_percent: progress, '% de avance': `${progress}%` };
    });
}

export function canEditOrderSchedule(role) {
  return role === 'planner' || role === 'plant_manager';
}

export function canViewOrderDetails(role, order = {}, context = {}) {
  if (role === 'operator') {
    const operatorId = context.operatorId;
    if (!operatorId) return false;
    const assignedOrderIds = Array.isArray(context.assignedOrderIds)
      ? context.assignedOrderIds
      : [];
    return (
      order.operator_id === operatorId ||
      order.operator_ext_hr_employee_id === operatorId ||
      (Array.isArray(order.operator_ids) && order.operator_ids.includes(operatorId)) ||
      assignedOrderIds.includes(order.id)
    );
  }
  return ['plant_manager', 'supervisor', 'planner', 'maintenance'].includes(role);
}
