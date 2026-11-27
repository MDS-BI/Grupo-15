import { describe, it, expect, vi } from 'vitest';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { authenticate } from '../../src/data/fixtures/demo-accounts.js';
import { CANONICAL_ROLES } from '../../src/domain/role-access.js';
import {
  SNAPSHOT_KEY,
  createFixtureSnapshot,
  loadSnapshot,
  saveSnapshot,
} from '../../src/data/persistence.js';

const EXPECTED_ACCOUNTS = {
  plant_manager: { username: 'jefa.planta', password: 'ForjaPlanta26!' },
  planner: { username: 'planificador.ops', password: 'Calendario2026!' },
  production_engineer: { username: 'ingeniero.prod', password: 'RutaOptimal26!' },
  supervisor: { username: 'supervisor.linea', password: 'TurnoLinea26!' },
  operator: { username: 'operador.planta', password: 'Estacion2026!' },
  maintenance: { username: 'mantencion.mgr', password: 'TallerMaq26!' },
};

const ROLE_KEYS = {
  plant_manager: 'role_users_plant_manager',
  planner: 'role_users_planner',
  production_engineer: 'role_users_production_engineer',
  supervisor: 'role_users_supervisor',
  operator: 'role_users_operator',
  maintenance: 'role_users_maintenance',
};

const LEGACY_USERNAMES = ['usuario', 'test', 'doble'];

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

function roleRow(role, username, password = username) {
  return {
    id: `ru_${role}_${username}`,
    company_id: 'cmp_1',
    username,
    password,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function oldV2Data() {
  const data = {
    ...createFixtureSnapshot(),
    productionOrders: [],
    workCenters: [],
    productionOrderOperations: [],
  };
  delete data.roleAccessSchema;
  delete data[ROLE_KEYS.production_engineer];
  for (const role of CANONICAL_ROLES.filter((entry) => entry !== 'production_engineer')) {
    const { username, password } = EXPECTED_ACCOUNTS[role];
    data[ROLE_KEYS[role]] = [
      roleRow(role, username, password),
      ...LEGACY_USERNAMES.map((legacy) => roleRow(role, legacy)),
    ];
  }
  return data;
}

function authRoles(result) {
  if (!result) return [];
  const value = result.roles ?? result.role ?? result;
  return Array.isArray(value) ? value : [value];
}

function isSuccess(result) {
  return result === true || result?.ok === true;
}

function failureReason(result) {
  return typeof result === 'string' ? result : result?.reason;
}

describe('Credenciales de las seis tablas de roles', () => {
  it('seed six tablas con una cuenta y contraseña literal', () => {
    const store = new ManufacturingStore({ storage: memoryStorage() });
    for (const [role, expected] of Object.entries(EXPECTED_ACCOUNTS)) {
      const rows = store.roleUsersFor(role);
      expect(rows).toHaveLength(1);
      expect(rows[0].username).toBe(expected.username);
      expect(rows[0].password).toBe(expected.password);
      expect(authRoles(authenticate(expected.username, expected.password))).toEqual([role]);
    }
  });

  it('crea usuarios con contraseña igual al usuario en una sola tabla', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    store.setSessionRole('plant_manager', 'plant_manager');

    const created = store.addRoleUser('production_engineer', { username: '  Nueva  ' });

    expect(created).toBeTruthy();
    expect(
      store.roleUsersFor('production_engineer').find((row) => row.username === 'nueva')?.password,
    ).toBe('nueva');
    for (const role of CANONICAL_ROLES.filter((entry) => entry !== 'production_engineer')) {
      expect(store.roleUsersFor(role).some((row) => row.username === 'nueva')).toBe(false);
    }
    const persisted = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    expect(persisted.data[ROLE_KEYS.production_engineer]).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: 'nueva', password: 'nueva' })]),
    );
  });

  it('quita usuarios y persiste en v2 sin afectar otras tablas', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    store.setSessionRole('plant_manager', 'plant_manager');
    const onChange = vi.fn();
    store.addEventListener('change', onChange);
    store.addRoleUser('supervisor', { username: 'nueva' });
    onChange.mockClear();

    const result = store.removeRoleUser('supervisor', '  NUEVA  ');

    expect(isSuccess(result)).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.roleUsersFor('supervisor').some((row) => row.username === 'nueva')).toBe(false);
    expect(JSON.parse(storage.getItem(SNAPSHOT_KEY)).version).toBe(2);
    expect(
      JSON.parse(storage.getItem(SNAPSHOT_KEY)).data[ROLE_KEYS.supervisor].some(
        (row) => row.username === 'nueva',
      ),
    ).toBe(false);
  });

  it('rechaza bajar al último plant_manager sin mutar ni persistir', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    store.setSessionRole('plant_manager', 'plant_manager');
    const onChange = vi.fn();
    store.addEventListener('change', onChange);
    const before = storage.getItem(SNAPSHOT_KEY);
    onChange.mockClear();

    const result = store.removeRoleUser('plant_manager', ' jefa.planta ');

    expect(isSuccess(result)).toBe(false);
    expect(failureReason(result)).toBe('last-plant-manager');
    expect(store.roleUsersFor('plant_manager').map((row) => row.username)).toEqual(['jefa.planta']);
    expect(storage.getItem(SNAPSHOT_KEY)).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('actualiza la contraseña literal y la acepta authenticate tras recargar', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    store.setSessionRole('plant_manager', 'plant_manager');

    const result = store.changeUserPassword(' ingeniero.prod ', 'RutaOptimal26!', 'NuevaClave123');

    expect(isSuccess(result)).toBe(true);
    const reloaded = new ManufacturingStore({ storage });
    const roleUsers = Object.fromEntries(
      CANONICAL_ROLES.map((role) => [role, reloaded.roleUsersFor(role)]),
    );
    expect(authRoles(authenticate('ingeniero.prod', 'NuevaClave123', roleUsers))).toEqual([
      'production_engineer',
    ]);
    expect(authenticate('ingeniero.prod', 'RutaOptimal26!', roleUsers)).toBeNull();
  });
});

