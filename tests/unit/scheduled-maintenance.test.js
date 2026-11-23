import { describe, it, expect } from 'vitest';
import {
  buildScheduledMaintenanceFromTicket,
  canEditMaintenanceFrequency,
  canResolveScheduledMaintenance,
  canRescheduleMaintenance,
  computeCorrectiveDowntime,
  effectiveMaintenanceEnd,
  isResolvedMaintenance,
} from '../../src/domain/maintenance.js';

function ticket(overrides = {}) {
  return {
    id: 'mt_1',
    ticket_code: 'MTO-1',
    work_center_id: 'wc_corte',
    description: 'Falla de prueba',
    priority: 'high',
    ticket_status: 'open',
    created_at: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

function scheduledEvent(overrides = {}) {
  return {
    id: 'maintenance:mt_1',
    kind: 'maintenance',
    sourceId: 'mt_1',
    maintenanceType: 'ticket',
    status: 'in_progress',
    scheduled_start_date: '2026-11-10',
    scheduled_end_date: '2026-11-20',
    ...overrides,
  };
}

describe('domain/maintenance - mantenimiento programado', () => {
  it('calcula la parada correctiva sin ingreso manual', () => {
    expect(computeCorrectiveDowntime('2026-11-10T08:00:00Z', '2026-11-10T09:30:30Z')).toBe(90.5);
    expect(computeCorrectiveDowntime('2026-11-10T09:00:00Z', '2026-11-10T08:00:00Z')).toBe(0);
    expect(() => computeCorrectiveDowntime('no-fecha', '2026-11-10T09:00:00Z')).toThrow(
      /fechas válidas/,
    );
  });

  it('proyecta la fecha final visible de activos vencidos y resueltos anticipados', () => {
    expect(effectiveMaintenanceEnd(scheduledEvent(), '2026-11-23')).toBe('2026-11-23');
    expect(effectiveMaintenanceEnd(scheduledEvent(), '2026-11-15')).toBe('2026-11-20');
    expect(
      effectiveMaintenanceEnd(
        scheduledEvent({
          status: 'resolved',
          resolved_at: '2026-11-18T10:00:00Z',
        }),
        '2026-11-23',
      ),
    ).toBe('2026-11-18');
    expect(
      effectiveMaintenanceEnd(
        scheduledEvent({
          status: 'completed',
          maintenanceType: 'preventive',
          completed_at: '2026-11-25T10:00:00Z',
        }),
        '2026-11-23',
      ),
    ).toBe('2026-11-20');
  });

  it('impide resolver eventos ya cerrados y aplica permisos por rol', () => {
    expect(canResolveScheduledMaintenance(scheduledEvent({ status: 'open' }))).toBe(true);
    expect(canResolveScheduledMaintenance(scheduledEvent({ status: 'planned' }))).toBe(true);
    expect(canResolveScheduledMaintenance(scheduledEvent())).toBe(true);
    expect(canResolveScheduledMaintenance(scheduledEvent({ status: 'resolved' }))).toBe(false);
    expect(
      canResolveScheduledMaintenance(
        scheduledEvent({ status: 'completed', maintenanceType: 'preventive' }),
      ),
    ).toBe(false);
    expect(
      canResolveScheduledMaintenance(
        scheduledEvent({ status: 'cancelled', maintenanceType: 'preventive' }),
      ),
    ).toBe(false);
    expect(isResolvedMaintenance(scheduledEvent({ status: 'completed' }))).toBe(true);
    expect(canRescheduleMaintenance('maintenance')).toBe(true);
    expect(canRescheduleMaintenance('plant_manager')).toBe(false);
    expect(canRescheduleMaintenance('operator')).toBe(false);
    expect(canEditMaintenanceFrequency('maintenance')).toBe(true);
    expect(canEditMaintenanceFrequency('plant_manager')).toBe(true);
    expect(canEditMaintenanceFrequency('supervisor')).toBe(false);
  });

  it('construye un evento correctivo desde un ticket sin mutarlo', () => {
    const source = ticket();
    const snapshot = JSON.stringify(source);
    const event = buildScheduledMaintenanceFromTicket(source, {
      scheduled_start_date: '2026-11-10',
      scheduled_end_date: '2026-11-12',
      technician_ext_hr_employee_id: 'ext_hr_tec_01',
    });

    expect(JSON.stringify(source)).toBe(snapshot);
    expect(event.id).toBe('maintenance:mt_1');
    expect(event.kind).toBe('maintenance');
    expect(event.maintenanceType).toBe('ticket');
    expect(event.sourceId).toBe('mt_1');
    expect(event.status).toBe('open');
    expect(event.scheduled_start_date).toBe('2026-11-10');
    expect(event.scheduled_end_date).toBe('2026-11-12');
    expect(event.technician_ext_hr_employee_id).toBe('ext_hr_tec_01');
    expect(event.visible_end_date).toBe('2026-11-12');
  });

  it('valida rango, técnico y estado al programar desde ticket', () => {
    expect(() =>
      buildScheduledMaintenanceFromTicket(ticket(), {
        scheduled_start_date: '2026-11-12',
        scheduled_end_date: '2026-11-10',
        technician_ext_hr_employee_id: 'ext_hr_tec_01',
      }),
    ).toThrow(/anterior/);
    expect(() =>
      buildScheduledMaintenanceFromTicket(ticket(), {
        scheduled_start_date: '2026-11-10',
        scheduled_end_date: '2026-11-12',
        technician_ext_hr_employee_id: '',
      }),
    ).toThrow(/técnico/i);
    expect(() =>
      buildScheduledMaintenanceFromTicket(ticket({ ticket_status: 'resolved' }), {
        scheduled_start_date: '2026-11-10',
        scheduled_end_date: '2026-11-12',
        technician_ext_hr_employee_id: 'ext_hr_tec_01',
      }),
    ).toThrow(/resuelto/i);
  });
});
