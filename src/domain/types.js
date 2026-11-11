/**
 * @file Tipos y enumeraciones espejo de `specs/002-operations-manufacturing/data-model.md`.
 * Módulo 7: Operaciones / Manufactura.
 *
 * Se usan constantes de objeto congeladas como "enums" y typedefs JSDoc como
 * "interfaces". Los identificadores preservan `snake_case` y el sufijo `_id`
 * del modelo de datos.
 */

/** @typedef {string} UUID */
/** @typedef {string} ISODate Formato `YYYY-MM-DD` */
/** @typedef {string} ISOTimestamp Formato ISO-8601 */

/* ------------------------------------------------------------------ *
 * Enumeraciones
 * ------------------------------------------------------------------ */

export const ProductType = Object.freeze({
  FINISHED_GOOD: 'finished_good',
  COMPONENT: 'component',
  RAW_MATERIAL: 'raw_material',
});

export const WarehouseType = Object.freeze({
  RAW_MATERIALS: 'raw_materials',
  WIP: 'wip',
  FINISHED_GOODS: 'finished_goods',
});

export const BomStatus = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  OBSOLETE: 'obsolete',
});

export const RoutingStatus = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  OBSOLETE: 'obsolete',
});

/** Máquina de estados principal. Ver §5.1 y `order-state-machine.js`. */
export const ProductionOrderStatus = Object.freeze({
  PLANNED: 'planned',
  RELEASED: 'released',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const OperationStatus = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
});

export const Priority = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
});

export const InspectionType = Object.freeze({
  IN_PROCESS: 'in_process',
  FINAL: 'final',
});

export const InspectionStatus = Object.freeze({
  PENDING: 'pending',
  PASSED: 'passed',
  FAILED: 'failed',
});

/** Semáforo operativo del centro de trabajo (US-07 / US-09). */
export const WorkCenterOperationalStatus = Object.freeze({
  IN_OPERATION: 'in_operation',
  PAUSED: 'paused',
  FAULT: 'fault',
  CHANGEOVER: 'changeover',
  AVAILABLE: 'available',
});

/** Ciclo de vida del ticket correctivo (US-09). */
export const MaintenanceTicketStatus = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
});

/** Prioridad de atención del ticket correctivo (US-09). */
export const MaintenancePriority = Object.freeze({
  URGENT: 'urgent',
  HIGH: 'high',
  NORMAL: 'normal',
});

