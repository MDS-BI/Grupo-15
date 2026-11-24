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
  deriveWearIndicator,
  isResolvedMaintenance,
} from '../domain/maintenance.js';
import { buildMachineCalendarMonth } from '../domain/machine-calendar.js';
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
  paused: 'En mantención',
  changeover: 'En mantención',
  maintenance: 'En mantención',
};

const MACHINE_STATUS_OPTIONS = [
  ['', 'Todos'],
  ['available', 'Disponible'],
  ['in_operation', 'En operación'],
  ['maintenance', 'En mantención'],
  ['fault', 'Detenida / En fallo'],
];

const CALENDAR_LEGEND = [
  ['none', 'Sin plan'],
  ['corrective', 'Correctiva / Fallo'],
  ['planned_use', 'Orden de trabajo'],
  ['preventive', 'Preventiva'],
];

function pad(value) {
  return String(value).padStart(2, '0');
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

function currentCalendarMonth() {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @param {{role?: string}} [options]
 * @returns {HTMLElement}
 */
export function MaintenancePanel(store, { role = 'maintenance' } = {}) {
  let activeTab = 'machines';
  let selectedTicketId = null;
  let selectedMachineId = null;
  let calendarMonth = currentCalendarMonth();
  let machineSection = '';
  let machineStatus = '';
  let maintenanceStatus = 'todos';
  const searches = { machines: '', tickets: '', active: '', history: '' };

  const root = el(`
    <section class="view maintenance-view">
      <header class="view__header">
        <div>
          <h1>Mantenimiento</h1>
          <p class="view__subtitle">Máquinas, tickets y mantenciones programadas sincronizadas con el calendario.</p>
        </div>
      </header>

      <nav class="maintenance-tabs" role="tablist" aria-label="Secciones de mantenimiento">
        <button type="button" class="maintenance-tabs__tab" role="tab" data-role="maintenance-tab" data-tab="machines" aria-selected="true">
          <span class="maintenance-tabs__icon">${icon('maintenance')}</span><span>Máquinas</span>
        </button>
        <button type="button" class="maintenance-tabs__tab" role="tab" data-role="maintenance-tab" data-tab="tickets" aria-selected="false">
          <span class="maintenance-tabs__icon">${icon('orders')}</span><span>Tickets</span>
        </button>
        <button type="button" class="maintenance-tabs__tab" role="tab" data-role="maintenance-tab" data-tab="maintenances" aria-selected="false">
          <span class="maintenance-tabs__icon">${icon('scheduling')}</span><span>Mantenimientos</span>
        </button>
      </nav>

      <div class="maintenance-tabpanel" data-role="maintenance-tabpanel" data-panel="machines" role="tabpanel">
        <div class="maintenance-machines-layout" data-role="machines-layout">
          <section class="panel maintenance-machines-list" data-role="machines-list">
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
                <select data-role="machine-status-filter" aria-label="Filtrar por estado de máquina">
                  ${MACHINE_STATUS_OPTIONS.map(
                    ([value, label]) =>
                      `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`,
                  ).join('')}
                </select>
              </div>
            </header>
            <div class="panel__body">
              <div data-role="machine-alert" aria-live="polite"></div>
              <div class="table-wrap">
                <table class="data-table data-table--compact">
                  <thead><tr><th>Máquina</th><th>Código</th><th>Sección</th><th>Estado</th><th>Frecuencia recomendada</th><th>Desgaste</th></tr></thead>
                  <tbody data-role="machine-list"></tbody>
                </table>
              </div>
            </div>
          </section>
          <section class="panel maintenance-machine-detail" data-role="machine-detail" tabindex="-1" aria-live="polite"></section>
        </div>
        <div data-role="machine-calendar-container"></div>
      </div>

      <div class="maintenance-tabpanel" data-role="maintenance-tabpanel" data-panel="tickets" role="tabpanel" hidden>
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
                    <th>Creado</th><th>Evento de parada</th><th>Mantención</th>
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
        <section class="panel maintenance-block" data-role="maintenance-block-active">
          <header class="panel__header" data-role="maintenance-block-search" data-block="active">
            <h2>Mantenimientos activos</h2>
            <select data-role="maintenance-status-filter" aria-label="Filtrar por vigencia">
              <option value="todos">Todos</option>
              <option value="vigentes">Vigentes</option>
              <option value="vencidos">Vencidos</option>
            </select>
            <input type="search" class="maintenance-block__search" data-role="maintenance-search-active" aria-label="Buscar en Mantenimientos activos" placeholder="Buscar máquina o código" />
          </header>
          <div class="panel__body" data-role="maintenance-block-body-active"></div>
        </section>
        <section class="panel maintenance-block" data-role="maintenance-block-history">
          <header class="panel__header" data-role="maintenance-block-search" data-block="history">
            <h2>Mantenimientos históricos</h2>
            <input type="search" class="maintenance-block__search" data-role="maintenance-search-history" aria-label="Buscar en Mantenimientos históricos" placeholder="Buscar máquina o código" />
          </header>
          <div class="panel__body" data-role="maintenance-block-body-history"></div>
        </section>
      </div>

      <div class="modal-root" data-role="modal-root"></div>
    </section>`);

  const detailEl = root.querySelector('[data-role="machine-detail"]');
  const machinesLayoutEl = root.querySelector('[data-role="machines-layout"]');
  const machineListEl = root.querySelector('[data-role="machine-list"]');
  const machineAlertEl = root.querySelector('[data-role="machine-alert"]');
  const machineCalendarContainer = root.querySelector('[data-role="machine-calendar-container"]');
  const ticketListEl = root.querySelector('[data-role="ticket-list"]');
  const ticketCountEl = root.querySelector('[data-role="ticket-count"]');
  const ticketDetailEl = root.querySelector('[data-role="ticket-detail"]');
  const modalRoot = root.querySelector('[data-role="modal-root"]');

  function ticketById(id) {
    return store.maintenanceTickets.find((ticket) => ticket.id === id) || null;
  }

  function workCenterName(id) {
    const wc = store.workCenterById(id);
    return wc ? wc.name : id;
  }

  function machineById(id) {
    return store.workCenters.find((wc) => wc.id === id) || null;
  }

  function machineStatusOf(wc) {
    if (wc.operational_status === 'fault' || store.activeInterventionForWorkCenter(wc.id)) {
      return 'fault';
    }
    if (wc.operational_status === 'in_operation') return 'in_operation';
    if (
      ['paused', 'changeover', 'maintenance'].includes(wc.operational_status) ||
      store
        .preventiveOrdersFor({ workCenterId: wc.id })
        .some((order) => ['planned', 'in_progress'].includes(order.status))
    ) {
      return 'maintenance';
    }
    return 'available';
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

  function frequencyControl(wc, editable) {
    if (!editable) {
      const frequency = wc.recommended_maintenance_frequency_days;
      return `<span class="maint-code">${frequency ? `${escapeHtml(frequency)} días` : 'Sin frecuencia'}</span>`;
    }
    return `<input type="number" min="1" step="1" class="maintenance-frequency" data-role="frequency-input" data-center="${escapeHtml(
      wc.id,
    )}" value="${wc.recommended_maintenance_frequency_days ?? ''}" aria-label="Cada cuánto se recomienda mantención" placeholder="Días" />`;
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
        (!machineStatus || machineStatusOf(wc) === machineStatus) &&
        (matchesSearch(wc.name, searches.machines) ||
          matchesSearch(wc.code, searches.machines) ||
          matchesSearch(wc.station_type, searches.machines)),
    );
    machinesLayoutEl.classList.toggle('is-selected', Boolean(selectedMachineId));

    if (machines.length === 0) {
      machineListEl.innerHTML = `<tr><td colspan="6" class="empty-cell">Sin máquinas para la búsqueda.</td></tr>`;
      return;
    }
    machineListEl.innerHTML = machines
      .map((wc) => {
        const wear = deriveWearIndicator(store.maintenanceTickets, wc.id);
        const selected = wc.id === selectedMachineId;
        return `<tr class="${selected ? 'is-selected' : ''}" data-role="machine-row" data-machine-id="${escapeHtml(
          wc.id,
        )}" data-center="${escapeHtml(wc.id)}" tabindex="0" aria-expanded="${selected}">
          <td><strong>${escapeHtml(wc.name)}</strong></td>
          <td class="maint-code">${escapeHtml(wc.code || '—')}</td>
          <td>${escapeHtml(wc.station_type || '—')}</td>
          <td>${operationalBadge(wc.operational_status)}</td>
          <td>${frequencyControl(wc, canEditMaintenanceFrequency(role))}</td>
          <td>${wearBadge(wear.wear_level)} · ${fmtNumber(wear.failure_count)} falla(s) · ${formatDurationLong(
            wear.total_downtime_minutes,
          )}</td>
        </tr>`;
      })
      .join('');
  }

  function failureList(workCenterId) {
    const failures = store.maintenanceHistoryForWorkCenter(workCenterId);
    if (failures.length === 0) {
      return '<p class="empty-note">Sin fallas resueltas para esta máquina.</p>';
    }
    return `<ul class="maintenance-detail-list">${failures
      .map(
        (row) =>
          `<li><span class="maint-code">${escapeHtml(row.ticket_code)}</span> · ${formatLocalDate(
            row.resolved_at,
          )} · ${formatDurationLong(row.downtime_minutes || 0)}</li>`,
      )
      .join('')}</ul>`;
  }

  function renderMachineDetail() {
    if (!selectedMachineId) {
      detailEl.innerHTML = '';
      return;
    }
    const wc = machineById(selectedMachineId);
    if (!wc) {
      detailEl.innerHTML = '';
      selectedMachineId = null;
      return;
    }
    const wear = deriveWearIndicator(store.maintenanceTickets, wc.id);
    detailEl.innerHTML = `
      <header class="panel__header">
        <h2>${escapeHtml(wc.name)} ${operationalBadge(wc.operational_status)}</h2>
        <p class="panel__subtitle">${escapeHtml(wc.code || '—')} · ${escapeHtml(wc.station_type || '—')}</p>
      </header>
      <div class="panel__body">
        <dl class="detail-list">
          <div><dt>Cada cuánto se recomienda mantención</dt><dd>${frequencyControl(
            wc,
            canEditMaintenanceFrequency(role),
          )}</dd></div>
          <div><dt>Estado operativo</dt><dd>${operationalBadge(wc.operational_status)}</dd></div>
          <div><dt>Desgaste</dt><dd>${wearBadge(wear.wear_level)}</dd></div>
          <div><dt>Fallas resueltas</dt><dd>${fmtNumber(wear.failure_count)}</dd></div>
          <div><dt>Paradas acumuladas</dt><dd>${formatDurationLong(
            wear.total_downtime_minutes,
          )}</dd></div>
          <div><dt>MTTR</dt><dd>${formatDurationLong(wear.mttr_minutes)}</dd></div>
          <div><dt>Última falla</dt><dd class="nowrap">${fmtDateTime(wear.last_failure_at)}</dd></div>
        </dl>
        <section class="maintenance-detail-section">
          <h3>Historial de fallas</h3>
          ${failureList(wc.id)}
        </section>
        <div class="detail-actions">
          <button type="button" class="btn btn--small btn--primary" data-preventive-create data-center="${escapeHtml(
            wc.id,
          )}">Programar preventiva</button>
          <button type="button" class="btn btn--small" data-role="review-history" data-center="${escapeHtml(
            wc.id,
          )}">Revisar históricas</button>
          <button type="button" class="btn btn--small" data-role="deselect-machine">Deseleccionar ×</button>
        </div>
      </div>`;
  }

  function renderMachineCalendar() {
    if (!selectedMachineId) {
      machineCalendarContainer.className = '';
      machineCalendarContainer.innerHTML = '';
      return;
    }
    const monthKey = `${calendarMonth.year}-${pad(calendarMonth.month)}`;
    const calendar = buildMachineCalendarMonth({
      ...calendarMonth,
      tickets: store.maintenanceTickets,
      workOrders: store.calendarEventsForMonth(monthKey).filter((event) => event.kind === 'order'),
      preventiveOrders: store.preventiveMaintenanceOrders,
      workCenterId: selectedMachineId,
    });
    const label = new Intl.DateTimeFormat('es-CL', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(Date.UTC(calendarMonth.year, calendarMonth.month - 1, 1)));
    machineCalendarContainer.className = 'machine-calendar';
    machineCalendarContainer.innerHTML = `
      <header class="machine-calendar__header">
        <button type="button" class="btn btn--tiny" data-machine-calendar-nav="prev" aria-label="Mes anterior">‹</button>
        <strong data-role="machine-calendar-label">${escapeHtml(label)}</strong>
        <button type="button" class="btn btn--tiny" data-machine-calendar-nav="next" aria-label="Mes siguiente">›</button>
      </header>
      <div class="table-wrap">
        <table class="machine-calendar__grid">
          <thead><tr>${calendar.columns
            .map(
              (column) =>
                `<th class="machine-calendar__weekday" scope="col">${escapeHtml(column)}</th>`,
            )
            .join('')}</tr></thead>
          <tbody>
            ${calendar.weeks
              .map(
                (week) =>
                  `<tr>${week
                    .map(
                      (cell) =>
                        `<td class="machine-calendar__cell machine-calendar__cell--${escapeHtml(
                          cell.status,
                        )}${cell.inMonth ? '' : ' is-outside'}" data-machine-calendar-cell data-date="${escapeHtml(
                          cell.date,
                        )}" data-status="${escapeHtml(cell.status)}" title="${escapeHtml(
                          cell.date,
                        )}">${cell.day}</td>`,
                    )
                    .join('')}</tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="machine-calendar__legend">
        ${CALENDAR_LEGEND.map(
          ([status, labelText]) =>
            `<span class="machine-calendar__legend-item"><span class="machine-calendar__legend-swatch machine-calendar__legend-swatch--${escapeHtml(
              status,
            )}"></span>${escapeHtml(labelText)}</span>`,
        ).join('')}
      </div>`;
  }

  function scheduleButton(ticket) {
    const disabled = !canRescheduleMaintenance(role) || ticket.ticket_status === 'resolved';
    return `<button type="button" class="btn btn--small" data-schedule-ticket="${escapeHtml(
      ticket.id,
    )}" ${disabled ? 'disabled title="No se puede programar esta mantención"' : ''}>Programar mantención</button>`;
  }

  function renderTickets() {
    const tickets = store
      .maintenanceTicketsFor()
      .filter(
        (ticket) =>
          matchesSearch(ticket.ticket_code, searches.tickets) ||
          matchesSearch(workCenterName(ticket.work_center_id), searches.tickets) ||
          matchesSearch(ticket.description, searches.tickets),
      );
    ticketCountEl.textContent = `${tickets.length} ticket(s)`;
    if (tickets.length === 0) {
      ticketListEl.innerHTML = `<tr><td colspan="7" class="empty-cell">Sin tickets para la búsqueda.</td></tr>`;
      return;
    }
    ticketListEl.innerHTML = tickets
      .map((ticket) => {
        const active = ticket.id === selectedTicketId ? 'is-selected' : '';
        return `<tr class="${active}" data-ticket-row="${escapeHtml(ticket.id)}" tabindex="0" aria-expanded="${
          ticket.id === selectedTicketId
        }">
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
          <td class="cell--actions maintenance-ticket-actions">${scheduleButton(ticket)}</td>
        </tr>`;
      })
      .join('');
  }

  function renderTicketDetail() {
    const ticket = selectedTicketId ? ticketById(selectedTicketId) : null;
    if (!ticket) {
      ticketDetailEl.innerHTML = `<header class="panel__header"><h2>Detalle del ticket</h2></header>
        <div class="panel__body">
          <p class="empty-note">Selecciona un ticket de la bandeja para ver su detalle.</p>
        </div>`;
      return;
    }
    const wear = deriveWearIndicator(store.maintenanceTickets, ticket.work_center_id);
    const failures = store.maintenanceHistoryForWorkCenter(ticket.work_center_id);
    const fullHistory = (
      typeof store.maintenanceFeed === 'function' ? store.maintenanceFeed() : []
    ).filter((event) => event.work_center_id === ticket.work_center_id);
    ticketDetailEl.innerHTML = `
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
        <div class="detail-actions">${scheduleButton(ticket)}</div>
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
    const active = feed.filter((event) => !isResolvedMaintenance(event));
    const history = feed.filter((event) => isResolvedMaintenance(event));
    const filteredActive = active.filter((event) => {
      if (maintenanceStatus === 'vigentes') return !event.is_overdue;
      if (maintenanceStatus === 'vencidos') return Boolean(event.is_overdue);
      return true;
    });
    renderMaintenanceBlock({ key: 'active', title: 'Mantenimientos activos' }, filteredActive);
    renderMaintenanceBlock({ key: 'history', title: 'Mantenimientos históricos' }, history);
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
    const centerId = workCenterId || selectedMachineId;
    if (!centerId) return;
    const suggestion = buildPreventiveOrderFromHistory(
      store.maintenanceTickets,
      centerId,
      relativeDay(0),
    );
    const wear = deriveWearIndicator(store.maintenanceTickets, centerId);
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

  function selectMachine(id) {
    selectedMachineId = id;
    renderAll();
    detailEl.focus();
  }

  function deselectMachine() {
    if (!selectedMachineId) return;
    const previousId = selectedMachineId;
    selectedMachineId = null;
    renderAll();
    const row = [...machineListEl.querySelectorAll('[data-machine-id]')].find(
      (node) => node.dataset.machineId === previousId,
    );
    if (row) row.focus();
  }

  function handleReviewHistory(workCenterId) {
    const name = workCenterName(workCenterId);
    searches.history = name;
    activeTab = 'maintenances';
    renderAll();
    const input = root.querySelector('[data-role="maintenance-search-history"]');
    input.value = searches.history;
    input.focus();
  }

  function shiftCalendarMonth(delta) {
    const date = new Date(Date.UTC(calendarMonth.year, calendarMonth.month - 1 + delta, 1));
    calendarMonth = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
    renderMachineCalendar();
  }

  root.addEventListener('click', (event) => {
    const target = event.target;
    const button = target.closest('button');
    if (button?.matches('[data-machine-calendar-nav]')) {
      shiftCalendarMonth(button.getAttribute('data-machine-calendar-nav') === 'prev' ? -1 : 1);
      return;
    }
    if (button?.matches('[data-role="maintenance-tab"]')) {
      activeTab = button.getAttribute('data-tab');
      renderAll();
      return;
    }
    if (button?.matches('[data-role="deselect-machine"]')) {
      deselectMachine();
      return;
    }
    if (button?.matches('[data-preventive-create]')) {
      openPreventiveModal(button.getAttribute('data-center') || undefined);
      return;
    }
    if (button?.matches('[data-role="review-history"]')) {
      handleReviewHistory(button.getAttribute('data-center'));
      return;
    }
    if (button?.matches('[data-schedule-ticket]')) {
      openScheduleModal(button.getAttribute('data-schedule-ticket'));
      return;
    }
    if (button?.matches('[data-resolve-scheduled]')) {
      handleResolveScheduled(button.getAttribute('data-resolve-scheduled'));
      return;
    }
    if (button?.matches('[data-delete-maintenance]')) {
      handleDeleteMaintenance(button.getAttribute('data-delete-maintenance'));
      return;
    }
    const machineRow = target.closest('[data-role="machine-row"]');
    if (machineRow) {
      selectMachine(machineRow.getAttribute('data-machine-id'));
      return;
    }
    const ticketRow = target.closest('[data-ticket-row]');
    if (ticketRow) {
      selectedTicketId = ticketRow.getAttribute('data-ticket-row');
      renderTickets();
      renderTicketDetail();
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-role="machine-section-filter"]')) {
      machineSection = target.value;
      renderMachines();
    } else if (target.matches('[data-role="machine-status-filter"]')) {
      machineStatus = target.value;
      renderMachines();
    } else if (target.matches('[data-role="maintenance-status-filter"]')) {
      maintenanceStatus = target.value;
      renderMaintenances();
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
      'maintenance-search-history': 'history',
    }[target.getAttribute('data-role')];
    if (!searchKey) return;
    searches[searchKey] = target.value;
    if (searchKey === 'machines') renderMachines();
    else if (searchKey === 'tickets') renderTickets();
    else renderMaintenances();
  });

  document.addEventListener(
    'click',
    (event) => {
      if (!selectedMachineId) return;
      const target = event.target;
      if (!target.closest) return;
      if (
        target.closest(
          '.modal-backdrop, .modal, .confirm-dialog, [data-machine-calendar-nav], .maintenance-machines-list, .maintenance-machine-detail',
        )
      ) {
        return;
      }
      deselectMachine();
    },
    true,
  );

  function renderAll() {
    renderTabs();
    renderMachines();
    renderMachineDetail();
    renderMachineCalendar();
    renderTickets();
    renderTicketDetail();
    renderMaintenances();
  }

  store.addEventListener('change', renderAll);
  renderAll();
  return root;
}
