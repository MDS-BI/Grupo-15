/**
 * @file Reglas puras de supervisión de línea (US-07): semáforo, asignación de
 * operarios, validación de cierres y escalamiento de incidentes.
 */

import { WorkCenterOperationalStatus } from './types.js';

/**
 * Deriva el semáforo del centro a partir de la operación activa y el ticket.
 * @param {import('./types.js').WorkCenter|null} workCenter
 * @param {Array<import('./types.js').ProductionOrderOperation>} operations
 * @param {import('./types.js').MaintenanceTicket|null} [activeTicket]
 */
export function deriveWorkCenterTrafficLight(workCenter, operations = [], activeTicket = null) {
  if (!workCenter) return WorkCenterOperationalStatus.AVAILABLE;
  if (activeTicket && activeTicket.ticket_status !== 'resolved') {
    return WorkCenterOperationalStatus.FAULT;
  }
  if (workCenter.operational_status === WorkCenterOperationalStatus.FAULT) {
    return WorkCenterOperationalStatus.FAULT;
  }
  if (workCenter.operational_status === WorkCenterOperationalStatus.CHANGEOVER) {
    return WorkCenterOperationalStatus.CHANGEOVER;
  }
  const active = operations.find((op) => op.status === 'in_progress' || op.status === 'paused');
  if (active && active.status === 'in_progress') {
    return WorkCenterOperationalStatus.IN_OPERATION;
  }
  if (active && active.status === 'paused') {
    return WorkCenterOperationalStatus.PAUSED;
  }
  return WorkCenterOperationalStatus.AVAILABLE;
}

/**
 * Una sola asignación activa por centro+franja y por operario+franja.
 * @param {Array<import('./types.js').ShiftAssignment>} assignments
 * @param {{work_center_id:string, shift_band:string, ext_hr_employee_id:string}} candidate
 */
export function canAssignOperator(assignments = [], candidate) {
  if (!candidate || !candidate.work_center_id) return false;
  if (!String(candidate.ext_hr_employee_id || '').trim()) return false;
  if (!String(candidate.shift_band || '').trim()) return false;
  return !assignments.some(
    (assignment) =>
      assignment.active &&
      assignment.shift_band === candidate.shift_band &&
      (assignment.work_center_id === candidate.work_center_id ||
        assignment.ext_hr_employee_id === candidate.ext_hr_employee_id),
  );
}

/**
 * Un cierre se aprueba si el turno existe, no fue validado y no hay atrasos abiertos.
 * @param {import('./types.js').ProductionShift|null} shift
 * @param {Array<import('./types.js').OperationDelay>} delays
 */
export function canValidateShiftClosure(shift, delays = []) {
  if (!shift) return false;
  if (shift.supervisor_validated) return false;
  return !delays.some((delay) => delay.status === 'open');
}

/**
 * Construye el borrador de ticket urgente originado por un incidente de piso.
 * @param {{workCenterId:string, operationDelayId?:string|null, description:string, reportedBy?:string|null, createdAt?:string}} input
 */
export function buildUrgentMaintenanceTicket(input) {
  const description = String(input.description || '').trim();
  if (!input.workCenterId) throw new Error('Debe indicar el centro de trabajo.');
  if (!description) throw new Error('La descripción del incidente es obligatoria.');
  return {
    company_id: 'cmp_1',
    work_center_id: input.workCenterId,
    operation_delay_id: input.operationDelayId || null,
    reported_by: input.reportedBy || null,
    description,
    priority: 'urgent',
    ticket_status: 'open',
    escalated_to_maint: true,
    technician_ext_hr_employee_id: null,
    intervention_started_at: null,
    resolved_at: null,
    downtime_started_at: null,
    downtime_ended_at: null,
    downtime_minutes: null,
    cause_reason_id: null,
    resolution_notes: null,
    created_at: input.createdAt || new Date().toISOString(),
  };
}
