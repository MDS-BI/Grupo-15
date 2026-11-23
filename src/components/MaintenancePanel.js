/**
 * @file Panel de mantenimiento (US-09/US-15): bandeja priorizada, intervención,
 * cierre con marcas de parada, historial/desgaste y órdenes preventivas.
 * Ver contracts/maintenance.md §4 y §8.
 */

import {
  buildPreventiveOrderFromHistory,
  canEditMaintenanceFrequency,
  canRescheduleMaintenance,
  canResolveScheduledMaintenance,
  computeDowntimeMinutes,
  isResolvedMaintenance,
} from '../domain/maintenance.js';
import {
  escapeHtml,
  el,
  fmtNumber,
  formatDurationLong,
  formatLocalDate,
  formatLocalDateTime,
} from './format.js';
import { confirmDialog, notifyDialog } from './ConfirmDialog.js';
import { daysFromNow, relativeDay } from '../data/fixtures/demo-dates.js';
import { stopEventLabel, technicianLabel } from './labels.js';
import { icon } from './icons.js';
import { showToast } from './Toast.js';

const TICKET_STATUS_LABEL = {
  open: 'Abierto',
  in_progress: 'En intervención',
  resolved: 'Resuelto',
};

const PRIORITY_LABEL = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja',
};

const PREVENTIVE_STATUS_LABEL = {
  planned: 'Planificada',
  in_progress: 'En ejecución',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const WEAR_LABEL = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
};

const OPERATIONAL_STATUS_LABEL = {
  fault: 'Frenada por mantención',
  available: 'Disponible',
  in_operation: 'En operación',
  paused: 'En pausa',
};

