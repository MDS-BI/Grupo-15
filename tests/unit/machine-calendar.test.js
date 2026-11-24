import { describe, it, expect } from 'vitest';
import { buildMachineCalendarMonth } from '../../src/domain/machine-calendar.js';

function cellAt(calendar, date) {
  const cell = calendar.cells.find((row) => row.date === date);
  expect(cell).toBeTruthy();
  return cell;
}

const base = { year: 2026, month: 2, workCenterId: 'wc_armado' };

describe('buildMachineCalendarMonth', () => {
  it('construye una matriz semanal de 7 columnas con celdas del mes', () => {
    const calendar = buildMachineCalendarMonth({
      ...base,
      tickets: [],
      workOrders: [],
      preventiveOrders: [],
    });

    expect(calendar.weeks).toBe(calendar);
    expect(calendar.cells).toHaveLength(35);
    expect(calendar.weeks).toHaveLength(5);
    calendar.weeks.forEach((week) => expect(week).toHaveLength(7));
    expect(calendar.weeks[0].map((cell) => cell.date)).toEqual([
      '2026-01-26',
      '2026-01-27',
      '2026-01-28',
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
    ]);
    expect(calendar.weeks[0][0].inMonth).toBe(false);
    expect(calendar.weeks[0][6].inMonth).toBe(true);
    expect(cellAt(calendar, '2026-02-01').day).toBe(1);
    expect(calendar.columns).toEqual(['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D']);
  });

  it('marca como none los días sin plan y filtra por la máquina seleccionada', () => {
    const calendar = buildMachineCalendarMonth({
      ...base,
      tickets: [
        {
          id: 't_other',
          work_center_id: 'wc_corte',
          scheduled_start_date: '2026-02-10',
          scheduled_end_date: '2026-02-10',
        },
      ],
      workOrders: [],
      preventiveOrders: [],
    });

    expect(cellAt(calendar, '2026-02-10').status).toBe('none');
    expect(cellAt(calendar, '2026-02-11').status).toBe('none');
  });

  it('marca correctiva un ticket de fallo en todo su rango', () => {
    const calendar = buildMachineCalendarMonth({
      ...base,
      tickets: [
        {
          id: 't_1',
          work_center_id: 'wc_armado',
          ticket_status: 'in_progress',
          scheduled_start_date: '2026-02-10',
          scheduled_end_date: '2026-02-12',
        },
      ],
      workOrders: [],
      preventiveOrders: [],
    });

    expect(cellAt(calendar, '2026-02-09').status).toBe('none');
    expect(cellAt(calendar, '2026-02-10').status).toBe('corrective');
    expect(cellAt(calendar, '2026-02-11').status).toBe('corrective');
    expect(cellAt(calendar, '2026-02-12').status).toBe('corrective');
    expect(cellAt(calendar, '2026-02-13').status).toBe('none');
  });

  it('marca planned_use las órdenes que pasan por la estación', () => {
    const calendar = buildMachineCalendarMonth({
      ...base,
      tickets: [],
      workOrders: [
        {
          id: 'po_1',
          work_center_id: 'wc_armado',
          planned_start_date: '2026-02-16',
          planned_end_date: '2026-02-17',
        },
        {
          id: 'po_2',
          work_center_id: 'wc_pintura',
          operations: [{ work_center_id: 'wc_armado' }],
          start_date: '2026-02-18',
          end_date: '2026-02-18',
        },
      ],
      preventiveOrders: [],
    });

    expect(cellAt(calendar, '2026-02-16').status).toBe('planned_use');
    expect(cellAt(calendar, '2026-02-17').status).toBe('planned_use');
    expect(cellAt(calendar, '2026-02-18').status).toBe('planned_use');
  });

  it('marca preventive las órdenes preventivas planificadas', () => {
    const calendar = buildMachineCalendarMonth({
      ...base,
      tickets: [],
      workOrders: [],
      preventiveOrders: [
        {
          id: 'pm_1',
          work_center_id: 'wc_armado',
          planned_date: '2026-02-20',
          status: 'planned',
        },
      ],
    });

    expect(cellAt(calendar, '2026-02-20').status).toBe('preventive');
    expect(cellAt(calendar, '2026-02-21').status).toBe('none');
  });

  it('aplica una prevalencia determinista correctiva > preventiva > planned_use', () => {
    const sources = {
      ...base,
      tickets: [
        {
          id: 't_1',
          work_center_id: 'wc_armado',
          scheduled_start_date: '2026-02-10',
          scheduled_end_date: '2026-02-10',
        },
      ],
      workOrders: [
        {
          id: 'po_1',
          work_center_id: 'wc_armado',
          planned_start_date: '2026-02-10',
          planned_end_date: '2026-02-10',
        },
      ],
      preventiveOrders: [
        {
          id: 'pm_1',
          work_center_id: 'wc_armado',
          planned_date: '2026-02-10',
          status: 'planned',
        },
      ],
    };
    const calendar = buildMachineCalendarMonth(sources);
    expect(cellAt(calendar, '2026-02-10').status).toBe('corrective');

    const withoutTicket = buildMachineCalendarMonth({ ...sources, tickets: [] });
    expect(cellAt(withoutTicket, '2026-02-10').status).toBe('preventive');

    const withoutPreventive = buildMachineCalendarMonth({
      ...sources,
      tickets: [],
      preventiveOrders: [],
    });
    expect(cellAt(withoutPreventive, '2026-02-10').status).toBe('planned_use');
  });
});