/** Estado de una orden de mantenimiento preventivo (US-09). */
export const PreventiveMaintenanceOrderStatus = Object.freeze({
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

/** Origen de un motivo de atraso (US-06). */
export const DelayReasonOrigin = Object.freeze({
  PREDEFINED: 'predefined',
  CUSTOM: 'custom',
});

/** Alcance de un motivo de atraso (US-06). */
export const DelayReasonScope = Object.freeze({
  GLOBAL: 'global',
  SHIFT: 'shift',
});

/** Estado del turno del operador (US-06). */
export const ShiftStatus = Object.freeze({
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

/** Estado de un atraso justificado (US-06). */
export const OperationDelayStatus = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
});

/** Rol simulado del panel de planta (US-08). */
export const PlantRole = Object.freeze({
  PLANT_MANAGER: 'plant_manager',
  PLANNER: 'planner',
  OPERATOR: 'operator',
});

/** Indicador configurable del panel de planta (US-08). */
export const PlantIndicator = Object.freeze({
  LOAD: 'load',
  OEE: 'oee',
  DOWNTIME: 'downtime',
  FULFILLMENT: 'fulfillment',
});

/** Acciones controladas por la matriz rol×acción simulada (US-08). */
export const PlantAction = Object.freeze({
  VIEW_PLANT_PANEL: 'view_plant_panel',
  SET_THRESHOLD: 'set_threshold',
  CHANGE_PRIORITY: 'change_priority',
  CANCEL_ORDER: 'cancel_order',
  EXPORT_REPORT: 'export_report',
});

/** Comparación de umbral (US-08). */
export const ThresholdComparison = Object.freeze({
  LT: 'lt',
  GT: 'gt',
});

/* ------------------------------------------------------------------ *
 * Entidades de frontera (Core / Logística / Ventas / Calidad) — solo lectura
 * ------------------------------------------------------------------ */

/**
 * @typedef {Object} Company
 * @property {UUID} id
 * @property {string} name
 * @property {string} [tax_id]
 * @property {string} [default_currency]
 */

/**
 * @typedef {Object} UnitOfMeasure
 * @property {UUID} id
 * @property {string} code
 * @property {string} name
 * @property {string} [category]
 * @property {UUID} [company_id]
 */

/**
 * @typedef {Object} Product
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {string} code
 * @property {string} name
 * @property {string} product_type
 * @property {UUID} uom_id
 * @property {number} [unit_cost]
 */

/**
 * @typedef {Object} Warehouse
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {string} code
 * @property {string} name
 * @property {string} warehouse_type
 */

/**
 * @typedef {Object} SalesOrder
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {UUID} [customer_id]
 * @property {string} order_number
 * @property {string} status
 * @property {boolean} make_to_order
 * @property {ISODate} [requested_date]
 */

/**
 * @typedef {Object} QualityInspection
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {string} inspection_type
 * @property {UUID} [production_order_id]
 * @property {UUID} [po_operation_id]
 * @property {UUID} [product_id]
 * @property {string} status
 */

/* ------------------------------------------------------------------ *
 * Entidades de Manufactura
 * ------------------------------------------------------------------ */

/**
 * @typedef {Object} BillOfMaterials
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {UUID} product_id
 * @property {string} code
 * @property {string} version
 * @property {ISODate} effective_from
 * @property {ISODate} [effective_to]
 * @property {number} base_quantity
 * @property {string} status
 * @property {string} [notes]
 */

/**
 * @typedef {Object} BomComponent
 * @property {UUID} id
 * @property {UUID} bom_id
 * @property {UUID} component_product_id
 * @property {number} quantity_per_unit
 * @property {UUID} uom_id
 * @property {number} scrap_percentage
 * @property {number} sequence
 * @property {boolean} is_optional
 */

/**
 * @typedef {Object} WorkCenter
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {string} code
 * @property {string} name
 * @property {UUID} [warehouse_id]
 * @property {number} capacity_per_day_minutes
 * @property {number} efficiency_factor
 * @property {number} [cost_per_hour]
 * @property {string} status
 * @property {'in_operation'|'paused'|'fault'|'changeover'|'available'} [operational_status]
 */

/**
 * @typedef {Object} Routing
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {UUID} product_id
 * @property {string} code
 * @property {string} version
 * @property {string} status
 */

/**
 * @typedef {Object} RoutingOperation
 * @property {UUID} id
 * @property {UUID} routing_id
 * @property {UUID} work_center_id
 * @property {number} sequence
 * @property {string} [description]
 * @property {number} setup_time_minutes
 * @property {number} run_time_per_unit_minutes
 */

/**
 * @typedef {Object} ProductionOrder
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {string} order_number
 * @property {UUID} product_id
 * @property {UUID} bom_id
 * @property {UUID|null} routing_id
 * @property {UUID|null} sales_order_id Enlace make-to-order opcional.
 * @property {UUID} warehouse_id
 * @property {number} quantity_planned
 * @property {string} status
 * @property {ISODate} [planned_start_date]
 * @property {ISODate} [planned_end_date]
 * @property {ISODate} [actual_start_date]
 * @property {ISODate} [actual_end_date]
 * @property {string} priority
 * @property {string} [notes]
 */

/**
 * @typedef {Object} ProductionOrderOperation
 * @property {UUID} id
 * @property {UUID} production_order_id
 * @property {UUID|null} routing_operation_id
 * @property {UUID} work_center_id
 * @property {number} sequence
 * @property {string} status
 * @property {number} planned_time_minutes
 * @property {number|null} actual_time_minutes
 * @property {number} [delay_time_minutes] Tiempo justificado por atrasos cerrados.
 * @property {number} quantity_completed
 * @property {number} scrap_quantity
 * @property {UUID|null} [operator_id]
 * @property {ISOTimestamp} [started_at]
 * @property {ISOTimestamp} [completed_at]
 */

/**
 * @typedef {Object} MaterialConsumption
 * @property {UUID} id
 * @property {UUID} production_order_id
 * @property {UUID|null} po_operation_id
 * @property {UUID} component_product_id
 * @property {UUID|null} bom_component_id
 * @property {UUID} warehouse_id
 * @property {number} quantity_consumed
 * @property {UUID} uom_id
 * @property {string} [lot_number]
 * @property {ISOTimestamp} consumed_at
 * @property {UUID|null} [consumed_by]
 */

/**
 * @typedef {Object} ProductionOutput
 * @property {UUID} id
 * @property {UUID} production_order_id
 * @property {UUID} product_id
 * @property {UUID} warehouse_id
 * @property {number} quantity_produced
 * @property {number} scrap_quantity
 * @property {string} [lot_number]
 * @property {UUID} uom_id
 * @property {ISOTimestamp} produced_at
 * @property {UUID|null} [recorded_by]
 */

/* ------------------------------------------------------------------ *
 * Entidades de Mantenimiento (US-09)
 * ------------------------------------------------------------------ */

/**
 * Ticket correctivo originado por un incidente escalado desde piso.
 * @typedef {Object} MaintenanceTicket
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {string} ticket_code Código único por empresa.
 * @property {UUID} work_center_id
 * @property {UUID|null} po_operation_id
 * @property {UUID|null} operation_delay_id Evento de parada de origen (único cuando existe).
 * @property {UUID|null} reported_by
 * @property {string} description
 * @property {'urgent'|'high'|'normal'} priority
 * @property {'open'|'in_progress'|'resolved'} ticket_status
 * @property {boolean} escalated_to_maint
 * @property {string|null} technician_ext_hr_employee_id
 * @property {ISOTimestamp|null} intervention_started_at
 * @property {ISOTimestamp|null} resolved_at
 * @property {ISOTimestamp|null} downtime_started_at
 * @property {ISOTimestamp|null} downtime_ended_at
 * @property {number|null} downtime_minutes
 * @property {UUID|null} cause_reason_id
 * @property {string|null} resolution_notes
 * @property {ISOTimestamp} created_at
 */

/**
 * Orden de mantenimiento preventivo programada desde el historial de fallos.
 * @typedef {Object} PreventiveMaintenanceOrder
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {string} order_code Código único por empresa.
 * @property {UUID} work_center_id
 * @property {UUID|null} source_ticket_id
 * @property {string} title
 * @property {ISODate} planned_date
 * @property {'planned'|'in_progress'|'completed'|'cancelled'} status
 * @property {string|null} technician_ext_hr_employee_id
 * @property {ISOTimestamp|null} completed_at
 * @property {number|null} downtime_minutes
 * @property {string} [notes]
 */

/* ------------------------------------------------------------------ *
 * Entidades de turno y supervisión (US-06 / US-07)
 * ------------------------------------------------------------------ */

/**
 * Turno de trabajo del operador sobre una operación concreta.
 * @typedef {Object} ProductionShift
 * @property {UUID} id
 * @property {UUID} po_operation_id
 * @property {UUID|null} operator_id
 * @property {number} shift_number
 * @property {'in_progress'|'completed'} status
 * @property {ISOTimestamp} started_at
 * @property {ISOTimestamp|null} ended_at
 * @property {number} quantity_counted
 * @property {boolean} [supervisor_validated]
 * @property {ISOTimestamp|null} [validated_at]
 * @property {string|null} [supervisor_notes]
 */

/**
 * Atraso justificado de una operación.
 * @typedef {Object} OperationDelay
 * @property {UUID} id
 * @property {UUID} po_operation_id
 * @property {UUID} production_shift_id
 * @property {UUID} delay_reason_id
 * @property {ISOTimestamp} started_at
 * @property {ISOTimestamp|null} ended_at
 * @property {number|null} duration_minutes
 * @property {'open'|'closed'} status
 * @property {string|null} note
 * @property {boolean} [escalated_to_maint]
 * @property {ISOTimestamp|null} [corrected_at]
 * @property {UUID|null} [corrected_by]
 * @property {string|null} [correction_note]
 */

/**
 * Motivo de atraso predefinido o personalizado del turno.
 * @typedef {Object} DelayReason
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {string} label
 * @property {'predefined'|'custom'} origin
 * @property {'global'|'shift'} scope
 * @property {UUID|null} production_shift_id
 * @property {boolean} active
 * @property {UUID|null} [created_by]
 */

/**
 * Asignación de un operario a un centro de trabajo en una franja.
 * @typedef {Object} ShiftAssignment
 * @property {UUID} id
 * @property {UUID} shift_assignment_id
 * @property {UUID} work_center_id
 * @property {string} ext_hr_employee_id
 * @property {string} shift_band
 * @property {ISOTimestamp} assigned_at
 * @property {boolean} active
 */

/**
 * Umbral crítico por indicador de planta.
 * @typedef {Object} ThresholdSetting
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {'load'|'oee'|'downtime'|'fulfillment'} indicator
 * @property {number} threshold
 * @property {'lt'|'gt'} comparison
 * @property {ISOTimestamp} updated_at
 */

/**
 * Fila de la matriz rol×acción simulada.
 * @typedef {Object} RolePermission
 * @property {UUID} id
 * @property {UUID} company_id
 * @property {'plant_manager'|'planner'|'operator'} role
 * @property {string} action
 * @property {boolean} allowed
 * @property {ISOTimestamp} updated_at
 */

/* ------------------------------------------------------------------ *
 * Utilidades de dominio
 * ------------------------------------------------------------------ */

/** @param {string} id @returns {string} */
export function makeId(prefix = 'id') {
  const rnd =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}

/** @param {number} value @returns {boolean} */
export function isPositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** @param {number} value @returns {boolean} */
export function isNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
