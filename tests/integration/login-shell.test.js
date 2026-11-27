import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from '../../src/domain/access-control.js';
import { SNAPSHOT_KEY } from '../../src/data/persistence.js';

const CREDENTIALS = {
  plant_manager: ['jefa.planta', 'ForjaPlanta26!'],
  planner: ['planificador.ops', 'Calendario2026!'],
  production_engineer: ['ingeniero.prod', 'RutaOptimal26!'],
  supervisor: ['supervisor.linea', 'TurnoLinea26!'],
  operator: ['operador.planta', 'Estacion2026!'],
  maintenance: ['mantencion.mgr', 'TallerMaq26!'],
};

const HOME = {
  plant_manager: ['#/plant', 'Planta'],
  planner: ['#/scheduling', 'Planificación'],
  production_engineer: ['#/line-balance', 'Balance'],
  supervisor: ['#/supervision', 'Supervisión'],
  operator: ['#/operator', 'Estación'],
  maintenance: ['#/maintenance', 'Mantenimiento'],
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

function goToHash(hash) {
  globalThis.location.hash = hash;
  dom.window.dispatchEvent(new dom.window.Event('hashchange'));
}

function currentRoleLabel() {
  return document.querySelector('[data-role="user-menu-toggle"]').textContent.trim();
}

function storedRole() {
  return globalThis.localStorage.getItem('erp.manufacturing.role') ?? '';
}

function expectStoredRole(username, role) {
  const raw = storedRole();
  expect(raw).toContain(username);
  expect(raw).toContain(role);
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

describe('Ingreso genérico y cuenta única', () => {
  it('muestra un login sin roles ni descripciones', async () => {
    await boot();

    expect(document.querySelector('[data-role="login-form"]')).toBeTruthy();
    expect(document.body.textContent).toContain('Iniciar sesión');
    for (const role of ROLE_ORDER) {
      expect(document.body.textContent).not.toContain(ROLE_LABELS[role]);
    }
    for (const description of Object.values(ROLE_DESCRIPTIONS)) {
      expect(document.body.textContent).not.toContain(description);
    }
    for (const [username] of Object.values(CREDENTIALS)) {
      expect(document.body.textContent).not.toContain(username);
    }
  });

  it('muestra un error genérico con contraseña incorrecta', async () => {
    await boot();
    submitLogin('jefa.planta', 'incorrecta');

    const error = document.querySelector('[data-role="login-error"]');

    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('Usuario o contraseña incorrectos');
    expect(document.querySelector('.shell')).toBeNull();
  });

  for (const [role, [username, password]] of Object.entries(CREDENTIALS)) {
    it(`entra con ${username} en su único rol ${role}`, async () => {
      await boot();
      await enter(username, password);

      const [hash, label] = HOME[role];
      expect(globalThis.location.hash).toBe(hash);
      expect(document.querySelector('[data-role="breadcrumb"] strong').textContent).toBe(label);
      expect(document.querySelector('[data-module="roles"]')).toBeNull();
      expectStoredRole(username, role);

      openUserMenu();
      expect(document.querySelector('[data-role="role-select"]')).toBeNull();
      if (role === 'plant_manager') {
        expect(document.querySelector('[data-role="user-menu"]').textContent).toContain('Ver como');
      } else {
        expect(document.querySelector('[data-role="user-menu"]').textContent).not.toContain(
          'Ver como',
        );
      }
    });
  }

  it('rechaza cuentas eliminadas usuario, test y doble', async () => {
    await boot();
    for (const username of ['usuario', 'test', 'doble']) {
      submitLogin(username, username);
      expect(document.querySelector('[data-role="login-error"]').hidden).toBe(false);
      expect(document.querySelector('.shell')).toBeNull();
    }
  });
});

describe('Navegación, "Ver como" y páginas de roles', () => {
  it('muestra "Ver como" solo a la Jefa de Planta', async () => {
    await boot();
    await enter(...CREDENTIALS.plant_manager);
    openUserMenu();

    expect(document.querySelector('[data-role="user-menu"]').textContent).toContain('Ver como');

    document.querySelector('[data-logout]').click();
    await vi.waitFor(() => expect(document.querySelector('[data-role="login-form"]')).toBeTruthy());

    await enter(...CREDENTIALS.production_engineer);
    openUserMenu();
    expect(document.querySelector('[data-role="user-menu"]').textContent).not.toContain('Ver como');
    expect(document.querySelector('[data-role="role-select"]')).toBeNull();
  });

  it('no ofrece selector de rol dentro del panel de planta', async () => {
    await boot();
    await enter(...CREDENTIALS.plant_manager);

    expect(globalThis.location.hash).toBe('#/plant');
    expect(document.querySelector('[data-role="content"] [data-role="role-select"]')).toBeNull();
    expect(document.querySelectorAll('[data-select-role]')).toHaveLength(0);
    expect(document.querySelector('[data-module="roles"]')).toBeNull();
  });

  it('redirige #/admin-roles a #/roles solo para la Jefa', async () => {
    await boot();
    await enter(...CREDENTIALS.plant_manager);
    goToHash('#/admin-roles');

    expect(globalThis.location.hash).toBe('#/roles');
    expect(document.querySelector('[data-role="breadcrumb"] strong').textContent).toBe('Roles');
    expect(document.querySelectorAll('[data-role-card]')).toHaveLength(6);
    expect(document.querySelector('[data-role="role-tab"][data-tab="config"]').disabled).toBe(
      false,
    );
    document.querySelector('[data-role="role-tab"][data-tab="config"]').click();
    expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(6);
  });

  for (const [role, [username, password]] of Object.entries(CREDENTIALS)) {
    if (role === 'plant_manager') continue;
    it(`deniega #/admin-roles y #/roles a ${username}`, async () => {
      await boot();
      await enter(username, password);

      goToHash('#/admin-roles');
      const [hash, label] = HOME[role];
      expect(globalThis.location.hash).toBe(hash);
      expect(document.querySelector('[data-role="breadcrumb"] strong').textContent).toBe(label);
      expect(document.querySelectorAll('[data-role-card]')).toHaveLength(0);
      expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(0);

      goToHash('#/roles');
      expect(globalThis.location.hash).toBe(hash);
      expect(document.querySelector('[data-role="breadcrumb"] strong').textContent).toBe(label);
    });
  }

  it('vuelve al login al cerrar sesión', async () => {
    await boot();
    await enter(...CREDENTIALS.planner);
    openUserMenu();
    document.querySelector('[data-logout]').click();

    expect(document.querySelector('[data-role="login-form"]')).toBeTruthy();
    expect(storedRole()).toBe('');
  });
});

describe('Reinicio de demo y contraseña', () => {
  it('ofrece reiniciar la demo solo a la jefa real con su rol', async () => {
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
    expectStoredRole('jefa.planta', 'plant_manager');
    expect(document.body.textContent).toContain('Datos de demo reiniciados');
  });

  it('oculta el reinicio de la demo a otros roles', async () => {
    await boot();
    await enter(...CREDENTIALS.production_engineer);
    openUserMenu();
    expect(document.querySelector('[data-reset-demo]')).toBeNull();
  });

  it('valida errores inline y persiste la nueva contraseña', async () => {
    await boot();
    await enter(...CREDENTIALS.operator);
    const before = localStorage.getItem(SNAPSHOT_KEY);

    openChangePassword();
    let dialog = await waitForChangePasswordDialog();
    expect(
      document.querySelector('[data-role="user-menu-toggle"]').getAttribute('aria-expanded'),
    ).toBe('false');
    expect(document.querySelector('[data-change-password]')).toBeNull();

    fillChangePassword(dialog, 'incorrecta', 'ClaveNueva123');
    submitChangePassword(dialog);
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-role="change-password-error-current"]').hidden).toBe(
        false,
      ),
    );
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBe(before);

    fillChangePassword(dialog, 'Estacion2026!', 'ClaveNueva123', 'distinta');
    submitChangePassword(dialog);
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-role="change-password-error-confirm"]').hidden).toBe(
        false,
      ),
    );
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBe(before);

    fillChangePassword(dialog, 'Estacion2026!', 'ClaveNueva123');
    submitChangePassword(dialog);
    await vi.waitFor(() =>
      expect(document.querySelector('#toast-region').textContent).toContain(
        'Contraseña actualizada',
      ),
    );
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="change-password-dialog"]')).toBeNull(),
    );

    expect(currentRoleLabel()).toBe('Operador');
    expectStoredRole('operador.planta', 'operator');
    const snapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
    for (const key of Object.keys(snapshot.data).filter((name) => name.startsWith('role_users_'))) {
      for (const row of snapshot.data[key]) {
        if (row.username === 'operador.planta') expect(row.password).toBe('ClaveNueva123');
      }
    }

    reloadWithStoredData();
    await boot();
    expect(document.querySelector('.shell')).toBeTruthy();
    expect(currentRoleLabel()).toBe('Operador');

    openUserMenu();
    document.querySelector('[data-logout]').click();
    await vi.waitFor(() => expect(document.querySelector('[data-role="login-form"]')).toBeTruthy());

    submitLogin('operador.planta', 'Estacion2026!');
    expect(document.querySelector('[data-role="login-error"]').hidden).toBe(false);
    await enter('operador.planta', 'ClaveNueva123');
    expect(globalThis.location.hash).toBe('#/operator');
  });
});
