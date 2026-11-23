import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { RoleAdminPanel } from '../../src/components/RoleAdminPanel.js';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { mountToastRegion } from '../../src/components/Toast.js';
import { CANONICAL_ROLES } from '../../src/domain/role-access.js';

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
