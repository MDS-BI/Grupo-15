import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { RoleAdminPanel } from '../../src/components/RoleAdminPanel.js';
import { RoleAccessPanel } from '../../src/components/RoleAccessPanel.js';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { mountToastRegion } from '../../src/components/Toast.js';
import { CANONICAL_ROLES } from '../../src/domain/role-access.js';
import { SNAPSHOT_KEY } from '../../src/data/persistence.js';

const EXPECTED_USERS = {
  plant_manager: 'jefa.planta',
  planner: 'planificador.ops',
  production_engineer: 'ingeniero.prod',
  supervisor: 'supervisor.linea',
  operator: 'operador.planta',
  maintenance: 'mantencion.mgr',
};

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

let dom;
let storage;
let store;

function submit(form) {
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

function roleSelect(form) {
  return form.querySelector('[data-role="admin-new-role"]');
}

function countUsername(username) {
  return CANONICAL_ROLES.flatMap((role) => store.roleUsersFor(role)).filter(
    (row) => row.username === username,
  );
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  storage = memoryStorage();
  store = new ManufacturingStore({ storage });
  store.setSessionRole('plant_manager', 'plant_manager');
  mountToastRegion();
  document.body.append(RoleAdminPanel({ store }));
});

afterEach(() => {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.localStorage;
  vi.restoreAllMocks();
});

describe('Panel de administración de roles', () => {
  it('muestra las seis tablas con una cuenta demo por rol', () => {
    const tables = [...document.querySelectorAll('[data-role="admin-user-table"]')];
    expect(tables).toHaveLength(6);
    expect(tables.map((table) => table.dataset.roles).sort()).toEqual([...CANONICAL_ROLES].sort());
    for (const table of tables) {
      expect(table.textContent).toContain(EXPECTED_USERS[table.dataset.roles]);
    }
    for (const legacy of ['usuario', 'test', 'doble']) {
      expect(document.body.textContent).not.toContain(legacy);
    }
  });

  it('ofrece un único desplegable de rol con seis opciones y sin botón +', () => {
    const form = document.querySelector('[data-role="admin-add-form"]');
    const selects = [...form.querySelectorAll('[data-role="admin-new-role"]')];

    expect(selects).toHaveLength(1);
    expect([...selects[0].options].map((option) => option.value).sort()).toEqual(
      [...CANONICAL_ROLES].sort(),
    );
    expect(form.querySelector('[data-role="admin-add-role"]')).toBeNull();
    expect(form.querySelector('[data-role="admin-remove-role"]')).toBeNull();
    expect(form.textContent).not.toContain('Rol 2');
  });

  it('agrega un usuario en una sola tabla, notifica y reinicia el formulario', () => {
    const form = document.querySelector('[data-role="admin-add-form"]');
    form.querySelector('[data-role="admin-new-username"]').value = '  Nueva  ';
    roleSelect(form).value = 'production_engineer';
    submit(form);

    expect(store.rolesForUsername('nueva')).toEqual(['production_engineer']);
    const rows = countUsername('nueva');
    expect(rows).toHaveLength(1);
    expect(rows[0].password).toBe('nueva');
    expect(
      document.querySelectorAll(
        '[data-role="admin-user-table"] .role-admin__user-chip[data-username="nueva"]',
      ),
    ).toHaveLength(1);
    expect(document.querySelector('#toast-region').textContent).toContain('Usuario agregado');

    const persisted = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    expect(persisted.data.role_users_production_engineer).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: 'nueva', password: 'nueva' })]),
    );
    for (const role of CANONICAL_ROLES.filter((entry) => entry !== 'production_engineer')) {
      const key = `role_users_${role}`;
      expect(persisted.data[key].some((row) => row.username === 'nueva')).toBe(false);
    }

    expect(form.querySelector('[data-role="admin-new-username"]').value).toBe('');
    expect(form.querySelectorAll('[data-role="admin-new-role"]')).toHaveLength(1);
    expect(form.textContent).not.toContain('Rol 2');
  });
});

