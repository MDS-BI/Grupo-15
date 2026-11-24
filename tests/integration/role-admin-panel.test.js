import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { RoleAdminPanel } from '../../src/components/RoleAdminPanel.js';
import { RoleAccessPanel } from '../../src/components/RoleAccessPanel.js';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { mountToastRegion } from '../../src/components/Toast.js';
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

let dom;
let storage;
let store;

function submit(form) {
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  storage = memoryStorage();
  store = new ManufacturingStore({ storage });
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
  it('muestra las cinco tablas con sus usuarios demo', () => {
    const tables = document.querySelectorAll('[data-role="admin-user-table"]');
    expect(tables).toHaveLength(5);
    expect(Array.from(tables).map((table) => table.dataset.roles)).toEqual(CANONICAL_ROLES);
    expect(document.body.textContent).toContain('jefa');
    expect(document.body.textContent).toContain('doble');
    expect(document.querySelector('[data-role="role-select"]')).toBeNull();
  });

  it('agrega usuarios a un rol y persiste de inmediato', () => {
    const form = document.querySelector('[data-role="admin-add-form"]');
    form.querySelector('[data-role="admin-new-username"]').value = 'nueva';
    form.querySelector('[data-role="admin-new-role"]').value = 'planner';
    submit(form);

    expect(store.roleUsersFor('planner').some((row) => row.username === 'nueva')).toBe(true);
    expect(document.body.textContent).toContain('nueva');
    expect(document.querySelector('#toast-region').textContent).toContain('Usuario agregado');
    expect(
      new ManufacturingStore({ storage })
        .roleUsersFor('planner')
        .some((row) => row.username === 'nueva'),
    ).toBe(true);
  });

  it('permite inscribir un usuario en hasta cinco roles únicos y reinicia el formulario', () => {
    const form = document.querySelector('[data-role="admin-add-form"]');
    const rows = () => [...form.querySelectorAll('[data-role="admin-role-row"]')];
    const addRole = form.querySelector('[data-role="admin-add-role"]');

    expect(rows()).toHaveLength(1);
    expect(rows()[0].querySelector('label > span').textContent.trim()).toBe('Rol');
    expect(addRole.textContent.trim()).toBe('+');

    for (let index = 2; index <= 5; index += 1) {
      addRole.click();
      expect(rows()).toHaveLength(index);
      expect(rows().at(-1).querySelector('label > span').textContent.trim()).toBe(`Rol ${index}`);
    }
    expect(addRole.disabled).toBe(true);

    form.querySelector('[data-role="admin-new-username"]').value = '  Multi  ';
    const values = ['planner', 'maintenance', 'operator', 'planner', 'supervisor'];
    rows().forEach((row, index) => {
      row.querySelector('[data-role="admin-new-role"]').value = values[index];
    });
    submit(form);

    const expectedRoles = CANONICAL_ROLES.filter((role) => values.includes(role));
    expect(store.rolesForUsername('multi')).toEqual(expectedRoles);
    for (const role of expectedRoles) {
      const row = store.roleUsersFor(role).find((entry) => entry.username === 'multi');
      expect(row.password).toBe('multi');
    }
    expect(new ManufacturingStore({ storage }).rolesForUsername('multi')).toEqual(expectedRoles);
    expect(document.querySelector('#toast-region').textContent).toContain('Usuario agregado');
    expect(rows()).toHaveLength(1);
    expect(form.querySelector('[data-role="admin-new-username"]').value).toBe('');
    expect(addRole.disabled).toBe(false);
  });

  it('quita filas de roles adicionales sin dejar la última sin desplegable', () => {
    const form = document.querySelector('[data-role="admin-add-form"]');
    const addRole = form.querySelector('[data-role="admin-add-role"]');
    addRole.click();
    addRole.click();
    expect(form.querySelectorAll('[data-role="admin-role-row"]')).toHaveLength(3);

    const removeButtons = () => [...form.querySelectorAll('[data-role="admin-remove-role"]')];
    expect(removeButtons()).toHaveLength(2);
    removeButtons()[1].click();
    expect(form.querySelectorAll('[data-role="admin-role-row"]')).toHaveLength(2);
    removeButtons()[0].click();
    expect(form.querySelectorAll('[data-role="admin-role-row"]')).toHaveLength(1);
    expect(form.querySelector('[data-role="admin-remove-role"]')).toBeNull();
    expect(addRole.disabled).toBe(false);
  });

  it('asigna roles adicionales y persiste de inmediato', () => {
    const form = document.querySelector('[data-role="admin-assign-form"]');
    form.querySelector('[data-role="admin-existing-username"]').value = 'operador';
    form.querySelector('[data-role="admin-assign-role"]').value = 'maintenance';
    submit(form);

    expect(store.rolesForUsername('operador')).toEqual(['operator', 'maintenance']);
    expect(document.querySelector('#toast-region').textContent).toContain('Rol asignado');
    expect(new ManufacturingStore({ storage }).rolesForUsername('operador')).toEqual([
      'operator',
      'maintenance',
    ]);
  });
});

