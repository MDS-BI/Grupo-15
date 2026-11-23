/**
 * @file Store de estado del módulo de manufactura (motor mock en memoria).
 * Carga los fixtures y expone consultas de dominio y acciones. Reemplazable por
 * un repositorio real sin tocar la UI. Ver plan.md §6.
 */

import * as master from './fixtures/master-data.js';
import * as bomsFx from './fixtures/boms.js';
import * as wcFx from './fixtures/work-centers.js';
import * as rtFx from './fixtures/routings.js';
import * as poFx from './fixtures/production-orders.js';
import * as mtFx from './fixtures/maintenance-tickets.js';
import * as pmoFx from './fixtures/preventive-maintenance-orders.js';
import * as shiftFx from './fixtures/production-shifts.js';
import * as reasonFx from './fixtures/delay-reasons.js';
import * as assignmentFx from './fixtures/shift-assignments.js';
import * as hrFx from './fixtures/hr-employees.js';
import * as plantFx from './fixtures/plant-performance.js';
import { InventoryPort, QualityPort } from './ports/index.js';
import { loadSnapshot, resetDemoSnapshot, saveSnapshot } from './persistence.js';
import {
  assertTransition,
  canScheduleOnWorkCenter,
  deriveOrderStatus,
} from '../domain/order-state-machine.js';
import { capacityFor } from '../domain/capacity.js';
import { capacityUtilization, plannedTimeMinutes } from '../domain/operation-planning.js';
import { buildBomTree, flattenBom } from '../domain/bom-explosion.js';
import {
  validateBom,
  validateBomComponent,
  validateRoutingSequence,
} from '../domain/validators.js';
import { reconcileConsumption, requiresReview } from '../domain/reconciliation.js';
import {
  canResolveTicket,
  canStartIntervention,
  canTransitionPreventiveOrder,
  computeDowntimeMinutes,
  deriveWearIndicator,
  resolveAvailabilityStatus,
  sortTicketsByPriorityAndAge,
} from '../domain/maintenance.js';
import {
  activeShiftOf,
  canStartDelay,
  canStartShift,
  computeEffectiveMinutes,
  elapsedMinutes,
  hasOpenDelay,
  openDelayOf,
  round2,
  sumClosedDelayMinutes,
  validateCounter,
  validateCumulative,
} from '../domain/shift-tracking.js';
import {
  buildUrgentMaintenanceTicket,
  canAssignOperator,
  canValidateShiftClosure,
  deriveWorkCenterTrafficLight,
} from '../domain/line-supervision.js';
import {
  accumulateDowntimesByReason,
  buildConsolidatedReport,
  canPerformAction,
  computeLoadByWorkCenter,
  computeOee,
  evaluateThresholds,
} from '../domain/plant-performance.js';
import {
  canRescheduleOrder,
  sortOrdersForScheduling,
  validatePlannedDates,
} from '../domain/order-scheduling.js';
import {
  buildCalendarRange,
  calendarEventsForMonth as deriveCalendarEventsForMonth,
  canEditOrderSchedule,
  sortPendingOrders,
} from '../domain/calendar-scheduling.js';
import {
  buildLineBalanceSuggestions,
  computeBalanceSummary,
  computeOrderDetail,
  computeProjectedLoad,
  computeStandardTimes,
  computeUtilization,
  detectBottlenecks,
} from '../domain/line-balance.js';
import { makeId } from '../domain/types.js';
import {
  CANONICAL_ROLES,
  rolesForUsername as resolveRolesForUsername,
} from '../domain/role-access.js';
import { ROLE_USERS, ROLE_USER_COLLECTION_KEYS } from './fixtures/demo-accounts.js';

