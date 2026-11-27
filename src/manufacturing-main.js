/**
 * @file Punto de entrada del Módulo de Operaciones / Manufactura.
 * Ingreso genérico y marco principal (Panel/BOM/Órdenes, etc.).
 */

import '@fontsource-variable/inter';
import './styles/manufacturing.css';
import { store } from './data/ManufacturingStore.js';
import { DashboardOverview } from './components/DashboardOverview.js';
import { BomExplorer } from './components/BomExplorer.js';
import { ProductionOrders } from './components/ProductionOrders.js';
import { MaintenancePanel } from './components/MaintenancePanel.js';
import { OperatorWorkstationPanel } from './components/OperatorWorkstationPanel.js';
import { SupervisorLinePanel } from './components/SupervisorLinePanel.js';
import { PlantPerformancePanel } from './components/PlantPerformancePanel.js';
import { ProductionSchedulingPanel } from './components/ProductionSchedulingPanel.js';
import { LineBalancePanel } from './components/LineBalancePanel.js';
import { RoleAccessPanel } from './components/RoleAccessPanel.js';
import { escapeHtml } from './components/format.js';
import { confirmDialog } from './components/ConfirmDialog.js';
import { ChangePasswordDialog } from './components/ChangePasswordDialog.js';
import { icon } from './components/icons.js';
import { mountToastRegion, showToast } from './components/Toast.js';
import { authenticate, DEMO_ACCOUNTS } from './data/fixtures/demo-accounts.js';
import { CANONICAL_ROLES } from './domain/role-access.js';
import {
  DEFAULT_ROLE,
  MODULE_GROUPS,
  ROLE_LABELS,
  homeModuleForRole,
  isModuleAllowed,
  normalizeRole,
} from './domain/access-control.js';

const MODULE_NAME = 'Manufactura';
const ROLE_STORAGE_KEY = 'erp.manufacturing.role';

const MODULES = [
  {
    id: 'dashboard',
    label: 'Panel',
    icon: 'panel',
    render: (context) => DashboardOverview(store, { ...context, role: context.role }),
  },
  {
    id: 'bom',
    label: 'BOM',
    icon: 'bom',
    render: (context) => BomExplorer(store, { role: context.role }),
  },
  {
    id: 'orders',
    label: 'Órdenes',
    icon: 'orders',
    render: (context) => ProductionOrders(store, { role: context.role }),
  },
  {
    id: 'operator',
    label: 'Estación',
    icon: 'operator',
    render: (context) => OperatorWorkstationPanel(store, { role: context.role }),
  },
  {
    id: 'supervision',
    label: 'Supervisión',
    icon: 'supervision',
    render: (context) => SupervisorLinePanel(store, { role: context.role }),
  },
  {
    id: 'plant',
    label: 'Planta',
    icon: 'plant',
    render: (context) => PlantPerformancePanel(store, { role: context.role }),
  },
  {
    id: 'scheduling',
    label: 'Planificación',
    icon: 'scheduling',
    render: (context) => ProductionSchedulingPanel(store, { role: context.role }),
  },
  {
    id: 'line-balance',
    label: 'Balance',
    icon: 'line-balance',
    render: (context) => LineBalancePanel(store, { role: context.role }),
  },
  {
    id: 'maintenance',
    label: 'Mantenimiento',
    icon: 'maintenance',
    render: (context) => MaintenancePanel(store, { role: context.role }),
  },
  {
    id: 'roles',
    label: 'Roles',
    icon: 'roles',
    render: (context) =>
      RoleAccessPanel({
        currentRole: context.role,
        username: context.username,
        store,
        modules: context.modules,
        initialTab: context.roleTab,
        onRoleChange: context.onRoleChange,
      }),
  },
];

const state = {
  active: 'dashboard',
  username: null,
  assignedRoles: [],
  roleOptions: [],
  realRole: null,
  role: DEFAULT_ROLE,
  roleTab: 'roles',
  screen: 'login',
  drawerOpen: false,
  userMenuOpen: false,
  showPassword: false,
  loadingLogin: false,
};

function roleChoicesFor(realRole, assignedRoles) {
  return realRole === 'plant_manager' ? [...CANONICAL_ROLES] : [...assignedRoles];
}

