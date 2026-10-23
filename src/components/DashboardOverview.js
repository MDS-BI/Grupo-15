/**
 * @file Panel de inicio (dashboard overview) con KPIs de manufactura.
 * KPIs: órdenes activas, utilización de capacidad, scrap rate, completion/yield.
 */

import { fmtNumber, fmtPercent, escapeHtml, el, ORDER_STATUS_LABEL } from './format.js';
import { capacityUtilization } from '../domain/operation-planning.js';

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @returns {HTMLElement}
 */
export function DashboardOverview(store) {
  const kpis = store.kpis();
  const loads = store.workCenterLoads();

  const activeByStatus = ['released', 'in_progress', 'planned'].map((status) => {
    const count = kpis.byStatus[status] || 0;
    return `
      <div class="mini-stat">
        <span class="mini-stat__value">${count}</span>
        <span class="mini-stat__label">${ORDER_STATUS_LABEL[status]}</span>
      </div>`;
  }).join('');

  const kpiCards = `
    <div class="kpi-grid">
      <article class="kpi-card">
        <span class="kpi-card__label">Órdenes activas</span>
        <span class="kpi-card__value">${fmtNumber(kpis.activeOrders)}</span>
        <div class="kpi-card__breakdown">${activeByStatus}</div>
      </article>
      <article class="kpi-card">
        <span class="kpi-card__label">Scrap rate</span>
        <span class="kpi-card__value">${fmtPercent(kpis.scrapRate)}</span>
        <span class="kpi-card__hint">${fmtNumber(kpis.totalScrap)} unidades de merma</span>
      </article>
      <article class="kpi-card">
        <span class="kpi-card__label">Completion / Yield</span>
        <span class="kpi-card__value">${fmtPercent(kpis.completionRate)}</span>
        <span class="kpi-card__hint">${fmtNumber(kpis.totalProduced)} unidades producidas</span>
      </article>
      <article class="kpi-card">
        <span class="kpi-card__label">Órdenes totales</span>
        <span class="kpi-card__value">${fmtNumber(kpis.totalOrders)}</span>
        <span class="kpi-card__hint">incluye canceladas</span>
      </article>
    </div>`;

  const capacityRows = loads.map(({ workCenter, loadMinutes, pendingOperations }) => {
    const util = capacityUtilization(loadMinutes, workCenter);
    const pct = Math.min(util * 100, 100);
    const over = util > 1;
    return `
      <tr>
        <td>${escapeHtml(workCenter.name)}</td>
        <td>${fmtNumber(loadMinutes)} min</td>
        <td>${fmtNumber(workCenter.capacity_per_day_minutes * workCenter.efficiency_factor)} min</td>
        <td>${fmtNumber(pendingOperations)}</td>
        <td class="cell--bar">
          <div class="bar ${over ? 'bar--over' : ''}">
            <div class="bar__fill" style="width:${pct}%"></div>
          </div>
          <span class="bar__label ${over ? 'is-over' : ''}">${fmtPercent(util)}</span>
        </td>
      </tr>`;
  }).join('');

  const html = `
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Panel de Producción</h1>
          <p class="view__subtitle">Resumen operativo del piso de planta y la planificación.</p>
        </div>
      </header>

      ${kpiCards}

      <section class="panel">
        <header class="panel__header">
          <h2>Utilización por Centro de Trabajo</h2>
          <p class="panel__subtitle">Carga pendiente vs. capacidad diaria efectiva (operations no completadas).</p>
        </header>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Centro de Trabajo</th>
                <th>Carga Pendiente</th>
                <th>Capacidad/día</th>
                <th>Operaciones</th>
                <th>Utilización</th>
              </tr>
            </thead>
            <tbody>${capacityRows}</tbody>
          </table>
        </div>
      </section>
    </section>`;

  return el(html);
}
