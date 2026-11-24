export const MACHINE_CALENDAR_STATUSES = Object.freeze({
  NONE: 'none',
  CORRECTIVE: 'corrective',
  PLANNED_USE: 'planned_use',
  PREVENTIVE: 'preventive',
});

export const MACHINE_CALENDAR_COLUMNS = Object.freeze(['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D']);

const STATUS_RANK = Object.freeze({
  none: 0,
  planned_use: 1,
  preventive: 2,
  corrective: 3,
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function pad(value) {
  return String(value).padStart(2, '0');
}

function isoFromDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function isoDate(value) {
  if (typeof value !== 'string') return null;
  if (ISO_DATE.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return value;
    }
    return null;
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ]/);
  if (match && ISO_DATE.test(match[1])) return match[1];
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? isoFromDate(parsed) : null;
}

function firstDate(item, fields) {
  for (const field of fields) {
    const date = isoDate(item?.[field]);
    if (date) return date;
  }
  return null;
}

function itemRange(item, fields) {
  const start = firstDate(item, fields.start);
  const end = firstDate(item, fields.end);
  if (!start && !end) return null;
  return start && end
    ? start <= end
      ? { start, end }
      : { start: end, end: start }
    : {
        start: start || end,
        end: start || end,
      };
}

const TICKET_RANGE = Object.freeze({
  start: ['scheduled_start_date', 'start_date', 'created_at', 'resolved_at', 'scheduled_end_date'],
  end: ['scheduled_end_date', 'end_date', 'resolved_at', 'created_at', 'scheduled_start_date'],
});

const ORDER_RANGE = Object.freeze({
  start: ['scheduled_start_date', 'start_date', 'planned_start_date', 'planned_date', 'end_date'],
  end: ['scheduled_end_date', 'end_date', 'planned_end_date', 'planned_date', 'start_date'],
});

const PREVENTIVE_RANGE = Object.freeze({
  start: ['scheduled_start_date', 'start_date', 'planned_date', 'planned_start_date', 'end_date'],
  end: ['scheduled_end_date', 'end_date', 'scheduled_start_date', 'planned_date', 'start_date'],
});

function touchesWorkCenter(item, workCenterId) {
  if (!workCenterId) return false;
  if (item?.work_center_id === workCenterId || item?.machine_id === workCenterId) return true;
  const operations = Array.isArray(item?.operations) ? item.operations : [];
  return operations.some(
    (operation) =>
      operation?.work_center_id === workCenterId || operation?.machine_id === workCenterId,
  );
}

function addMark(cell, status, source) {
  cell.sources.push(source);
  if (STATUS_RANK[status] > STATUS_RANK[cell.status]) {
    cell.status = status;
    cell.state = status;
  }
}

function sourceType(item) {
  if (item?.maintenanceType === 'preventive' || item?.kind === 'preventive') return 'preventive';
  return null;
}

function preventiveIsActive(item) {
  const status = item?.status || item?.order_status;
  return !status || ['planned', 'in_progress'].includes(status);
}

function markRange(cells, item, range, status, source, workCenterId) {
  if (!range || !touchesWorkCenter(item, workCenterId)) return;
  cells.forEach((cell) => {
    if (cell.date >= range.start && cell.date <= range.end) addMark(cell, status, source);
  });
}

export function buildMachineCalendarMonth({
  year,
  month,
  tickets = [],
  workOrders = [],
  preventiveOrders = [],
  workCenterId = null,
} = {}) {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  if (
    !Number.isInteger(numericYear) ||
    !Number.isInteger(numericMonth) ||
    numericMonth < 1 ||
    numericMonth > 12
  ) {
    throw new Error('El mes del calendario de máquina no es válido.');
  }

  const first = new Date(Date.UTC(numericYear, numericMonth - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(numericYear, numericMonth, 0)).getUTCDate();
  const weekCount = Math.ceil((offset + daysInMonth) / 7);
  const weeks = [];
  const cells = [];

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const week = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(first);
      date.setUTCDate(1 - offset + weekIndex * 7 + dayIndex);
      const cell = {
        date: isoFromDate(date),
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === numericMonth - 1,
        status: MACHINE_CALENDAR_STATUSES.NONE,
        state: MACHINE_CALENDAR_STATUSES.NONE,
        sources: [],
      };
      week.push(cell);
      cells.push(cell);
    }
    weeks.push(week);
  }

  (Array.isArray(tickets) ? tickets : []).forEach((ticket) => {
    markRange(
      cells,
      ticket,
      itemRange(ticket, TICKET_RANGE),
      MACHINE_CALENDAR_STATUSES.CORRECTIVE,
      { type: 'ticket', id: ticket?.id || ticket?.ticket_code || null },
      workCenterId,
    );
  });

  (Array.isArray(preventiveOrders) ? preventiveOrders : []).forEach((order) => {
    if (!preventiveIsActive(order)) return;
    markRange(
      cells,
      order,
      itemRange(order, PREVENTIVE_RANGE),
      MACHINE_CALENDAR_STATUSES.PREVENTIVE,
      { type: sourceType(order) || 'preventive', id: order?.id || order?.order_code || null },
      workCenterId,
    );
  });

  (Array.isArray(workOrders) ? workOrders : []).forEach((order) => {
    markRange(
      cells,
      order,
      itemRange(order, ORDER_RANGE),
      MACHINE_CALENDAR_STATUSES.PLANNED_USE,
      { type: 'work_order', id: order?.id || order?.order_number || null },
      workCenterId,
    );
  });

  return Object.assign(weeks, {
    year: numericYear,
    month: numericMonth,
    columns: [...MACHINE_CALENDAR_COLUMNS],
    weeks,
    cells,
  });
}
