import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from '../../src/domain/access-control.js';
import { CANONICAL_ROLES } from '../../src/domain/role-access.js';
import { SNAPSHOT_KEY } from '../../src/data/persistence.js';

const CREDENTIALS = {
  plant_manager: ['jefa', 'jefa'],
  supervisor: ['supervisor', 'supervisor'],
  planner: ['planificador', 'planificador'],
  operator: ['operador', 'operador'],
  maintenance: ['mantenimiento', 'mantenimiento'],
};

let dom;

function submitLogin(username, password) {
  const form = document.querySelector('[data-role="login-form"]');
  form.elements.username.value = username;
  form.elements.password.value = password;
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

async function boot() {
  await import('../../src/manufacturing-main.js');
}

async function enter(username, password) {
  submitLogin(username, password);
  await vi.waitFor(() => expect(document.querySelector('.shell')).toBeTruthy());
}

function openUserMenu() {
  document.querySelector('[data-role="user-menu-toggle"]').click();
}

function chooseRole(role) {
  openUserMenu();
  const select = document.querySelector('[data-role="role-select"]');
  select.value = role;
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
}

function goToHash(hash) {
  globalThis.location.hash = hash;
  dom.window.dispatchEvent(new dom.window.Event('hashchange'));
}

function currentRoleLabel() {
  return document
    .querySelector('[data-role="user-menu-toggle"] .user-menu__role')
    .textContent.trim();
}

function installDom(stored = {}) {
  dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost/',
  });
  for (const [key, value] of Object.entries(stored)) {
    dom.window.localStorage.setItem(key, value);
  }
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.location = dom.window.location;
  globalThis.history = dom.window.history;
  globalThis.addEventListener = dom.window.addEventListener.bind(dom.window);
  vi.resetModules();
}

function reloadWithStoredData() {
  const stored = {};
  for (const key of [SNAPSHOT_KEY, 'erp.manufacturing.role']) {
    const value = globalThis.localStorage.getItem(key);
    if (value) stored[key] = value;
  }
  const hash = globalThis.location.hash;
  dom.window.close();
  installDom(stored);
  if (hash) globalThis.location.hash = hash;
}

function openChangePassword() {
  openUserMenu();
  const item = document.querySelector('[data-change-password]');
  expect(item).toBeTruthy();
  item.click();
}

async function waitForChangePasswordDialog() {
  return vi.waitFor(() => {
    const backdrop = document.querySelector('.modal-backdrop[data-role="change-password-dialog"]');
    expect(backdrop).toBeTruthy();
    expect(backdrop.querySelector('.modal')).toBeTruthy();
    return backdrop;
  });
}

function fillChangePassword(dialog, currentPassword, newPassword, confirmPassword = newPassword) {
  const form = dialog.querySelector('[data-role="change-password-form"]');
  form.elements.currentPassword.value = currentPassword;
  form.elements.newPassword.value = newPassword;
  form.elements.confirmPassword.value = confirmPassword;
}

function submitChangePassword(dialog) {
  dialog
    .querySelector('[data-role="change-password-form"]')
    .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  installDom();
});

afterEach(() => {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.localStorage;
  delete globalThis.location;
  delete globalThis.history;
  delete globalThis.addEventListener;
});