function loadRole() {
  try {
    const raw = globalThis.localStorage?.getItem(ROLE_STORAGE_KEY);
    if (!raw) return null;
    const [first, second] = raw.split('|');
    const storedRoles = store.rolesForUsername(first);
    if (storedRoles.length) {
      const primary = storedRoles[0];
      return {
        username: first.trim().toLowerCase(),
        assignedRoles: storedRoles,
        roleOptions: roleChoicesFor(primary, storedRoles),
        realRole: primary,
        role: roleChoicesFor(primary, storedRoles).includes(second) ? second : primary,
      };
    }
    const legacyRole = normalizeRole(second || first);
    const account = DEMO_ACCOUNTS.find((entry) => entry.roles.includes(legacyRole));
    const assignedRoles = account?.roles ?? [legacyRole];
    return {
      username: account?.username ?? null,
      assignedRoles,
      roleOptions: roleChoicesFor(legacyRole, assignedRoles),
      realRole: legacyRole,
      role: legacyRole,
    };
  } catch {
    return null;
  }
}

function persistRole() {
  try {
    globalThis.localStorage?.setItem(
      ROLE_STORAGE_KEY,
      `${state.username ?? state.realRole}|${state.role}`,
    );
  } catch {
    /* almacenamiento no disponible: los roles duran la sesión */
  }
}