const MAINTENANCE_BLOCKS = [
  { key: 'active', title: 'Activos', searchRole: 'maintenance-search-active' },
  {
    key: 'overdue',
    title: 'No resueltos por vencimiento',
    searchRole: 'maintenance-search-overdue',
  },
  { key: 'history', title: 'Históricos', searchRole: 'maintenance-search-history' },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function nowLocalInput() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function isoToLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function localToIso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesSearch(value, term) {
  const needle = normalizeText(term);
  return !needle || normalizeText(value).includes(needle);
}

function fmtDateTime(value) {
  return formatLocalDateTime(value);
}

function priorityBadge(priority) {
  return `<span class="prio prio--${escapeHtml(priority)}">${escapeHtml(PRIORITY_LABEL[priority] || priority)}</span>`;
}

function ticketStatusBadge(status) {
  return `<span class="maint-badge maint-badge--${escapeHtml(status)}">${escapeHtml(TICKET_STATUS_LABEL[status] || status)}</span>`;
}

function preventiveStatusBadge(status) {
  return `<span class="maint-badge maint-badge--${escapeHtml(status)}">${escapeHtml(
    PREVENTIVE_STATUS_LABEL[status] || status,
  )}</span>`;
}

function wearBadge(level) {
  return `<span class="wear wear--${escapeHtml(level)}">${escapeHtml(
    WEAR_LABEL[level] || level,
  )}</span>`;
}

function operationalBadge(status) {
  return `<span class="maint-badge maint-badge--${escapeHtml(status)}">${escapeHtml(
    OPERATIONAL_STATUS_LABEL[status] || status,
  )}</span>`;
}

function maintenanceCode(event) {
  return event.ticket_code || event.order_code || event.sourceId || event.id;
}

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @param {{role?: string}} [options]
 * @returns {HTMLElement}
 */
export function MaintenancePanel(store, { role = 'maintenance' } = {}) {
  let activeTab = 'tickets';
  let selectedTicketId = null;
  let historyWorkCenterId = null;
  let machineSection = '';
  const filters = { status: '', priority: '', workCenterId: '' };
  const searches = { machines: '', tickets: '', active: '', overdue: '', history: '' };

  const root = el(`
    <section class="view maintenance-view">
      <header class="view__header">
        <div>
          <h1>Mantenimiento</h1>
          <p class="view__subtitle">Máquinas, tickets y mantenciones programadas sincronizadas con el calendario.</p>
        </div>
        <div class="maintenance-filters">
          <label>Estado
            <select data-role="filter-status" aria-label="Filtrar por estado">
              <option value="">Todos</option>
              <option value="open">Abierto</option>
              <option value="in_progress">En intervención</option>
              <option value="resolved">Resuelto</option>
            </select>
          </label>
          <label>Prioridad
            <select data-role="filter-priority" aria-label="Filtrar por prioridad">
              <option value="">Todas</option>
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="normal">Normal</option>
            </select>
          </label>
          <label>Centro
            <select data-role="filter-work-center" aria-label="Filtrar por centro de trabajo">
              <option value="">Todos</option>
              ${store.workCenters
                .map((wc) => `<option value="${escapeHtml(wc.id)}">${escapeHtml(wc.name)}</option>`)
                .join('')}
            </select>
          </label>
        </div>
      </header>

      <nav class="maintenance-tabs" role="tablist" aria-label="Secciones de mantenimiento">
        <button type="button" class="maintenance-tabs__tab" role="tab" data-role="maintenance-tab" data-tab="machines" aria-selected="false">
          <span class="maintenance-tabs__icon">${icon('maintenance')}</span><span>Máquinas</span>
        </button>
        <button type="button" class="maintenance-tabs__tab" role="tab" data-role="maintenance-tab" data-tab="tickets" aria-selected="true">
          <span class="maintenance-tabs__icon">${icon('orders')}</span><span>Tickets</span>
        </button>
        <button type="button" class="maintenance-tabs__tab" role="tab" data-role="maintenance-tab" data-tab="maintenances" aria-selected="false">
          <span class="maintenance-tabs__icon">${icon('scheduling')}</span><span>Mantenimientos</span>
        </button>
      </nav>

      <div class="maintenance-tabpanel" data-role="maintenance-tabpanel" data-panel="machines" role="tabpanel" hidden>
        <div data-role="fault-banner" aria-live="polite"></div>

        <section class="panel">
          <header class="panel__header">
            <h2>Máquinas</h2>
            <div class="maintenance-block-tools">
              <input type="search" data-role="maintenance-search-machines" aria-label="Buscar máquinas" placeholder="Buscar máquina o código" />
              <select data-role="machine-section-filter" aria-label="Filtrar por sección">
                <option value="">Todas las secciones</option>
                ${[...new Set(store.workCenters.map((wc) => wc.station_type).filter(Boolean))]
                  .map(
                    (station) =>
                      `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`,
                  )
                  .join('')}
              </select>
            </div>
          </header>
          <div class="panel__body">
            <div data-role="machine-alert" aria-live="polite"></div>
            <div class="table-wrap">
              <table class="data-table data-table--compact">
                <thead><tr><th>Máquina</th><th>Código</th><th>Sección</th><th>Estado</th><th>Frecuencia recomendada</th><th>Desgaste</th><th>Acciones</th></tr></thead>
                <tbody data-role="machine-list"></tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="panel" data-role="history"></section>

        <section class="panel">
          <header class="panel__header">
            <h2>Órdenes de mantenimiento preventivo</h2>
            <button type="button" class="btn btn--small btn--primary" data-preventive-create>Programar preventiva</button>
          </header>
          <div class="panel__body">
            <div data-role="preventive-list"></div>
          </div>
        </section>
      </div>

      <div class="maintenance-tabpanel" data-role="maintenance-tabpanel" data-panel="tickets" role="tabpanel">
        <section class="panel">
          <header class="panel__header">
            <h2>Bandeja de tickets</h2>
            <div class="maintenance-block-tools">
              <input type="search" data-role="maintenance-search-tickets" aria-label="Buscar tickets" placeholder="Buscar ticket o máquina" />
              <span class="panel__subtitle" data-role="ticket-count"></span>
            </div>
          </header>
          <div class="panel__body">
            <div class="table-wrap table-wrap--tickets">
              <table class="data-table maintenance-ticket-table">
                <thead>
                  <tr>
                    <th>Código</th><th>Centro</th><th>Prioridad</th><th>Estado</th>
                    <th>Creado</th><th>Evento de parada</th><th>Acción</th>
                  </tr>
                </thead>
                <tbody data-role="ticket-list"></tbody>
              </table>
            </div>
          </div>
        </section>
        <section class="panel maintenance-ticket-detail" data-role="ticket-detail"></section>
      </div>

      <div class="maintenance-tabpanel" data-role="maintenance-tabpanel" data-panel="maintenances" role="tabpanel" hidden>
        ${MAINTENANCE_BLOCKS.map(
          (block) => `
            <section class="panel maintenance-block" data-role="maintenance-block-${block.key}">
              <header class="panel__header" data-role="maintenance-block-search" data-block="${block.key}">
                <h2>${escapeHtml(block.title)}</h2>
                <input type="search" class="maintenance-block__search" data-role="${block.searchRole}" aria-label="Buscar en ${escapeHtml(block.title)}" placeholder="Buscar máquina o código" />
              </header>
              <div class="panel__body" data-role="maintenance-block-body-${block.key}"></div>
            </section>`,
        ).join('')}
      </div>

      <div class="modal-root" data-role="modal-root"></div>
    </section>`);

  const ticketListEl = root.querySelector('[data-role="ticket-list"]');
  const ticketCountEl = root.querySelector('[data-role="ticket-count"]');
  const faultBannerEl = root.querySelector('[data-role="fault-banner"]');
  const detailEl = root.querySelector('[data-role="ticket-detail"]');
  const historyEl = root.querySelector('[data-role="history"]');
  const preventiveListEl = root.querySelector('[data-role="preventive-list"]');
  const machineListEl = root.querySelector('[data-role="machine-list"]');
  const machineAlertEl = root.querySelector('[data-role="machine-alert"]');
  const modalRoot = root.querySelector('[data-role="modal-root"]');

  function ticketById(id) {
    return store.maintenanceTickets.find((ticket) => ticket.id === id) || null;
  }

  function workCenterName(id) {
    const wc = store.workCenterById(id);
    return wc ? wc.name : id;
  }

  function selectedWorkCenterId() {
    if (historyWorkCenterId) return historyWorkCenterId;
    const ticket = selectedTicketId ? ticketById(selectedTicketId) : null;
    if (ticket) return ticket.work_center_id;
    return store.workCenters[0] ? store.workCenters[0].id : null;
  }

  function renderTabs() {
    root.querySelectorAll('[data-role="maintenance-tab"]').forEach((tab) => {
      const selected = tab.getAttribute('data-tab') === activeTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    root.querySelectorAll('[data-role="maintenance-tabpanel"]').forEach((panel) => {
      panel.hidden = panel.getAttribute('data-panel') !== activeTab;
    });
  }

  function renderFaultBanner() {
    const active = store.maintenanceTickets.filter(
      (ticket) => ticket.ticket_status === 'in_progress',
    );
    if (active.length === 0) {
      faultBannerEl.innerHTML = '';
      return;
    }
    faultBannerEl.innerHTML = `
      <div class="fault-banner" role="status">
        <strong>Máquina detenida</strong>
        ${active
          .map((ticket) => {
            const since = ticket.downtime_started_at || ticket.intervention_started_at;
            const minutes = since
              ? Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000))
              : null;
            return `<div class="fault-banner__item" data-fault-ticket="${escapeHtml(ticket.id)}">
              <span>${escapeHtml(ticket.ticket_code)} · ${escapeHtml(
                workCenterName(ticket.work_center_id),
              )}</span>
              <span title="${escapeHtml(ticket.technician_ext_hr_employee_id || '')}">Técnico: ${escapeHtml(
                ticket.technician_ext_hr_employee_id
                  ? technicianLabel(ticket.technician_ext_hr_employee_id)
                  : '—',
              )}</span>
              <span>Parada: ${minutes === null ? '—' : formatDurationLong(minutes)}</span>
            </div>`;
          })
          .join('')}
      </div>`;
  }

  function actionButton(ticket) {
    if (ticket.ticket_status === 'open') {
      const blocked = Boolean(store.activeInterventionForWorkCenter(ticket.work_center_id));
      return `<button type="button" class="btn btn--small btn--primary" data-take="${escapeHtml(ticket.id)}" ${
        blocked ? 'disabled title="El centro ya tiene una intervención activa"' : ''
      }>Tomar intervención</button>`;
    }
    if (ticket.ticket_status === 'in_progress') {
      return `<button type="button" class="btn btn--small btn--primary" data-resolve="${escapeHtml(ticket.id)}">Resolver</button>`;
    }
    return `<button type="button" class="btn btn--small" data-view="${escapeHtml(ticket.id)}">Ver historial</button>`;
  }

  function scheduleButton(ticket) {
    const disabled = !canRescheduleMaintenance(role) || ticket.ticket_status === 'resolved';
    return `<button type="button" class="btn btn--small" data-schedule-ticket="${escapeHtml(
      ticket.id,
    )}" ${disabled ? 'disabled title="No se puede programar esta mantención"' : ''}>Programar mantención</button>`;
  }

  function frequencyAlerts() {
    const today = new Date();
    return store.workCenters.filter((wc) => {
      const frequency = Number(wc.recommended_maintenance_frequency_days);
      if (!Number.isFinite(frequency) || frequency < 1) return true;
      const dates = [
        ...store
          .preventiveOrdersFor({ status: 'completed', workCenterId: wc.id })
          .map((order) => order.completed_at || order.planned_date),
        ...store.maintenanceHistoryForWorkCenter(wc.id).map((ticket) => ticket.resolved_at),
      ].filter(Boolean);
      if (dates.length === 0) return true;
      const latest = Math.max(...dates.map((value) => new Date(value).getTime()));
      if (!Number.isFinite(latest)) return true;
      return (today.getTime() - latest) / 86400000 > frequency;
    });
  }

  function renderMachines() {
    const alerts = frequencyAlerts();
    machineAlertEl.innerHTML =
      alerts.length === 0
        ? ''
        : `<div class="maintenance-alert" role="status">${icon('maintenance')} Revisar frecuencia de mantención: ${alerts
            .map((wc) => escapeHtml(wc.name))
            .join(', ')}.</div>`;

    const machines = store.workCenters.filter(
      (wc) =>
        (!machineSection || wc.station_type === machineSection) &&
        (matchesSearch(wc.name, searches.machines) ||
          matchesSearch(wc.code, searches.machines) ||
          matchesSearch(wc.station_type, searches.machines)),
    );
    if (machines.length === 0) {
      machineListEl.innerHTML = `<tr><td colspan="7" class="empty-cell">Sin máquinas para la búsqueda.</td></tr>`;
      return;
    }
    machineListEl.innerHTML = machines
      .map((wc) => {
        const wear = store.maintenanceIndicatorsForWorkCenter(wc.id);
        const frequency = wc.recommended_maintenance_frequency_days;
        const frequencyControl = canEditMaintenanceFrequency(role)
          ? `<input type="number" min="1" step="1" class="maintenance-frequency" data-role="frequency-input" data-center="${escapeHtml(
              wc.id,
            )}" value="${frequency ?? ''}" aria-label="Cada cuánto se recomienda mantención" placeholder="Días" />`
          : `<span class="maint-code">${frequency ? `${escapeHtml(frequency)} días` : 'Sin frecuencia'}</span>`;
        return `<tr data-role="machine-row" data-center="${escapeHtml(wc.id)}">
          <td><strong>${escapeHtml(wc.name)}</strong></td>
          <td class="maint-code">${escapeHtml(wc.code || '—')}</td>
          <td>${escapeHtml(wc.station_type || '—')}</td>
          <td>${operationalBadge(wc.operational_status)}</td>
          <td>${frequencyControl}</td>
          <td>${wearBadge(wear.wear_level)} · ${fmtNumber(wear.failure_count)} falla(s) · ${formatDurationLong(
            wear.total_downtime_minutes,
          )}</td>
          <td class="cell--actions">
            <button type="button" class="btn btn--small" data-preventive-create data-center="${escapeHtml(
              wc.id,
            )}">Programar preventiva</button>
            <button type="button" class="btn btn--small" data-role="review-history" data-center="${escapeHtml(
              wc.id,
            )}">Revisar históricas</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function renderTickets() {
    const tickets = store
      .maintenanceTicketsFor(filters)
      .filter(
        (ticket) =>
          matchesSearch(ticket.ticket_code, searches.tickets) ||
          matchesSearch(workCenterName(ticket.work_center_id), searches.tickets) ||
          matchesSearch(ticket.description, searches.tickets),
      );
    ticketCountEl.textContent = `${tickets.length} ticket(s)`;
    if (tickets.length === 0) {
      ticketListEl.innerHTML = `<tr><td colspan="7" class="empty-cell">Sin tickets para los filtros seleccionados.</td></tr>`;
      return;
    }
    ticketListEl.innerHTML = tickets
      .map((ticket) => {
        const active = ticket.id === selectedTicketId ? 'is-selected' : '';
        return `<tr class="${active}" data-ticket-row="${escapeHtml(ticket.id)}">
          <td class="maint-code"><strong>${escapeHtml(ticket.ticket_code)}</strong></td>
          <td>${escapeHtml(workCenterName(ticket.work_center_id))}</td>
          <td>${priorityBadge(ticket.priority)}</td>
          <td>${ticketStatusBadge(ticket.ticket_status)}</td>
          <td class="maint-date">${formatLocalDate(ticket.created_at)}</td>
          <td class="maint-code" title="${escapeHtml(ticket.operation_delay_id || '')}">${
            ticket.operation_delay_id
              ? escapeHtml(stopEventLabel(store, ticket.operation_delay_id))
              : '—'
          }</td>
          <td class="cell--actions maintenance-ticket-actions">${scheduleButton(ticket)}${actionButton(
            ticket,
          )}</td>
        </tr>`;
      })
      .join('');
  }

  function renderDetail() {
    const ticket = selectedTicketId ? ticketById(selectedTicketId) : null;
    if (!ticket) {
      detailEl.innerHTML = `<header class="panel__header"><h2>Detalle del ticket</h2></header>
        <div class="panel__body">
          <p class="empty-note">Selecciona un ticket de la bandeja para ver su detalle.</p>
        </div>`;
      return;
    }
    const wear = store.maintenanceIndicatorsForWorkCenter(ticket.work_center_id);
    const failures = store.maintenanceHistoryForWorkCenter(ticket.work_center_id);
    const fullHistory = (
      typeof store.maintenanceFeed === 'function' ? store.maintenanceFeed() : []
    ).filter((event) => event.work_center_id === ticket.work_center_id);
    detailEl.innerHTML = `
      <header class="panel__header">
        <h2>${escapeHtml(ticket.ticket_code)} ${ticketStatusBadge(ticket.ticket_status)}</h2>
        <p class="panel__subtitle">${escapeHtml(workCenterName(ticket.work_center_id))}</p>
      </header>
      <div class="panel__body">
        <dl class="detail-list">
          <div><dt>Prioridad</dt><dd>${priorityBadge(ticket.priority)}</dd></div>
          <div><dt>Origen</dt><dd>${ticket.escalated_to_maint ? 'Escalado desde piso' : 'Registro manual'}</dd></div>
          <div><dt>Creado</dt><dd class="nowrap">${fmtDateTime(ticket.created_at)}</dd></div>
          <div><dt>Evento de parada</dt><dd class="nowrap" title="${escapeHtml(
            ticket.operation_delay_id || '',
          )}">${escapeHtml(
            ticket.operation_delay_id ? stopEventLabel(store, ticket.operation_delay_id) : '—',
          )}</dd></div>
          <div><dt>Técnico</dt><dd class="nowrap" title="${escapeHtml(
            ticket.technician_ext_hr_employee_id || '',
          )}">${escapeHtml(
            ticket.technician_ext_hr_employee_id
              ? technicianLabel(ticket.technician_ext_hr_employee_id)
              : '—',
          )}</dd></div>
          <div><dt>Inicio intervención</dt><dd class="nowrap">${fmtDateTime(ticket.intervention_started_at)}</dd></div>
          <div><dt>Inicio parada</dt><dd class="nowrap">${fmtDateTime(ticket.downtime_started_at)}</dd></div>
          <div><dt>Fin parada</dt><dd class="nowrap">${fmtDateTime(ticket.downtime_ended_at)}</dd></div>
          <div><dt>Parada total</dt><dd class="nowrap">${
            ticket.downtime_minutes === null ? '—' : formatDurationLong(ticket.downtime_minutes)
          }</dd></div>
          <div><dt>Resuelto</dt><dd class="nowrap">${fmtDateTime(ticket.resolved_at)}</dd></div>
        </dl>
        <p class="maintenance-description">${escapeHtml(ticket.description)}</p>
        ${
          ticket.resolution_notes
            ? `<p class="maintenance-description"><strong>Notas de cierre:</strong> ${escapeHtml(
                ticket.resolution_notes,
              )}</p>`
            : ''
        }
        <div class="maintenance-detail-sections">
          <section>
            <h3>Historial de fallas</h3>
            ${
              failures.length === 0
                ? '<p class="empty-note">Sin fallas resueltas para esta máquina.</p>'
                : `<ul class="maintenance-detail-list">${failures
                    .map(
                      (row) =>
                        `<li><span class="maint-code">${escapeHtml(row.ticket_code)}</span> · ${formatLocalDate(
                          row.resolved_at,
                        )} · ${formatDurationLong(row.downtime_minutes || 0)}</li>`,
                    )
                    .join('')}</ul>`
            }
          </section>
          <section>
            <h3>Historial completo de mantenciones</h3>
            ${
              fullHistory.length === 0
                ? '<p class="empty-note">Sin mantenciones registradas.</p>'
                : `<ul class="maintenance-detail-list">${fullHistory
                    .map(
                      (event) =>
                        `<li><span class="maint-code">${escapeHtml(maintenanceCode(event))}</span> · ${escapeHtml(
                          event.work_center_name || workCenterName(event.work_center_id),
                        )} · ${formatLocalDate(event.start_date)}</li>`,
                    )
                    .join('')}</ul>`
            }
          </section>
          <section>
            <h3>Indicador de desgaste</h3>
            <p>${wearBadge(wear.wear_level)} · ${fmtNumber(
              wear.failure_count,
            )} falla(s) · ${formatDurationLong(wear.total_downtime_minutes)} acumulados</p>
          </section>
        </div>
        <div class="detail-actions">${scheduleButton(ticket)} ${actionButton(ticket)}</div>
      </div>`;
  }

  function renderHistory() {
    const workCenterId = selectedWorkCenterId();
    if (!workCenterId) {
      historyEl.innerHTML = `<header class="panel__header"><h2>Historial y desgaste</h2></header>
        <div class="panel__body">
          <p class="empty-note">Sin centros de trabajo disponibles.</p>
        </div>`;
      return;
    }
    const history = store.maintenanceHistoryForWorkCenter(workCenterId);
    const wear = store.maintenanceIndicatorsForWorkCenter(workCenterId);

    const rows = history
      .map(
        (ticket) => `<tr>
          <td class="maint-code">${escapeHtml(ticket.ticket_code)}</td>
          <td class="maint-date">${formatLocalDate(ticket.resolved_at)}</td>
          <td class="cell--nowrap">${formatDurationLong(ticket.downtime_minutes || 0)}</td>
          <td class="maint-code">${escapeHtml(
            store.maintenanceCauses.find((cause) => cause.id === ticket.cause_reason_id)?.label ||
              ticket.cause_reason_id ||
              '—',
          )}</td>
        </tr>`,
      )
      .join('');

    historyEl.innerHTML = `
      <header class="panel__header">
        <h2>Historial y desgaste</h2>
        <select data-role="history-center" aria-label="Centro de trabajo del historial">
          ${store.workCenters
            .map(
              (wc) =>
                `<option value="${escapeHtml(wc.id)}" ${wc.id === workCenterId ? 'selected' : ''}>${escapeHtml(
                  wc.name,
                )}</option>`,
            )
            .join('')}
        </select>
      </header>
      <div class="panel__body">
      <p class="context-note">Indicadores agregados por máquina · solo contexto operativo, no evaluación de desempeño.</p>
      <dl class="detail-list">
        <div><dt>Fallas resueltas</dt><dd>${fmtNumber(wear.failure_count)}</dd></div>
        <div><dt>Parada acumulada</dt><dd>${formatDurationLong(wear.total_downtime_minutes)}</dd></div>
        <div><dt>MTTR</dt><dd>${formatDurationLong(wear.mttr_minutes)}</dd></div>
        <div><dt>Desgaste</dt><dd>${wearBadge(wear.wear_level)}</dd></div>
      </dl>
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Ticket</th><th>Resuelto</th><th>Parada</th><th>Causa</th></tr></thead>
          <tbody>${
            rows ||
            '<tr><td colspan="4" class="empty-cell">Sin fallos resueltos en esta máquina.</td></tr>'
          }</tbody>
        </table>
      </div>
      </div>`;
  }

  function preventiveActions(order) {
    const buttons = [];
    if (order.status === 'planned') {
      buttons.push(
        `<button type="button" class="btn btn--small btn--primary" data-preventive-action="start" data-order="${escapeHtml(order.id)}">Iniciar</button>`,
      );
    }
    if (order.status === 'in_progress') {
      buttons.push(
        `<button type="button" class="btn btn--small btn--primary" data-preventive-action="complete" data-order="${escapeHtml(order.id)}">Completar</button>`,
      );
    }
    if (order.status === 'planned' || order.status === 'in_progress') {
      buttons.push(
        `<button type="button" class="btn btn--small" data-preventive-action="cancel" data-order="${escapeHtml(order.id)}">Cancelar</button>`,
      );
    }
    return buttons.join('');
  }

  function renderPreventives() {
    const orders = store.preventiveOrdersFor();
    if (orders.length === 0) {
      preventiveListEl.innerHTML = `<p class="empty-note">Sin órdenes preventivas programadas.</p>`;
      return;
    }
    preventiveListEl.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Código</th><th>Centro</th><th>Título</th><th>Fecha objetivo</th><th>Estado</th><th>Origen</th><th>Acción</th></tr></thead>
          <tbody>
            ${orders
              .map((order) => {
                const sourceTicket = order.source_ticket_id
                  ? ticketById(order.source_ticket_id)
                  : null;
                return `<tr data-preventive-row="${escapeHtml(order.id)}">
                  <td class="maint-code"><strong>${escapeHtml(order.order_code)}</strong></td>
                  <td>${escapeHtml(workCenterName(order.work_center_id))}</td>
                  <td>${escapeHtml(order.title)}</td>
                  <td class="maint-date">${formatLocalDate(order.planned_date)}</td>
                  <td>${preventiveStatusBadge(order.status)}</td>
                  <td class="maint-code" title="${escapeHtml(order.source_ticket_id || '')}">${escapeHtml(
                    sourceTicket?.ticket_code || '—',
                  )}</td>
                  <td class="cell--actions">${preventiveActions(order)}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  function maintenanceSearchText(event) {
    return [
      maintenanceCode(event),
      event.work_center_name || workCenterName(event.work_center_id),
      event.sourceId,
      event.description,
    ]
      .filter(Boolean)
      .join(' ');
  }

  function maintenanceSubject(event) {
    if (['maintenance', 'plant_manager'].includes(role)) {
      return event.technician_name || technicianLabel(event.technician_ext_hr_employee_id);
    }
    return `Máquina ${escapeHtml(event.work_center_id || '—')} · ${formatDurationLong(
      event.downtime_minutes,
    )}`;
  }

  function renderMaintenanceBlock(block, events) {
    const filtered = events.filter((event) =>
      matchesSearch(maintenanceSearchText(event), searches[block.key]),
    );
    const bodyEl = root.querySelector(`[data-role="maintenance-block-body-${block.key}"]`);
    if (filtered.length === 0) {
      bodyEl.innerHTML = `<p class="empty-note">Sin mantenciones</p>`;
      return;
    }
    bodyEl.innerHTML = `
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Código</th><th>Máquina</th><th>Tipo</th><th>Estado</th><th>Inicio</th><th>Fecha visible</th><th>Responsable</th><th>Acción</th></tr></thead>
          <tbody>
            ${filtered
              .map((event) => {
                const resolved = isResolvedMaintenance(event);
                const action = resolved
                  ? `<button type="button" class="btn btn--small btn--danger" data-delete-maintenance="${escapeHtml(
                      event.id,
                    )}" ${role === 'maintenance' ? '' : 'disabled'}>Eliminar</button>`
                  : `<button type="button" class="btn btn--small btn--primary" data-resolve-scheduled="${escapeHtml(
                      event.id,
                    )}" ${
                      role === 'maintenance' && canResolveScheduledMaintenance(event)
                        ? ''
                        : 'disabled'
                    }>Resolver</button>`;
                return `<tr data-maintenance-row="${escapeHtml(event.id)}">
                  <td class="maint-code"><strong>${escapeHtml(maintenanceCode(event))}</strong></td>
                  <td>${escapeHtml(event.work_center_name || workCenterName(event.work_center_id))}</td>
                  <td>${escapeHtml(
                    event.maintenanceType === 'preventive' ? 'Preventiva' : 'Correctiva',
                  )}</td>
                  <td>${
                    event.maintenanceType === 'preventive'
                      ? preventiveStatusBadge(event.status)
                      : ticketStatusBadge(event.status)
                  }</td>
                  <td class="maint-date">${formatLocalDate(event.start_date)}</td>
                  <td class="maint-date">${formatLocalDate(
                    event.visible_end_date || event.end_date,
                  )}</td>
                  <td>${maintenanceSubject(event)}</td>
                  <td class="cell--actions">${action}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderMaintenances() {
    const feed = typeof store.maintenanceFeed === 'function' ? store.maintenanceFeed() : [];
    const groups = { active: [], overdue: [], history: [] };
    feed.forEach((event) => {
      if (isResolvedMaintenance(event)) groups.history.push(event);
      else if (event.is_overdue) groups.overdue.push(event);
      else groups.active.push(event);
    });
    MAINTENANCE_BLOCKS.forEach((block) => renderMaintenanceBlock(block, groups[block.key]));
  }

  function showModal(innerHtml) {
    modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${innerHtml}</div></div>`;
    const modal = modalRoot.querySelector('.modal');
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length) focusable[0].focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    modalRoot.__onKeyDown = onKeyDown;

    modalRoot.querySelector('[data-close]')?.addEventListener('click', closeModal);
    modalRoot.querySelector('.modal-backdrop')?.addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-backdrop')) closeModal();
    });
  }

  function closeModal() {
    if (modalRoot.__onKeyDown) {
      document.removeEventListener('keydown', modalRoot.__onKeyDown);
      modalRoot.__onKeyDown = null;
    }
    modalRoot.innerHTML = '';
  }

  function openTakeModal(ticketId) {
    const ticket = ticketById(ticketId);
    if (!ticket) return;
    selectedTicketId = ticketId;
    const options = store.technicians
      .map(
        (tech) =>
          `<option value="${escapeHtml(tech.ext_hr_employee_id)}">${escapeHtml(tech.name)} — ${escapeHtml(
            tech.specialty,
          )}</option>`,
      )
      .join('');
    showModal(`
      <h2 id="take-title">Tomar intervención · ${escapeHtml(ticket.ticket_code)}</h2>
      <form data-role="take-form" class="stack-form">
        <p class="maintenance-description">${escapeHtml(ticket.description)}</p>
        <label>Técnico asignado
          <select name="technician_ext_hr_employee_id" required>
            <option value="">Selecciona…</option>${options}
          </select>
        </label>
        <p class="form-error" data-role="error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Cancelar</button>
          <button type="submit" class="btn btn--primary">Iniciar intervención</button>
        </div>
      </form>`);
    const form = modalRoot.querySelector('[data-role="take-form"]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const errorEl = form.querySelector('[data-role="error"]');
      try {
        const technician = form.querySelector('[name="technician_ext_hr_employee_id"]').value;
        store.startMaintenanceIntervention(ticketId, {
          technician_ext_hr_employee_id: technician,
        });
        showToast('Intervención iniciada', { tone: 'info' });
        closeModal();
      } catch (error) {
        errorEl.textContent = error.message;
      }
    });
  }

  function openResolveModal(ticketId) {
    const ticket = ticketById(ticketId);
    if (!ticket) return;
    selectedTicketId = ticketId;
    const causeOptions = store.maintenanceCauses
      .map((cause) => `<option value="${escapeHtml(cause.id)}">${escapeHtml(cause.label)}</option>`)
      .join('');
    const startedValue = isoToLocalInput(
      ticket.downtime_started_at || ticket.intervention_started_at,
    );
    showModal(`
      <h2 id="resolve-title">Resolver intervención · ${escapeHtml(ticket.ticket_code)}</h2>
      <form data-role="resolve-form" class="stack-form">
        <label>Fecha y hora de resolución
          <input type="datetime-local" name="resolvedAt" value="${nowLocalInput()}" required />
        </label>
        <label>Inicio real de la parada
          <input type="datetime-local" name="downtimeStartedAt" value="${startedValue}" required />
        </label>
        <label>Fin real de la parada
          <input type="datetime-local" name="downtimeEndedAt" value="${nowLocalInput()}" required />
        </label>
        <p class="hint">Parada calculada: <strong data-role="downtime-preview">—</strong></p>
        <label>Causa
          <select name="causeReasonId"><option value="">Sin clasificar</option>${causeOptions}</select>
        </label>
        <label>Notas de cierre
          <textarea name="notes" rows="3" placeholder="Detalle de la intervención"></textarea>
        </label>
        <p class="form-error" data-role="error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Cancelar</button>
          <button type="submit" class="btn btn--primary">Confirmar cierre</button>
        </div>
      </form>`);
    const form = modalRoot.querySelector('[data-role="resolve-form"]');
    const preview = form.querySelector('[data-role="downtime-preview"]');
    const startedInput = form.querySelector('[name="downtimeStartedAt"]');
    const endedInput = form.querySelector('[name="downtimeEndedAt"]');
    const updatePreview = () => {
      try {
        const start = localToIso(startedInput.value);
        const end = localToIso(endedInput.value);
        const minutes = computeDowntimeMinutes(start, end);
        preview.textContent = formatDurationLong(minutes);
      } catch {
        preview.textContent = '—';
      }
    };
    [startedInput, endedInput].forEach((input) => input.addEventListener('input', updatePreview));
    updatePreview();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const errorEl = form.querySelector('[data-role="error"]');
      try {
        const resolvedAt = localToIso(form.querySelector('[name="resolvedAt"]').value);
        const downtimeStartedAt = localToIso(startedInput.value);
        const downtimeEndedAt = localToIso(endedInput.value);
        const causeReasonId = form.querySelector('[name="causeReasonId"]').value;
        const notes = form.querySelector('[name="notes"]').value;
        store.resolveMaintenanceTicket(ticketId, {
          resolvedAt,
          downtimeStartedAt,
          downtimeEndedAt,
          causeReasonId: causeReasonId || null,
          notes,
        });
        showToast('Ticket resuelto', { tone: 'success' });
        closeModal();
      } catch (error) {
        errorEl.textContent = error.message;
      }
    });
  }

  function openScheduleModal(ticketId) {
    const ticket = ticketById(ticketId);
    if (!ticket) return;
    const techOptions = store.technicians
      .map(
        (tech) =>
          `<option value="${escapeHtml(tech.ext_hr_employee_id)}">${escapeHtml(tech.name)} — ${escapeHtml(
            tech.specialty,
          )}</option>`,
      )
      .join('');
    const technician = ticket.technician_ext_hr_employee_id || '';
    showModal(`
      <h2 id="schedule-title">Programar mantención · ${escapeHtml(ticket.ticket_code)}</h2>
      <form data-role="schedule-form" class="stack-form">
        <p class="context-note">${escapeHtml(workCenterName(ticket.work_center_id))} · ${escapeHtml(
          ticket.description,
        )}</p>
        <label>Técnico asignado
          <select name="technician_ext_hr_employee_id" required>
            <option value="">Selecciona…</option>${techOptions}
          </select>
        </label>
        <label>Inicio
          <input type="date" name="scheduledStartDate" value="${relativeDay(0)}" required />
        </label>
        <label>Plazo
          <input type="date" name="scheduledEndDate" value="${daysFromNow(1)}" required />
        </label>
        <p class="hint">${technician ? `Técnico actual: ${escapeHtml(technicianLabel(technician))}` : 'Sin técnico asignado'}</p>
        <p class="form-error" data-role="error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Cancelar</button>
          <button type="submit" class="btn btn--primary">Programar mantención</button>
        </div>
      </form>`);
    const form = modalRoot.querySelector('[data-role="schedule-form"]');
    form.querySelector('[name="technician_ext_hr_employee_id"]').value = technician;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const errorEl = form.querySelector('[data-role="error"]');
      try {
        store.scheduleMaintenanceFromTicket(
          ticketId,
          {
            technician_ext_hr_employee_id: form.querySelector(
              '[name="technician_ext_hr_employee_id"]',
            ).value,
            scheduled_start_date: form.querySelector('[name="scheduledStartDate"]').value,
            scheduled_end_date: form.querySelector('[name="scheduledEndDate"]').value,
          },
          role,
        );
        showToast('Mantención programada', { tone: 'success' });
        closeModal();
      } catch (error) {
        errorEl.textContent = error.message;
      }
    });
  }

  function openPreventiveModal(workCenterId) {
    const centerId = workCenterId || selectedWorkCenterId();
    if (!centerId) return;
    const suggestion = buildPreventiveOrderFromHistory(
      store.maintenanceTickets,
      centerId,
      relativeDay(0),
    );
    const wear = store.maintenanceIndicatorsForWorkCenter(centerId);
    const techOptions = store.technicians
      .map(
        (tech) =>
          `<option value="${escapeHtml(tech.ext_hr_employee_id)}">${escapeHtml(tech.name)}</option>`,
      )
      .join('');
    showModal(`
      <h2 id="preventive-title">Programar preventiva · ${escapeHtml(workCenterName(centerId))}</h2>
      <form data-role="preventive-form" class="stack-form">
        <p class="context-note">Desgaste ${escapeHtml(WEAR_LABEL[wear.wear_level] || wear.wear_level)}: ${escapeHtml(
          wear.failure_count,
        )} fallo(s), ${formatDurationLong(wear.total_downtime_minutes)} de parada.</p>
        <label>Fecha objetivo
          <input type="date" name="plannedDate" value="${escapeHtml(suggestion.planned_date)}" required />
        </label>
        <label>Título
          <input type="text" name="title" value="${escapeHtml(suggestion.title)}" required />
        </label>
        <label>Técnico (opcional)
          <select name="technician_ext_hr_employee_id">
            <option value="">Sin asignar</option>${techOptions}
          </select>
        </label>
        <p class="form-error" data-role="error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Cancelar</button>
          <button type="submit" class="btn btn--primary">Crear orden</button>
        </div>
      </form>`);
    const form = modalRoot.querySelector('[data-role="preventive-form"]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const errorEl = form.querySelector('[data-role="error"]');
      try {
        const plannedDate = form.querySelector('[name="plannedDate"]').value;
        const title = form.querySelector('[name="title"]').value;
        const technician = form.querySelector('[name="technician_ext_hr_employee_id"]').value;
        const order = store.createPreventiveMaintenanceOrder({
          workCenterId: centerId,
          sourceTicketId: suggestion.source_ticket_id,
          plannedDate,
          title,
          technician_ext_hr_employee_id: technician || null,
        });
        store.schedulePreventiveMaintenance(
          order.id,
          { scheduled_start_date: plannedDate, scheduled_end_date: plannedDate },
          role,
        );
        showToast('Orden preventiva creada', { tone: 'success' });
        closeModal();
      } catch (error) {
        errorEl.textContent = error.message;
      }
    });
  }

  async function handlePreventiveAction(orderId, action) {
    try {
      if (action === 'start') {
        store.transitionPreventiveMaintenanceOrder(orderId, 'in_progress');
        showToast('Orden preventiva iniciada', { tone: 'info' });
      } else if (action === 'complete') {
        store.transitionPreventiveMaintenanceOrder(orderId, 'completed');
        showToast('Orden preventiva completada', { tone: 'success' });
      } else if (action === 'cancel') {
        const reason =
          typeof window !== 'undefined' && typeof window.prompt === 'function'
            ? window.prompt('Motivo de cancelación de la orden preventiva:') || ''
            : '';
        store.cancelPreventiveMaintenanceOrder(orderId, { reason });
        showToast('Orden preventiva cancelada', { tone: 'warning' });
      }
    } catch (error) {
      await notifyDialog({
        title: 'No se pudo completar la acción',
        message: error.message,
      });
    }
  }

  async function handleResolveScheduled(id) {
    const confirmed = await confirmDialog({
      title: 'Resolver mantención',
      message: '¿Está seguro que quiere resolver esta mantención?',
      confirmLabel: 'Resolver',
    });
    if (!confirmed) return;
    try {
      store.resolveScheduledMaintenance(id, { resolvedAt: new Date().toISOString() }, role);
      showToast('Mantención resuelta', { tone: 'success' });
    } catch (error) {
      await notifyDialog({ title: 'No se pudo resolver la mantención', message: error.message });
    }
  }

  async function handleDeleteMaintenance(id) {
    const confirmed = await confirmDialog({
      title: 'Eliminar mantención histórica',
      message: 'Esta acción elimina el registro de v2 y del calendario. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    try {
      store.deleteResolvedMaintenance(id, role);
      showToast('Mantención histórica eliminada', { tone: 'success' });
    } catch (error) {
      await notifyDialog({ title: 'No se pudo eliminar la mantención', message: error.message });
    }
  }

  function handleReviewHistory(workCenterId) {
    searches.history = workCenterName(workCenterId);
    root.querySelector('[data-role="maintenance-search-history"]').value = searches.history;
    activeTab = 'maintenances';
    historyWorkCenterId = workCenterId;
    renderAll();
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('[data-role="maintenance-tab"]')) {
      activeTab = button.getAttribute('data-tab');
      renderAll();
      return;
    }
    if (button.matches('[data-schedule-ticket]')) {
      openScheduleModal(button.getAttribute('data-schedule-ticket'));
      return;
    }
    if (button.matches('[data-role="review-history"]')) {
      handleReviewHistory(button.getAttribute('data-center'));
      return;
    }
    if (button.matches('[data-resolve-scheduled]')) {
      handleResolveScheduled(button.getAttribute('data-resolve-scheduled'));
      return;
    }
    if (button.matches('[data-delete-maintenance]')) {
      handleDeleteMaintenance(button.getAttribute('data-delete-maintenance'));
      return;
    }
    if (button.matches('[data-take]')) {
      openTakeModal(button.getAttribute('data-take'));
      return;
    }
    if (button.matches('[data-resolve]')) {
      openResolveModal(button.getAttribute('data-resolve'));
      return;
    }
    if (button.matches('[data-view]')) {
      selectedTicketId = button.getAttribute('data-view');
      renderAll();
      return;
    }
    if (button.matches('[data-preventive-create]')) {
      openPreventiveModal(button.getAttribute('data-center') || undefined);
      return;
    }
    if (button.matches('[data-preventive-action]')) {
      handlePreventiveAction(
        button.getAttribute('data-order'),
        button.getAttribute('data-preventive-action'),
      );
      return;
    }
    const row = button.closest('[data-ticket-row]');
    if (row) {
      selectedTicketId = row.getAttribute('data-ticket-row');
      renderAll();
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-role="filter-status"]')) {
      filters.status = target.value;
      renderAll();
    } else if (target.matches('[data-role="filter-priority"]')) {
      filters.priority = target.value;
      renderAll();
    } else if (target.matches('[data-role="filter-work-center"]')) {
      filters.workCenterId = target.value;
      renderAll();
    } else if (target.matches('[data-role="history-center"]')) {
      historyWorkCenterId = target.value;
      renderAll();
    } else if (target.matches('[data-role="machine-section-filter"]')) {
      machineSection = target.value;
      renderMachines();
    } else if (target.matches('[data-role="frequency-input"]')) {
      try {
        store.setRecommendedMaintenanceFrequency(target.dataset.center, target.value, role);
        showToast('Frecuencia recomendada actualizada', { tone: 'success' });
      } catch (error) {
        notifyDialog({ title: 'No se pudo actualizar la frecuencia', message: error.message });
      }
    }
  });

  root.addEventListener('input', (event) => {
    const target = event.target;
    const searchKey = {
      'maintenance-search-machines': 'machines',
      'maintenance-search-tickets': 'tickets',
      'maintenance-search-active': 'active',
      'maintenance-search-overdue': 'overdue',
      'maintenance-search-history': 'history',
    }[target.getAttribute('data-role')];
    if (!searchKey) return;
    searches[searchKey] = target.value;
    if (searchKey === 'machines') renderMachines();
    else if (searchKey === 'tickets') renderTickets();
    else renderMaintenances();
  });

  function renderAll() {
    renderTabs();
    renderFaultBanner();
    renderMachines();
    renderTickets();
    renderDetail();
    renderHistory();
    renderPreventives();
    renderMaintenances();
  }

  store.addEventListener('change', renderAll);
  renderAll();
  return root;
}