describe('Ingreso genérico y sistema multi-rol', () => {
  it('muestra un login sin datos de roles', async () => {
    await boot();

    expect(document.querySelector('[data-role="login-form"]')).toBeTruthy();
    expect(document.querySelector('#toast-region').getAttribute('role')).toBe('status');
    expect(document.body.textContent).toContain('Iniciar sesión');
    for (const role of ROLE_ORDER)
      expect(document.body.textContent).not.toContain(ROLE_LABELS[role]);
    for (const description of Object.values(ROLE_DESCRIPTIONS)) {
      expect(document.body.textContent).not.toContain(description);
    }
    expect(document.body.textContent).not.toContain('Entrar como');
  });

  it('muestra un error genérico y no entra con credenciales inválidas', async () => {
    await boot();
    submitLogin('jefa', 'incorrecta');

    const error = document.querySelector('[data-role="login-error"]');

    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('Usuario o contraseña incorrectos');
    expect(document.querySelector('.shell')).toBeNull();
  });

  it('entra con un rol único y no ofrece selector ni administración', async () => {
    await boot();
    await enter(...CREDENTIALS.operator);

    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('operador|operator');
    openUserMenu();
    expect(document.querySelector('[data-role="role-select"]')).toBeNull();

    goToHash('#/admin-roles');

    expect(document.querySelector('[data-role="breadcrumb"] strong').textContent).toBe('Roles');
    expect(document.querySelector('[data-role="role-tab"][data-tab="config"]').disabled).toBe(true);
    expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(0);
    expect(document.body.textContent).not.toContain('Entrar como');
  });

  it('permite a la Jefa de Planta abrir el panel de cinco tablas desde Roles', async () => {
    await boot();
    await enter(...CREDENTIALS.plant_manager);

    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
    document.querySelector('[data-module="roles"]').click();
    document.querySelector('[data-role="role-tab"][data-tab="config"]').click();

    expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(5);
    expect(document.querySelectorAll('[data-pick-role]')).toHaveLength(0);
    expect(document.body.textContent).toContain('Configurar roles');
    expect(document.body.textContent).toContain('Jefa de Planta');
  });

  it('abre Configurar roles desde #/admin-roles solo con el rol activo de plant_manager', async () => {
    await boot();
    await enter('test', 'test');

    goToHash('#/admin-roles');

    expect(document.querySelector('[data-role="breadcrumb"] strong').textContent).toBe('Roles');
    expect(
      document
        .querySelector('[data-role="role-tab"][data-tab="config"]')
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(5);

    chooseRole('operator');
    goToHash('#/admin-roles');

    expect(
      document
        .querySelector('[data-role="role-tab"][data-tab="roles"]')
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(document.querySelector('[data-role="role-tab"][data-tab="config"]').disabled).toBe(true);
    expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(0);
  });

  it('confirma antes de aplicar el cambio de rol desde una tarjeta', async () => {
    await boot();
    await enter('test', 'test');
    document.querySelector('[data-module="roles"]').click();

    expect(
      [...document.querySelectorAll('[data-role-card]')].map((card) => card.dataset.roleCard),
    ).toEqual(CANONICAL_ROLES);

    document.querySelector('[data-role-card="operator"]').click();
    const dialog = await vi.waitFor(() => {
      const found = document.querySelector('[data-role="confirm-dialog"]');
      expect(found).toBeTruthy();
      return found;
    });
    expect(dialog.textContent).toContain('¿Deseas cambiar tu vista al rol Operador de Máquina?');
    expect(currentRoleLabel()).toBe('Jefa de Planta');
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('test|plant_manager');

    document.querySelector('[data-role="cancel"]').click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeNull(),
    );
    expect(currentRoleLabel()).toBe('Jefa de Planta');

    document.querySelector('[data-role-card="operator"]').click();
    document.querySelector('[data-role="confirm"]').click();
    await vi.waitFor(() => expect(currentRoleLabel()).toBe('Operador de Máquina'));
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('test|operator');
  });

  it('rechaza la cuenta genérica usuario', async () => {
    await boot();
    submitLogin('usuario', 'usuario');

    expect(document.querySelector('[data-role="login-error"]').hidden).toBe(false);
    expect(document.querySelector('.shell')).toBeNull();
  });

  it('ofrece los cinco roles a test y solo dos a doble', async () => {
    await boot();
    await enter('test', 'test');
    openUserMenu();

    expect(
      Array.from(document.querySelectorAll('[data-role="role-select"] option')).map(
        (option) => option.value,
      ),
    ).toEqual(CANONICAL_ROLES);
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('test|plant_manager');

    document.querySelector('[data-logout]').click();
    await vi.waitFor(() => expect(document.querySelector('[data-role="login-form"]')).toBeTruthy());

    await enter('doble', 'doble');
    openUserMenu();
    expect(
      Array.from(document.querySelectorAll('[data-role="role-select"] option')).map(
        (option) => option.value,
      ),
    ).toEqual(['operator', 'maintenance']);
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('doble|operator');
    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
  });

  it('cambia de rol efectivo sin alterar la identidad', async () => {
    await boot();
    await enter('test', 'test');
    chooseRole('operator');

    expect(document.querySelector('[data-role="viewing-as"]').textContent).toContain(
      'Viendo como: Operador de Máquina',
    );
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('test|operator');
    expect(document.querySelector('[data-module="orders"]')).toBeNull();
    expect(document.querySelector('[data-module="scheduling"]')).toBeTruthy();

    chooseRole('plant_manager');

    expect(document.querySelector('[data-role="viewing-as"]')).toBeNull();
    expect(document.querySelector('[data-module="scheduling"]')).toBeTruthy();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('test|plant_manager');
  });

  it('vuelve al login al cerrar sesión', async () => {
    await boot();
    await enter(...CREDENTIALS.planner);

    openUserMenu();
    document.querySelector('[data-logout]').click();

    expect(document.querySelector('[data-role="login-form"]')).toBeTruthy();
    expect(localStorage.getItem('erp.manufacturing.role')).toBeNull();
  });

  it('no duplica el selector de rol dentro de #/roles', async () => {
    await boot();
    await enter('test', 'test');
    document.querySelector('[data-module="roles"]').click();

    expect(document.querySelectorAll('[data-select-role]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-role="role-select"]')).toHaveLength(0);
    expect(document.body.textContent).toContain('Páginas disponibles');
  });

  it('permite reiniciar la demo solo a la jefa real con su rol', async () => {
    await boot();
    await enter(...CREDENTIALS.plant_manager);

    openUserMenu();
    const resetButton = document.querySelector('[data-reset-demo]');
    expect(resetButton).toBeTruthy();

    resetButton.click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeTruthy(),
    );
    document.querySelector('[data-role="confirm"]').click();

    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeNull(),
    );
    expect(document.querySelector('[data-role="login-form"]')).toBeNull();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('jefa|plant_manager');
    expect(document.body.textContent).toContain('Datos de demo reiniciados');
  });

  it('oculta el reinicio de la demo a otros roles y mientras se visualiza otro rol', async () => {
    await boot();
    await enter(...CREDENTIALS.operator);
    openUserMenu();
    expect(document.querySelector('[data-reset-demo]')).toBeNull();

    document.querySelector('[data-logout]').click();
    await vi.waitFor(() => expect(document.querySelector('[data-role="login-form"]')).toBeTruthy());

    await enter('test', 'test');
    chooseRole('operator');
    openUserMenu();
    expect(document.querySelector('[data-reset-demo]')).toBeNull();
  });
});