describe('Configuración de roles integrada en Roles', () => {
  function mountAccess(currentRole, initialTab = 'config') {
    document.body.innerHTML = '';
    mountToastRegion();
    document.body.append(
      RoleAccessPanel({
        currentRole,
        username: EXPECTED_USERS[currentRole],
        store,
        modules: [{ id: 'orders', label: 'Órdenes' }],
        initialTab,
      }),
    );
  }

  it('monta las seis tablas y el alta solo para plant_manager', () => {
    mountAccess('plant_manager');

    const configTab = document.querySelector('[data-role="role-tab"][data-tab="config"]');
    expect(configTab.disabled).toBe(false);
    expect(configTab.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(6);
    expect(document.querySelector('[data-role="admin-add-form"]')).toBeTruthy();
    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
  });

  it('niega la administración a los otros cinco roles', () => {
    for (const role of CANONICAL_ROLES.filter((entry) => entry !== 'plant_manager')) {
      mountAccess(role);

      const configTab = document.querySelector('[data-role="role-tab"][data-tab="config"]');
      const configPanel = document.querySelector('[data-panel="config"]');
      expect(!configTab || configTab.disabled === true).toBe(true);
      expect(!configPanel || configPanel.hidden === true).toBe(true);
      expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(0);
      expect(document.querySelector('[data-role="admin-add-form"]')).toBeNull();
    }
  });

  it('muestra solo la tarjeta del rol autenticado', () => {
    mountAccess('production_engineer', 'roles');
    expect(
      [...document.querySelectorAll('[data-role-card]')].map((card) => card.dataset.roleCard),
    ).toEqual(['production_engineer']);
  });
});

describe('Baja confirmada de usuarios en Configurar roles', () => {
  function clickRemove(role, username) {
    const button = document.querySelector(`[data-remove-user="${username}"][data-role="${role}"]`);
    expect(button).toBeTruthy();
    button.click();
  }

  async function confirmRemoval() {
    const dialog = await vi.waitFor(() => {
      const found = document.querySelector('[data-role="confirm-dialog"]');
      expect(found).toBeTruthy();
      return found;
    });
    dialog.querySelector('[data-role="confirm"]').click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeNull(),
    );
  }

  it('muestra chips con Quitar en las seis tablas', () => {
    const tables = [...document.querySelectorAll('[data-role="admin-user-table"]')];
    expect(tables).toHaveLength(6);
    for (const table of tables) {
      const chips = [...table.querySelectorAll('.role-admin__user-chip')];
      expect(chips).toHaveLength(store.roleUsersFor(table.dataset.roles).length);
      for (const chip of chips) {
        const button = chip.querySelector('[data-remove-user]');
        expect(button.dataset.removeUser).toBe(chip.dataset.username);
        expect(button.dataset.role).toBe(table.dataset.roles);
      }
    }
  });

  it('no muta nada al cancelar la confirmación', async () => {
    const remove = vi.spyOn(store, 'removeRoleUser');
    const before = storage.getItem(SNAPSHOT_KEY);

    clickRemove('supervisor', 'supervisor.linea');
    const dialog = await vi.waitFor(() => document.querySelector('[data-role="confirm-dialog"]'));
    dialog.querySelector('[data-role="cancel"]').click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeNull(),
    );

    expect(remove).not.toHaveBeenCalled();
    expect(storage.getItem(SNAPSHOT_KEY)).toBe(before);
    expect(store.rolesForUsername('supervisor.linea')).toEqual(['supervisor']);
  });

  it('quita al confirmar, persiste y vuelve a renderizar', async () => {
    async function confirmWithRemove(role, username) {
      clickRemove(role, username);
      await confirmRemoval();
    }

    await confirmWithRemove('supervisor', 'supervisor.linea');

    expect(store.rolesForUsername('supervisor.linea')).toEqual([]);
    expect(document.querySelector('[data-role="admin-tables"]').textContent).not.toContain(
      'supervisor.linea',
    );
    expect(
      [...document.querySelectorAll('#admin-user-options option')].map((option) => option.value),
    ).not.toContain('supervisor.linea');
    expect(
      JSON.parse(storage.getItem(SNAPSHOT_KEY)).data.role_users_supervisor.some(
        (row) => row.username === 'supervisor.linea',
      ),
    ).toBe(false);
  });

  it('rechaza la baja del último plant_manager sin mutar', async () => {
    const before = storage.getItem(SNAPSHOT_KEY);

    clickRemove('plant_manager', 'jefa.planta');
    await confirmRemoval();

    expect(store.roleUsersFor('plant_manager').map((row) => row.username)).toEqual(['jefa.planta']);
    expect(storage.getItem(SNAPSHOT_KEY)).toBe(before);
    expect(document.querySelector('#toast-region').textContent).toMatch(/último|plant_manager/i);
  });
});