function forgetRole() {
  try {
    globalThis.localStorage?.removeItem(ROLE_STORAGE_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
  state.username = null;
  state.assignedRoles = [];
  state.roleOptions = [];
  state.realRole = null;
  state.role = DEFAULT_ROLE;
  state.roleTab = 'roles';
  state.active = 'dashboard';
  state.drawerOpen = false;
  state.userMenuOpen = false;
  state.showPassword = false;
  state.loadingLogin = false;
  store.setSessionRole(DEFAULT_ROLE, DEFAULT_ROLE);
  if (state.loginTimer) {
    globalThis.clearTimeout(state.loginTimer);
    state.loginTimer = null;
  }
}

function routeFromHash() {
  const hash = globalThis.location?.hash || '';
  const value = hash.replace(/^#\/?/, '').split('?')[0];
  if (value === 'admin-roles') return { moduleId: 'roles', roleTab: 'roles' };
  return {
    moduleId: MODULES.some((module) => module.id === value) ? value : null,
    roleTab: 'roles',
  };
}

function syncHash(moduleId, replace = false) {
  const target = `#/${moduleId}`;
  const history = globalThis.history;
  if (globalThis.location?.hash === target) return;
  if (history && typeof history.replaceState === 'function' && replace) {
    history.replaceState(null, '', target);
    return;
  }
  if (globalThis.location) globalThis.location.hash = target;
}

function navigateTo(moduleId) {
  if (!isModuleAllowed(state.role, moduleId)) return;
  state.active = moduleId;
  state.roleTab = 'roles';
  state.screen = 'app';
  state.drawerOpen = false;
  state.userMenuOpen = false;
  syncHash(moduleId);
  renderApp();
}

function handleLocationChange({ render = true } = {}) {
  if (state.screen === 'login' || !state.realRole) return;
  const route = routeFromHash();
  state.active =
    route.moduleId && isModuleAllowed(state.role, route.moduleId)
      ? route.moduleId
      : homeModuleForRole(state.role);
  state.roleTab = 'roles';
  syncHash(state.active, true);
  state.screen = 'app';
  if (render) renderApp();
}

function selectEffectiveRole(role, { goHome = false } = {}) {
  if (!state.roleOptions.includes(role)) return;
  state.role = role;
  store.setSessionRole(state.realRole, state.role);
  persistRole();
  if (state.roleTab === 'config' && !isModuleAllowed(role, 'admin-roles')) state.roleTab = 'roles';

  if (goHome) state.active = homeModuleForRole(state.role);
  else if (!isModuleAllowed(state.role, state.active)) state.active = homeModuleForRole(state.role);

  state.userMenuOpen = false;
  state.drawerOpen = false;
  syncHash(state.active, true);
  renderApp();
}

function login(roles, username) {
  state.username = String(username ?? '')
    .trim()
    .toLowerCase();
  state.assignedRoles = roles;
  state.realRole = roles[0] ?? DEFAULT_ROLE;
  state.roleOptions = roleChoicesFor(state.realRole, roles);
  state.role = state.realRole;
  store.setSessionRole(state.realRole, state.role);
  state.roleTab = 'roles';
  state.active = homeModuleForRole(state.role);
  state.screen = 'app';
  state.drawerOpen = false;
  state.userMenuOpen = false;
  state.showPassword = false;
  state.loadingLogin = false;
  state.loginTimer = null;
  persistRole();
  syncHash(state.active, true);
  renderApp();
}

function logout() {
  forgetRole();
  state.screen = 'login';
  renderApp();
}

async function resetDemoData() {
  state.userMenuOpen = false;
  renderShell();
  const confirmed = await confirmDialog({
    title: 'Reiniciar datos de demo',
    message:
      'Se descartarán los cambios de la sesión y volverán los datos iniciales. Tu sesión no se cerrará.',
    confirmLabel: 'Reiniciar datos',
    danger: true,
  });
  if (!confirmed) return;

  const restored = store.resetDemoData();
  showToast(restored ? 'Datos de demo reiniciados' : 'No se pudieron reiniciar los datos de demo', {
    tone: restored ? 'success' : 'danger',
  });
  renderContent();
}

function passwordChangeMessage(reason) {
  return (
    {
      'invalid-current-password': 'La contraseña actual no es correcta.',
      'user-not-found': 'No se encontró el usuario autenticado.',
      'empty-password': 'La nueva contraseña no puede estar vacía.',
    }[reason] ?? 'No se pudo cambiar la contraseña'
  );
}

function openChangePassword() {
  state.userMenuOpen = false;
  renderShell();
  const dialog = ChangePasswordDialog({
    onSubmit: ({ currentPassword, newPassword }) => {
      const username = String(state.username ?? '')
        .trim()
        .toLowerCase();
      const result = store.changeUserPassword(username, currentPassword, newPassword);
      showToast(result.ok ? 'Contraseña actualizada' : passwordChangeMessage(result.reason), {
        tone: result.ok ? 'success' : 'danger',
      });
      return result;
    },
  });
  document.body.append(dialog);
}

function visibleModules() {
  return MODULES.filter((module) => isModuleAllowed(state.role, module.id));
}

function sidebarModules() {
  return visibleModules().filter((module) => module.id !== 'roles');
}

function monogram(name) {
  return name.slice(0, 2).toUpperCase();
}

function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-screen">
      <form class="login-card" data-role="login-form" novalidate>
        <div class="login-brand">
          <span class="logo logo--login" aria-hidden="true">${monogram(MODULE_NAME)}</span>
          <span class="login-brand__name">Módulo de ${MODULE_NAME}</span>
        </div>
        <h1 class="login-title">Iniciar sesión</h1>
        <p class="login-subtitle">Ingresa tus credenciales para acceder al módulo.</p>
        <label class="login-field">Usuario
          <input type="text" name="username" autocomplete="username" required />
        </label>
        <label class="login-field login-field--password">Contraseña
          <span class="login-password-wrap">
            <input type="${state.showPassword ? 'text' : 'password'}" name="password" autocomplete="current-password" required />
            <button type="button" class="login-password-toggle" data-role="password-toggle"
              aria-pressed="${state.showPassword}"
              aria-label="${state.showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}">
              ${icon(state.showPassword ? 'eye-off' : 'eye')}
            </button>
          </span>
        </label>
        <p class="login-error" data-role="login-error" role="alert" hidden></p>
        <button type="submit" class="btn btn--primary login-submit" data-role="login-submit" ${
          state.loadingLogin ? 'disabled' : ''
        }>${state.loadingLogin ? 'Ingresando…' : 'Entrar'}</button>
      </form>
    </div>`;

  const form = app.querySelector('[data-role="login-form"]');
  const toggle = form.querySelector('[data-role="password-toggle"]');
  toggle.addEventListener('click', () => {
    state.showPassword = !state.showPassword;
    const input = form.elements.password;
    input.type = state.showPassword ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(state.showPassword));
    toggle.setAttribute(
      'aria-label',
      state.showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña',
    );
    toggle.innerHTML = icon(state.showPassword ? 'eye-off' : 'eye');
    input.focus();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.loadingLogin) return;
    const username = form.elements.username.value;
    const roleUsers = Object.fromEntries(
      CANONICAL_ROLES.map((role) => [role, store.roleUsersFor(role)]),
    );
    const roles = authenticate(username, form.elements.password.value, roleUsers);
    const error = form.querySelector('[data-role="login-error"]');
    if (!roles) {
      error.textContent = 'Usuario o contraseña incorrectos';
      error.hidden = false;
      return;
    }
    error.hidden = true;
    error.textContent = '';
    state.loadingLogin = true;
    const submit = form.querySelector('[data-role="login-submit"]');
    submit.disabled = true;
    submit.textContent = 'Ingresando…';
    state.loginTimer = globalThis.setTimeout(() => login(roles, username), 400);
  });
}

function sidebarButtons() {
  const allowed = sidebarModules();
  return MODULE_GROUPS.map((group) => {
    const buttons = group.modules
      .map((id) => allowed.find((module) => module.id === id))
      .filter(Boolean)
      .map((module) => {
        const active = module.id === state.active ? 'is-active' : '';
        const current = module.id === state.active ? 'aria-current="page"' : '';
        return `<button type="button" class="sidebar__btn ${active}" data-module="${module.id}" ${current}>
        <span class="sidebar__icon">${icon(module.icon)}</span>
        <span class="sidebar__label">${escapeHtml(module.label)}</span>
        <span class="sidebar__chevron" aria-hidden="true">›</span>
      </button>`;
      })
      .join('');
    return buttons
      ? `<div class="sidebar__group"><p class="sidebar__group-label">${escapeHtml(group.label)}</p>${buttons}</div>`
      : '';
  }).join('');
}

function roleOptions() {
  return state.roleOptions
    .map(
      (role) =>
        `<option value="${role}" ${role === state.role ? 'selected' : ''}>${escapeHtml(ROLE_LABELS[role])}</option>`,
    )
    .join('');
}

function userMenu() {
  const canResetDemo = state.realRole === 'plant_manager' && state.role === state.realRole;
  const switcher =
    state.roleOptions.length > 1
      ? `<div class="user-menu__group">
        <p class="user-menu__label" id="view-as-label">Ver como</p>
        <label class="user-menu__select" aria-labelledby="view-as-label">
          <span class="sr-only">Seleccionar rol de usuario</span>
          <select data-role="preview-role" aria-label="Seleccionar rol de usuario">
            ${roleOptions()}
          </select>
        </label>
      </div>`
      : '';
  return `
    <div class="user-menu" data-role="user-menu">
      <button type="button" class="user-menu__trigger" data-role="user-menu-toggle"
        aria-haspopup="true" aria-expanded="${state.userMenuOpen}"
        aria-label="Abrir menú de usuario">
        <span class="avatar" aria-hidden="true" data-initials="${monogram(ROLE_LABELS[state.role])}"></span>
        <span class="user-menu__role">${escapeHtml(ROLE_LABELS[state.role])}</span>
        ${icon('chevron')}
      </button>
      ${
        state.userMenuOpen
          ? `<div class="user-menu__panel" role="menu" aria-label="Menú de usuario">
        <p class="user-menu__current"><span>Rol efectivo</span><strong>${escapeHtml(ROLE_LABELS[state.role])}</strong></p>
        ${switcher}
        ${
          canResetDemo
            ? `<button type="button" class="user-menu__item" data-reset-demo role="menuitem">
          ${icon('refresh')}<span>Reiniciar datos de demo</span>
        </button>`
            : ''
        }
        <button type="button" class="user-menu__item" data-change-password role="menuitem">
          <span>Cambiar contraseña</span>
        </button>
        <button type="button" class="user-menu__item" data-logout role="menuitem">
          ${icon('logout')}<span>Cerrar sesión</span>
        </button>
      </div>`
          : ''
      }
    </div>`;
}

function renderShell() {
  const app = document.getElementById('app');
  const activeModule = MODULES.find((module) => module.id === state.active);
  const viewingAs = state.role !== state.realRole;
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <button type="button" class="icon-btn topbar__menu" data-role="drawer-toggle"
          aria-label="${state.drawerOpen ? 'Cerrar menú de módulos' : 'Abrir menú de módulos'}" aria-controls="sidebar"
          aria-expanded="${state.drawerOpen}">${icon(state.drawerOpen ? 'close' : 'menu')}</button>
        <button type="button" class="topbar__brand" data-role="brand" aria-label="Ir al inicio">
          <span class="logo" aria-hidden="true">${monogram(MODULE_NAME)}</span>
          <span class="topbar__name">Módulo de ${MODULE_NAME}</span>
        </button>
        <div class="topbar__breadcrumb" data-role="breadcrumb">
          <span>${MODULE_NAME}</span>
          <span class="topbar__separator" aria-hidden="true">/</span>
          <strong>${escapeHtml(activeModule ? activeModule.label : 'Panel')}</strong>
        </div>
        ${viewingAs ? `<p class="topbar__viewing" data-role="viewing-as">Viendo como: ${escapeHtml(ROLE_LABELS[state.role])}</p>` : ''}
        ${userMenu()}
      </header>
      <div class="shell__body">
        ${state.drawerOpen ? '<div class="sidebar-backdrop" data-role="drawer-backdrop"></div>' : ''}
        <nav class="sidebar ${state.drawerOpen ? 'is-open' : ''}" id="sidebar" aria-label="Módulos">${sidebarButtons()}</nav>
        <main class="content" data-role="content" tabindex="-1"></main>
      </div>
    </div>`;

  const drawerToggle = app.querySelector('[data-role="drawer-toggle"]');
  drawerToggle.addEventListener('click', () => {
    state.drawerOpen = !state.drawerOpen;
    state.userMenuOpen = false;
    renderShell();
    if (state.drawerOpen) app.querySelector('.sidebar__btn.is-active')?.focus();
    else app.querySelector('[data-role="drawer-toggle"]')?.focus();
  });

  app.querySelector('[data-role="brand"]').addEventListener('click', () => {
    navigateTo(homeModuleForRole(state.role));
  });

  app.querySelector('[data-logout]')?.addEventListener('click', logout);
  app.querySelector('[data-reset-demo]')?.addEventListener('click', resetDemoData);
  app.querySelector('[data-change-password]')?.addEventListener('click', openChangePassword);

  const menuToggle = app.querySelector('[data-role="user-menu-toggle"]');
  menuToggle.addEventListener('click', () => {
    state.userMenuOpen = !state.userMenuOpen;
    state.drawerOpen = false;
    renderShell();
    const focusTarget = state.userMenuOpen
      ? app.querySelector('[data-role="preview-role"], [data-reset-demo], [data-logout]')
      : app.querySelector('[data-role="user-menu-toggle"]');
    focusTarget?.focus();
  });

  app.querySelector('[data-role="preview-role"]')?.addEventListener('change', (event) => {
    selectEffectiveRole(event.target.value);
  });

  app.querySelectorAll('[data-module]').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-module')));
  });

  app.querySelector('[data-role="drawer-backdrop"]')?.addEventListener('click', closeOverlays);

  renderContent();
}