describe('Configuración de roles integrada en Roles', () => {
  function mountAccess(currentRole = 'plant_manager', initialTab = 'config') {
    document.body.innerHTML = '';
    mountToastRegion();
    document.body.append(
      RoleAccessPanel({
        currentRole,
        username: 'jefa',
        store,
        modules: [{ id: 'orders', label: 'Órdenes' }],
        initialTab,
      }),
    );
  }

  function clickRoleTab(tabName) {
    const tab = document.querySelector(`[data-role="role-tab"][data-tab="${tabName}"]`);
    expect(tab).toBeTruthy();
    tab.click();
  }

  it('monta las cinco tablas y los formularios como subpestaña de plant_manager', () => {
    mountAccess();

    const tabs = [...document.querySelectorAll('[data-role="role-tab"]')];
    expect(tabs.map((tab) => tab.textContent.trim())).toEqual(['Roles', 'Configurar roles']);
    for (const tab of tabs) {
      expect(tab.getAttribute('role')).toBe('tab');
      expect(tab.getAttribute('aria-selected')).toBe(String(tab.dataset.tab === 'config'));
    }
    expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(5);
    expect(document.querySelector('[data-role="admin-add-form"]')).toBeTruthy();
    expect(document.querySelector('[data-role="admin-assign-form"]')).toBeTruthy();
    expect(document.querySelector('[data-role="role-select"]')).toBeNull();
    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
  });

  it('conserva altas y asignaciones dentro de la subpestaña integrada', () => {
    mountAccess();

    const addForm = document.querySelector('[data-role="admin-add-form"]');
    addForm.querySelector('[data-role="admin-new-username"]').value = 'nueva';
    addForm.querySelector('[data-role="admin-new-role"]').value = 'planner';
    submit(addForm);

    const assignForm = document.querySelector('[data-role="admin-assign-form"]');
    assignForm.querySelector('[data-role="admin-existing-username"]').value = 'nueva';
    assignForm.querySelector('[data-role="admin-assign-role"]').value = 'operator';
    submit(assignForm);

    expect(store.rolesForUsername('nueva')).toEqual(['planner', 'operator']);
    expect(document.querySelector('#toast-region').textContent).toContain('Rol asignado');
  });

  it('niega la subpestaña de configuración a otros roles activos', () => {
    mountAccess('operator', 'config');

    expect(document.querySelector('[data-role="role-tab"][data-tab="config"]').disabled).toBe(true);
    expect(
      document
        .querySelector('[data-role="role-tab"][data-tab="roles"]')
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(document.querySelector('[data-panel="config"]').hidden).toBe(true);
    expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(0);
    expect(document.querySelector('[data-role="admin-add-form"]')).toBeNull();
    expect(document.querySelectorAll('[data-role-card]')).toHaveLength(1);

    clickRoleTab('roles');
    expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(0);
  });

  it('muestra solo los roles asignados al usuario autenticado', () => {
    mountAccess('plant_manager', 'roles');

    expect(
      [...document.querySelectorAll('[data-role-card]')].map((card) => card.dataset.roleCard),
    ).toEqual(['plant_manager']);
    expect(document.body.textContent).toContain('Rol efectivo');
  });
});

describe('Baja confirmada de usuarios en Configurar roles', () => {
  function clickRemove(role, username) {
    const button = document.querySelector(`[data-remove-user="${username}"][data-role="${role}"]`);
    expect(button).toBeTruthy();
    expect(button.textContent.trim()).toBe('×');
    button.click();
  }

  async function confirmRemoval() {
    const dialog = await vi.waitFor(() => {
      const found = document.querySelector('[data-role="confirm-dialog"]');
      expect(found).toBeTruthy();
      return found;
    });
    expect(dialog.querySelector('[data-role="confirm"]')).toBeTruthy();
    dialog.querySelector('[data-role="confirm"]').click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeNull(),
    );
  }

  it('muestra chips con botón Quitar en las cinco tablas', () => {
    const tables = [...document.querySelectorAll('[data-role="admin-user-table"]')];
    expect(tables).toHaveLength(5);
    for (const table of tables) {
      const role = table.dataset.roles;
      const chips = [...table.querySelectorAll('.role-admin__user-chip')];
      expect(chips.length).toBe(store.roleUsersFor(role).length);
      for (const chip of chips) {
        expect(chip.dataset.username).toBeTruthy();
        const button = chip.querySelector('[data-remove-user]');
        expect(button.dataset.removeUser).toBe(chip.dataset.username);
        expect(button.dataset.role).toBe(role);
        expect(chip.textContent).toContain(chip.dataset.username);
      }
    }
  });

  it('no muta nada al cancelar la confirmación', async () => {
    const remove = vi.spyOn(store, 'removeRoleUser');
    const before = storage.getItem(SNAPSHOT_KEY);

    clickRemove('supervisor', 'test');
    const dialog = await vi.waitFor(() => document.querySelector('[data-role="confirm-dialog"]'));
    expect(dialog.textContent).toContain('test');
    expect(dialog.textContent).toContain('Supervisor');
    dialog.querySelector('[data-role="cancel"]').click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeNull(),
    );

    expect(remove).not.toHaveBeenCalled();
    expect(storage.getItem(SNAPSHOT_KEY)).toBe(before);
    expect(store.roleUsersFor('supervisor').some((row) => row.username === 'test')).toBe(true);
  });

  it('quita al confirmar, notifica y vuelve a renderizar tablas y datalist', async () => {
    const addForm = document.querySelector('[data-role="admin-add-form"]');
    addForm.querySelector('[data-role="admin-new-username"]').value = 'nueva';
    addForm.querySelector('[data-role="admin-new-role"]').value = 'planner';
    submit(addForm);
    const remove = vi.spyOn(store, 'removeRoleUser');

    clickRemove('planner', 'nueva');
    await confirmRemoval();

    expect(remove).toHaveBeenCalledWith('planner', 'nueva');
    expect(store.roleUsersFor('planner').some((row) => row.username === 'nueva')).toBe(false);
    expect(document.querySelector('[data-role="admin-tables"]').textContent).not.toContain('nueva');
    expect(
      [...document.querySelectorAll('#admin-user-options option')].map((option) => option.value),
    ).not.toContain('nueva');
    expect(document.querySelector('#toast-region').textContent).toContain('nueva');
    expect(
      JSON.parse(storage.getItem(SNAPSHOT_KEY)).data.role_users_planner.some(
        (row) => row.username === 'nueva',
      ),
    ).toBe(false);
  });

  it('rechaza con mensaje la baja del último plant_manager sin mutar', async () => {
    clickRemove('plant_manager', 'test');
    await confirmRemoval();

    const before = storage.getItem(SNAPSHOT_KEY);
    clickRemove('plant_manager', 'jefa');
    await confirmRemoval();

    expect(store.roleUsersFor('plant_manager').map((row) => row.username)).toEqual(['jefa']);
    expect(storage.getItem(SNAPSHOT_KEY)).toBe(before);
    expect(document.body.textContent).toContain('jefa');
    expect(document.querySelector('#toast-region').textContent).toMatch(/último|plant_manager/i);
  });
});
