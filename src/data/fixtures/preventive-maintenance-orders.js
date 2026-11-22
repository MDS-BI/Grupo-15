/**
 * @file Fixtures de órdenes de mantenimiento preventivo (US-09).
 * Ver data-model.md §3.20.
 */

import { relativeDay, relativeTimestamp } from './demo-dates.js';

export const preventiveMaintenanceOrders = [
  {
    id: 'pmo_2001',
    company_id: 'cmp_1',
    order_code: 'PM-2001',
    work_center_id: 'wc_armado',
    source_ticket_id: 'mt_1004',
    title: 'Inspección preventiva de rodamientos',
    planned_date: relativeDay(-12),
    status: 'planned',
    technician_ext_hr_employee_id: 'ext_hr_tec_01',
    completed_at: null,
    downtime_minutes: null,
    notes: 'Derivada del historial de fallos.',
  },
  {
    id: 'pmo_2002',
    company_id: 'cmp_1',
    order_code: 'PM-2002',
    work_center_id: 'wc_pintura',
    source_ticket_id: 'mt_1007',
    title: 'Limpieza y calibración de cabina',
    planned_date: relativeDay(-25),
    status: 'completed',
    technician_ext_hr_employee_id: 'ext_hr_tec_03',
    completed_at: relativeTimestamp(-25, '16:00'),
    downtime_minutes: 20,
    notes: 'Ejecutada durante el turno de tarde.',
  },
];
