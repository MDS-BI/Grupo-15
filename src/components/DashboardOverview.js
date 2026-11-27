import {
  fmtNumber,
  fmtPercent,
  escapeHtml,
  el,
  OP_STATUS_LABEL,
  ORDER_STATUS_LABEL,
} from './format.js';
import { effectiveCapacityPerDay } from '../domain/operation-planning.js';
import { can, isModuleAllowed, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../domain/access-control.js';
import { ACTIVITY_FEED, DEMO_NOTICE } from '../data/fixtures/dashboard-demo.js';

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @param {{role?: string, onNavigate?: (moduleId: string) => void}} [options]
 * @returns {HTMLElement}
 */
export function DashboardOverview(store, options = {}) {
  const role = options.role || 'plant_manager';
  const onNavigate = options.onNavigate;
  const kpis = store.kpis();
  const loads = store.dailyUtilizationByWorkCenter();
  const roleLabel = ROLE_LABELS[role] || role;
  const roleDescription = ROLE_DESCRIPTIONS[role] || '';
  const performance = store.plantPerformanceFor({});
  const breachedCount = performance.thresholds.filter((row) => row.breached).length;
  const urgentTickets = store.maintenanceTickets.filter(
    (ticket) => ticket.priority === 'urgent' && ticket.ticket_status !== 'resolved',
  ).length;
  const pendingClosures = store.shiftsPendingValidation().length;
  const overdueOrders = store.orderScheduleSummary().overdue;

  const attentionActions = {
    plant: 'panel.ver',
    maintenance: 'mantenimiento.ver',
    supervision: 'supervision.ver',
    scheduling: 'planificacion.ver',
  };

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
        <span class="kpi-card__label">Tasa de merma</span>
        <span class="kpi-card__value">${fmtPercent(kpis.scrapRate)}</span>
        <span class="kpi-card__hint">${fmtNumber(kpis.totalScrap)} unidades de merma</span>
      </article>
      <article class="kpi-card">
        <span class="kpi-card__label">Cumplimiento / Rendimiento</span>
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
    .filter(
      (card) => isModuleAllowed(role, card.moduleId) && can(role, attentionActions[card.moduleId]),
    )
    .map(
      (card) => `
      <button type="button" class="attention-card attention-card--${escapeHtml(card.tone)}" data-attention="${escapeHtml(card.moduleId)}">
        <span class="attention-card__label">${card.label}</span>
        <span class="attention-card__value">${fmtNumber(card.value)}</span>
        <span class="attention-card__hint">${card.hint}</span>
      </button>`,
    )
    .join('');

  const activityRows = ACTIVITY_FEED.map(
    (item) => `
    <li class="activity-item activity-item--${escapeHtml(item.tone)}" data-activity="${escapeHtml(item.moduleId)}">
      <span class="activity-dot" aria-hidden="true"></span>
      <span class="activity-time">${escapeHtml(item.time)}</span>
      <span class="activity-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.detail)}</span>
      </span>
    </li>`,
  ).join('');

  const capacityRows = loads
    .map(({ workCenter, loadMinutes, pendingOperations, utilization: util }) => {
      const capacity = effectiveCapacityPerDay(workCenter);
      const pct = util === null ? 0 : Math.min(util * 100, 100);
      const over = util !== null && util > 1;
      return `
      <tr data-capacity-wc="${workCenter.id}" tabindex="0" role="button" aria-label="Ver operaciones de ${escapeHtml(workCenter.name)}">
        <td>${escapeHtml(workCenter.name)}</td>
        <td class="num" title="Suma de planned_time_minutes de las operaciones no completadas">${fmtNumber(loadMinutes)} min</td>
        <td class="num" title="Capacidad efectiva de 1 día = min/día × eficiencia">${capacity === null ? '—' : fmtNumber(capacity)} min</td>
        <td class="num">${fmtNumber(pendingOperations)}</td>
        <td class="cell--bar" title="Carga pendiente ÷ capacidad de 1 día">
          <div class="bar ${over ? 'bar--over' : ''}">
            <div class="bar__fill" style="width:${pct}%"></div>
          </div>
          <span class="bar__label ${over ? 'is-over' : ''}">${util === null ? '—' : fmtPercent(util)}</span>
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

      <section class="context-banner" aria-label="Contexto del panel">
        <p class="context-banner__line"><strong>${escapeHtml(roleLabel)}</strong> · ${escapeHtml(roleDescription)}</p>
      </section>

      <section class="attention-grid" aria-label="Situación actual">${attentionCards}</section>

      ${kpiCards}

      <section class="panel">
        <header class="panel__header">
          <h2>Actividad reciente</h2>
          <p class="panel__subtitle">Datos simulados para probar la interfaz.</p>
        </header>
        <div class="panel__body">
          <ol class="activity-list">${activityRows}</ol>
        </div>
      </section>

      <section class="panel">
        <header class="panel__header">
          <h2>Utilización por Centro de Trabajo</h2>
          <p class="panel__subtitle">Carga pendiente vs. capacidad diaria efectiva (operaciones no completadas). Haz clic en un centro para ver sus operaciones.</p>
        </header>
        <div class="panel__body">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Centro de Trabajo</th>
                  <th class="num">Carga Pendiente</th>
                  <th class="num">Capacidad/día</th>
                  <th class="num">Operaciones</th>
                  <th>Utilización</th>
                </tr>
              </thead>
              <tbody>${capacityRows}</tbody>
            </table>
          </div>
        </div>
      </section>
      <div class="center-popover-root" data-role="capacity-popover-root"></div>
    </section>`;

  const root = el(html);

  function navigate(moduleId) {
    if (typeof onNavigate === 'function') {
      onNavigate(moduleId);
      return;
    }
    if (globalThis.location) globalThis.location.hash = `#/${moduleId}`;
  }

  root.querySelectorAll('[data-attention]').forEach((button) => {
    button.addEventListener('click', () => {
      navigate(button.getAttribute('data-attention'));
    });
  });

  const popoverRoot = root.querySelector('[data-role="capacity-popover-root"]');
  let openCapacityId = '';
  let capacityAnchor = null;

  function closeCapacityPopover(restoreFocus = false) {
    if (!openCapacityId) return;
    openCapacityId = '';
    popoverRoot.innerHTML = '';
    if (restoreFocus) capacityAnchor?.focus();
    capacityAnchor = null;
  }

  function positionCapacityPopover() {
    const popover = popoverRoot.querySelector('[data-role="capacity-popover"]');
    const section = root.querySelector('.dashboard-capacity-table')?.closest('.panel');
    if (!popover || !section) return;
    const sectionRect = section.getBoundingClientRect();
    const rowRect = capacityAnchor?.getBoundingClientRect?.() ?? sectionRect;
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;
    const width = popover.offsetWidth || 420;
    const height = popover.offsetHeight || 260;
    const centeredLeft = sectionRect.left + sectionRect.width / 2 - width / 2;
    const left = Math.max(16, Math.min(centeredLeft, viewportWidth - width - 16));
    const top = Math.max(16, Math.min(rowRect.top, viewportHeight - height - 16));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function operationRowsFor(workCenterId) {
    const operations = store.productionOrderOperations
      .filter((op) => op.work_center_id === workCenterId && op.status !== 'completed')
      .sort((a, b) => {
        const numberA =
          store.orderById(a.production_order_id)?.order_number || a.production_order_id;
        const numberB =
          store.orderById(b.production_order_id)?.order_number || b.production_order_id;
        return (
          numberA.localeCompare(numberB, 'es', { numeric: true }) ||
          (a.sequence ?? 0) - (b.sequence ?? 0)
        );
      });
    return operations.length
      ? operations
          .map((op) => {
            const order = store.orderById(op.production_order_id);
            return `<tr data-capacity-operation="${op.id}">
              <td>${escapeHtml(order?.order_number || op.production_order_id)}</td>
              <td>${fmtNumber(op.sequence ?? '—')}</td>
              <td>${OP_STATUS_LABEL[op.status] || escapeHtml(op.status)}</td>
              <td class="num">${fmtNumber(op.planned_time_minutes)}</td>
            </tr>`;
          })
          .join('')
      : '<tr><td colspan="4" class="empty-cell">Sin operaciones pendientes en este centro.</td></tr>';
  }

  function openCapacityPopover(workCenterId, anchor) {
    const workCenter = store.workCenterById(workCenterId);
    const load = loads.find((row) => row.workCenter.id === workCenterId);
    const name = escapeHtml(workCenter?.name || workCenterId);
    openCapacityId = workCenterId;
    capacityAnchor = anchor;
    popoverRoot.innerHTML = `
      <div class="center-popover" data-role="capacity-popover" role="dialog" aria-modal="true" aria-label="Operaciones de ${name}">
        <header class="center-popover__header">
          <div>
            <p class="center-popover__title">${name}</p>
            <p class="center-popover__meta">${fmtNumber(load?.pendingOperations || 0)} operaciones · ${fmtNumber(load?.loadMinutes || 0)} min de carga pendiente</p>
          </div>
          <button type="button" class="btn btn--tiny" data-role="close-capacity-popover" aria-label="Cerrar detalle de operaciones">Cerrar</button>
        </header>
        <table class="data-table data-table--compact center-popover__table">
          <thead><tr><th>Orden</th><th>Sec.</th><th>Estado</th><th class="num">Min</th></tr></thead>
          <tbody>${operationRowsFor(workCenterId)}</tbody>
        </table>
      </div>`;
    positionCapacityPopover();
    const closeButton = popoverRoot.querySelector('[data-role="close-capacity-popover"]');
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeCapacityPopover(true);
    });
    closeButton.focus();
  }

  root.querySelectorAll('[data-capacity-wc]').forEach((row) => {
    const toggle = (event) => {
      event?.stopPropagation?.();
      const workCenterId = row.getAttribute('data-capacity-wc');
      if (openCapacityId === workCenterId) {
        closeCapacityPopover();
        return;
      }
      openCapacityPopover(workCenterId, row);
    };
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle(event);
      }
    });
  });

  document.addEventListener('click', (event) => {
    if (!openCapacityId) return;
    if (event.target.closest?.('[data-role="capacity-popover"], [data-capacity-wc]')) return;
    closeCapacityPopover();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCapacityPopover(true);
  });

  window.addEventListener('resize', () => {
    if (openCapacityId) positionCapacityPopover();
  });

  window.addEventListener(
    'scroll',
    () => {
      if (openCapacityId) positionCapacityPopover();
    },
    true,
  );

  return root;
}
