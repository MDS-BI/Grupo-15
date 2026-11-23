import { describe, it, expect } from 'vitest';
import {
  buildCalendarRange,
  calendarEventsForMonth,
  canEditOrderSchedule,
  canViewOrderDetails,
  filterCalendarEvents,
  sortPendingOrders,
} from '../../src/domain/calendar-scheduling.js';

const orders = [
  {
    id: 'po_critical',
    order_number: 'OP-100',
    priority: 'high',
    is_critical_urgent: true,
    planned_start_date: '2026-11-04',
    planned_end_date: '2026-11-05',
    status: 'planned',
    quantity_planned: 10,
    quantity_completed: 5,
    work_center_id: 'wc_corte',
  },
  {
    id: 'po_low',
    order_number: 'OP-101',
    priority: 'low',
    is_critical_urgent: false,
    planned_start_date: '2026-11-03',
    planned_end_date: '2026-11-03',
    status: 'planned',
    quantity_planned: 10,
    quantity_completed: 0,
  },
  {
    id: 'po_urgent',
    order_number: 'OP-102',
    priority: 'urgent',
    is_critical_urgent: false,
    planned_start_date: '2026-11-02',
    planned_end_date: '2026-11-02',
    status: 'released',
    quantity_planned: 10,
    quantity_completed: 10,
    work_center_id: 'wc_solda',
  },
  {
    id: 'po_high',
    order_number: 'OP-103',
    priority: 'high',
    is_critical_urgent: false,
    planned_start_date: '2026-11-01',
    planned_end_date: '2026-11-01',
    status: 'planned',
    quantity_planned: 10,
    quantity_completed: 2,
  },
];

const maintenanceTickets = [
  {
    id: 'mt_dup',
    ticket_code: 'MTO-001',
    description: 'Ticket duplicado',
    work_center_id: 'wc_corte',
    priority: 'urgent',
    ticket_status: 'open',
    scheduled_start_date: '2026-11-06',
    scheduled_end_date: '2026-11-06',
  },
  {
    id: 'mt_keep',
    ticket_code: 'MTO-002',
    description: 'Ticket sin programación',
    work_center_id: 'wc_armado',
    priority: 'high',
    ticket_status: 'open',
  },
];

const preventiveMaintenanceOrders = [
  {
    id: 'pmo_dup',
    order_code: 'PM-001',
    title: 'Preventiva duplicada',
    work_center_id: 'wc_corte',
    source_ticket_id: 'mt_dup',
    planned_date: '2026-11-07',
    status: 'planned',
  },
  {
    id: 'pmo_keep',
    order_code: 'PM-002',
    title: 'Preventiva independiente',
    work_center_id: 'wc_pintura',
    source_ticket_id: 'mt_keep',
    planned_date: '2026-11-08',
    status: 'planned',
  },
];

describe('calendar-scheduling - rangos y eventos (US-13)', () => {
  it('construye rangos inclusivos aplicando horas por día', () => {
    expect(buildCalendarRange('2026-11-10', '2026-11-12', '09:30', '17:00')).toEqual({
      start_date: '2026-11-10',
      end_date: '2026-11-12',
      start_time: '09:30',
      end_time: '17:00',
      days: ['2026-11-10', '2026-11-11', '2026-11-12'],
    });
    expect(buildCalendarRange('2026-11-12', '2026-11-10').days).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
    ]);
  });

  it('unifica órdenes y mantenciones sin duplicar preventivas con source_ticket_id', () => {
    const events = calendarEventsForMonth('2026-11', {
      orders,
      maintenanceTickets,
      preventiveMaintenanceOrders,
    });

    expect(events.filter((event) => event.kind === 'order')).toHaveLength(4);
    expect(events.map((event) => event.id)).toContain('order:po_critical');
    expect(events.map((event) => event.id)).toContain('maintenance:mt_dup');
    expect(events.map((event) => event.id)).toContain('maintenance:pmo_keep');
    expect(events.map((event) => event.id)).not.toContain('maintenance:pmo_dup');
    expect(events.find((event) => event.id === 'order:po_critical')).toMatchObject({
      sourceId: 'po_critical',
      start_date: '2026-11-04',
      end_date: '2026-11-05',
      start_time: '08:00',
      end_time: '16:00',
      is_critical_urgent: true,
    });
    expect(events.find((event) => event.id === 'maintenance:mt_dup').title).toContain('MTO-001');
  });

  it('aplica filtro Ambos por defecto y filtros secundarios', () => {
    const events = calendarEventsForMonth('2026-11', {
      orders,
      maintenanceTickets,
      preventiveMaintenanceOrders,
    });

    expect(filterCalendarEvents(events)).toHaveLength(events.length);
    expect(
      filterCalendarEvents(events, { kind: 'Solo Órdenes de Trabajo' }).every(
        (event) => event.kind === 'order',
      ),
    ).toBe(true);
    expect(
      filterCalendarEvents(events, { kind: 'Solo Mantenciones' }).every(
        (event) => event.kind === 'maintenance',
      ),
    ).toBe(true);
    expect(
      filterCalendarEvents(events, { workCenterId: 'wc_corte' }).map((event) => event.id),
    ).toEqual(['order:po_critical', 'maintenance:mt_dup']);
    expect(
      filterCalendarEvents(events, { isCriticalUrgent: true }).map((event) => event.id),
    ).toEqual(['order:po_critical']);
  });

  it('ordena pendientes por criticidad, prioridad y expone % de avance', () => {
    const rows = sortPendingOrders(orders);
    expect(rows.map((order) => order.id)).toEqual([
      'po_critical',
      'po_urgent',
      'po_high',
      'po_low',
    ]);
    expect(rows[0].progress_percent).toBe(50);
    expect(rows[0]['% de avance']).toBe('50%');
    expect(rows[1]['% de avance']).toBe('100%');
  });

  it('restringe edición de horarios y detalle de órdenes por rol', () => {
    expect(canEditOrderSchedule('planner')).toBe(true);
    expect(canEditOrderSchedule('plant_manager')).toBe(true);
    expect(canEditOrderSchedule('supervisor')).toBe(false);
    expect(canEditOrderSchedule('operator')).toBe(false);
    expect(canEditOrderSchedule('maintenance')).toBe(false);

    const assigned = { id: 'po_critical', operator_id: 'emp_op_01' };
    expect(canViewOrderDetails('operator', assigned, { operatorId: 'emp_op_01' })).toBe(true);
    expect(canViewOrderDetails('operator', assigned, { operatorId: 'emp_op_02' })).toBe(false);
    expect(canViewOrderDetails('supervisor', assigned)).toBe(true);
    expect(canViewOrderDetails('maintenance', assigned)).toBe(true);
    expect(canViewOrderDetails('plant_manager', assigned)).toBe(true);
  });
});