const ROLE_USER_PROPERTIES = Object.freeze({
  plant_manager: 'roleUsersPlantManager',
  supervisor: 'roleUsersSupervisor',
  planner: 'roleUsersPlanner',
  operator: 'roleUsersOperator',
  maintenance: 'roleUsersMaintenance',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function datePart(value) {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T/);
  return match ? match[1] : null;
}

export class ManufacturingStore extends EventTarget {
  constructor({ storage, hydrate = true } = {}) {
    super();
    this.storage =
      storage === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : storage;
    this.persistenceWarning = null;

    this.companies = clone(master.companies);
    this.unitsOfMeasure = clone(master.unitsOfMeasure);
    this.warehouses = clone(master.warehouses);
    this.products = clone(master.products);
    this.salesOrders = clone(master.salesOrders);
    this.qualityInspections = clone(master.qualityInspections);

    this.billOfMaterials = clone(bomsFx.billOfMaterials);
    this.bomComponents = clone(bomsFx.bomComponents);
    this.workCenters = clone(wcFx.workCenters);
    this.routings = clone(rtFx.routings);
    this.routingOperations = clone(rtFx.routingOperations);

    this.productionOrders = clone(poFx.productionOrders);
    this.productionOrderOperations = clone(poFx.productionOrderOperations);
    this.materialConsumption = clone(poFx.materialConsumption);
    this.productionOutput = clone(poFx.productionOutput);

    this.maintenanceTickets = clone(mtFx.maintenanceTickets);
    this.preventiveMaintenanceOrders = clone(pmoFx.preventiveMaintenanceOrders);
    this.technicians = clone(mtFx.technicians);
    this.maintenanceCauses = clone(mtFx.maintenanceCauses);

    this.productionShifts = clone(shiftFx.productionShifts);
    this.operationDelays = clone(shiftFx.operationDelays);
    this.delayReasons = clone(reasonFx.delayReasons);
    this.shiftAssignments = clone(assignmentFx.shiftAssignments);
    this.hrEmployees = clone(hrFx.hrEmployees);
    this.thresholdSettings = clone(plantFx.thresholdSettings);
    this.rolePermissions = clone(plantFx.rolePermissions);

    for (const role of CANONICAL_ROLES) {
      this[ROLE_USER_PROPERTIES[role]] = clone(ROLE_USERS[role]);
    }

    if (hydrate && this.storage) this.#hydrate();
    this.#resetInventory();
  }

  resetDemoData() {
    if (!this.storage || !resetDemoSnapshot(this.storage)) return false;
    this.#hydrate();
    this.technicians = clone(mtFx.technicians);
    this.maintenanceCauses = clone(mtFx.maintenanceCauses);
    this.#resetInventory();
    this.#emit();
    return true;
  }

  #hydrate() {
    const snapshot = loadSnapshot(this.storage, {
      onWarning: (message) => {
        this.persistenceWarning = message;
      },
    });
    if (!snapshot) return;

    const assignments = {
      companies: 'companies',
      unitsOfMeasure: 'unitsOfMeasure',
      warehouses: 'warehouses',
      products: 'products',
      salesOrders: 'salesOrders',
      qualityInspections: 'qualityInspections',
      billOfMaterials: 'billOfMaterials',
      bomComponents: 'bomComponents',
      workCenters: 'workCenters',
      routings: 'routings',
      routingOperations: 'routingOperations',
      productionOrders: 'productionOrders',
      productionOrderOperations: 'productionOrderOperations',
      materialConsumption: 'materialConsumption',
      productionOutput: 'productionOutput',
      maintenanceTickets: 'maintenanceTickets',
      preventiveMaintenanceOrders: 'preventiveMaintenanceOrders',
      productionShifts: 'productionShifts',
      operationDelays: 'operationDelays',
      delayReasons: 'delayReasons',
      shiftAssignments: 'shiftAssignments',
      hrEmployees: 'hrEmployees',
      thresholdSettings: 'thresholdSettings',
      rolePermissions: 'rolePermissions',
      ...Object.fromEntries(
        CANONICAL_ROLES.map((role) => [
          ROLE_USER_COLLECTION_KEYS[role],
          ROLE_USER_PROPERTIES[role],
        ]),
      ),
    };
    for (const [dataKey, key] of Object.entries(assignments)) {
      if (Array.isArray(snapshot.data[dataKey])) this[key] = clone(snapshot.data[dataKey]);
    }

    for (const permission of plantFx.rolePermissions) {
      const exists = this.rolePermissions.some(
        (row) => row.role === permission.role && row.action === permission.action,
      );
      if (!exists) this.rolePermissions.push(clone(permission));
    }
  }

  #resetInventory() {
    this.inventory = new InventoryPort([
      { warehouse_id: 'wh_mp', product_id: 'comp_tubo', quantity: 5000 },
      { warehouse_id: 'wh_mp', product_id: 'comp_llanta', quantity: 1000 },
      { warehouse_id: 'wh_mp', product_id: 'comp_rayos', quantity: 1000 },
      { warehouse_id: 'wh_mp', product_id: 'comp_maza', quantity: 1000 },
      { warehouse_id: 'wh_mp', product_id: 'rm_pintura', quantity: 500 },
      { warehouse_id: 'wh_mp', product_id: 'rm_soldadura', quantity: 800 },
      { warehouse_id: 'wh_pt', product_id: 'prod_bici', quantity: 49 },
    ]);
    this.quality = new QualityPort(this.qualityInspections);

    for (const c of this.materialConsumption) {
      this.inventory.debit(c.warehouse_id, c.component_product_id, c.quantity_consumed);
    }
    for (const o of this.productionOutput) {
      this.inventory.credit(o.warehouse_id, o.product_id, o.quantity_produced);
    }
  }

  #snapshotData() {
    return {
      companies: this.companies,
      unitsOfMeasure: this.unitsOfMeasure,
      warehouses: this.warehouses,
      products: this.products,
      salesOrders: this.salesOrders,
      qualityInspections: this.qualityInspections,
      billOfMaterials: this.billOfMaterials,
      bomComponents: this.bomComponents,
      workCenters: this.workCenters,
      routings: this.routings,
      routingOperations: this.routingOperations,
      productionOrders: this.productionOrders,
      productionOrderOperations: this.productionOrderOperations,
      materialConsumption: this.materialConsumption,
      productionOutput: this.productionOutput,
      maintenanceTickets: this.maintenanceTickets,
      preventiveMaintenanceOrders: this.preventiveMaintenanceOrders,
      productionShifts: this.productionShifts,
      operationDelays: this.operationDelays,
      delayReasons: this.delayReasons,
      shiftAssignments: this.shiftAssignments,
      hrEmployees: this.hrEmployees,
      thresholdSettings: this.thresholdSettings,
      rolePermissions: this.rolePermissions,
      ...Object.fromEntries(
        CANONICAL_ROLES.map((role) => [
          ROLE_USER_COLLECTION_KEYS[role],
          this[ROLE_USER_PROPERTIES[role]],
        ]),
      ),
    };
  }

  #persist() {
    if (!this.storage) return;
    saveSnapshot(this.#snapshotData(), this.storage);
  }

  #emit() {
    this.dispatchEvent(new Event('change'));
  }

  /* -------------------- Ayudantes de consulta -------------------- */

  productById(id) {
    return this.products.find((p) => p.id === id) || null;
  }
  warehouseById(id) {
    return this.warehouses.find((w) => w.id === id) || null;
  }
  uomById(id) {
    return this.unitsOfMeasure.find((u) => u.id === id) || null;
  }
  salesOrderById(id) {
    return this.salesOrders.find((s) => s.id === id) || null;
  }
  workCenterById(id) {
    return this.workCenters.find((w) => w.id === id) || null;
  }
  orderById(id) {
    return this.productionOrders.find((o) => o.id === id) || null;
  }
  operationsForOrder(orderId) {
    return this.productionOrderOperations
      .filter((o) => o.production_order_id === orderId)
      .sort((a, b) => a.sequence - b.sequence);
  }
  consumptionForOrder(orderId) {
    return this.materialConsumption.filter((c) => c.production_order_id === orderId);
  }
  outputForOrder(orderId) {
    return this.productionOutput.filter((o) => o.production_order_id === orderId);
  }

  /* -------------------- BOM -------------------- */

  activeBoms() {
    return this.billOfMaterials.filter((b) => b.status === 'active');
  }

  bomTree(rootBomId) {
    return buildBomTree({
      boms: this.billOfMaterials,
      components: this.bomComponents,
      products: this.products,
      rootBomId,
    });
  }

  flattenedBom(rootBomId) {
    return flattenBom(this.bomTree(rootBomId));
  }

  bomMaterials(bomId) {
    return this.bomComponents
      .filter((component) => component.bom_id === bomId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  routingForBom(bomId) {
    const bom = this.billOfMaterials.find((item) => item.id === bomId);
    if (!bom) return null;
    const linked = this.routings.find((routing) => routing.bom_id === bomId);
    if (linked) return linked;
    return (
      this.routings.find(
        (routing) => routing.product_id === bom.product_id && routing.status === 'active',
      ) || null
    );
  }

  operationsForBom(bomId) {
    const routing = this.routingForBom(bomId);
    if (!routing) return [];
    return this.routingOperations
      .filter((operation) => operation.routing_id === routing.id)
      .sort((a, b) => a.sequence - b.sequence);
  }

  bomStations(bomId) {
    const bom = this.billOfMaterials.find((item) => item.id === bomId);
    const baseQuantity = bom ? Number(bom.base_quantity) || 1 : 1;
    return this.operationsForBom(bomId).map((operation) => {
      const workCenter = this.workCenterById(operation.work_center_id);
      return {
        ...operation,
        work_center: workCenter,
        estimated_time_minutes:
          (Number(operation.setup_time_minutes) || 0) +
          (Number(operation.run_time_per_unit_minutes) || 0) * baseQuantity,
      };
    });
  }

  /** Crea una receta completa: cabecera BOM, materiales, estaciones y tiempos. */
  createBomRecipe(input = {}) {
    const resolved = this.#resolveRecipeProduct(input);
    const product = resolved.product;
    const bom = {
      id: makeId('bom'),
      company_id: product.company_id || 'cmp_1',
      product_id: product.id,
      code: String(input.code || '').trim() || this.#nextBomCode(product),
      version: String(input.version || '').trim() || this.#nextBomVersion(product.id),
      effective_from: input.effective_from || new Date().toISOString().slice(0, 10),
      effective_to: input.effective_to || null,
      base_quantity:
        input.base_quantity === undefined || input.base_quantity === ''
          ? 1
          : Number(input.base_quantity),
      status: input.status || 'active',
      notes: String(input.notes || '').trim(),
    };
    const issues = validateBom(bom, product);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));
    if (this.billOfMaterials.some((item) => item.code.toLowerCase() === bom.code.toLowerCase())) {
      throw new Error(`Ya existe una receta con el código ${bom.code}.`);
    }
    if (
      this.billOfMaterials.some(
        (item) => item.product_id === product.id && item.version === bom.version,
      )
    ) {
      throw new Error(`El producto ya tiene una receta en la versión ${bom.version}.`);
    }

    const components = this.#buildMaterialLines(bom.id, product.id, input.materials);
    const routing = {
      id: makeId('rt'),
      company_id: bom.company_id,
      product_id: product.id,
      code: this.#nextRoutingCode(product),
      version: bom.version,
      status: 'active',
      bom_id: bom.id,
    };
    const operations = this.#buildRoutingOperations(routing.id, input.stations);

    if (resolved.isNew) this.products.push(product);
    this.billOfMaterials.push(bom);
    this.bomComponents.push(...components);
    this.routings.push(routing);
    this.routingOperations.push(...operations);
    this.#persist();
    this.#emit();
    return { bom, routing, operations };
  }

  /** Modifica cabecera, materiales y/o estaciones de una receta existente. */
  updateBomRecipe(bomId, changes = {}) {
    const bom = this.billOfMaterials.find((item) => item.id === bomId);
    if (!bom) throw new Error(`Receta no encontrada: ${bomId}`);

    let product = this.productById(bom.product_id);
    if (!product) throw new Error(`Producto no encontrado: ${bom.product_id}`);
    let renameTo = null;

    if (changes.product_id && changes.product_id !== bom.product_id) {
      product = this.productById(changes.product_id);
      if (!product) throw new Error(`Producto no encontrado: ${changes.product_id}`);
      if (product.product_type !== 'finished_good') {
        throw new Error('El producto de una receta debe ser un bien terminado.');
      }
    } else if (changes.product_name !== undefined) {
      const name = String(changes.product_name || '').trim();
      if (!name) throw new Error('El nombre del producto no puede estar vacío.');
      const duplicated = this.products.some(
        (item) => item.id !== product.id && item.name.toLowerCase() === name.toLowerCase(),
      );
      if (duplicated) throw new Error(`Ya existe un producto llamado ${name}.`);
      renameTo = name;
    }

    const next = {
      ...bom,
      product_id: product.id,
      code: changes.code !== undefined ? String(changes.code).trim() || bom.code : bom.code,
      version:
        changes.version !== undefined ? String(changes.version).trim() || bom.version : bom.version,
      effective_from:
        changes.effective_from !== undefined
          ? changes.effective_from || bom.effective_from
          : bom.effective_from,
      base_quantity:
        changes.base_quantity !== undefined && changes.base_quantity !== ''
          ? Number(changes.base_quantity)
          : bom.base_quantity,
      notes: changes.notes !== undefined ? String(changes.notes).trim() : bom.notes,
    };
    const issues = validateBom(next, product);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));
    if (
      this.billOfMaterials.some(
        (item) => item.id !== bom.id && item.code.toLowerCase() === next.code.toLowerCase(),
      )
    ) {
      throw new Error(`Ya existe una receta con el código ${next.code}.`);
    }
    if (
      this.billOfMaterials.some(
        (item) =>
          item.id !== bom.id && item.product_id === product.id && item.version === next.version,
      )
    ) {
      throw new Error(`El producto ya tiene una receta en la versión ${next.version}.`);
    }

    const newComponents =
      changes.materials !== undefined
        ? this.#buildMaterialLines(bom.id, product.id, changes.materials)
        : null;

    let routing = this.routingForBom(bom.id);
    let routingToCreate = null;
    let newOperations = null;
    if (changes.stations !== undefined) {
      if (!routing) {
        routingToCreate = {
          id: makeId('rt'),
          company_id: bom.company_id,
          product_id: product.id,
          code: this.#nextRoutingCode(product),
          version: next.version,
          status: 'active',
          bom_id: bom.id,
        };
        newOperations = this.#buildRoutingOperations(routingToCreate.id, changes.stations);
      } else {
        newOperations = this.#buildRoutingOperations(routing.id, changes.stations);
      }
    }

    if (renameTo) product.name = renameTo;
    Object.assign(bom, next);
    if (newComponents) {
      this.bomComponents = this.bomComponents
        .filter((component) => component.bom_id !== bom.id)
        .concat(newComponents);
    }
    if (routingToCreate) {
      this.routings.push(routingToCreate);
      routing = routingToCreate;
    }
    if (routing && newOperations) {
      this.routingOperations = this.routingOperations
        .filter((operation) => operation.routing_id !== routing.id)
        .concat(newOperations);
      routing.product_id = product.id;
      routing.version = next.version;
      routing.bom_id = bom.id;
    } else if (routing && changes.product_id) {
      routing.product_id = product.id;
    }

    this.#persist();
    this.#emit();
    return bom;
  }

  /** Elimina la receta y sus líneas/ruta asociadas (operación confirmada en UI). */
  deleteBomRecipe(bomId) {
    const bom = this.billOfMaterials.find((item) => item.id === bomId);
    if (!bom) throw new Error(`Receta no encontrada: ${bomId}`);

    this.billOfMaterials = this.billOfMaterials.filter((item) => item.id !== bomId);
    this.bomComponents = this.bomComponents.filter((component) => component.bom_id !== bomId);

    const routingIds = new Set(
      this.routings.filter((routing) => routing.bom_id === bomId).map((routing) => routing.id),
    );
    const stillUsed = this.billOfMaterials.some((item) => item.product_id === bom.product_id);
    if (!stillUsed) {
      for (const routing of this.routings.filter((item) => item.product_id === bom.product_id)) {
        routingIds.add(routing.id);
      }
    }
    this.routingOperations = this.routingOperations.filter(
      (operation) => !routingIds.has(operation.routing_id),
    );
    this.routings = this.routings.filter((routing) => !routingIds.has(routing.id));

    this.#persist();
    this.#emit();
    return bom;
  }

  addBomComponent(bomId, input = {}) {
    const bom = this.billOfMaterials.find((item) => item.id === bomId);
    if (!bom) throw new Error(`Receta no encontrada: ${bomId}`);
    const component = this.productById(input.component_product_id);
    if (!component) throw new Error('El material seleccionado no existe.');
    if (component.id === bom.product_id) {
      throw new Error('La receta no puede incluir el mismo producto como material.');
    }
    const existing = this.bomComponents.filter((line) => line.bom_id === bomId);
    const line = {
      id: makeId('bc'),
      bom_id: bomId,
      component_product_id: component.id,
      quantity_per_unit: Number(input.quantity_per_unit),
      uom_id: input.uom_id || component.uom_id,
      scrap_percentage:
        input.scrap_percentage === undefined || input.scrap_percentage === ''
          ? 0
          : Number(input.scrap_percentage),
      sequence:
        input.sequence === undefined || input.sequence === ''
          ? (existing.reduce((max, item) => Math.max(max, item.sequence), 0) || 0) + 10
          : Number(input.sequence),
      is_optional: Boolean(input.is_optional),
    };
    const issues = validateBomComponent(line, existing);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));
    this.bomComponents.push(line);
    this.#persist();
    this.#emit();
    return line;
  }

  updateBomComponent(bomId, componentId, changes = {}) {
    const line = this.bomComponents.find(
      (component) => component.id === componentId && component.bom_id === bomId,
    );
    if (!line) throw new Error(`Material de la receta no encontrado: ${componentId}`);
    const bom = this.billOfMaterials.find((item) => item.id === bomId);
    const candidate = { ...line, ...changes };
    if (changes.component_product_id) {
      const component = this.productById(changes.component_product_id);
      if (!component) throw new Error('El material seleccionado no existe.');
      if (component.id === bom.product_id) {
        throw new Error('La receta no puede incluir el mismo producto como material.');
      }
      candidate.component_product_id = component.id;
      candidate.uom_id = changes.uom_id || component.uom_id;
    }
    if (changes.quantity_per_unit !== undefined) {
      candidate.quantity_per_unit = Number(changes.quantity_per_unit);
    }
    if (changes.scrap_percentage !== undefined) {
      candidate.scrap_percentage = Number(changes.scrap_percentage);
    }
    if (changes.sequence !== undefined) candidate.sequence = Number(changes.sequence);
    const others = this.bomComponents.filter(
      (component) => component.bom_id === bomId && component.id !== componentId,
    );
    const issues = validateBomComponent(candidate, others);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));
    Object.assign(line, candidate);
    this.#persist();
    this.#emit();
    return line;
  }

  removeBomComponent(bomId, componentId) {
    const line = this.bomComponents.find(
      (component) => component.id === componentId && component.bom_id === bomId,
    );
    if (!line) throw new Error(`Material de la receta no encontrado: ${componentId}`);
    this.bomComponents = this.bomComponents.filter((component) => component !== line);
    this.#persist();
    this.#emit();
    return line;
  }

  addRoutingOperationForBom(bomId, input = {}) {
    const bom = this.billOfMaterials.find((item) => item.id === bomId);
    if (!bom) throw new Error(`Receta no encontrada: ${bomId}`);
    const existingRouting = this.routingForBom(bomId);
    const currentOperations = existingRouting
      ? this.routingOperations.filter((operation) => operation.routing_id === existingRouting.id)
      : [];
    const routingId = existingRouting ? existingRouting.id : makeId('rt');
    const operation = this.#normalizeOperation(
      routingId,
      input,
      (currentOperations.reduce((max, item) => Math.max(max, item.sequence), 0) || 0) + 10,
    );
    if (currentOperations.some((item) => item.work_center_id === operation.work_center_id)) {
      throw new Error('La estación ya está incluida en la receta.');
    }
    const issues = validateRoutingSequence([...currentOperations, operation]);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));

    let routing = existingRouting;
    if (!routing) {
      routing = {
        id: routingId,
        company_id: bom.company_id,
        product_id: bom.product_id,
        code: this.#nextRoutingCode(this.productById(bom.product_id)),
        version: bom.version,
        status: 'active',
        bom_id: bom.id,
      };
      this.routings.push(routing);
    }
    routing.bom_id = bom.id;
    this.routingOperations.push(operation);
    this.#persist();
    this.#emit();
    return operation;
  }

  updateRoutingOperationForBom(bomId, operationId, changes = {}) {
    const routing = this.routingForBom(bomId);
    if (!routing) throw new Error('La receta no tiene estaciones configuradas.');
    const operation = this.routingOperations.find(
      (item) => item.id === operationId && item.routing_id === routing.id,
    );
    if (!operation) throw new Error(`Estación de la receta no encontrada: ${operationId}`);
    const candidate = this.#normalizeOperation(
      routing.id,
      { ...operation, ...changes },
      operation.sequence,
    );
    const others = this.routingOperations.filter(
      (item) => item.routing_id === routing.id && item.id !== operationId,
    );
    if (others.some((item) => item.work_center_id === candidate.work_center_id)) {
      throw new Error('La estación ya está incluida en la receta.');
    }
    const issues = validateRoutingSequence([...others, candidate]);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));
    Object.assign(operation, candidate);
    this.#persist();
    this.#emit();
    return operation;
  }

  removeRoutingOperationForBom(bomId, operationId) {
    const routing = this.routingForBom(bomId);
    if (!routing) throw new Error('La receta no tiene estaciones configuradas.');
    const operation = this.routingOperations.find(
      (item) => item.id === operationId && item.routing_id === routing.id,
    );
    if (!operation) throw new Error(`Estación de la receta no encontrada: ${operationId}`);
    this.routingOperations = this.routingOperations.filter((item) => item !== operation);
    this.#persist();
    this.#emit();
    return operation;
  }

  #codeSegment(value) {
    return (
      String(value || 'REC')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24) || 'REC'
    );
  }

  #nextBomCode(product) {
    const base = `BOM-${this.#codeSegment(product?.code || product?.id)}`;
    let code = base;
    let suffix = 2;
    while (this.billOfMaterials.some((item) => item.code.toLowerCase() === code.toLowerCase())) {
      code = `${base}-${suffix}`;
      suffix += 1;
    }
    return code;
  }

  #nextRoutingCode(product) {
    const base = `RT-${this.#codeSegment(product?.code || product?.id)}`;
    let code = base;
    let suffix = 2;
    while (this.routings.some((item) => item.code.toLowerCase() === code.toLowerCase())) {
      code = `${base}-${suffix}`;
      suffix += 1;
    }
    return code;
  }

  #nextBomVersion(productId) {
    const versions = this.billOfMaterials
      .filter((item) => item.product_id === productId)
      .map((item) => String(item.version));
    if (!versions.length) return 'A';
    for (let index = 0; index < 26; index += 1) {
      const version = String.fromCharCode(65 + index);
      if (!versions.includes(version)) return version;
    }
    return `V${versions.length + 1}`;
  }

  #nextProductCode(name) {
    const base = `FG-${this.#codeSegment(name)}`;
    let code = base;
    let suffix = 2;
    while (this.products.some((item) => item.code.toLowerCase() === code.toLowerCase())) {
      code = `${base}-${suffix}`;
      suffix += 1;
    }
    return code;
  }

  #resolveRecipeProduct({ product_id, product_name } = {}) {
    if (product_id) {
      const product = this.productById(product_id);
      if (!product) throw new Error(`Producto no encontrado: ${product_id}`);
      if (product.product_type !== 'finished_good') {
        throw new Error('El producto de una receta debe ser un bien terminado.');
      }
      return { product, isNew: false };
    }
    const name = String(product_name || '').trim();
    if (!name) throw new Error('El nombre del producto es obligatorio.');
    const existing = this.products.find(
      (product) => product.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      if (existing.product_type !== 'finished_good') {
        throw new Error('El producto de una receta debe ser un bien terminado.');
      }
      return { product: existing, isNew: false };
    }
    return {
      product: {
        id: makeId('prod'),
        company_id: 'cmp_1',
        code: this.#nextProductCode(name),
        name,
        product_type: 'finished_good',
        uom_id: 'uom_un',
        unit_cost: 0,
      },
      isNew: true,
    };
  }

  #buildMaterialLines(bomId, productId, materials) {
    const list = Array.isArray(materials) ? materials : [];
    if (!list.length) throw new Error('Debe añadir al menos un material a la receta.');
    const lines = [];
    for (let index = 0; index < list.length; index += 1) {
      const raw = list[index] || {};
      const component = this.productById(String(raw.component_product_id || '').trim());
      if (!component) throw new Error('Seleccione un material válido para cada línea.');
      if (component.id === productId) {
        throw new Error('La receta no puede incluir el mismo producto como material.');
      }
      const line = {
        id: makeId('bc'),
        bom_id: bomId,
        component_product_id: component.id,
        quantity_per_unit: Number(raw.quantity_per_unit),
        uom_id: raw.uom_id || component.uom_id,
        scrap_percentage:
          raw.scrap_percentage === undefined || raw.scrap_percentage === ''
            ? 0
            : Number(raw.scrap_percentage),
        sequence:
          raw.sequence === undefined || raw.sequence === ''
            ? (index + 1) * 10
            : Number(raw.sequence),
        is_optional: Boolean(raw.is_optional),
      };
      const issues = validateBomComponent(line, lines);
      if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));
      lines.push(line);
    }
    return lines;
  }

  #normalizeOperation(routingId, input = {}, fallbackSequence = 10) {
    const workCenterId = String(input.work_center_id || '').trim();
    const workCenter = this.workCenterById(workCenterId);
    if (!workCenter) throw new Error('Seleccione una estación válida para cada operación.');
    const setup =
      input.setup_time_minutes === undefined || input.setup_time_minutes === ''
        ? 0
        : Number(input.setup_time_minutes);
    const rawRun =
      input.run_time_per_unit_minutes ?? input.estimated_time_minutes ?? input.time_minutes;
    const run = rawRun === undefined || rawRun === '' ? 0 : Number(rawRun);
    if (!Number.isFinite(setup) || setup < 0) {
      throw new Error(`El alistamiento de ${workCenter.name} debe ser mayor o igual que 0.`);
    }
    if (!Number.isFinite(run) || run < 0) {
      throw new Error(`El tiempo estimado de ${workCenter.name} debe ser mayor o igual que 0.`);
    }
    if (setup + run <= 0) {
      throw new Error(`Indique un tiempo estimado mayor que 0 para ${workCenter.name}.`);
    }
    return {
      id: input.id || makeId('ro'),
      routing_id: routingId,
      work_center_id: workCenter.id,
      sequence:
        input.sequence === undefined || input.sequence === ''
          ? fallbackSequence
          : Number(input.sequence),
      description: String(input.description || '').trim() || `Operación en ${workCenter.name}`,
      setup_time_minutes: setup,
      run_time_per_unit_minutes: run,
    };
  }

  #buildRoutingOperations(routingId, stations) {
    const list = Array.isArray(stations) ? stations : [];
    if (!list.length) throw new Error('Debe indicar al menos una estación de trabajo.');
    const operations = [];
    for (let index = 0; index < list.length; index += 1) {
      const operation = this.#normalizeOperation(routingId, list[index], (index + 1) * 10);
      if (operations.some((item) => item.work_center_id === operation.work_center_id)) {
        throw new Error(`La estación ${operation.work_center_id} está repetida en la receta.`);
      }
      operations.push(operation);
    }
    const issues = validateRoutingSequence(operations);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));
    return operations;
  }

  /* -------------------- Órdenes -------------------- */

  /** Crea una orden (planned) y genera sus operaciones congeladas. */
  createOrder(input) {
    const routeOps = input.routing_id
      ? this.routingOperations.filter((ro) => ro.routing_id === input.routing_id)
      : [];
    const scheduleCheck = canScheduleOnWorkCenter(this.workCenters, routeOps);
    if (!scheduleCheck.allowed) {
      throw new Error(
        `No se puede programar la orden: centro(s) desactivado(s) ${scheduleCheck.blocked_work_center_ids.join(', ')}.`,
      );
    }
    const order = {
      id: makeId('po'),
      company_id: 'cmp_1',
      order_number: input.order_number || this.#nextOrderNumber(),
      product_id: input.product_id,
      bom_id: input.bom_id,
      routing_id: input.routing_id || null,
      sales_order_id: input.sales_order_id || null,
      warehouse_id: input.warehouse_id,
      quantity_planned: Number(input.quantity_planned),
      status: 'planned',
      planned_start_date: input.planned_start_date || null,
      planned_end_date: input.planned_end_date || null,
      actual_start_date: null,
      actual_end_date: null,
      priority: input.priority || 'normal',
      notes: input.notes || '',
    };
    this.productionOrders.push(order);
    this.#generateOperations(order);
    this.#persist();
    this.#emit();
    return order;
  }

  /** Transiciona el estado de una orden validando la máquina de estados. */
  transitionOrder(orderId, to) {
    const order = this.orderById(orderId);
    if (!order) throw new Error(`Orden no encontrada: ${orderId}`);
    assertTransition(order.status, to);
    order.status = to;
    const now = new Date().toISOString();
    if (to === 'in_progress' && !order.actual_start_date)
      order.actual_start_date = now.slice(0, 10);
    if (to === 'completed' && !order.actual_end_date) order.actual_end_date = now.slice(0, 10);
    this.#persist();
    this.#emit();
    return order;
  }

  /** Recalcula el estado de la orden a partir de sus operaciones. */
  recomputeOrderStatus(orderId) {
    const order = this.orderById(orderId);
    if (!order || order.status === 'cancelled') return order;
    if (order.status === 'planned') return order;
    const derived = deriveOrderStatus(this.operationsForOrder(orderId));
    order.status = derived;
    if (derived === 'completed') {
      order.actual_end_date = order.actual_end_date || new Date().toISOString().slice(0, 10);
    }
    this.#persist();
    this.#emit();
    return order;
  }

  #generateOperations(order) {
    if (!order.routing_id) return;
    const ops = this.routingOperations
      .filter((ro) => ro.routing_id === order.routing_id)
      .sort((a, b) => a.sequence - b.sequence);
    for (const ro of ops) {
      this.productionOrderOperations.push({
        id: makeId('poo'),
        production_order_id: order.id,
        routing_operation_id: ro.id,
        work_center_id: ro.work_center_id,
        sequence: ro.sequence,
        status: 'pending',
        planned_time_minutes: plannedTimeMinutes(ro, order.quantity_planned),
        actual_time_minutes: null,
        delay_time_minutes: 0,
        quantity_completed: 0,
        scrap_quantity: 0,
        operator_id: null,
        started_at: null,
        completed_at: null,
      });
    }
  }

  #nextOrderNumber() {
    const nums = this.productionOrders
      .map((o) => Number(String(o.order_number).replace(/\D/g, '')))
      .filter((n) => !Number.isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 3000) + 1;
    return `OP-${next}`;
  }

  /* -------------------- Ejecución -------------------- */

  startOperation(operationId) {
    const op = this.productionOrderOperations.find((o) => o.id === operationId);
    if (!op) throw new Error(`Operación no encontrada: ${operationId}`);
    if (op.status !== 'pending' && op.status !== 'paused') {
      throw new Error(`No se puede iniciar una operación en estado "${op.status}".`);
    }
    op.status = 'in_progress';
    op.started_at = op.started_at || new Date().toISOString();
    const order = this.orderById(op.production_order_id);
    if (order && order.status === 'released') {
      assertTransition(order.status, 'in_progress');
      order.status = 'in_progress';
      order.actual_start_date = order.actual_start_date || new Date().toISOString().slice(0, 10);
    }
    this.#persist();
    this.#emit();
    return op;
  }

  pauseOperation(operationId) {
    const op = this.productionOrderOperations.find((o) => o.id === operationId);
    if (!op || op.status !== 'in_progress') {
      throw new Error('Solo se puede pausar una operación en progreso.');
    }
    op.status = 'paused';
    this.#persist();
    this.#emit();
    return op;
  }

  completeOperation(operationId, { actual_time_minutes, scrap_quantity = 0 } = {}) {
    const op = this.productionOrderOperations.find((o) => o.id === operationId);
    if (!op) throw new Error(`Operación no encontrada: ${operationId}`);
    const minutes = Number(actual_time_minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new Error('actual_time_minutes debe ser mayor que 0.');
    }
    op.status = 'completed';
    op.actual_time_minutes = minutes;
    op.scrap_quantity = Number(scrap_quantity) || 0;
    op.completed_at = new Date().toISOString();
    this.recomputeOrderStatus(op.production_order_id);
    this.#persist();
    this.#emit();
    return op;
  }

  /* -------------------- Consumo / Salida -------------------- */

  recordConsumption(input) {
    const record = {
      id: makeId('mc'),
      production_order_id: input.production_order_id,
      po_operation_id: input.po_operation_id || null,
      component_product_id: input.component_product_id,
      bom_component_id: input.bom_component_id || null,
      warehouse_id: input.warehouse_id,
      quantity_consumed: Number(input.quantity_consumed),
      uom_id: input.uom_id,
      lot_number: input.lot_number || '',
      consumed_at: new Date().toISOString(),
      consumed_by: input.consumed_by || null,
    };
    this.materialConsumption.push(record);
    this.inventory.debit(
      record.warehouse_id,
      record.component_product_id,
      record.quantity_consumed,
    );
    this.#persist();
    this.#emit();
    return record;
  }

  recordOutput(input) {
    const record = {
      id: makeId('out'),
      production_order_id: input.production_order_id,
      product_id: input.product_id,
      warehouse_id: input.warehouse_id,
      quantity_produced: Number(input.quantity_produced),
      scrap_quantity: Number(input.scrap_quantity) || 0,
      lot_number: input.lot_number || '',
      uom_id: input.uom_id,
      produced_at: new Date().toISOString(),
      recorded_by: input.recorded_by || null,
    };
    this.productionOutput.push(record);
    this.inventory.credit(record.warehouse_id, record.product_id, record.quantity_produced);
    this.#persist();
    this.#emit();
    return record;
  }

  /* -------------------- Analítica -------------------- */

  reconcile(orderId) {
    const order = this.orderById(orderId);
    if (!order) return [];
    return reconcileConsumption({
      bomComponents: this.bomComponents.filter((c) => c.bom_id === order.bom_id),
      consumptions: this.consumptionForOrder(orderId),
      quantityPlanned: order.quantity_planned,
    });
  }

  reconciliationNeedsReview(orderId) {
    return requiresReview(this.reconcile(orderId));
  }

  orderQualityStatus(orderId) {
    return this.quality.derivedStatus(orderId);
  }

  /** KPIs para el panel (dashboard). */
  kpis() {
    const active = this.productionOrders.filter(
      (o) => o.status === 'released' || o.status === 'in_progress',
    ).length;
    const totalProduced = this.productionOutput.reduce((s, o) => s + o.quantity_produced, 0);
    const totalScrap = this.productionOutput.reduce((s, o) => s + o.scrap_quantity, 0);
    const totalPlanned = this.productionOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((s, o) => s + o.quantity_planned, 0);
    const scrapRate =
      totalProduced + totalScrap > 0 ? totalScrap / (totalProduced + totalScrap) : 0;
    const completionRate = totalPlanned > 0 ? totalProduced / totalPlanned : 0;
    return {
      activeOrders: active,
      totalOrders: this.productionOrders.length,
      totalProduced,
      totalScrap,
      scrapRate,
      completionRate,
      byStatus: this.#countBy(this.productionOrders, 'status'),
    };
  }

  /** Carga pendiente por centro de trabajo (minutos de operaciones no completadas). */
  workCenterLoads() {
    return this.workCenters.map((wc) => {
      const ops = this.productionOrderOperations.filter(
        (o) => o.work_center_id === wc.id && o.status !== 'completed',
      );
      const load = ops.reduce((s, o) => s + o.planned_time_minutes, 0);
      return { workCenter: wc, loadMinutes: load, pendingOperations: ops.length };
    });
  }

  /** Utilización diaria por centro: la misma carga pendiente que usa el panel. */
  dailyUtilizationByWorkCenter() {
    return this.workCenterLoads().map((row) => ({
      ...row,
      utilization: capacityUtilization(row.loadMinutes, row.workCenter),
    }));
  }

  /* -------------------- Mantenimiento (US-09) -------------------- */

  maintenanceTicketsFor({ status, priority, workCenterId } = {}) {
    const filtered = this.maintenanceTickets.filter((ticket) => {
      if (status && ticket.ticket_status !== status) return false;
      if (priority && ticket.priority !== priority) return false;
      if (workCenterId && ticket.work_center_id !== workCenterId) return false;
      return true;
    });
    return sortTicketsByPriorityAndAge(filtered);
  }

  activeInterventionForWorkCenter(workCenterId) {
    return (
      this.maintenanceTickets.find(
        (ticket) =>
          ticket.work_center_id === workCenterId && ticket.ticket_status === 'in_progress',
      ) || null
    );
  }

  maintenanceHistoryForWorkCenter(workCenterId) {
    return this.maintenanceTickets
      .filter(
        (ticket) => ticket.work_center_id === workCenterId && ticket.ticket_status === 'resolved',
      )
      .sort(
        (a, b) => new Date(b.resolved_at || 0).getTime() - new Date(a.resolved_at || 0).getTime(),
      );
  }

  preventiveOrdersFor({ status, workCenterId } = {}) {
    return this.preventiveMaintenanceOrders
      .filter((order) => {
        if (status && order.status !== status) return false;
        if (workCenterId && order.work_center_id !== workCenterId) return false;
        return true;
      })
      .sort((a, b) => String(a.planned_date).localeCompare(String(b.planned_date)));
  }

  maintenanceIndicatorsForWorkCenter(workCenterId, period) {
    return deriveWearIndicator(this.maintenanceTickets, workCenterId, period);
  }

  startMaintenanceIntervention(ticketId, { technician_ext_hr_employee_id } = {}) {
    const ticket = this.maintenanceTickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error(`Ticket no encontrado: ${ticketId}`);
    if (ticket.ticket_status === 'resolved') {
      throw new Error('Un ticket resuelto no se puede reabrir.');
    }
    if (ticket.ticket_status !== 'open') {
      throw new Error('Solo se puede tomar un ticket abierto.');
    }
    const technician = String(technician_ext_hr_employee_id || '').trim();
    if (!technician) {
      throw new Error('Debe asignar un técnico para iniciar la intervención.');
    }
    const active = this.activeInterventionForWorkCenter(ticket.work_center_id);
    if (!canStartIntervention(ticket, active ? [active] : [], technician)) {
      throw new Error('El centro de trabajo ya tiene una intervención activa.');
    }
    const workCenter = this.workCenterById(ticket.work_center_id);
    if (!workCenter) {
      throw new Error(`Centro de trabajo no encontrado: ${ticket.work_center_id}`);
    }

    const now = new Date().toISOString();
    ticket.ticket_status = 'in_progress';
    ticket.technician_ext_hr_employee_id = technician;
    ticket.intervention_started_at = now;
    ticket.downtime_started_at = ticket.downtime_started_at || now;
    workCenter.operational_status = 'fault';

    this.#persist();
    this.#emit();
    return { ticket, workCenter };
  }

  resolveMaintenanceTicket(
    ticketId,
    { resolvedAt, downtimeStartedAt, downtimeEndedAt, causeReasonId = null, notes = '' } = {},
  ) {
    const ticket = this.maintenanceTickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error(`Ticket no encontrado: ${ticketId}`);
    if (!canResolveTicket(ticket)) {
      throw new Error('Solo se puede resolver un ticket en intervención.');
    }
    if (!resolvedAt || !downtimeStartedAt || !downtimeEndedAt) {
      throw new Error('Debe registrar la resolución y las marcas de parada.');
    }

    const startedMs = new Date(ticket.intervention_started_at).getTime();
    const resolvedMs = new Date(resolvedAt).getTime();
    if (!Number.isFinite(startedMs) || !Number.isFinite(resolvedMs)) {
      throw new Error('Las marcas de la intervención no son fechas válidas.');
    }
    if (resolvedMs < startedMs) {
      throw new Error('resolved_at no puede ser anterior a intervention_started_at.');
    }

    const downtimeMinutes = computeDowntimeMinutes(downtimeStartedAt, downtimeEndedAt);
    const downtimeStartMs = new Date(downtimeStartedAt).getTime();
    const downtimeEndMs = new Date(downtimeEndedAt).getTime();

    const workCenter = this.workCenterById(ticket.work_center_id);
    if (!workCenter) {
      throw new Error(`Centro de trabajo no encontrado: ${ticket.work_center_id}`);
    }

    ticket.ticket_status = 'resolved';
    ticket.resolved_at = new Date(resolvedMs).toISOString();
    ticket.downtime_started_at = new Date(downtimeStartMs).toISOString();
    ticket.downtime_ended_at = new Date(downtimeEndMs).toISOString();
    ticket.downtime_minutes = downtimeMinutes;
    ticket.cause_reason_id = causeReasonId || null;
    ticket.resolution_notes = String(notes || '').trim() || null;

    const activeOperation =
      this.productionOrderOperations
        .filter(
          (op) =>
            op.work_center_id === ticket.work_center_id &&
            (op.status === 'in_progress' || op.status === 'paused'),
        )
        .sort(
          (a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime(),
        )[0] || null;

    workCenter.operational_status = resolveAvailabilityStatus(activeOperation, ticket);

    this.#persist();
    this.#emit();
    return { ticket, workCenter };
  }

  createPreventiveMaintenanceOrder({
    workCenterId,
    sourceTicketId,
    plannedDate,
    title,
    technician_ext_hr_employee_id,
  } = {}) {
    if (!workCenterId) throw new Error('Debe indicar el centro de trabajo.');
    const workCenter = this.workCenterById(workCenterId);
    if (!workCenter) throw new Error(`Centro de trabajo no encontrado: ${workCenterId}`);

    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) throw new Error('El título de la orden preventiva es obligatorio.');
    if (!plannedDate) throw new Error('La fecha objetivo es obligatoria.');

    let source = null;
    if (sourceTicketId) {
      source = this.maintenanceTickets.find((t) => t.id === sourceTicketId);
      if (!source) throw new Error(`Ticket de origen no encontrado: ${sourceTicketId}`);
      if (source.work_center_id !== workCenterId) {
        throw new Error('El ticket de origen pertenece a otro centro de trabajo.');
      }
    }

    const order = {
      id: makeId('pmo'),
      company_id: 'cmp_1',
      order_code: this.#nextPreventiveCode(),
      work_center_id: workCenterId,
      source_ticket_id: source ? source.id : null,
      title: cleanTitle,
      planned_date: plannedDate,
      status: 'planned',
      technician_ext_hr_employee_id: String(technician_ext_hr_employee_id || '').trim() || null,
      completed_at: null,
      downtime_minutes: null,
      notes: '',
    };

    this.preventiveMaintenanceOrders.push(order);
    this.#persist();
    this.#emit();
    return order;
  }

  transitionPreventiveMaintenanceOrder(orderId, nextStatus) {
    const order = this.preventiveMaintenanceOrders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Orden preventiva no encontrada: ${orderId}`);
    if (!canTransitionPreventiveOrder(order, nextStatus)) {
      throw new Error(`Transición inválida de "${order.status}" a "${nextStatus}".`);
    }
    if (
      nextStatus === 'completed' &&
      order.downtime_minutes !== null &&
      order.downtime_minutes !== undefined &&
      (!Number.isFinite(Number(order.downtime_minutes)) || Number(order.downtime_minutes) < 0)
    ) {
      throw new Error('downtime_minutes debe ser mayor o igual que 0.');
    }

    order.status = nextStatus;
    if (nextStatus === 'completed') order.completed_at = new Date().toISOString();

    this.#persist();
    this.#emit();
    return order;
  }

  cancelPreventiveMaintenanceOrder(orderId, { reason } = {}) {
    const order = this.preventiveMaintenanceOrders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Orden preventiva no encontrada: ${orderId}`);
    if (!canTransitionPreventiveOrder(order, 'cancelled')) {
      throw new Error(`No se puede cancelar una orden en estado "${order.status}".`);
    }

    order.status = 'cancelled';
    const cleanReason = String(reason || '').trim();
    if (cleanReason) {
      order.notes = order.notes
        ? `${order.notes} Cancelada: ${cleanReason}`
        : `Cancelada: ${cleanReason}`;
    }

    this.#persist();
    this.#emit();
    return order;
  }

  #nextPreventiveCode() {
    const numbers = this.preventiveMaintenanceOrders
      .map((order) => Number(String(order.order_code).replace(/\D/g, '')))
      .filter((value) => !Number.isNaN(value));
    const next = (numbers.length ? Math.max(...numbers) : 2000) + 1;
    return `PM-${next}`;
  }

  /* -------------------- US-06 Turnos y atrasos -------------------- */

  #operationFor(operationId) {
    return this.productionOrderOperations.find((o) => o.id === operationId) || null;
  }

  #shiftFor(shiftId) {
    return this.productionShifts.find((s) => s.id === shiftId) || null;
  }

  #delayFor(delayId) {
    return this.operationDelays.find((d) => d.id === delayId) || null;
  }

  activeShiftFor(operationId) {
    return activeShiftOf(this.productionShifts, operationId);
  }

  delaysForOperation(operationId) {
    return this.operationDelays
      .filter((delay) => delay.po_operation_id === operationId)
      .sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
  }

  openDelayFor(operationId) {
    return openDelayOf(this.delaysForOperation(operationId));
  }

  reasonsForShift(shiftId) {
    const shift = this.#shiftFor(shiftId);
    if (!shift) return [];
    return this.delayReasons.filter(
      (reason) =>
        reason.active &&
        (reason.scope === 'global' ||
          (reason.scope === 'shift' && reason.production_shift_id === shiftId)),
    );
  }

  startShift(operationId, { operator_id = null, now } = {}) {
    const operation = this.#operationFor(operationId);
    if (!operation) throw new Error(`Operación no encontrada: ${operationId}`);
    const active = this.activeShiftFor(operationId);
    const operatorId = String(operator_id || '').trim() || null;
    const activeOperatorShift = operatorId
      ? this.productionShifts.find(
          (shift) =>
            shift.status === 'in_progress' &&
            shift.operator_id === operatorId &&
            shift.po_operation_id !== operationId,
        )
      : null;
    if (!canStartShift(operation, active, { operator_id: operatorId, activeOperatorShift })) {
      if (operation.status === 'completed') {
        throw new Error('No se puede iniciar un turno sobre una operación finalizada.');
      }
      if (active) throw new Error('La operación ya tiene un turno en progreso.');
      throw new Error('El operador ya tiene otro turno en progreso.');
    }

    const startedAt = now || new Date().toISOString();
    const numbers = this.productionShifts
      .filter((shift) => shift.po_operation_id === operationId)
      .map((shift) => shift.shift_number);
    const shift = {
      id: makeId('sh'),
      po_operation_id: operationId,
      operator_id: operatorId,
      shift_number: (numbers.length ? Math.max(...numbers) : 0) + 1,
      status: 'in_progress',
      started_at: startedAt,
      ended_at: null,
      quantity_counted: 0,
      supervisor_validated: false,
      validated_at: null,
      supervisor_notes: null,
    };
    this.productionShifts.push(shift);

    operation.status = 'in_progress';
    operation.operator_id = operatorId || operation.operator_id || null;
    operation.started_at = operation.started_at || startedAt;
    const order = this.orderById(operation.production_order_id);
    if (order && order.status === 'released') {
      assertTransition(order.status, 'in_progress');
      order.status = 'in_progress';
      order.actual_start_date = order.actual_start_date || startedAt.slice(0, 10);
    }

    this.#persist();
    this.#emit();
    return { shift, operation, order };
  }

  #recalcOperationTime(operation) {
    const delays = this.delaysForOperation(operation.id);
    operation.delay_time_minutes = sumClosedDelayMinutes(delays);
    if (operation.status === 'completed' && operation.started_at && operation.completed_at) {
      operation.actual_time_minutes = computeEffectiveMinutes(
        operation.started_at,
        operation.completed_at,
        delays,
      );
    }
    return operation;
  }

  finishOperation(operationId, { now } = {}) {
    const operation = this.#operationFor(operationId);
    if (!operation) throw new Error(`Operación no encontrada: ${operationId}`);
    if (operation.status !== 'in_progress') {
      throw new Error('Solo se puede finalizar una operación en progreso.');
    }
    const completedAt = now || new Date().toISOString();
    const shift = this.activeShiftFor(operationId);
    if (shift) {
      shift.status = 'completed';
      shift.ended_at = completedAt;
    }
    operation.completed_at = completedAt;
    operation.status = 'completed';
    this.#recalcOperationTime(operation);
    const order = this.recomputeOrderStatus(operation.production_order_id);
    const openDelays = this.delaysForOperation(operationId).filter(
      (delay) => delay.status === 'open',
    );
    this.#persist();
    this.#emit();
    return { operation, order, openDelays };
  }

  startDelay(operationId, { reasonId = null, customLabel = null, note = '', now } = {}) {
    const operation = this.#operationFor(operationId);
    if (!operation) throw new Error(`Operación no encontrada: ${operationId}`);
    const open = this.openDelayFor(operationId);
    if (!canStartDelay(operation, open)) {
      if (open) throw new Error('Ya existe un atraso abierto para esta operación.');
      throw new Error('Solo se puede registrar un atraso en una operación en progreso.');
    }
    const shift = this.activeShiftFor(operationId);
    if (!shift) throw new Error('No hay un turno activo para la operación.');

    let resolvedReasonId = reasonId;
    if (String(customLabel || '').trim()) {
      const label = String(customLabel).trim();
      const duplicate = this.delayReasons.some(
        (reason) =>
          reason.company_id === 'cmp_1' && reason.label.toLowerCase() === label.toLowerCase(),
      );
      if (duplicate) throw new Error('Ya existe un motivo de atraso con esa etiqueta.');
      const custom = {
        id: makeId('dr'),
        company_id: 'cmp_1',
        label,
        origin: 'custom',
        scope: 'shift',
        production_shift_id: shift.id,
        active: true,
        created_by: shift.operator_id || null,
      };
      this.delayReasons.push(custom);
      resolvedReasonId = custom.id;
    }

    if (!resolvedReasonId) throw new Error('Debe seleccionar un motivo de atraso.');
    const reason = this.delayReasons.find((row) => row.id === resolvedReasonId && row.active);
    if (!reason) throw new Error('El motivo de atraso no existe o está inactivo.');
    if (reason.scope === 'shift' && reason.production_shift_id !== shift.id) {
      throw new Error('El motivo de atraso pertenece a otro turno.');
    }

    const delay = {
      id: makeId('od'),
      po_operation_id: operationId,
      production_shift_id: shift.id,
      delay_reason_id: reason.id,
      started_at: now || new Date().toISOString(),
      ended_at: null,
      duration_minutes: null,
      status: 'open',
      note: String(note || '').trim() || null,
      escalated_to_maint: false,
      corrected_at: null,
      corrected_by: null,
      correction_note: null,
    };
    this.operationDelays.push(delay);
    this.#persist();
    this.#emit();
    return delay;
  }

  closeDelay(delayId, { endedAt, now } = {}) {
    const delay = this.#delayFor(delayId);
    if (!delay) throw new Error(`Atraso no encontrado: ${delayId}`);
    if (delay.status !== 'open') throw new Error('El atraso ya está cerrado.');
    const end = endedAt || now || new Date().toISOString();
    delay.ended_at = new Date(end).toISOString();
    delay.duration_minutes = elapsedMinutes(delay.started_at, delay.ended_at);
    delay.status = 'closed';
    const operation = this.#operationFor(delay.po_operation_id);
    if (operation) this.#recalcOperationTime(operation);
    this.#persist();
    this.#emit();
    return delay;
  }

  correctOpenDelay(delayId, { endedAt, note = '', correctedBy = null, now } = {}) {
    const delay = this.#delayFor(delayId);
    if (!delay) throw new Error(`Atraso no encontrado: ${delayId}`);
    if (delay.status !== 'open') throw new Error('Solo se corrigen atrasos abiertos.');
    const operation = this.#operationFor(delay.po_operation_id);
    if (!operation || operation.status !== 'completed') {
      throw new Error('Solo se corrigen atrasos de operaciones finalizadas.');
    }
    if (!endedAt) throw new Error('Debe indicar la marca de término del atraso.');
    const duration = elapsedMinutes(delay.started_at, endedAt);
    if (
      operation.completed_at &&
      new Date(endedAt).getTime() > new Date(operation.completed_at).getTime()
    ) {
      throw new Error('ended_at no puede ser posterior a completed_at.');
    }
    delay.ended_at = new Date(endedAt).toISOString();
    delay.duration_minutes = duration;
    delay.status = 'closed';
    delay.corrected_at = now || new Date().toISOString();
    delay.corrected_by = correctedBy;
    delay.correction_note = String(note || '').trim() || null;
    this.#recalcOperationTime(operation);
    this.#persist();
    this.#emit();
    return delay;
  }

  #applyShiftCounter(shift, nextValue) {
    const operation = this.#operationFor(shift.po_operation_id);
    if (!operation) throw new Error('Operación del turno no encontrada.');
    const delta = nextValue - (Number(shift.quantity_counted) || 0);
    const cumulative = (Number(operation.quantity_completed) || 0) + delta;
    const order = this.orderById(operation.production_order_id);
    validateCumulative(cumulative, order ? order.quantity_planned : 0);
    shift.quantity_counted = nextValue;
    operation.quantity_completed = cumulative;
    this.#persist();
    this.#emit();
    return { shiftQuantity: nextValue, cumulativeQuantity: cumulative };
  }

  adjustShiftCounter(operationId, delta) {
    const shift = this.activeShiftFor(operationId);
    if (!shift) throw new Error('No hay un turno activo para la operación.');
    const next = validateCounter((Number(shift.quantity_counted) || 0) + Number(delta));
    return this.#applyShiftCounter(shift, next);
  }

  setShiftCounter(operationId, value) {
    const shift = this.activeShiftFor(operationId);
    if (!shift) throw new Error('No hay un turno activo para la operación.');
    return this.#applyShiftCounter(shift, validateCounter(value));
  }

  /* -------------------- US-07 Supervisión de línea -------------------- */

  activeAssignmentForWorkCenter(workCenterId, shiftBand = null) {
    return (
      this.shiftAssignments.find(
        (assignment) =>
          assignment.active &&
          assignment.work_center_id === workCenterId &&
          (!shiftBand || assignment.shift_band === shiftBand),
      ) || null
    );
  }

  trafficLightForWorkCenters() {
    return this.workCenters.map((workCenter) => {
      const operations = this.productionOrderOperations.filter(
        (op) => op.work_center_id === workCenter.id,
      );
      const ticket = this.activeInterventionForWorkCenter(workCenter.id);
      return {
        work_center: workCenter,
        status: deriveWorkCenterTrafficLight(workCenter, operations, ticket),
        active_operation:
          operations.find((op) => op.status === 'in_progress' || op.status === 'paused') || null,
        assignment: this.activeAssignmentForWorkCenter(workCenter.id),
      };
    });
  }

  shiftsPendingValidation() {
    return this.productionShifts.filter(
      (shift) =>
        shift.status === 'completed' &&
        !shift.supervisor_validated &&
        !hasOpenDelay(this.delaysForOperation(shift.po_operation_id)),
    );
  }

  openMaintenanceTicketsFor(workCenterId) {
    return this.maintenanceTickets.filter(
      (ticket) =>
        ticket.ticket_status === 'open' &&
        (!workCenterId || ticket.work_center_id === workCenterId),
    );
  }

  assignOperatorToWorkCenter(
    workCenterId,
    { ext_hr_employee_id, shift_band = 'morning', now } = {},
  ) {
    const workCenter = this.workCenterById(workCenterId);
    if (!workCenter) throw new Error(`Centro de trabajo no encontrado: ${workCenterId}`);
    const employee = this.hrEmployees.find((row) => row.ext_hr_employee_id === ext_hr_employee_id);
    if (!employee) throw new Error('El operador no existe en el puente de RR.HH.');
    const candidate = { work_center_id: workCenterId, ext_hr_employee_id, shift_band };
    const previous = this.shiftAssignments.find(
      (assignment) =>
        assignment.active &&
        assignment.work_center_id === workCenterId &&
        assignment.shift_band === shift_band,
    );
    const others = this.shiftAssignments.filter((assignment) => assignment !== previous);
    if (!canAssignOperator(others, candidate)) {
      throw new Error('El operador ya está asignado a otra franja en el mismo turno.');
    }
    if (previous) previous.active = false;
    const assignment = {
      id: makeId('sa'),
      shift_assignment_id: null,
      work_center_id: workCenterId,
      ext_hr_employee_id,
      shift_band,
      assigned_at: now || new Date().toISOString(),
      active: true,
    };
    assignment.shift_assignment_id = assignment.id;
    this.shiftAssignments.push(assignment);
    this.#persist();
    this.#emit();
    return assignment;
  }

  setWorkCenterOperationalStatus(workCenterId, status) {
    const allowed = ['in_operation', 'paused', 'fault', 'changeover', 'available'];
    if (!allowed.includes(status)) throw new Error(`Estado operativo inválido: ${status}`);
    const workCenter = this.workCenterById(workCenterId);
    if (!workCenter) throw new Error(`Centro de trabajo no encontrado: ${workCenterId}`);
    workCenter.operational_status = status;
    this.#persist();
    this.#emit();
    return workCenter;
  }

  validateShiftClosure(shiftId, { supervisor_notes = null, now } = {}) {
    const shift = this.#shiftFor(shiftId);
    if (!shift) throw new Error(`Turno no encontrado: ${shiftId}`);
    const delays = this.delaysForOperation(shift.po_operation_id);
    if (!canValidateShiftClosure(shift, delays)) {
      if (shift.supervisor_validated) throw new Error('El cierre del turno ya fue validado.');
      throw new Error('No se puede validar un cierre con atrasos abiertos.');
    }
    shift.supervisor_validated = true;
    shift.validated_at = now || new Date().toISOString();
    shift.supervisor_notes = String(supervisor_notes || '').trim() || null;
    this.#persist();
    this.#emit();
    return shift;
  }

  escalateIncidentToMaintenance({
    workCenterId,
    operationDelayId = null,
    description,
    reportedBy = null,
    now,
  } = {}) {
    const workCenter = this.workCenterById(workCenterId);
    if (!workCenter) throw new Error(`Centro de trabajo no encontrado: ${workCenterId}`);
    if (operationDelayId) {
      const existing = this.maintenanceTickets.find(
        (ticket) => ticket.operation_delay_id === operationDelayId,
      );
      if (existing) return existing;
    }
    const draft = buildUrgentMaintenanceTicket({
      workCenterId,
      operationDelayId,
      description,
      reportedBy,
      createdAt: now || new Date().toISOString(),
    });
    const ticket = {
      id: makeId('mt'),
      ticket_code: this.#nextTicketCode(),
      ...draft,
    };
    this.maintenanceTickets.push(ticket);
    if (operationDelayId) {
      const delay = this.#delayFor(operationDelayId);
      if (delay) delay.escalated_to_maint = true;
    }
    workCenter.operational_status = 'fault';
    this.#persist();
    this.#emit();
    return ticket;
  }

  #nextTicketCode() {
    const numbers = this.maintenanceTickets
      .map((ticket) => Number(String(ticket.ticket_code).replace(/\D/g, '')))
      .filter((value) => !Number.isNaN(value));
    return `MTO-${(numbers.length ? Math.max(...numbers) : 1000) + 1}`;
  }

  /* -------------------- US-08 Panel de planta -------------------- */

  thresholdsFor() {
    return this.thresholdSettings.map((row) => ({ ...row }));
  }

  rolePermissionsFor(role) {
    return this.rolePermissions.filter((row) => row.role === role).map((row) => ({ ...row }));
  }

  roleUsersFor(role) {
    return clone(this[ROLE_USER_PROPERTIES[role]] ?? []);
  }

  rolesForUsername(username) {
    return resolveRolesForUsername(
      Object.fromEntries(CANONICAL_ROLES.map((role) => [role, this.roleUsersFor(role)])),
      username,
    );
  }

  addRoleUser(role, { username } = {}) {
    const property = ROLE_USER_PROPERTIES[role];
    const normalized = String(username ?? '')
      .trim()
      .toLowerCase();
    if (!property || !normalized) return null;

    const rows = this[property];
    const existing = rows.find((row) => row.username === normalized);
    if (existing) return clone(existing);

    const row = {
      id: makeId('ru'),
      company_id: 'cmp_1',
      username: normalized,
      password: normalized,
      created_at: new Date().toISOString(),
    };
    rows.push(row);
    this.#persist();
    this.#emit();
    return clone(row);
  }

  assignRoleToUser(username, role) {
    const property = ROLE_USER_PROPERTIES[role];
    const normalized = String(username ?? '')
      .trim()
      .toLowerCase();
    if (!property || !normalized) return false;
    if (!this.rolesForUsername(normalized).length) return false;

    const rows = this[property];
    if (rows.some((row) => row.username === normalized)) return true;

    rows.push({
      id: makeId('ru'),
      company_id: 'cmp_1',
      username: normalized,
      password: normalized,
      created_at: new Date().toISOString(),
    });
    this.#persist();
    this.#emit();
    return true;
  }

  canPerformActionFor(role, action) {
    return canPerformAction(role, action, this.rolePermissions);
  }

  #enrichedOperations() {
    return this.productionOrderOperations.map((operation) => {
      const route = this.routingOperations.find((row) => row.id === operation.routing_operation_id);
      const order = this.orderById(operation.production_order_id);
      return {
        ...operation,
        quantity_planned: order ? order.quantity_planned : 0,
        run_time_per_unit_minutes: route ? route.run_time_per_unit_minutes : null,
      };
    });
  }

  loadByWorkCenterFor(period = {}) {
    return computeLoadByWorkCenter(this.workCenters, this.#enrichedOperations(), period);
  }

  downtimesByReasonFor(period = {}) {
    return accumulateDowntimesByReason(
      this.operationDelays,
      this.maintenanceTickets,
      period,
      this.delayReasons,
    );
  }

  plantPerformanceFor(period = {}) {
    const operations = this.#enrichedOperations();
    const loadByWorkCenter = computeLoadByWorkCenter(this.workCenters, operations, period);
    const oeeByWorkCenter = {};
    for (const workCenter of this.workCenters) {
      oeeByWorkCenter[workCenter.id] = computeOee(
        workCenter.id,
        operations,
        this.operationDelays,
        period,
      );
    }
    const downtimeByReason = this.downtimesByReasonFor(period);
    const due = this.productionOrders.filter(
      (order) => order.planned_end_date && order.status !== 'cancelled',
    );
    const onTime = due.filter(
      (order) =>
        order.status === 'completed' &&
        order.actual_end_date &&
        order.actual_end_date <= order.planned_end_date,
    ).length;
    const fulfillment = {
      completed_on_time: onTime,
      total_with_due_date: due.length,
      ratio: due.length ? round2(onTime / due.length) : null,
    };

    const loadRatios = Object.values(loadByWorkCenter).map((row) => row.load_ratio);
    const oeeValues = Object.values(oeeByWorkCenter)
      .filter((value) => value && value.oee !== null)
      .map((value) => value.oee);
    const indicators = {
      load: loadRatios.length ? Math.max(...loadRatios) : 0,
      oee: oeeValues.length
        ? round2(oeeValues.reduce((sum, value) => sum + value, 0) / oeeValues.length)
        : null,
      downtime: round2(downtimeByReason.reduce((sum, row) => sum + row.downtime_minutes, 0)),
      fulfillment: fulfillment.ratio,
    };
    const thresholds = evaluateThresholds(indicators, this.thresholdSettings);

    return {
      indicators,
      thresholds,
      oee_by_work_center: oeeByWorkCenter,
      load_by_work_center: loadByWorkCenter,
      downtime_by_reason: downtimeByReason,
      fulfillment,
    };
  }

  consolidatedReportFor(period = {}, generatedAt = null) {
    return buildConsolidatedReport(period, {
      ...this.plantPerformanceFor(period),
      generated_at: generatedAt || new Date().toISOString(),
    });
  }

  setIndicatorThreshold({ indicator, threshold, comparison } = {}) {
    const indicators = ['load', 'oee', 'downtime', 'fulfillment'];
    if (!indicators.includes(indicator)) {
      throw new Error(`Indicador desconocido: ${indicator}`);
    }
    const value = Number(threshold);
    if (!Number.isFinite(value)) throw new Error('El umbral debe ser un número válido.');
    const cmp = comparison || (indicator === 'downtime' ? 'gt' : 'lt');
    if (cmp !== 'lt' && cmp !== 'gt') throw new Error(`Comparación inválida: ${cmp}`);
    if (indicator === 'downtime') {
      if (value < 0) throw new Error('El umbral de paradas no puede ser negativo.');
      if (cmp !== 'gt') throw new Error('El umbral de paradas debe compararse con "gt".');
    } else if (value < 0 || value > 1) {
      throw new Error('El umbral debe estar en el rango [0, 1].');
    }

    const existing = this.thresholdSettings.find(
      (row) => row.company_id === 'cmp_1' && row.indicator === indicator,
    );
    const updatedAt = new Date().toISOString();
    if (existing) {
      existing.threshold = value;
      existing.comparison = cmp;
      existing.updated_at = updatedAt;
      this.#persist();
      this.#emit();
      return existing;
    }
    const row = {
      id: makeId('th'),
      company_id: 'cmp_1',
      indicator,
      threshold: value,
      comparison: cmp,
      updated_at: updatedAt,
    };
    this.thresholdSettings.push(row);
    this.#persist();
    this.#emit();
    return row;
  }

  changeOrderPriority(orderId, priority) {
    const order = this.orderById(orderId);
    if (!order) throw new Error(`Orden no encontrada: ${orderId}`);
    if (order.status !== 'planned') {
      throw new Error('Solo se puede cambiar la prioridad de una orden planificada.');
    }
    if (!['low', 'normal', 'high'].includes(priority)) {
      throw new Error(`Prioridad inválida: ${priority}`);
    }
    order.priority = priority;
    this.#persist();
    this.#emit();
    return order;
  }

  cancelOrderFromPanel(orderId, { reason } = {}) {
    const order = this.orderById(orderId);
    if (!order) throw new Error(`Orden no encontrada: ${orderId}`);
    if (order.status === 'cancelled' || order.status === 'completed') {
      throw new Error('La orden ya está cerrada y no se puede cancelar.');
    }
    const cleanReason = String(reason || '').trim();
    if (!cleanReason) throw new Error('Debe indicar el motivo de cancelación.');
    order.status = 'cancelled';
    order.notes = order.notes
      ? `${order.notes} Cancelada: ${cleanReason}`
      : `Cancelada: ${cleanReason}`;
    this.#persist();
    this.#emit();
    return order;
  }

  /* -------------------- US-10 Planificación -------------------- */

  ordersForScheduling({ status = null, dateFrom = null, dateTo = null } = {}) {
    const list = this.productionOrders.filter((order) => {
      if (status) {
        if (order.status !== status) return false;
      } else if (!canRescheduleOrder(order)) {
        return false;
      }
      const start = order.planned_start_date || order.planned_end_date;
      if (dateFrom && (!start || start < dateFrom)) return false;
      if (dateTo && (!start || start > dateTo)) return false;
      return true;
    });
    return sortOrdersForScheduling(list);
  }

  orderScheduleSummary(asOfDate = new Date().toISOString().slice(0, 10)) {
    const planned = this.productionOrders.filter(
      (order) => order.planned_start_date || order.planned_end_date,
    ).length;
    const unplanned = this.productionOrders.filter(
      (order) => !order.planned_start_date && !order.planned_end_date,
    ).length;
    const overdue = this.productionOrders.filter(
      (order) =>
        order.status !== 'completed' &&
        order.status !== 'cancelled' &&
        order.planned_end_date &&
        order.planned_end_date < asOfDate,
    ).length;
    return { planned, unplanned, overdue };
  }

  updatePlannedDates(orderId, { planned_start_date, planned_end_date } = {}) {
    const order = this.orderById(orderId);
    if (!order) throw new Error(`Orden no encontrada: ${orderId}`);
    if (!canRescheduleOrder(order)) {
      throw new Error('Una orden cerrada no admite cambios de fechas.');
    }
    const start = planned_start_date === undefined ? null : planned_start_date;
    const end = planned_end_date === undefined ? null : planned_end_date;
    const result = validatePlannedDates({
      planned_start_date: start,
      planned_end_date: end,
    });
    if (!result.valid) {
      throw new Error(
        result.error === 'rango_invertido'
          ? 'La fecha de término no puede ser anterior a la de inicio.'
          : 'Las fechas deben tener el formato YYYY-MM-DD y existir en el calendario.',
      );
    }
    order.planned_start_date = start;
    order.planned_end_date = end;
    this.#persist();
    this.#emit();
    return order;
  }

  pendingSchedulingOrders() {
    const today = new Date().toISOString().slice(0, 10);
    const candidates = this.productionOrders
      .filter((order) => {
        if (!canRescheduleOrder(order)) return false;
        if (!order.planned_start_date || !order.planned_end_date) return true;
        const valid = validatePlannedDates({
          planned_start_date: order.planned_start_date,
          planned_end_date: order.planned_end_date,
          scheduled_start_time: order.scheduled_start_time,
          scheduled_end_time: order.scheduled_end_time,
        });
        return !valid.valid || order.planned_end_date < today;
      })
      .map((order) => ({ ...order, operations: this.operationsForOrder(order.id) }));
    return sortPendingOrders(candidates);
  }

  calendarEventsForMonth(month) {
    const orders = this.productionOrders.map((order) => {
      const operations = this.operationsForOrder(order.id);
      const operator = operations.find((row) => row.operator_id);
      return {
        ...order,
        operations,
        product_name: this.productById(order.product_id)?.name || null,
        operator_id: operator?.operator_id || null,
        operator_name: operator?.operator_id
          ? this.hrEmployees.find((row) => row.ext_hr_employee_id === operator.operator_id)?.name ||
            null
          : null,
        work_center_id:
          order.work_center_id ||
          operations.find((row) => row.work_center_id)?.work_center_id ||
          null,
        work_center_name:
          this.workCenterById(
            order.work_center_id || operations.find((row) => row.work_center_id)?.work_center_id,
          )?.name || null,
      };
    });
    const maintenanceTickets = this.maintenanceTickets.map((ticket) => {
      const date = datePart(ticket.created_at);
      const technician = [...mtFx.technicians, ...this.hrEmployees].find(
        (row) => row.ext_hr_employee_id === ticket.technician_ext_hr_employee_id,
      );
      return {
        ...ticket,
        scheduled_start_date: ticket.scheduled_start_date || date,
        scheduled_end_date: ticket.scheduled_end_date || date,
        work_center_name: this.workCenterById(ticket.work_center_id)?.name || null,
        technician_name: technician?.name || null,
      };
    });
    const preventiveMaintenanceOrders = this.preventiveMaintenanceOrders.map((order) => ({
      ...order,
      scheduled_start_date: order.scheduled_start_date || datePart(order.planned_date),
      scheduled_end_date: order.scheduled_end_date || datePart(order.planned_date),
      work_center_name: this.workCenterById(order.work_center_id)?.name || null,
      technician_name:
        [...mtFx.technicians, ...this.hrEmployees].find(
          (row) => row.ext_hr_employee_id === order.technician_ext_hr_employee_id,
        )?.name || null,
    }));
    return deriveCalendarEventsForMonth(month, {
      orders,
      maintenanceTickets,
      preventiveMaintenanceOrders,
      productionOrderOperations: this.productionOrderOperations,
    });
  }

  scheduleOrderRange(orderId, payload = {}, role = null) {
    if (role && !canEditOrderSchedule(role)) {
      throw new Error('Su rol no puede modificar horarios del calendario.');
    }
    const order = this.orderById(orderId);
    if (!order) throw new Error(`Orden no encontrada: ${orderId}`);
    if (!canRescheduleOrder(order)) {
      throw new Error('Una orden cerrada no admite cambios de horario.');
    }
    const range = buildCalendarRange(
      payload.startDate,
      payload.endDate,
      payload.startTime,
      payload.endTime,
    );
    const result = validatePlannedDates({
      planned_start_date: range.start_date,
      planned_end_date: range.end_date,
      scheduled_start_time: range.start_time,
      scheduled_end_time: range.end_time,
    });
    if (!result.valid) {
      throw new Error(
        result.error === 'hora_invalida'
          ? 'Las horas deben tener el formato HH:mm.'
          : result.error === 'rango_horario_invertido'
            ? 'La hora de término debe ser posterior a la de inicio.'
            : 'Las fechas deben tener el formato YYYY-MM-DD y existir en el calendario.',
      );
    }
    order.planned_start_date = range.start_date;
    order.planned_end_date = range.end_date;
    order.scheduled_start_time = range.start_time;
    order.scheduled_end_time = range.end_time;
    this.#persist();
    this.#emit();
    return order;
  }

  setOrderPriority(orderId, priority, role = 'plant_manager') {
    if (role !== 'plant_manager') {
      throw new Error('Solo la jefa de planta puede cambiar la prioridad.');
    }
    if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
      throw new Error(`Prioridad inválida: ${priority}`);
    }
    const order = this.orderById(orderId);
    if (!order) throw new Error(`Orden no encontrada: ${orderId}`);
    if (!canRescheduleOrder(order)) {
      throw new Error('Una orden cerrada no admite cambios de prioridad.');
    }
    order.priority = priority;
    this.#persist();
    this.#emit();
    return order;
  }

  setCriticalUrgent(orderId, flag, role = 'plant_manager') {
    if (role !== 'plant_manager') {
      throw new Error('Solo la jefa de planta puede marcar urgencia crítica.');
    }
    const order = this.orderById(orderId);
    if (!order) throw new Error(`Orden no encontrada: ${orderId}`);
    if (!canRescheduleOrder(order)) {
      throw new Error('Una orden cerrada no admite cambios de urgencia crítica.');
    }
    order.is_critical_urgent = Boolean(flag);
    this.#persist();
    this.#emit();
    return order;
  }

  /* -------------------- US-11 Balance de líneas -------------------- */

  capacityForPeriod(period = {}) {
    const map = {};
    for (const workCenter of this.workCenters) {
      const capacity = capacityFor(workCenter, period);
      map[workCenter.id] = {
        work_center_id: workCenter.id,
        name: workCenter.name,
        capacity_minutes: capacity.capacity_minutes,
      };
    }
    return map;
  }

  lineBalanceFor(period = {}) {
    const standardTimes = computeStandardTimes(this.routingOperations);
    const projected = computeProjectedLoad(
      this.productionOrders,
      this.routingOperations,
      period,
      this.productionOrderOperations,
    );
    const utilization = computeUtilization(projected.load_by_work_center, this.workCenters, period);
    const { bottleneck, candidates } = detectBottlenecks(utilization);
    const balance = {
      standard_times: standardTimes,
      load_by_work_center: projected.load_by_work_center,
      utilization_by_work_center: utilization,
      bottleneck,
      bottleneck_candidates: candidates,
      summary: computeBalanceSummary(utilization),
      unscheduled_order_ids: projected.unscheduled_order_ids,
    };
    return {
      ...balance,
      suggestions: buildLineBalanceSuggestions(
        balance,
        projected.load_operations_by_order,
        this.workCenters,
        this.productionOrders,
      ),
    };
  }

  lineBalanceForOrder(orderId) {
    const order = this.orderById(orderId);
    if (!order) return null;
    const period = { from: order.planned_start_date, to: order.planned_end_date };
    const projected = computeProjectedLoad(
      [order],
      this.routingOperations,
      period,
      this.productionOrderOperations,
    );
    const utilization = computeUtilization(projected.load_by_work_center, this.workCenters, period);
    const { bottleneck, candidates } = detectBottlenecks(utilization);
    return {
      order,
      load_by_work_center: projected.load_by_work_center,
      utilization_by_work_center: computeOrderDetail(utilization, projected, orderId),
      bottleneck,
      bottleneck_candidates: candidates,
      unscheduled_order_ids: projected.unscheduled_order_ids,
    };
  }

  #countBy(list, key) {
    const out = {};
    for (const item of list) out[item[key]] = (out[item[key]] || 0) + 1;
    return out;
  }
}

/** Instancia única compartida por las vistas (mock singleton). */
export const store = new ManufacturingStore();
