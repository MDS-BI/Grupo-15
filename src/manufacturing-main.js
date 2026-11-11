/**
 * @file Punto de entrada del Módulo de Operaciones / Manufactura.
 * Monta el marco (barra superior + barra lateral) y enruta entre las vistas:
 * Panel, BOM, Órdenes. Ver plan.md §6.
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
];

const MODULE_NAME = 'Manufactura';
const state = { active: 'dashboard' };

function monogram(name) {
  return name.slice(0, 2).toUpperCase();
}

function sidebarButtons() {
  return MODULES.map((m) => {
    const active = m.id === state.active ? 'is-active' : '';
    const current = m.id === state.active ? 'aria-current="page"' : '';
    return `<button type="button" class="sidebar__btn ${active}" data-module="${m.id}" ${current}>
      <span class="sidebar__label">${m.label}</span>
    </button>`;
  }).join('');
}

function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <span class="logo" aria-hidden="true">${monogram(MODULE_NAME)}</span>
        <span class="topbar__name">Módulo de ${MODULE_NAME}</span>
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

  renderContent();
}

function renderContent() {
  const content = document.querySelector('[data-role="content"]');
  const module = MODULES.find((m) => m.id === state.active) || MODULES[0];
  content.replaceChildren(module.render());
}

renderShell();
