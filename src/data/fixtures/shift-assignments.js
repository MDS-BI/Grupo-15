/**
 * @file Fixtures de asignación de operadores a centros de trabajo (US-07).
 * Ver data-model.md §3.8 y contracts/operator-shift.md.
 */

import { relativeTimestamp } from './demo-dates.js';

export const shiftAssignments = [
  {
    id: 'sa_1',
    shift_assignment_id: 'sa_1',
    work_center_id: 'wc_corte',
    ext_hr_employee_id: 'emp_op_01',
    shift_band: 'morning',
    assigned_at: relativeTimestamp(-21, '06:50'),
    active: true,
  },
  {
    id: 'sa_2',
    shift_assignment_id: 'sa_2',
    work_center_id: 'wc_armado',
    ext_hr_employee_id: 'emp_op_02',
    shift_band: 'morning',
    assigned_at: relativeTimestamp(-21, '06:50'),
    active: true,
  },
  {
    id: 'sa_3',
    shift_assignment_id: 'sa_3',
    work_center_id: 'wc_solda',
    ext_hr_employee_id: 'emp_op_03',
    shift_band: 'morning',
    assigned_at: relativeTimestamp(-21, '06:50'),
    active: true,
  },
  {
    id: 'sa_4',
    shift_assignment_id: 'sa_4',
    work_center_id: 'wc_calidad',
    ext_hr_employee_id: 'emp_op_04',
    shift_band: 'morning',
    assigned_at: relativeTimestamp(-21, '06:50'),
    active: true,
  },
  {
    id: 'sa_5',
    shift_assignment_id: 'sa_5',
    work_center_id: 'wc_pintura',
    ext_hr_employee_id: 'emp_op_05',
    shift_band: 'morning',
    assigned_at: relativeTimestamp(-21, '06:50'),
    active: true,
  },
];