describe('Migración de snapshots v2 de roles', () => {
  it('elimina usuario/test/doble y agrega la tabla vacía del ingeniero', () => {
    const storage = memoryStorage();
    saveSnapshot(oldV2Data(), storage);

    const migrated = loadSnapshot(storage);

    expect(migrated.data.roleAccessSchema).toBe(2);
    expect(migrated.data[ROLE_KEYS.production_engineer]).toEqual([]);
    for (const key of Object.values(ROLE_KEYS)) {
      const usernames = migrated.data[key].map((row) => row.username);
      for (const legacy of LEGACY_USERNAMES) {
        expect(usernames).not.toContain(legacy);
      }
    }

    const store = new ManufacturingStore({ storage });
    store.setSessionRole('plant_manager', 'plant_manager');
    expect(store.roleUsersFor('production_engineer')).toEqual([]);
    for (const legacy of LEGACY_USERNAMES) {
      expect(store.rolesForUsername(legacy)).toEqual([]);
    }
    store.addRoleUser('planner', { username: 'nueva' });

    const persisted = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    expect(persisted.data.roleAccessSchema).toBe(2);
    expect(persisted.data[ROLE_KEYS.production_engineer]).toEqual([]);
    for (const key of Object.values(ROLE_KEYS)) {
      const usernames = persisted.data[key].map((row) => row.username);
      for (const legacy of LEGACY_USERNAMES) {
        expect(usernames).not.toContain(legacy);
      }
    }
    expect(persisted.data[ROLE_KEYS.planner].some((row) => row.username === 'nueva')).toBe(true);
  });

  it('conserva un snapshot ya migrado sin vaciar la tabla del ingeniero', () => {
    const storage = memoryStorage();
    const engineer = roleRow('production_engineer', 'ingeniero.prod', 'RutaOptimal26!');
    const data = { ...createFixtureSnapshot(), roleAccessSchema: 2 };
    data[ROLE_KEYS.production_engineer] = [engineer];
    saveSnapshot(data, storage);

    const loaded = loadSnapshot(storage);

    expect(loaded.data.roleAccessSchema).toBe(2);
    expect(loaded.data[ROLE_KEYS.production_engineer]).toEqual([engineer]);

    const store = new ManufacturingStore({ storage });
    store.setSessionRole('plant_manager', 'plant_manager');
    expect(store.roleUsersFor('production_engineer')).toEqual([engineer]);
    store.addRoleUser('supervisor', { username: 'nueva' });

    const persisted = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    expect(persisted.data.roleAccessSchema).toBe(2);
    expect(persisted.data[ROLE_KEYS.production_engineer]).toEqual([engineer]);
  });
});
