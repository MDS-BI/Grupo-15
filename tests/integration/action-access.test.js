import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ACTION_ACCESS, can } from '../../src/domain/access-control.js';
import { createFixtureSnapshot, SNAPSHOT_KEY, saveSnapshot } from '../../src/data/persistence.js';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { ProductionOrders } from '../../src/components/ProductionOrders.js';
import { OperatorWorkstationPanel } from '../../src/components/OperatorWorkstationPanel.js';
import { SupervisorLinePanel } from '../../src/components/SupervisorLinePanel.js';
import { PlantPerformancePanel } from '../../src/components/PlantPerformancePanel.js';
import { ProductionSchedulingPanel } from '../../src/components/ProductionSchedulingPanel.js';
import { LineBalancePanel } from '../../src/components/LineBalancePanel.js';
import { MaintenancePanel } from '../../src/components/MaintenancePanel.js';
import { BomExplorer } from '../../src/components/BomExplorer.js';
import { RoleAccessPanel } from '../../src/components/RoleAccessPanel.js';
import { mountToastRegion } from '../../src/components/Toast.js';

const ALIASES = {
  panel: ['dashboard', 'plant'],
  estacion: ['operator'],
  planificacion: ['scheduling'],
  balance: ['line-balance'],
  mantenimiento: ['maintenance'],
};

const PANELS = [
  {
    label: 'Órdenes',
    module: 'orders',
    mount: (store, role) => ProductionOrders(store, { role }),
  },
  {
    label: 'Estación',
    module: 'estacion',
    mount: (store, role) => OperatorWorkstationPanel(store, { role }),
  },
  {
    label: 'Supervisión',
    module: 'supervision',
    mount: (store, role) => SupervisorLinePanel(store, { role }),
  },
  {
    label: 'Planta',
    module: 'panel',
    mount: (store, role) => PlantPerformancePanel(store, { role }),
  },
  {
    label: 'Planificación',
    module: 'planificacion',
    mount: (store, role) => ProductionSchedulingPanel(store, { role }),
  },
  {
    label: 'Balance',
    module: 'balance',
    mount: (store, role) => LineBalancePanel(store, { role }),
  },
  {
    label: 'Mantenimiento',
    module: 'mantenimiento',
    mount: (store, role) => MaintenancePanel(store, { role }),
  },
  {
    label: 'BOM',
    module: 'bom',
    mount: (store, role) => BomExplorer(store, { role }),
  },
  {
    label: 'Roles',
    module: 'roles',
    mount: (store, role) =>
      RoleAccessPanel({
        currentRole: role,
        username: role === 'plant_manager' ? 'jefa.planta' : 'operador.planta',
        store,
        modules: [{ id: 'orders', label: 'Órdenes' }],
        initialTab: 'config',
      }),
  },
];

const RESTRICTED_ROLE = {
  orders: 'supervisor',
  estacion: 'planner',
  supervision: 'planner',
  panel: 'operator',
  planificacion: 'supervisor',
  balance: 'supervisor',
  mantenimiento: 'operator',
  bom: 'operator',
  roles: 'operator',
};

let dom;

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

function seededStore(role) {
  const storage = memoryStorage();
  saveSnapshot(createFixtureSnapshot(), storage);
  const store = new ManufacturingStore({ storage });
  store.setSessionRole(role, role);
  return { storage, store };
}

function mountPanel(panel, role) {
  const store = new ManufacturingStore({ storage: memoryStorage() });
  store.setSessionRole(role, role);
  const root = panel.mount(store, role);
  document.body.replaceChildren(root);
  return root;
}

function memoryFingerprint(store) {
  return JSON.stringify({
    orders: store.productionOrders,
    operations: store.productionOrderOperations,
    boms: store.billOfMaterials,
    routingOperations: store.routingOperations,
    workCenters: store.workCenters,
    shifts: store.productionShifts,
    tickets: store.maintenanceTickets,
    preventive: store.preventiveMaintenanceOrders,
    thresholds: store.thresholdSettings,
    roleUsers: Object.fromEntries(
      [
        'plant_manager',
        'planner',
        'production_engineer',
        'supervisor',
        'operator',
        'maintenance',
      ].map((role) => [role, store.roleUsersFor(role)]),
    ),
  });
}

function assertDeniedMutation({ label, role, action, invoke }) {
  const { storage, store } = seededStore(role);
  const onChange = vi.fn();
  store.addEventListener('change', onChange);
  expect(can(role, action)).toBe(false);

  const beforeSnapshot = storage.getItem(SNAPSHOT_KEY);
  const beforeMemory = memoryFingerprint(store);
  const result = invoke(store);

  expect(result, label).toMatchObject({ ok: false, reason: 'permission-denied' });
  expect(onChange, label).not.toHaveBeenCalled();
  expect(storage.getItem(SNAPSHOT_KEY), label).toBe(beforeSnapshot);
  expect(memoryFingerprint(store), label).toBe(beforeMemory);
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  mountToastRegion();
});

afterEach(() => {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.localStorage;
  vi.restoreAllMocks();
});

