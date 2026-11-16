/**
 * @file Punto de entrada del Módulo de Operaciones / Manufactura.
 * Monta el marco (barra superior + barra lateral) y enruta entre las vistas:
 * Panel, BOM, Órdenes. El menú se filtra según el rol de usuario activo.
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
import {
  DEFAULT_ROLE,
  ROLE_LABELS,
  ROLE_ORDER,
  isModuleAllowed,
  normalizeRole,
} from './domain/access-control.js';

const MODULE_NAME = 'Manufactura';
const ROLE_STORAGE_KEY = 'erp.manufacturing.role';

const state = { active: 'dashboard', role: loadRole() };

const MODULES = [
  { id: 'dashboard', label: 'Panel', render: () => DashboardOverview(store) },
  { id: 'bom', label: 'BOM', render: () => BomExplorer(store) },
  { id: 'orders', label: 'Órdenes', render: () => ProductionOrders(store) },
  { id: 'operator', label: 'Estación', render: () => OperatorWorkstationPanel(store) },
  { id: 'supervision', label: 'Supervisión', render: () => SupervisorLinePanel(store) },
  { id: 'plant', label: 'Planta', render: () => PlantPerformancePanel(store) },
  { id: 'scheduling', label: 'Planificación', render: () => ProductionSchedulingPanel(store) },
  { id: 'line-balance', label: 'Balance', render: () => LineBalancePanel(store) },
  { id: 'maintenance', label: 'Mantenimiento', render: () => MaintenancePanel(store) },
  {
    id: 'roles',
    label: 'Roles',
    render: () =>
      RoleAccessPanel({
        currentRole: state.role,
        modules: MODULES,
        onSelect: (role) => selectRole(role, { goHome: true }),
      }),
  },
];

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

function selectRole(role, { goHome = false } = {}) {
  state.role = normalizeRole(role);
  persistRole(state.role);
  if (goHome) state.active = 'dashboard';
  else if (!isModuleAllowed(state.role, state.active)) state.active = 'dashboard';
  renderShell();
}

function visibleModules() {
  return MODULES.filter((module) => isModuleAllowed(state.role, module.id));
}

function monogram(name) {
  return name.slice(0, 2).toUpperCase();
}

function sidebarButtons() {
  return visibleModules()
    .map((module) => {
      const active = module.id === state.active ? 'is-active' : '';
      const current = module.id === state.active ? 'aria-current="page"' : '';
      return `<button type="button" class="sidebar__btn ${active}" data-module="${module.id}" ${current}>
      <span class="sidebar__label">${module.label}</span>
    </button>`;
    })
    .join('');
}

function roleOptions() {
  return ROLE_ORDER.map(
    (role) =>
      `<option value="${role}" ${role === state.role ? 'selected' : ''}>${ROLE_LABELS[role]}</option>`,
  ).join('');
}

function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <span class="logo" aria-hidden="true">${monogram(MODULE_NAME)}</span>
        <span class="topbar__name">Módulo de ${MODULE_NAME}</span>
        <label class="topbar__role" for="role-select">Rol activo
          <select id="role-select" data-role="role-select" aria-label="Seleccionar rol de usuario">
            ${roleOptions()}
          </select>
        </label>
      </header>
      <div class="shell__body">
        <nav class="sidebar" aria-label="Módulos">${sidebarButtons()}</nav>
        <main class="content" data-role="content"></main>
      </div>
    </div>`;

  app.querySelectorAll('[data-module]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.active = btn.getAttribute('data-module');
      renderShell();
    });
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
  content.replaceChildren(module.render());
}

renderShell();
