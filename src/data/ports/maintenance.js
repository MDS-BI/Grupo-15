/**
 * @file Puerto de solo lectura de mantenimiento para US-08 (OEE y paradas).
 * No muta colecciones; entrega copias derivadas de los tickets resueltos.
 */

import { computeRepairMinutes, computeResponseMinutes } from '../../domain/maintenance.js';

function toMillis(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function inPeriod(value, period = {}) {
  const at = toMillis(value);
  if (at === null) return false;
  const from = period.from ? toMillis(period.from) : null;
  const to = period.to ? toMillis(period.to) : null;
  if (from !== null && at < from) return false;
  if (to !== null && at > to) return false;
  return true;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export class MaintenancePort {
  constructor({ tickets = [], preventiveOrders = [] } = {}) {
    this.tickets = tickets;
    this.preventiveOrders = preventiveOrders;
  }

  /** @returns {Array<Object>} Copia de los tickets resueltos del período. */
  resolvedTickets(period = {}) {
    return this.tickets
      .filter(
        (ticket) => ticket.ticket_status === 'resolved' && inPeriod(ticket.resolved_at, period)
      )
      .map((ticket) => ({
        ...ticket,
        response_minutes: computeResponseMinutes(ticket),
        repair_minutes: computeRepairMinutes(ticket),
      }));
  }

  resolvedTicketsForWorkCenter(workCenterId, period = {}) {
    return this.resolvedTickets(period).filter((ticket) => ticket.work_center_id === workCenterId);
  }

  downtimeMinutesForWorkCenter(workCenterId, period = {}) {
    return round2(
      this.resolvedTicketsForWorkCenter(workCenterId, period).reduce(
        (sum, ticket) => sum + (Number(ticket.downtime_minutes) || 0),
        0
      )
    );
  }

  downtimeMinutesByWorkCenter(period = {}) {
    const totals = {};
    for (const ticket of this.resolvedTickets(period)) {
      const key = ticket.work_center_id;
      totals[key] = round2((totals[key] || 0) + (Number(ticket.downtime_minutes) || 0));
    }
    return totals;
  }

  preventiveDowntimeMinutes(period = {}) {
    return round2(
      this.preventiveOrders
        .filter(
          (order) => order.status === 'completed' && inPeriod(order.completed_at, period)
        )
        .reduce((sum, order) => sum + (Number(order.downtime_minutes) || 0), 0)
    );
  }
}

/** @param {import('../ManufacturingStore.js').ManufacturingStore} store */
export function createMaintenancePort(store) {
  return new MaintenancePort({
    tickets: store.maintenanceTickets,
    preventiveOrders: store.preventiveMaintenanceOrders,
  });
}
