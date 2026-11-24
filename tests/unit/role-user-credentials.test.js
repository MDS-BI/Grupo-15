import { describe, it, expect, vi } from 'vitest';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { authenticate } from '../../src/data/fixtures/demo-accounts.js';
import { CANONICAL_ROLES } from '../../src/domain/role-access.js';
import { SNAPSHOT_KEY } from '../../src/data/persistence.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

function roleUsersFrom(storage) {
  const snapshot = JSON.parse(storage.getItem(SNAPSHOT_KEY));
  return Object.fromEntries(
    CANONICAL_ROLES.map((role) => {
      const key = {
        plant_manager: 'role_users_plant_manager',
        supervisor: 'role_users_supervisor',
        planner: 'role_users_planner',
        operator: 'role_users_operator',
        maintenance: 'role_users_maintenance',
      }[role];
      return [role, snapshot.data[key]];
    }),
  );
}

describe('Baja de usuarios por rol', () => {
  it('guarda la contraseña inicial igual al usuario en altas de las cinco tablas', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });

    for (const role of CANONICAL_ROLES) {
      const row = store.addRoleUser(role, { username: '  Nueva  ' });
      expect(row.username).toBe('nueva');
      expect(row.password).toBe('nueva');
      expect(store.roleUsersFor(role).find((entry) => entry.username === 'nueva').password).toBe(
        'nueva',
      );
    }

    const persisted = roleUsersFrom(storage);
    for (const role of CANONICAL_ROLES) {
      expect(persisted[role].find((row) => row.username === 'nueva').password).toBe('nueva');
    }
  });

  it('quita un usuario normalizado, persiste en v2 y emite el cambio', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    const onChange = vi.fn();
    store.addEventListener('change', onChange);
    store.addRoleUser('supervisor', { username: 'nueva' });
    onChange.mockClear();

    const result = store.removeRoleUser('supervisor', '  NUEVA  ');

    expect(result.ok).toBe(true);
    expect(store.roleUsersFor('supervisor').some((row) => row.username === 'nueva')).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.getItem(SNAPSHOT_KEY)).version).toBe(2);
    expect(roleUsersFrom(storage).supervisor.some((row) => row.username === 'nueva')).toBe(false);
    expect(
      new ManufacturingStore({ storage })
        .roleUsersFor('supervisor')
        .some((row) => row.username === 'nueva'),
    ).toBe(false);
  });

  it('no altera los otros roles cuando el usuario pertenece a varias tablas', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });

    expect(store.removeRoleUser('operator', ' doble ').ok).toBe(true);
    expect(store.rolesForUsername('doble')).toEqual(['maintenance']);
    expect(store.roleUsersFor('maintenance').some((row) => row.username === 'doble')).toBe(true);
  });

  it('rechaza quitar al último usuario de plant_manager sin mutar ni persistir', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    const onChange = vi.fn();
    store.addEventListener('change', onChange);

    expect(store.removeRoleUser('plant_manager', 'test').ok).toBe(true);
    const before = storage.getItem(SNAPSHOT_KEY);
    onChange.mockClear();

    const result = store.removeRoleUser('plant_manager', ' jefa ');

    expect(result).toEqual({ ok: false, reason: 'last-plant-manager' });
    expect(store.roleUsersFor('plant_manager').map((row) => row.username)).toEqual(['jefa']);
    expect(storage.getItem(SNAPSHOT_KEY)).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rechaza roles desconocidos y usuarios ausentes', () => {
    const store = new ManufacturingStore({ storage: memoryStorage() });

    expect(store.removeRoleUser('inventado', 'jefa').ok).toBe(false);
    expect(store.removeRoleUser('planner', 'ausente').ok).toBe(false);
    expect(store.roleUsersFor('planner').map((row) => row.username)).toContain('test');
  });
});

describe('Alta de usuarios con roles múltiples', () => {
  it('crea un usuario en todas las tablas válidas con dedupe, contraseña y persistencia única', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    const onChange = vi.fn();
    store.addEventListener('change', onChange);

    const created = store.createUserWithRoles('  Multi  ', [
      'planner',
      'planner',
      'inventado',
      'maintenance',
      'operator',
    ]);

    const expectedRoles = ['planner', 'maintenance', 'operator'];
    expect(created.map((row) => row.username)).toEqual(['multi', 'multi', 'multi']);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect([...store.rolesForUsername('multi')].sort()).toEqual([...expectedRoles].sort());
    for (const role of expectedRoles) {
      const row = store.roleUsersFor(role).find((entry) => entry.username === 'multi');
      expect(row.password).toBe('multi');
    }

    const snapshot = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    expect(snapshot.version).toBe(2);
    const persisted = roleUsersFrom(storage);
    for (const role of expectedRoles) {
      expect(persisted[role].find((row) => row.username === 'multi').password).toBe('multi');
    }
    expect([...new ManufacturingStore({ storage }).rolesForUsername('multi')].sort()).toEqual(
      [...expectedRoles].sort(),
    );
  });

  it('no muta ni persiste cuando no hay usuario o no hay roles válidos', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    const before = storage.getItem(SNAPSHOT_KEY);

    expect(store.createUserWithRoles('   ', ['planner'])).toEqual([]);
    expect(store.createUserWithRoles('multi', ['inventado'])).toEqual([]);
    expect(store.rolesForUsername('multi')).toEqual([]);
    expect(storage.getItem(SNAPSHOT_KEY)).toBe(before);
  });
});

describe('Cambio de contraseña persistente', () => {
  it('actualiza la credencial en todas las tablas del usuario y la acepta authenticate', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    const rolesBefore = store.rolesForUsername('doble');
    const onChange = vi.fn();
    store.addEventListener('change', onChange);

    const result = store.changeUserPassword('  DOBLE  ', 'doble', 'NuevaClave123');

    expect(result.ok).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.rolesForUsername('doble')).toEqual(rolesBefore);
    const persisted = roleUsersFrom(storage);
    for (const role of CANONICAL_ROLES) {
      for (const row of persisted[role]) {
        expect(row.password).toBe(row.username === 'doble' ? 'NuevaClave123' : row.username);
      }
    }
    const rebuilt = new ManufacturingStore({ storage });
    const rebuiltUsers = Object.fromEntries(
      CANONICAL_ROLES.map((role) => [role, rebuilt.roleUsersFor(role)]),
    );
    expect(authenticate('doble', 'NuevaClave123', rebuiltUsers)).toEqual([
      'operator',
      'maintenance',
    ]);
    expect(authenticate('doble', 'doble', rebuiltUsers)).toBeNull();
  });

  it('niega cambios sin mutar si falla usuario, contraseña actual o nueva contraseña', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    const before = storage.getItem(SNAPSHOT_KEY);

    expect(store.changeUserPassword('ausente', 'ausente', 'otra').ok).toBe(false);
    expect(store.changeUserPassword('test', 'incorrecta', 'otra').ok).toBe(false);
    expect(store.changeUserPassword('test', 'test', '   ').ok).toBe(false);
    expect(storage.getItem(SNAPSHOT_KEY)).toBe(before);
    expect(store.roleUsersFor('test').every((row) => row.password === 'test')).toBe(true);
  });
});
