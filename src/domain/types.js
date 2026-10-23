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