describe('Cambio de contraseña desde el menú de usuario', () => {
  it('está disponible para cualquier rol y muestra errores inline', async () => {
    await boot();
    await enter(...CREDENTIALS.operator);
    const before = localStorage.getItem(SNAPSHOT_KEY);

    openChangePassword();
    const dialog = await waitForChangePasswordDialog();
    expect(
      document.querySelector('[data-role="user-menu-toggle"]').getAttribute('aria-expanded'),
    ).toBe('false');
    expect(document.querySelector('[data-change-password]')).toBeNull();
    expect(dialog.textContent).toContain('Contraseña actual');
    expect(dialog.textContent).toContain('Nueva contraseña');
    expect(dialog.textContent).toContain('Confirmar nueva contraseña');

    fillChangePassword(dialog, 'incorrecta', 'ClaveNueva123');
    submitChangePassword(dialog);
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-role="change-password-error-current"]').hidden).toBe(
        false,
      ),
    );
    expect(dialog.textContent).toMatch(/contraseña actual/i);
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBe(before);

    fillChangePassword(dialog, 'operador', 'ClaveNueva123', 'distinta');
    submitChangePassword(dialog);
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-role="change-password-error-confirm"]').hidden).toBe(
        false,
      ),
    );
    expect(dialog.textContent).toMatch(/coincid/i);
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBe(before);

    fillChangePassword(dialog, 'operador', '   ', '   ');
    submitChangePassword(dialog);
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-role="change-password-error-new"]').hidden).toBe(false),
    );
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBe(before);
  });

  it('cierra el modal con botón, Escape y clic fuera sin mutar credenciales', async () => {
    await boot();
    await enter(...CREDENTIALS.planner);
    const before = localStorage.getItem(SNAPSHOT_KEY);

    openChangePassword();
    let dialog = await waitForChangePasswordDialog();
    dialog.querySelector('[data-role="change-password-cancel"]').click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="change-password-dialog"]')).toBeNull(),
    );

    openChangePassword();
    dialog = await waitForChangePasswordDialog();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="change-password-dialog"]')).toBeNull(),
    );

    openChangePassword();
    dialog = await waitForChangePasswordDialog();
    dialog.click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="change-password-dialog"]')).toBeNull(),
    );

    expect(localStorage.getItem(SNAPSHOT_KEY)).toBe(before);
  });

  it('persiste la nueva credencial, conserva el rol y permite ingresar tras logout y recarga', async () => {
    await boot();
    await enter('test', 'test');
    chooseRole('operator');

    openChangePassword();
    const dialog = await waitForChangePasswordDialog();
    fillChangePassword(dialog, 'test', 'ClaveNueva456');
    submitChangePassword(dialog);
    await vi.waitFor(() =>
      expect(document.querySelector('#toast-region').textContent).toContain(
        'Contraseña actualizada',
      ),
    );
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="change-password-dialog"]')).toBeNull(),
    );

    expect(currentRoleLabel()).toBe('Operador de Máquina');
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('test|operator');
    const snapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
    for (const key of Object.keys(snapshot.data).filter((name) => name.startsWith('role_users_'))) {
      for (const row of snapshot.data[key]) {
        if (row.username === 'test') expect(row.password).toBe('ClaveNueva456');
      }
    }

    reloadWithStoredData();
    await boot();
    expect(document.querySelector('.shell')).toBeTruthy();
    expect(currentRoleLabel()).toBe('Operador de Máquina');

    openUserMenu();
    document.querySelector('[data-logout]').click();
    await vi.waitFor(() => expect(document.querySelector('[data-role="login-form"]')).toBeTruthy());

    submitLogin('test', 'test');
    expect(document.querySelector('[data-role="login-error"]').hidden).toBe(false);
    expect(document.querySelector('.shell')).toBeNull();

    await enter('test', 'ClaveNueva456');
    openUserMenu();
    expect(
      Array.from(document.querySelectorAll('[data-role="role-select"] option')).map(
        (option) => option.value,
      ),
    ).toEqual(CANONICAL_ROLES);
  });
});
