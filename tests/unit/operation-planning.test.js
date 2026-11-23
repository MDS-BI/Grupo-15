import { describe, it, expect } from 'vitest';
import {
  plannedTimeMinutes,
  totalPlannedTime,
  effectiveCapacityPerDay,
  capacityUtilization,
  deriveBomStations,
} from '../../src/domain/operation-planning.js';

const op = { setup_time_minutes: 15, run_time_per_unit_minutes: 3 };

describe('operation-planning', () => {
  it('calcula planned_time_minutes = setup + run × cantidad', () => {
    expect(plannedTimeMinutes(op, 50)).toBe(165);
    expect(plannedTimeMinutes(op, 0)).toBe(15);
  });

  it('maneja entradas inválidas como cero', () => {
    expect(plannedTimeMinutes({}, 10)).toBe(0);
    expect(plannedTimeMinutes(op, null)).toBe(15);
  });

  it('suma el tiempo estándar total de una ruta', () => {
    const ops = [op, { setup_time_minutes: 10, run_time_per_unit_minutes: 12 }];
    expect(totalPlannedTime(ops, 10)).toBe(45 + 130);
  });

  it('aplica el efficiency_factor a la capacidad', () => {
    const wc = { capacity_per_day_minutes: 480, efficiency_factor: 0.9 };
    expect(effectiveCapacityPerDay(wc)).toBe(432);
    expect(effectiveCapacityPerDay({ capacity_per_day_minutes: 480, efficiency_factor: 0 })).toBe(
      480,
    );
    expect(effectiveCapacityPerDay({ capacity_per_day_minutes: 0 })).toBeNull();
  });

  it('calcula la utilización con sobrecarga y redondea a 2 decimales', () => {
    const wc = { capacity_per_day_minutes: 480, efficiency_factor: 1 };
    expect(capacityUtilization(240, wc)).toBe(0.5);
    expect(capacityUtilization(960, wc)).toBe(2);
    expect(capacityUtilization(150, { ...wc, efficiency_factor: 0.9 })).toBe(0.35);
  });

  it('devuelve null cuando el centro no tiene capacidad efectiva', () => {
    expect(capacityUtilization(240, { capacity_per_day_minutes: 0 })).toBeNull();
  });
});

describe('deriveBomStations (US-14)', () => {
  const order = { id: 'po_3002', routing_id: 'rt_bici', quantity_planned: 10 };
  const routingOperations = [
    {
      id: 'ro_bici_3',
      routing_id: 'rt_bici',
      work_center_id: 'wc_calidad',
      sequence: 30,
      setup_time_minutes: 5,
      run_time_per_unit_minutes: 2,
    },
    {
      id: 'ro_bici_1',
      routing_id: 'rt_bici',
      work_center_id: 'wc_corte',
      sequence: 10,
      setup_time_minutes: 15,
      run_time_per_unit_minutes: 3,
    },
    {
      id: 'ro_bici_2',
      routing_id: 'rt_bici',
      work_center_id: 'wc_armado',
      sequence: 20,
      setup_time_minutes: 10,
      run_time_per_unit_minutes: 12,
    },
    {
      id: 'ro_rueda_1',
      routing_id: 'rt_rueda',
      work_center_id: 'wc_armado',
      sequence: 10,
      setup_time_minutes: 99,
      run_time_per_unit_minutes: 99,
    },
  ];
  const workCenters = [
    { id: 'wc_corte', name: 'Estación de Corte' },
    { id: 'wc_armado', name: 'Línea de Armado' },
    { id: 'wc_calidad', name: 'Control de Calidad' },
  ];

  it('deriva estaciones = work_center, ordenadas por secuencia y con tiempo planificado', () => {
    expect(deriveBomStations(order, { routingOperations, workCenters })).toEqual([
      {
        work_center_id: 'wc_corte',
        name: 'Estación de Corte',
        sequence: 10,
        planned_time_minutes: 45,
      },
      {
        work_center_id: 'wc_armado',
        name: 'Línea de Armado',
        sequence: 20,
        planned_time_minutes: 130,
      },
      {
        work_center_id: 'wc_calidad',
        name: 'Control de Calidad',
        sequence: 30,
        planned_time_minutes: 25,
      },
    ]);
  });

  it('usa el id como nombre si el centro no existe y devuelve [] sin ruta', () => {
    expect(deriveBomStations(order, { routingOperations, workCenters: [] })[0].name).toBe(
      'wc_corte',
    );
    expect(deriveBomStations({ ...order, routing_id: null }, { routingOperations })).toEqual([]);
    expect(deriveBomStations(order)).toEqual([]);
  });
});