function closeOverlays() {
  if (!state.drawerOpen && !state.userMenuOpen) return;
  const wasDrawer = state.drawerOpen;
  state.drawerOpen = false;
  state.userMenuOpen = false;
  renderShell();
  if (wasDrawer) document.querySelector('[data-role="drawer-toggle"]')?.focus();
  else document.querySelector('[data-role="user-menu-toggle"]')?.focus();
}

function renderContent() {
  const content = document.querySelector('[data-role="content"]');
  const allowed = visibleModules();
  const module = allowed.find((entry) => entry.id === state.active) || allowed[0];
  state.active = module.id;
  const currentModule = MODULES.find((entry) => entry.id === state.active);
  const breadcrumb = document.querySelector('[data-role="breadcrumb"] strong');
  if (breadcrumb) breadcrumb.textContent = currentModule.label;
  content.replaceChildren(
    module.render({
      role: state.role,
      realRole: state.realRole,
      username: state.username,
      modules: MODULES,
      roleTab: state.roleTab,
      onRoleChange: (role) => selectEffectiveRole(role),
      onNavigate: navigateTo,
    }),
  );
}

function renderApp() {
  if (state.screen === 'login') {
    renderLogin();
    return;
  }
  renderShell();
}

function setupGlobalHandlers() {
  const doc = document;
  if (!doc) return;
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeOverlays();
  });
  doc.addEventListener('click', (event) => {
    const target = event.target;
    if (!state.drawerOpen && !state.userMenuOpen) return;
    if (target.closest?.('[data-role="user-menu"], [data-role="drawer-toggle"], .sidebar')) return;
    closeOverlays();
  });
}

globalThis.addEventListener?.('popstate', handleLocationChange);
globalThis.addEventListener?.('hashchange', handleLocationChange);
setupGlobalHandlers();
mountToastRegion();

const saved = loadRole();
if (saved) {
  state.username = saved.username;
  state.assignedRoles = saved.assignedRoles;
  state.roleOptions = saved.roleOptions;
  state.realRole = saved.realRole;
  state.role = saved.role;
  store.setSessionRole(state.realRole, state.role);
  state.roleTab = 'roles';
  state.active = homeModuleForRole(state.role);
  state.screen = 'app';
  handleLocationChange({ render: false });
}

renderApp();
