/**
 * @file Reglas puras de mantenimiento correctivo y preventivo (US-09).
 * Ver contracts/maintenance.md §3 y §5.
 */

import {
  MaintenancePriority,
  MaintenanceTicketStatus,
  PreventiveMaintenanceOrderStatus,
  WorkCenterOperationalStatus,
} from './types.js';

const PRIORITY_RANK = Object.freeze({
  [MaintenancePriority.URGENT]: 0,
  [MaintenancePriority.HIGH]: 1,
  [MaintenancePriority.NORMAL]: 2,
});

const TICKET_TRANSITIONS = Object.freeze({
  [MaintenanceTicketStatus.OPEN]: [MaintenanceTicketStatus.IN_PROGRESS],
  [MaintenanceTicketStatus.IN_PROGRESS]: [MaintenanceTicketStatus.RESOLVED],
  [MaintenanceTicketStatus.RESOLVED]: [],
});

const PREVENTIVE_TRANSITIONS = Object.freeze({
  [PreventiveMaintenanceOrderStatus.PLANNED]: [
    PreventiveMaintenanceOrderStatus.IN_PROGRESS,
    PreventiveMaintenanceOrderStatus.CANCELLED,
  ],
  [PreventiveMaintenanceOrderStatus.IN_PROGRESS]: [
    PreventiveMaintenanceOrderStatus.COMPLETED,
    PreventiveMaintenanceOrderStatus.CANCELLED,
  ],
  [PreventiveMaintenanceOrderStatus.COMPLETED]: [],
  [PreventiveMaintenanceOrderStatus.CANCELLED]: [],
});

function round2(value) {
  return Math.round(value * 100) / 100;
}