describe('Permisos aplicados en la interfaz', () => {
  it('los nueve paneles marcan sus acciones permitidas con data-action', () => {
    for (const panel of PANELS) {
      const root = mountPanel(panel, 'plant_manager');
      const actions = [...root.querySelectorAll('[data-action]')];
      expect(actions.length, panel.label).toBeGreaterThan(0);
      for (const element of actions) {
        expect(
          can('plant_manager', element.dataset.action),
          `${panel.label}: ${element.dataset.action}`,
        ).toBe(true);
      }
    }
  });

  it('oculta todas las acciones denegadas en los nueve paneles', () => {
    for (const panel of PANELS) {
      const role = RESTRICTED_ROLE[panel.module];
      const denied = Object.keys(ACTION_ACCESS).filter(
        (key) => key.startsWith(`${panel.module}.`) && !can(role, key),
      );
      expect(denied.length, panel.label).toBeGreaterThan(0);
      const root = mountPanel(panel, role);

      for (const key of denied) {
        const action = key.slice(key.indexOf('.') + 1);
        const variants = [
          key,
          ...(ALIASES[panel.module] ?? []).map((alias) => `${alias}.${action}`),
        ];
        for (const variant of variants) {
          expect(
            root.querySelectorAll(`[data-action="${variant}"]`),
            `${panel.label}: ${variant}`,
          ).toHaveLength(0);
        }
      }
    }
  });
});

describe('Permisos aplicados en el store', () => {
  const deniedMutations = [
    {
      label: 'panel.configurar',
      role: 'operator',
      action: 'panel.configurar',
      invoke: (store) =>
        store.setIndicatorThreshold({ indicator: 'oee', threshold: 80, comparison: 'below' }),
    },
    {
      label: 'orders.crear',
      role: 'operator',
      action: 'orders.crear',
      invoke: (store) =>
        store.createOrder({ product_id: store.products[0].id, quantity_planned: 1 }),
    },
    {
      label: 'bom.editar',
      role: 'planner',
      action: 'bom.editar',
      invoke: (store) => store.updateBomRecipe(store.billOfMaterials[0].id, { version: 'x' }),
    },
    {
      label: 'estacion.crear',
      role: 'planner',
      action: 'estacion.crear',
      invoke: (store) =>
        store.startShift(store.productionOrderOperations[0].id, {
          operator_id: store.hrEmployees[0].id,
        }),
    },
    {
      label: 'supervision.editar',
      role: 'planner',
      action: 'supervision.editar',
      invoke: (store) => store.setWorkCenterOperationalStatus(store.workCenters[0].id, 'fault'),
    },
    {
      label: 'planificacion.editar',
      role: 'operator',
      action: 'planificacion.editar',
      invoke: (store) =>
        store.updatePlannedDates(store.productionOrders[0].id, {
          planned_start_date: '2026-12-01',
          planned_end_date: '2026-12-05',
        }),
    },
    {
      label: 'balance.editar',
      role: 'supervisor',
      action: 'balance.editar',
      invoke: (store) =>
        store.updateRoutingOperationForBom(
          store.billOfMaterials[0].id,
          store.routingOperations[0].id,
          { run_time_per_unit_minutes: 1 },
        ),
    },
    {
      label: 'mantenimiento.aprobar',
      role: 'operator',
      action: 'mantenimiento.aprobar',
      invoke: (store) =>
        store.resolveScheduledMaintenance(
          store.preventiveMaintenanceOrders[0].id,
          { resolvedAt: new Date().toISOString() },
          'plant_manager',
        ),
    },
    {
      label: 'roles.crear',
      role: 'operator',
      action: 'roles.crear',
      invoke: (store) => store.addRoleUser('planner', { username: 'nueva' }),
    },
  ];

  for (const mutation of deniedMutations) {
    it(`rechaza ${mutation.label} sin mutar ni persistir`, () => {
      assertDeniedMutation(mutation);
    });
  }

  it('la previsualización no amplía los permisos del rol autenticado', () => {
    const { storage, store } = seededStore('plant_manager');
    store.setSessionRole('plant_manager', 'operator');
    const onChange = vi.fn();
    store.addEventListener('change', onChange);
    expect(can('operator', 'roles.crear')).toBe(false);

    const beforeSnapshot = storage.getItem(SNAPSHOT_KEY);
    const beforeMemory = memoryFingerprint(store);
    const result = store.addRoleUser('planner', { username: 'nueva' });

    expect(result).toMatchObject({ ok: false, reason: 'permission-denied' });
    expect(onChange).not.toHaveBeenCalled();
    expect(storage.getItem(SNAPSHOT_KEY)).toBe(beforeSnapshot);
    expect(memoryFingerprint(store)).toBe(beforeMemory);
  });

  it('permite mutaciones autorizadas por el rol de la sesión', () => {
    const { store } = seededStore('plant_manager');
    expect(store.addRoleUser('planner', { username: 'nueva' })).toBeTruthy();
    expect(store.rolesForUsername('nueva')).toEqual(['planner']);
  });
});
