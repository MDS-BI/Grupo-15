/**
 * @file Panel de mantenimiento (US-09): bandeja priorizada, intervención,
 * cierre con marcas de parada, historial/desgaste y órdenes preventivas.
 * Ver contracts/maintenance.md §4.
 */

import {
  computeDowntimeMinutes,
  buildPreventiveOrderFromHistory,
} from '../domain/maintenance.js';
import { escapeHtml, el, fmtNumber } from './format.js';

const TICKET_STATUS_LABEL = {
  open: 'Abierto',
  in_progress: 'En intervención',
  resolved: 'Resuelto',
};

const PRIORITY_LABEL = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
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

function pad(value) {
  return String(value).padStart(2, '0');
}

function nowLocalInput() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function isoToLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function localToIso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function fmtDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

function priorityBadge(priority) {
  return `<span class="prio prio--${priority}">${PRIORITY_LABEL[priority] || priority}</span>`;
}

function ticketStatusBadge(status) {
  return `<span class="maint-badge maint-badge--${status}">${TICKET_STATUS_LABEL[status] || status}</span>`;
}

function preventiveStatusBadge(status) {
  return `<span class="maint-badge maint-badge--${status}">${
    PREVENTIVE_STATUS_LABEL[status] || status
  }</span>`;
}

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @returns {HTMLElement}
 */
