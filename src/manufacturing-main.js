/**
 * @file Punto de entrada del Módulo de Operaciones / Manufactura.
 * Ingreso genérico y marco principal (Panel/BOM/Órdenes, etc.).
 */

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
import { el, escapeHtml } from './components/format.js';
import { authenticate } from './data/fixtures/demo-accounts.js';
import {
  DEFAULT_ROLE,
  MODULE_GROUPS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_ORDER,
  homeModuleForRole,
  isModuleAllowed,
  normalizeRole,
} from './domain/access-control.js';

const MODULE_NAME = 'Manufactura';
const ROLE_STORAGE_KEY = 'erp.manufacturing.role';

const MODULES = [
  { id: 'dashboard', label: 'Panel', render: (context) => DashboardOverview(store, context) },
  { id: 'bom', label: 'BOM', render: () => BomExplorer(store) },
  { id: 'orders', label: 'Órdenes', render: () => ProductionOrders(store) },
  { id: 'operator', label: 'Estación', render: () => OperatorWorkstationPanel(store) },
  { id: 'supervision', label: 'Supervisión', render: () => SupervisorLinePanel(store) },
  {
    id: 'plant',
    label: 'Planta',
    render: (context) => PlantPerformancePanel(store, { role: context.role }),
  },
  { id: 'scheduling', label: 'Planificación', render: () => ProductionSchedulingPanel(store) },
  { id: 'line-balance', label: 'Balance', render: () => LineBalancePanel(store) },
  { id: 'maintenance', label: 'Mantenimiento', render: () => MaintenancePanel(store) },
  {
    id: 'roles',
    label: 'Roles',
    render: (context) =>
      RoleAccessPanel({
        currentRole: context.role,
        modules: MODULES.filter((module) => module.id !== 'admin-roles'),
        onSelect: (role) => selectRole(role, { goHome: true, enterApp: true }),
      }),
  },
  {
    id: 'admin-roles',
    label: 'Datos de roles',
    render: () => adminRolesView(),
  },
];

const state = { active: 'dashboard', role: loadRole(), screen: 'login' };

function loadRole() {
  try {
    return normalizeRole(globalThis.localStorage?.getItem(ROLE_STORAGE_KEY));
  } catch {
    return DEFAULT_ROLE;
  }
}

function persistRole(role) {
  try {
    globalThis.localStorage?.setItem(ROLE_STORAGE_KEY, role);
  } catch {
    /* almacenamiento no disponible: el rol dura la sesión */
  }
}

function forgetRole() {
  try {
    globalThis.localStorage?.removeItem(ROLE_STORAGE_KEY);
  } catch {
    state.role = DEFAULT_ROLE;
  }
}