function toMillis(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function createdAt(ticket) {
  return ticket.resolved_at || ticket.created_at || '';
}

/** @param {Array<import('./types.js').MaintenanceTicket>} tickets */
export function sortTicketsByPriorityAndAge(tickets = []) {
  return [...tickets].sort((a, b) => {
    const rankA = PRIORITY_RANK[a.priority] ?? 99;
    const rankB = PRIORITY_RANK[b.priority] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const timeA = toMillis(a.created_at) ?? 0;
    const timeB = toMillis(b.created_at) ?? 0;
    return timeA - timeB;
  });
}

/** @param {import('./types.js').MaintenanceTicket|null} ticket */
export function canStartIntervention(ticket, activeTicketsForWorkCenter = [], technicianId) {
  if (!ticket) return false;
  if (ticket.ticket_status !== MaintenanceTicketStatus.OPEN) return false;
  if (technicianId !== undefined && !String(technicianId || '').trim()) return false;
  return !activeTicketsForWorkCenter.some(
    (active) =>
      active &&
      active.id !== ticket.id &&
      active.work_center_id === ticket.work_center_id &&
      active.ticket_status === MaintenanceTicketStatus.IN_PROGRESS,
  );
}

/** @param {import('./types.js').MaintenanceTicket|null} ticket */
export function canResolveTicket(ticket) {
  return Boolean(ticket) && ticket.ticket_status === MaintenanceTicketStatus.IN_PROGRESS;
}

/** @param {import('./types.js').MaintenanceTicket|null} ticket */
export function canTransitionTicket(ticket, nextStatus) {
  if (!ticket) return false;
  const allowed = TICKET_TRANSITIONS[ticket.ticket_status] || [];
  return allowed.includes(nextStatus);
}

/**
 * @param {string} startedAt
 * @param {string} endedAt
 * @returns {number} Minutos de parada redondeados a 2 decimales.
 */
export function computeDowntimeMinutes(startedAt, endedAt) {
  const start = toMillis(startedAt);
  const end = toMillis(endedAt);
  if (start === null || end === null) {
    throw new Error('Las marcas de parada no son fechas válidas.');
  }
  if (end < start) {
    throw new Error('downtime_ended_at no puede ser anterior a downtime_started_at.');
  }
  return round2((end - start) / 60000);
}

/** @param {import('./types.js').MaintenanceTicket} ticket */
export function computeResponseMinutes(ticket) {
  if (!ticket || !ticket.intervention_started_at) return null;
  const created = toMillis(ticket.created_at);
  const started = toMillis(ticket.intervention_started_at);
  if (created === null || started === null) return null;
  return round2(Math.max(0, (started - created) / 60000));
}

/** @param {import('./types.js').MaintenanceTicket} ticket */
export function computeRepairMinutes(ticket) {
  if (!ticket || !ticket.intervention_started_at || !ticket.resolved_at) return null;
  const started = toMillis(ticket.intervention_started_at);
  const resolved = toMillis(ticket.resolved_at);
  if (started === null || resolved === null) return null;
  return round2(Math.max(0, (resolved - started) / 60000));
}

/**
 * Indicador derivado de desgaste por máquina. No se persiste.
 * @param {Array<import('./types.js').MaintenanceTicket>} tickets
 * @param {string} workCenterId
 * @param {{from?:string, to?:string}} [period]
 */
export function deriveWearIndicator(tickets = [], workCenterId, period = {}) {
  const from = period.from ? toMillis(period.from) : null;
  const to = period.to ? toMillis(period.to) : null;

  const resolved = tickets.filter((ticket) => {
    if (ticket.work_center_id !== workCenterId) return false;
    if (ticket.ticket_status !== MaintenanceTicketStatus.RESOLVED) return false;
    if (from === null && to === null) return true;
    const at = toMillis(createdAt(ticket));
    if (at === null) return false;
    if (from !== null && at < from) return false;
    if (to !== null && at > to) return false;
    return true;
  });

  const totalDowntime = resolved.reduce(
    (sum, ticket) => sum + (Number(ticket.downtime_minutes) || 0),
    0,
  );
  const failureCount = resolved.length;
  const mttr = failureCount > 0 ? totalDowntime / failureCount : 0;
  const score = failureCount + totalDowntime / 120;

  let wearLevel = 'low';
  if (score >= 3) wearLevel = 'high';
  else if (score >= 1.5) wearLevel = 'medium';

  return {
    work_center_id: workCenterId,
    failure_count: failureCount,
    total_downtime_minutes: round2(totalDowntime),
    mttr_minutes: round2(mttr),
    wear_level: wearLevel,
    last_failure_at:
      resolved
        .map((ticket) => ticket.resolved_at)
        .filter(Boolean)
        .sort((a, b) => (toMillis(b) ?? 0) - (toMillis(a) ?? 0))[0] || null,
  };
}

/**
 * Deriva la disponibilidad del centro al resolver un ticket.
 * @param {import('./types.js').ProductionOrderOperation|null} activeOperation
 * @param {import('./types.js').MaintenanceTicket} [resolvedTicket]
 */
export function resolveAvailabilityStatus(activeOperation, resolvedTicket) {
  if (resolvedTicket && resolvedTicket.ticket_status !== MaintenanceTicketStatus.RESOLVED) {
    return WorkCenterOperationalStatus.FAULT;
  }
  if (activeOperation && activeOperation.status === 'in_progress') {
    return WorkCenterOperationalStatus.IN_OPERATION;
  }
  if (activeOperation && activeOperation.status === 'paused') {
    return WorkCenterOperationalStatus.PAUSED;
  }
  if (activeOperation && activeOperation.status === 'changeover') {
    return WorkCenterOperationalStatus.CHANGEOVER;
  }
  return WorkCenterOperationalStatus.AVAILABLE;
}

/** @param {import('./types.js').PreventiveMaintenanceOrder|null} order */
export function canTransitionPreventiveOrder(order, nextStatus) {
  if (!order) return false;
  const allowed = PREVENTIVE_TRANSITIONS[order.status] || [];
  return allowed.includes(nextStatus);
}

/**
 * Construye un borrador de orden preventiva a partir del historial de la máquina.
 * @param {Array<import('./types.js').MaintenanceTicket>} tickets
 * @param {string} workCenterId
 * @param {string} plannedDate
 */
export function buildPreventiveOrderFromHistory(tickets = [], workCenterId, plannedDate) {
  const history = tickets
    .filter(
      (ticket) =>
        ticket.work_center_id === workCenterId &&
        ticket.ticket_status === MaintenanceTicketStatus.RESOLVED,
    )
    .sort((a, b) => (toMillis(b.resolved_at) ?? 0) - (toMillis(a.resolved_at) ?? 0));

  const source = history[0] || null;
  const wear = deriveWearIndicator(tickets, workCenterId);

  return {
    work_center_id: workCenterId,
    source_ticket_id: source ? source.id : null,
    title: source
      ? `Preventiva por desgaste: ${source.description}`
      : `Mantenimiento preventivo programado (${workCenterId})`,
    planned_date: plannedDate,
    status: PreventiveMaintenanceOrderStatus.PLANNED,
    technician_ext_hr_employee_id: null,
    completed_at: null,
    downtime_minutes: null,
    notes: `Desgaste ${wear.wear_level}; ${wear.failure_count} fallo(s); ${wear.total_downtime_minutes} min de parada.`,
  };
}

/**
 * Idempotencia del escalamiento: un evento de parada origina como máximo un ticket.
 * @param {Array<import('./types.js').MaintenanceTicket>} tickets
 * @param {string|null|undefined} operationDelayId
 */
export function hasTicketForOperationDelay(tickets = [], operationDelayId) {
  if (!operationDelayId) return false;
  return tickets.some((ticket) => ticket.operation_delay_id === operationDelayId);
}
