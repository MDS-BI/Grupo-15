import { describe, it, expect } from 'vitest';
import { relativeDay, relativeTimestamp } from '../../src/data/fixtures/demo-dates.js';
import { productionOrders } from '../../src/data/fixtures/production-orders.js';
import { productionShifts, operationDelays } from '../../src/data/fixtures/production-shifts.js';
import { maintenanceTickets } from '../../src/data/fixtures/maintenance-tickets.js';
import { preventiveMaintenanceOrders } from '../../src/data/fixtures/preventive-maintenance-orders.js';
import { salesOrders } from '../../src/data/fixtures/master-data.js';
import { thresholdSettings, rolePermissions } from '../../src/data/fixtures/plant-performance.js';
import { shiftAssignments } from '../../src/data/fixtures/shift-assignments.js';

function localNow() {
  return new Date(2026, 5, 15, 12, 0, 0);
}

function dayDiff(value) {
  const today = new Date(`${relativeDay(0)}T12:00:00`);
  const date = new Date(`${value}T12:00:00`);
  return Math.round((date - today) / 86400000);
}

describe('Fechas relativas de la demo', () => {
  it('calcula días y marcas de tiempo relativos a hoy', () => {
    const now = localNow();

    expect(relativeDay(0, now)).toBe('2026-06-15');
    expect(relativeDay(-3, now)).toBe('2026-06-12');
    expect(relativeDay(4, now)).toBe('2026-06-19');
    expect(relativeTimestamp(-2, '08:30', now)).toBe('2026-06-13T08:30:00Z');
  });

  it('mantiene todas las marcas de los fixtures cerca de la fecha actual', () => {
    const values = [];

    for (const order of productionOrders) {
      values.push(order.planned_start_date, order.planned_end_date);
      if (order.actual_start_date) values.push(order.actual_start_date);
      if (order.actual_end_date) values.push(order.actual_end_date);
    }
    for (const shift of productionShifts) {
      if (shift.started_at) values.push(shift.started_at.slice(0, 10));
      if (shift.ended_at) values.push(shift.ended_at.slice(0, 10));
      if (shift.validated_at) values.push(shift.validated_at.slice(0, 10));
    }
    for (const delay of operationDelays) {
      values.push(delay.started_at.slice(0, 10));
      if (delay.ended_at) values.push(delay.ended_at.slice(0, 10));
    }
    for (const ticket of maintenanceTickets) values.push(ticket.created_at.slice(0, 10));
    for (const order of preventiveMaintenanceOrders) values.push(order.planned_date);
    for (const order of salesOrders) values.push(order.requested_date);
    for (const setting of thresholdSettings) values.push(setting.updated_at.slice(0, 10));
    for (const permission of rolePermissions) values.push(permission.updated_at.slice(0, 10));
    for (const assignment of shiftAssignments) values.push(assignment.assigned_at.slice(0, 10));

    for (const value of values.filter(Boolean)) {
      const diff = dayDiff(value);
      expect(diff).toBeGreaterThanOrEqual(-60);
      expect(diff).toBeLessThanOrEqual(30);
    }
  });

  it('conserva el orden de fechas planificadas de las órdenes', () => {
    for (const order of productionOrders) {
      expect(order.planned_end_date >= order.planned_start_date).toBe(true);
      if (order.actual_start_date && order.actual_end_date) {
        expect(order.actual_end_date >= order.actual_start_date).toBe(true);
      }
    }
  });

  it('mantiene el dataset semilla vigente con fechas relativas de FR-21', () => {
    const currentMonth = relativeDay(0).slice(0, 7);
    const startWindow = new Set(Array.from({ length: 13 }, (_, index) => relativeDay(index - 2)));
    const currentStarts = productionOrders.filter(
      (order) =>
        order.planned_start_date &&
        startWindow.has(order.planned_start_date) &&
        order.planned_start_date.startsWith(currentMonth),
    );
    const undatedOrders = productionOrders.filter(
      (order) =>
        order.status === 'planned' &&
        order.planned_start_date === null &&
        order.planned_end_date === null,
    );
    const scheduledTickets = maintenanceTickets.filter(
      (ticket) =>
        ticket.ticket_status !== 'resolved' &&
        ticket.scheduled_start_date >= relativeDay(0) &&
        ticket.scheduled_start_date <= relativeDay(2) &&
        ticket.scheduled_end_date <= relativeDay(5),
    );
    const upcomingPreventives = preventiveMaintenanceOrders.filter(
      (order) =>
        order.status === 'planned' &&
        order.planned_date >= relativeDay(2) &&
        order.planned_date <= relativeDay(8),
    );

    expect(productionOrders.length).toBeGreaterThanOrEqual(13);
    expect(currentStarts.length).toBeGreaterThanOrEqual(4);
    expect(undatedOrders.length).toBeGreaterThanOrEqual(2);
    expect(scheduledTickets.length).toBeGreaterThanOrEqual(2);
    expect(upcomingPreventives.length).toBeGreaterThanOrEqual(2);
  });
});