export function MaintenancePanel(store) {
  let selectedTicketId = null;
  let historyWorkCenterId = null;
  const filters = { status: '', priority: '', workCenterId: '' };

  const root = el(`
    <section class="view maintenance-view">
      <header class="view__header">
        <div>
          <h1>Mantenimiento</h1>
          <p class="view__subtitle">Tickets correctivos, tiempos de parada y mantenimiento preventivo por máquina.</p>
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
                .map((wc) => `<option value="${wc.id}">${escapeHtml(wc.name)}</option>`)
                .join('')}
            </select>
          </label>
        </div>
      </header>

      <div data-role="fault-banner" aria-live="polite"></div>

      <section class="panel">
        <header class="panel__header">
          <h2>Bandeja de tickets</h2>
          <span class="panel__subtitle" data-role="ticket-count"></span>
        </header>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th><th>Centro</th><th>Prioridad</th><th>Estado</th>
                <th>Creado</th><th>Evento de parada</th><th>Acción</th>
              </tr>
            </thead>
            <tbody data-role="ticket-list"></tbody>
          </table>
        </div>
      </section>

      <div class="maintenance-grid">
        <section class="panel" data-role="ticket-detail"></section>
        <section class="panel" data-role="history"></section>
      </div>

      <section class="panel">
        <header class="panel__header">
          <h2>Órdenes de mantenimiento preventivo</h2>
          <button type="button" class="btn btn--small btn--primary" data-preventive-create>Programar preventiva</button>
        </header>
        <div data-role="preventive-list"></div>
      </section>

      <div class="modal-root" data-role="modal-root"></div>
    </section>`);

  const ticketListEl = root.querySelector('[data-role="ticket-list"]');
  const ticketCountEl = root.querySelector('[data-role="ticket-count"]');
  const faultBannerEl = root.querySelector('[data-role="fault-banner"]');
  const detailEl = root.querySelector('[data-role="ticket-detail"]');
  const historyEl = root.querySelector('[data-role="history"]');
  const preventiveListEl = root.querySelector('[data-role="preventive-list"]');
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

  function renderFaultBanner() {
    const active = store.maintenanceTickets.filter(
      (ticket) => ticket.ticket_status === 'in_progress'
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
            return `<div class="fault-banner__item" data-fault-ticket="${ticket.id}">
              <span>${escapeHtml(ticket.ticket_code)} · ${escapeHtml(
                workCenterName(ticket.work_center_id)
              )}</span>
              <span>Técnico: ${escapeHtml(ticket.technician_ext_hr_employee_id || '—')}</span>
              <span>Parada: ${minutes === null ? '—' : `${fmtNumber(minutes)} min`}</span>
            </div>`;
          })
          .join('')}
      </div>`;
  }

  function actionButton(ticket) {
    if (ticket.ticket_status === 'open') {
      const blocked = Boolean(store.activeInterventionForWorkCenter(ticket.work_center_id));
      return `<button type="button" class="btn btn--small btn--primary" data-take="${ticket.id}" ${
        blocked ? 'disabled title="El centro ya tiene una intervención activa"' : ''
      }>Tomar intervención</button>`;
    }
    if (ticket.ticket_status === 'in_progress') {
      return `<button type="button" class="btn btn--small btn--primary" data-resolve="${ticket.id}">Resolver</button>`;
    }
    return `<button type="button" class="btn btn--small" data-view="${ticket.id}">Ver historial</button>`;
  }

  function renderTickets() {
    const tickets = store.maintenanceTicketsFor(filters);
    ticketCountEl.textContent = `${tickets.length} ticket(s)`;
    if (tickets.length === 0) {
      ticketListEl.innerHTML = `<tr><td colspan="7" class="empty-cell">Sin tickets para los filtros seleccionados.</td></tr>`;
      return;
    }
    ticketListEl.innerHTML = tickets
      .map((ticket) => {
        const active = ticket.id === selectedTicketId ? 'is-selected' : '';
        return `<tr class="${active}" data-ticket-row="${ticket.id}">
          <td><strong>${escapeHtml(ticket.ticket_code)}</strong></td>
          <td>${escapeHtml(workCenterName(ticket.work_center_id))}</td>
          <td>${priorityBadge(ticket.priority)}</td>
          <td>${ticketStatusBadge(ticket.ticket_status)}</td>
          <td>${fmtDateTime(ticket.created_at)}</td>
          <td>${ticket.operation_delay_id ? escapeHtml(ticket.operation_delay_id) : '—'}</td>
          <td class="cell--actions">${actionButton(ticket)}</td>
        </tr>`;
      })
      .join('');
  }

  function renderDetail() {
    const ticket = selectedTicketId ? ticketById(selectedTicketId) : null;
    if (!ticket) {
      detailEl.innerHTML = `<header class="panel__header"><h2>Detalle del ticket</h2></header>
        <p class="empty-note">Selecciona un ticket de la bandeja para ver su detalle.</p>`;
      return;
    }
    detailEl.innerHTML = `
      <header class="panel__header">
        <h2>${escapeHtml(ticket.ticket_code)} ${ticketStatusBadge(ticket.ticket_status)}</h2>
        <p class="panel__subtitle">${escapeHtml(workCenterName(ticket.work_center_id))}</p>
      </header>
      <dl class="detail-list">
        <div><dt>Prioridad</dt><dd>${priorityBadge(ticket.priority)}</dd></div>
        <div><dt>Origen</dt><dd>${ticket.escalated_to_maint ? 'Escalado desde piso' : 'Registro manual'}</dd></div>
        <div><dt>Creado</dt><dd>${fmtDateTime(ticket.created_at)}</dd></div>
        <div><dt>Evento de parada</dt><dd>${escapeHtml(ticket.operation_delay_id || '—')}</dd></div>
        <div><dt>Técnico</dt><dd>${escapeHtml(ticket.technician_ext_hr_employee_id || '—')}</dd></div>
        <div><dt>Inicio intervención</dt><dd>${fmtDateTime(ticket.intervention_started_at)}</dd></div>
        <div><dt>Inicio parada</dt><dd>${fmtDateTime(ticket.downtime_started_at)}</dd></div>
        <div><dt>Fin parada</dt><dd>${fmtDateTime(ticket.downtime_ended_at)}</dd></div>
        <div><dt>Parada total</dt><dd>${
          ticket.downtime_minutes === null ? '—' : `${fmtNumber(ticket.downtime_minutes, 2)} min`
        }</dd></div>
        <div><dt>Resuelto</dt><dd>${fmtDateTime(ticket.resolved_at)}</dd></div>
      </dl>
      <p class="maintenance-description">${escapeHtml(ticket.description)}</p>
      ${
        ticket.resolution_notes
          ? `<p class="maintenance-description"><strong>Notas de cierre:</strong> ${escapeHtml(
              ticket.resolution_notes
            )}</p>`
          : ''
      }
      <div class="detail-actions">${actionButton(ticket)}</div>`;
  }

  function renderHistory() {
    const workCenterId = selectedWorkCenterId();
    if (!workCenterId) {
      historyEl.innerHTML = `<header class="panel__header"><h2>Historial y desgaste</h2></header>
        <p class="empty-note">Sin centros de trabajo disponibles.</p>`;
      return;
    }
    const history = store.maintenanceHistoryForWorkCenter(workCenterId);
    const wear = store.maintenanceIndicatorsForWorkCenter(workCenterId);

    const rows = history
      .map(
        (ticket) => `<tr>
          <td>${escapeHtml(ticket.ticket_code)}</td>
          <td>${fmtDateTime(ticket.resolved_at)}</td>
          <td>${fmtNumber(ticket.downtime_minutes || 0, 2)} min</td>
          <td>${escapeHtml(ticket.cause_reason_id || '—')}</td>
        </tr>`
      )
      .join('');

    historyEl.innerHTML = `
      <header class="panel__header">
        <h2>Historial y desgaste</h2>
        <select data-role="history-center" aria-label="Centro de trabajo del historial">
          ${store.workCenters
            .map(
              (wc) =>
                `<option value="${wc.id}" ${wc.id === workCenterId ? 'selected' : ''}>${escapeHtml(
                  wc.name
                )}</option>`
            )
            .join('')}
        </select>
      </header>
      <p class="context-note">Indicadores agregados por máquina · solo contexto operativo, no evaluación de desempeño.</p>
      <dl class="detail-list">
        <div><dt>Fallas resueltas</dt><dd>${fmtNumber(wear.failure_count)}</dd></div>
        <div><dt>Parada acumulada</dt><dd>${fmtNumber(wear.total_downtime_minutes, 2)} min</dd></div>
        <div><dt>MTTR</dt><dd>${fmtNumber(wear.mttr_minutes, 2)} min</dd></div>
        <div><dt>Desgaste</dt><dd><span class="wear wear--${wear.wear_level}">${
          WEAR_LABEL[wear.wear_level] || wear.wear_level
        }</span></dd></div>
      </dl>
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Ticket</th><th>Resuelto</th><th>Parada</th><th>Causa</th></tr></thead>
          <tbody>${
            rows || '<tr><td colspan="4" class="empty-cell">Sin fallos resueltos en esta máquina.</td></tr>'
          }</tbody>
        </table>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn btn--small" data-preventive-create data-center="${workCenterId}">Programar preventiva</button>
      </div>`;
  }

  function preventiveActions(order) {
    const buttons = [];
    if (order.status === 'planned') {
      buttons.push(
        `<button type="button" class="btn btn--small btn--primary" data-preventive-action="start" data-order="${order.id}">Iniciar</button>`
      );
    }
    if (order.status === 'in_progress') {
      buttons.push(
        `<button type="button" class="btn btn--small btn--primary" data-preventive-action="complete" data-order="${order.id}">Completar</button>`
      );
    }
    if (order.status === 'planned' || order.status === 'in_progress') {
      buttons.push(
        `<button type="button" class="btn btn--small" data-preventive-action="cancel" data-order="${order.id}">Cancelar</button>`
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
              .map(
                (order) => `<tr data-preventive-row="${order.id}">
                  <td><strong>${escapeHtml(order.order_code)}</strong></td>
                  <td>${escapeHtml(workCenterName(order.work_center_id))}</td>
                  <td>${escapeHtml(order.title)}</td>
                  <td>${escapeHtml(order.planned_date)}</td>
                  <td>${preventiveStatusBadge(order.status)}</td>
                  <td>${escapeHtml(order.source_ticket_id || '—')}</td>
                  <td class="cell--actions">${preventiveActions(order)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  function showModal(innerHtml) {
    modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${innerHtml}</div></div>`;
    const modal = modalRoot.querySelector('.modal');
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
            tech.specialty
          )}</option>`
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
    const startedValue = isoToLocalInput(ticket.downtime_started_at || ticket.intervention_started_at);
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
        preview.textContent = `${fmtNumber(minutes, 2)} min`;
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
      new Date().toISOString().slice(0, 10)
    );
    const wear = store.maintenanceIndicatorsForWorkCenter(centerId);
    const techOptions = store.technicians
      .map(
        (tech) =>
          `<option value="${escapeHtml(tech.ext_hr_employee_id)}">${escapeHtml(tech.name)}</option>`
      )
      .join('');
    showModal(`
      <h2 id="preventive-title">Programar preventiva · ${escapeHtml(workCenterName(centerId))}</h2>
      <form data-role="preventive-form" class="stack-form">
        <p class="context-note">Desgaste ${WEAR_LABEL[wear.wear_level] || wear.wear_level}: ${
          wear.failure_count
        } fallo(s), ${fmtNumber(wear.total_downtime_minutes, 2)} min de parada.</p>
        <label>Fecha objetivo
          <input type="date" name="plannedDate" value="${suggestion.planned_date}" required />
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
        const technician = form.querySelector(
          '[name="technician_ext_hr_employee_id"]'
        ).value;
        store.createPreventiveMaintenanceOrder({
          workCenterId: centerId,
          sourceTicketId: suggestion.source_ticket_id,
          plannedDate,
          title,
          technician_ext_hr_employee_id: technician || null,
        });
        closeModal();
      } catch (error) {
        errorEl.textContent = error.message;
      }
    });
  }

  function handlePreventiveAction(orderId, action) {
    try {
      if (action === 'start') {
        store.transitionPreventiveMaintenanceOrder(orderId, 'in_progress');
      } else if (action === 'complete') {
        store.transitionPreventiveMaintenanceOrder(orderId, 'completed');
      } else if (action === 'cancel') {
        const reason =
          typeof window !== 'undefined' && typeof window.prompt === 'function'
            ? window.prompt('Motivo de cancelación de la orden preventiva:') || ''
            : '';
        store.cancelPreventiveMaintenanceOrder(orderId, { reason });
      }
    } catch (error) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(error.message);
      }
    }
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
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
        button.getAttribute('data-preventive-action')
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
    }
  });

  function renderAll() {
    renderFaultBanner();
    renderTickets();
    renderDetail();
    renderHistory();
    renderPreventives();
  }

  store.addEventListener('change', renderAll);
  renderAll();
  return root;
}
