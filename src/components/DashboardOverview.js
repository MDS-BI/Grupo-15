import { fmtNumber, fmtPercent, escapeHtml, el, ORDER_STATUS_LABEL } from './format.js';
import { capacityUtilization } from '../domain/operation-planning.js';
import { isModuleAllowed, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../domain/access-control.js';
import { ACTIVITY_FEED, DEMO_NOTICE, shortcutsForRole } from '../data/fixtures/dashboard-demo.js';

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @param {{role?: string, modules?: Array<{id: string, label: string}>, onNavigate?: (moduleId: string) => void}} [options]
 * @returns {HTMLElement}
 */
export function DashboardOverview(store, options = {}) {
  const role = options.role || 'plant_manager';
  const modules = options.modules || [];
  const onNavigate = options.onNavigate;
  const kpis = store.kpis();
  const loads = store.workCenterLoads();
  const roleLabel = ROLE_LABELS[role] || role;
  const roleDescription = ROLE_DESCRIPTIONS[role] || '';
  const shortcuts = shortcutsForRole(role).filter((shortcut) =>
    isModuleAllowed(role, shortcut.moduleId),
  );
  const performance = store.plantPerformanceFor({});
  const breachedCount = performance.thresholds.filter((row) => row.breached).length;
  const urgentTickets = store.maintenanceTickets.filter(
    (ticket) => ticket.priority === 'urgent' && ticket.ticket_status !== 'resolved',
  ).length;
  const pendingClosures = store.shiftsPendingValidation().length;
  const overdueOrders = store.orderScheduleSummary().overdue;

  const activeByStatus = ['released', 'in_progress', 'planned']
    .map((status) => {
      const count = kpis.byStatus[status] || 0;
      return `
      <div class="mini-stat">
        <span class="mini-stat__value">${count}</span>
        <span class="mini-stat__label">${ORDER_STATUS_LABEL[status]}</span>
      </div>`;
    })
    .join('');

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

  const attentionCards = [
    {
      moduleId: 'plant',
      label: 'Alarmas de umbral',
      value: breachedCount,
      hint: breachedCount ? 'Requieren revisión' : 'Indicadores dentro de rango',
      tone: breachedCount ? 'danger' : 'success',
    },
    {
      moduleId: 'maintenance',
      label: 'Tickets urgentes',
      value: urgentTickets,
      hint: urgentTickets ? 'Hay incidencias abiertas' : 'Sin incidencias abiertas',
      tone: urgentTickets ? 'danger' : 'success',
    },
    {
      moduleId: 'supervision',
      label: 'Cierres por validar',
      value: pendingClosures,
      hint: pendingClosures ? 'Pendientes de supervisión' : 'Todo validado',
      tone: pendingClosures ? 'warning' : 'success',
    },
    {
      moduleId: 'scheduling',
      label: 'Órdenes atrasadas',
      value: overdueOrders,
      hint: overdueOrders ? 'Revisar fechas planificadas' : 'Calendarización al día',
      tone: overdueOrders ? 'warning' : 'success',
    },
  ]
    .filter((card) => isModuleAllowed(role, card.moduleId))
    .map(
      (card) => `
      <button type="button" class="attention-card attention-card--${card.tone}" data-attention="${card.moduleId}">
        <span class="attention-card__label">${card.label}</span>
        <span class="attention-card__value">${fmtNumber(card.value)}</span>
        <span class="attention-card__hint">${card.hint}</span>
      </button>`,
    )
    .join('');

  const quickCards = shortcuts
    .map((shortcut) => {
      const module = modules.find((entry) => entry.id === shortcut.moduleId);
      return `
      <button type="button" class="quick-card" data-quick-action="${shortcut.moduleId}">
        <span class="quick-card__tag">${escapeHtml(shortcut.tag)}</span>
        <span class="quick-card__title">${escapeHtml(module ? module.label : shortcut.label)}</span>
        <span class="quick-card__hint">${escapeHtml(shortcut.hint)}</span>
        <span class="quick-card__go" aria-hidden="true">→</span>
      </button>`;
    })
    .join('');

  const activityRows = ACTIVITY_FEED.map(
    (item) => `
    <li class="activity-item activity-item--${item.tone}" data-activity="${item.moduleId}">
      <span class="activity-dot" aria-hidden="true"></span>
      <span class="activity-time">${escapeHtml(item.time)}</span>
      <span class="activity-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.detail)}</span>
      </span>
    </li>`,
  ).join('');

  const capacityRows = loads
    .map(({ workCenter, loadMinutes, pendingOperations }) => {
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
    })
    .join('');

  const html = `
    <section class="view view--dashboard">
      <header class="view__header">
        <div>
          <h1>Panel de Producción</h1>
          <p class="view__subtitle">Resumen operativo del piso de planta y la planificación.</p>
        </div>
        <span class="demo-tag">${escapeHtml(DEMO_NOTICE.title)}</span>
      </header>

      <section class="context-banner">
        <div>
          <p class="context-banner__kicker">Rol activo · ${escapeHtml(DEMO_NOTICE.detail)}</p>
          <h2>${escapeHtml(roleLabel)}</h2>
          <p>${escapeHtml(roleDescription)}</p>
        </div>
        <span class="role-badge">${escapeHtml(roleLabel)}</span>
      </section>

      <section class="attention-grid" aria-label="Situación actual">${attentionCards}</section>

      ${kpiCards}

      <div class="dashboard-split">
        <section class="panel">
          <header class="panel__header">
            <h2>Accesos rápidos</h2>
            <p class="panel__subtitle">Atajos sugeridos para tu rol.</p>
          </header>
          <div class="panel__body">
            <div class="quick-grid">${quickCards}</div>
          </div>
        </section>
        <section class="panel">
          <header class="panel__header">
            <h2>Actividad reciente</h2>
            <p class="panel__subtitle">Datos simulados para probar la interfaz.</p>
          </header>
          <div class="panel__body">
            <ol class="activity-list">${activityRows}</ol>
          </div>
        </section>
      </div>

      <section class="panel">
        <header class="panel__header">
          <h2>Utilización por Centro de Trabajo</h2>
          <p class="panel__subtitle">Carga pendiente vs. capacidad diaria efectiva (operations no completadas).</p>
        </header>
        <div class="panel__body">
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
        </div>
      </section>
    </section>`;

  const root = el(html);

  function navigate(moduleId) {
    if (typeof onNavigate === 'function') {
      onNavigate(moduleId);
      return;
    }
    if (globalThis.location) globalThis.location.hash = `#/${moduleId}`;
  }

  root.querySelectorAll('[data-quick-action], [data-attention]').forEach((button) => {
    button.addEventListener('click', () => {
      const moduleId =
        button.getAttribute('data-quick-action') || button.getAttribute('data-attention');
      navigate(moduleId);
    });
  });

  return root;
}