function moduleFromHash() {
  const hash = globalThis.location?.hash || '';
  const value = hash.replace(/^#\/?/, '').split('?')[0];
  return MODULES.some((module) => module.id === value) ? value : null;
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
  state.screen = 'app';
  syncHash(moduleId);
  renderApp();
}

function handleLocationChange() {
  if (state.screen === 'login') return;
  const target = moduleFromHash();
  state.active =
    target && isModuleAllowed(state.role, target) ? target : homeModuleForRole(state.role);
  syncHash(state.active, true);
  state.screen = 'app';
  renderApp();
}

function selectRole(role, { goHome = false, enterApp = false } = {}) {
  state.role = normalizeRole(role);
  persistRole(state.role);

  if (enterApp) state.screen = 'app';
  if (goHome) state.active = homeModuleForRole(state.role);
  else if (!isModuleAllowed(state.role, state.active)) state.active = homeModuleForRole(state.role);

  syncHash(state.active, true);
  renderApp();
}

function logout() {
  forgetRole();
  state.screen = 'login';
  renderApp();
}

function visibleModules() {
  return MODULES.filter((module) => isModuleAllowed(state.role, module.id));
}

function monogram(name) {
  return name.slice(0, 2).toUpperCase();
}

function roleCard(role) {
  return `
    <button type="button" class="role-select-card" data-pick-role="${role}">
      <span class="role-select-card__monogram" aria-hidden="true">${monogram(ROLE_LABELS[role])}</span>
      <span class="role-select-card__body">
        <span class="role-select-card__title">${escapeHtml(ROLE_LABELS[role])}</span>
        <span class="role-select-card__desc">${escapeHtml(ROLE_DESCRIPTIONS[role])}</span>
        <span class="role-select-card__hint">Entrar como ${escapeHtml(ROLE_LABELS[role])} →</span>
      </span>
    </button>`;
}

function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-screen">
      <form class="login-card" data-role="login-form" novalidate>
        <p class="login-kicker">Módulo de Operaciones / Manufactura</p>
        <h1 class="login-title">Iniciar sesión</h1>
        <p class="login-subtitle">Ingresa tus credenciales para acceder al módulo.</p>
        <label class="login-field">Usuario
          <input type="text" name="username" autocomplete="username" required />
        </label>
        <label class="login-field">Contraseña
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        <p class="login-error" data-role="login-error" role="alert" hidden></p>
        <button type="submit" class="btn btn--primary login-submit">Entrar</button>
      </form>
    </div>`;

  const form = app.querySelector('[data-role="login-form"]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const role = authenticate(form.elements.username.value, form.elements.password.value);
    const error = form.querySelector('[data-role="login-error"]');
    if (!role) {
      error.textContent = 'Usuario o contraseña incorrectos';
      error.hidden = false;
      return;
    }
    error.hidden = true;
    error.textContent = '';
    selectRole(role, { enterApp: true, goHome: true });
  });
}

function adminRolesView() {
  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Datos de roles</h1>
          <p class="view__subtitle">Información de los roles simulados. Solo disponible para ${escapeHtml(ROLE_LABELS[DEFAULT_ROLE])}.</p>
        </div>
      </header>
      <div class="role-select-grid">${ROLE_ORDER.map(roleCard).join('')}</div>
    </section>`);
  root.querySelectorAll('[data-pick-role]').forEach((button) => {
    button.addEventListener('click', () =>
      selectRole(button.getAttribute('data-pick-role'), { enterApp: true, goHome: true }),
    );
  });
  return root;
}

function sidebarButtons() {
  const allowed = visibleModules();
  return MODULE_GROUPS.map((group) => {
    const buttons = group.modules
      .map((id) => allowed.find((module) => module.id === id))
      .filter(Boolean)
      .map((module) => {
        const active = module.id === state.active ? 'is-active' : '';
        const current = module.id === state.active ? 'aria-current="page"' : '';
        return `<button type="button" class="sidebar__btn ${active}" data-module="${module.id}" ${current}>
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
  return ROLE_ORDER.map(
    (role) =>
      `<option value="${role}" ${role === state.role ? 'selected' : ''}>${escapeHtml(ROLE_LABELS[role])}</option>`,
  ).join('');
}

function renderShell() {
  const app = document.getElementById('app');
  const activeModule = MODULES.find((module) => module.id === state.active);
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <button type="button" class="topbar__brand" data-logout aria-label="Cerrar sesión y volver al ingreso">
          <span class="logo" aria-hidden="true">${monogram(MODULE_NAME)}</span>
          <span class="topbar__name">Módulo de ${MODULE_NAME}</span>
        </button>
        <div class="topbar__breadcrumb" data-role="breadcrumb">
          <span>${MODULE_NAME}</span>
          <span class="topbar__separator" aria-hidden="true">/</span>
          <strong>${escapeHtml(activeModule ? activeModule.label : 'Panel')}</strong>
        </div>
        <label class="topbar__role" for="role-select">Rol activo
          <select id="role-select" data-role="role-select" aria-label="Seleccionar rol de usuario">
            ${roleOptions()}
          </select>
        </label>
        <button type="button" class="topbar__logout" data-logout>Cerrar sesión</button>
      </header>
      <div class="shell__body">
        <nav class="sidebar" aria-label="Módulos">${sidebarButtons()}</nav>
        <main class="content" data-role="content" tabindex="-1"></main>
      </div>
    </div>`;

  app.querySelectorAll('[data-logout]').forEach((button) => {
    button.addEventListener('click', logout);
  });

  app.querySelectorAll('[data-module]').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-module')));
  });

  app.querySelector('[data-role="role-select"]').addEventListener('change', (event) => {
    selectRole(event.target.value);
  });

  renderContent();
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
      modules: MODULES,
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

globalThis.addEventListener?.('popstate', handleLocationChange);
globalThis.addEventListener?.('hashchange', handleLocationChange);

renderApp();
