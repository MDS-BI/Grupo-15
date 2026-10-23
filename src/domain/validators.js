/**
 * @file Validadores de esquema y reglas de negocio (plan.md §2, data-model.md §8).
 */

import { isPositive, isNonNegative, ProductType } from './types.js';

/**
 * @typedef {Object} ValidationIssue
 * @property {string} field
 * @property {string} message
 */

/**
 * Valida la cabecera de una BOM.
 * @param {import('./types.js').BillOfMaterials} bom
 * @param {import('./types.js').Product} product
 * @returns {ValidationIssue[]}
 */
export function validateBom(bom, product) {
  const issues = [];
  if (!bom?.product_id) issues.push({ field: 'product_id', message: 'El producto es obligatorio.' });
  if (product && product.product_type !== ProductType.FINISHED_GOOD) {
    issues.push({
      field: 'product_id',
      message: 'El producto de una BOM debe ser un bien terminado (finished_good).',
    });
  }
  if (!isPositive(Number(bom?.base_quantity))) {
    issues.push({ field: 'base_quantity', message: 'base_quantity debe ser mayor que 0.' });
  }
  if (!bom?.version) issues.push({ field: 'version', message: 'La versión es obligatoria.' });
  if (!bom?.effective_from) {
    issues.push({ field: 'effective_from', message: 'La fecha de vigencia es obligatoria.' });
  }
  if (bom?.effective_to && bom?.effective_from && bom.effective_to < bom.effective_from) {
    issues.push({ field: 'effective_to', message: 'effective_to debe ser ≥ effective_from.' });
  }
  return issues;
}

/**
 * Valida una línea de componente de BOM contra las líneas existentes.
 * @param {import('./types.js').BomComponent} line
 * @param {import('./types.js').BomComponent[]} existing
 * @returns {ValidationIssue[]}
 */
export function validateBomComponent(line, existing = []) {
  const issues = [];
  if (!line?.component_product_id) {
    issues.push({ field: 'component_product_id', message: 'El componente es obligatorio.' });
  }
  if (!isPositive(Number(line?.quantity_per_unit))) {
    issues.push({ field: 'quantity_per_unit', message: 'quantity_per_unit debe ser > 0.' });
  }
  if (!line?.uom_id) issues.push({ field: 'uom_id', message: 'La unidad de medida es obligatoria.' });
  if (line?.scrap_percentage != null && !isNonNegative(Number(line.scrap_percentage))) {
    issues.push({ field: 'scrap_percentage', message: 'scrap_percentage no puede ser negativo.' });
  }
  const duplicated = existing.some(
    (e) => e.component_product_id === line?.component_product_id
  );
  if (duplicated) {
    issues.push({
      field: 'component_product_id',
      message: 'UNIQUE (bom_id, component_product_id): el componente ya existe en esta BOM.',
    });
  }
  return issues;
}

/**
 * Valida la secuencia estrictamente creciente de operaciones de una ruta.
 * @param {import('./types.js').RoutingOperation[]} operations
 * @returns {ValidationIssue[]}
 */
export function validateRoutingSequence(operations = []) {
  const issues = [];
  const sorted = [...operations].sort((a, b) => a.sequence - b.sequence);
  for (let i = 0; i < sorted.length; i++) {
    const op = sorted[i];
    if (!Number.isInteger(op.sequence) || op.sequence < 10) {
      issues.push({
        field: `sequence[${op.id}]`,
        message: 'sequence debe ser un entero ≥ 10.',
      });
    }
    if (i > 0 && sorted[i - 1].sequence === op.sequence) {
      issues.push({
        field: `sequence[${op.id}]`,
        message: 'sequence duplicado: debe ser estrictamente creciente.',
      });
    }
    if (!isNonNegative(Number(op.setup_time_minutes))) {
      issues.push({ field: `setup_time_minutes[${op.id}]`, message: 'setup_time_minutes debe ser ≥ 0.' });
    }
    if (!isNonNegative(Number(op.run_time_per_unit_minutes))) {
      issues.push({
        field: `run_time_per_unit_minutes[${op.id}]`,
        message: 'run_time_per_unit_minutes debe ser ≥ 0.',
      });
    }
  }
  return issues;
}

/**
 * Valida una orden de producción para su liberación.
 * @param {import('./types.js').ProductionOrder} order
 * @returns {ValidationIssue[]}
 */
export function validateProductionOrder(order) {
  const issues = [];
  if (!isPositive(Number(order?.quantity_planned))) {
    issues.push({ field: 'quantity_planned', message: 'quantity_planned debe ser > 0.' });
  }
  if (!order?.product_id) issues.push({ field: 'product_id', message: 'El producto es obligatorio.' });
  if (!order?.bom_id) issues.push({ field: 'bom_id', message: 'La BOM es obligatoria.' });
  if (!order?.warehouse_id) {
    issues.push({ field: 'warehouse_id', message: 'La bodega destino es obligatoria.' });
  }
  return issues;
}

/**
 * Valida un registro de consumo de material.
 * @param {import('./types.js').MaterialConsumption} consumption
 * @returns {ValidationIssue[]}
 */
export function validateConsumption(consumption) {
  const issues = [];
  if (!consumption?.production_order_id) {
    issues.push({ field: 'production_order_id', message: 'La orden es obligatoria.' });
  }
  if (!consumption?.component_product_id) {
    issues.push({ field: 'component_product_id', message: 'El componente es obligatorio.' });
  }
  if (!isPositive(Number(consumption?.quantity_consumed))) {
    issues.push({ field: 'quantity_consumed', message: 'quantity_consumed debe ser > 0.' });
  }
  if (!consumption?.warehouse_id) {
    issues.push({ field: 'warehouse_id', message: 'La bodega origen es obligatoria.' });
  }
  return issues;
}

/**
 * Valida un registro de salida de producción.
 * @param {import('./types.js').ProductionOutput} output
 * @returns {ValidationIssue[]}
 */
export function validateOutput(output) {
  const issues = [];
  if (!output?.production_order_id) {
    issues.push({ field: 'production_order_id', message: 'La orden es obligatoria.' });
  }
  if (!output?.product_id) {
    issues.push({ field: 'product_id', message: 'El producto es obligatorio.' });
  }
  if (!isPositive(Number(output?.quantity_produced))) {
    issues.push({ field: 'quantity_produced', message: 'quantity_produced debe ser > 0.' });
  }
  if (!output?.warehouse_id) {
    issues.push({ field: 'warehouse_id', message: 'La bodega destino es obligatoria.' });
  }
  if (output?.scrap_quantity != null && !isNonNegative(Number(output.scrap_quantity))) {
    issues.push({ field: 'scrap_quantity', message: 'scrap_quantity debe ser ≥ 0.' });
  }
  return issues;
}

/**
 * Valida un centro de trabajo.
 * @param {import('./types.js').WorkCenter} workCenter
 * @returns {ValidationIssue[]}
 */
export function validateWorkCenter(workCenter) {
  const issues = [];
  if (!isPositive(Number(workCenter?.capacity_per_day_minutes))) {
    issues.push({
      field: 'capacity_per_day_minutes',
      message: 'capacity_per_day_minutes debe ser > 0.',
    });
  }
  const eff = Number(workCenter?.efficiency_factor);
  if (!Number.isFinite(eff) || eff <= 0 || eff > 1) {
    issues.push({
      field: 'efficiency_factor',
      message: 'efficiency_factor debe estar en el rango (0, 1].',
    });
  }
  return issues;
}

/** @param {ValidationIssue[]} issues @returns {boolean} */
export function isValid(issues) {
  return !issues || issues.length === 0;
}
