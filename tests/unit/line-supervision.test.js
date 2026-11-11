import { describe, it, expect } from 'vitest';
import {
  buildUrgentMaintenanceTicket,
  canAssignOperator,
  canValidateShiftClosure,
  deriveWorkCenterTrafficLight,
} from '../../src/domain/line-supervision.js';

describe('line-supervision', () => {
  it('prioriza el ticket activo y luego el estado operativo del centro', () => {
    const wc = { operational_status: 'available' };
    expect(deriveWorkCenterTrafficLight(wc, [], { ticket_status: 'open' })).toBe('fault');
    expect(deriveWorkCenterTrafficLight({ operational_status: 'changeover' }, [], null)).toBe(
      'changeover',
    );
    expect(
      deriveWorkCenterTrafficLight(wc, [{ status: 'in_progress' }, { status: 'pending' }], null),
    ).toBe('in_operation');
    expect(deriveWorkCenterTrafficLight(wc, [{ status: 'paused' }], null)).toBe('paused');
    expect(deriveWorkCenterTrafficLight(wc, [], null)).toBe('available');
    expect(deriveWorkCenterTrafficLight(null, [], null)).toBe('available');
  });

  it('evita duplicar operario o centro en la misma franja', () => {
    const assignments = [
      {
        active: true,
        work_center_id: 'wc_corte',
        ext_hr_employee_id: 'ext_hr_op_01',
        shift_band: 'morning',
      },
    ];
    expect(
      canAssignOperator(assignments, {
        work_center_id: 'wc_solda',
        ext_hr_employee_id: 'ext_hr_op_01',
        shift_band: 'morning',
      }),
    ).toBe(false);
    expect(
      canAssignOperator(assignments, {
        work_center_id: 'wc_corte',
        ext_hr_employee_id: 'ext_hr_op_02',
        shift_band: 'morning',
      }),
    ).toBe(false);
    expect(
      canAssignOperator(assignments, {
        work_center_id: 'wc_solda',
        ext_hr_employee_id: 'ext_hr_op_02',
        shift_band: 'morning',
      }),
    ).toBe(true);
    expect(
      canAssignOperator(assignments, {
        work_center_id: 'wc_corte',
        ext_hr_employee_id: 'ext_hr_op_01',
        shift_band: 'night',
      }),
    ).toBe(true);
  });

  it('bloquea la validación con atrasos abiertos o ya validada', () => {
    expect(canValidateShiftClosure({ supervisor_validated: false }, [])).toBe(true);
    expect(canValidateShiftClosure({ supervisor_validated: false }, [{ status: 'open' }])).toBe(
      false,
    );
    expect(canValidateShiftClosure({ supervisor_validated: true }, [])).toBe(false);
    expect(canValidateShiftClosure(null, [])).toBe(false);
  });

  it('construye un ticket urgente válido', () => {
    const ticket = buildUrgentMaintenanceTicket({
      workCenterId: 'wc_corte',
      operationDelayId: 'od_1',
      description: 'Cabezal sobrecalentado',
      createdAt: '2026-11-03T10:00:00Z',
    });
    expect(ticket.priority).toBe('urgent');
    expect(ticket.ticket_status).toBe('open');
    expect(ticket.work_center_id).toBe('wc_corte');
    expect(ticket.operation_delay_id).toBe('od_1');
    expect(ticket.created_at).toBe('2026-11-03T10:00:00Z');
    expect(() => buildUrgentMaintenanceTicket({ workCenterId: 'wc_corte' })).toThrow(/descripción/);
  });
});
