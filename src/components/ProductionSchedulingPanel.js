import { escapeHtml, el, formatLocalDate, orderStatusBadge, PRIORITY_LABEL } from './format.js';
import { icon } from './icons.js';
import { showToast } from './Toast.js';
import { CalendarEventDialog } from './calendar/CalendarEventDialog.js';
import {
  DEFAULT_CALENDAR_FILTER,
  canEditOrderSchedule,
  canViewOrderDetails,
  filterCalendarEvents,
} from '../domain/calendar-scheduling.js';

const MENU_ROLES = new Set(['planner', 'plant_manager', 'supervisor']);
const TRAY_ROLES = new Set(['planner', 'plant_manager']);
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function pad(value) {
  return String(value).padStart(2, '0');
}

function isoFromDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function shiftMonth(month, delta) {
  const [year, rawMonth] = month.split('-').map(Number);
  return isoFromDate(new Date(Date.UTC(year, rawMonth - 1 + delta, 1))).slice(0, 7);
}

function monthLabel(month) {
  const [year, rawMonth] = month.split('-').map(Number);
  const label = new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, rawMonth - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dateKeyInRange(key, event) {
  const start = event.start_date || event.end_date;
  const end = event.end_date || event.start_date;
  if (!start || !end) return false;
  return key >= start && key <= end;
}

function sortedRange(first, second) {
  if (!first) return null;
  if (!second || first <= second)
    return { start: first, end: first === second ? first : second || first };
  return { start: second, end: first };
}

function buildMonthCells(month, events) {
  const [year, rawMonth] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, rawMonth - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - offset);
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(gridStart);
    day.setUTCDate(gridStart.getUTCDate() + index);
    const key = isoFromDate(day);
    const dayEvents = events.filter((event) => dateKeyInRange(key, event));
    cells.push({ key, outside: day.getUTCMonth() !== rawMonth - 1, events: dayEvents });
  }
  return cells;
}

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @param {{role?:string, operatorId?:string}} options
 * @returns {HTMLElement}
 */
export function ProductionSchedulingPanel(store, options = {}) {
  const role = String(options.role || 'planner');
  const operatorId =
    options.operatorId ||
    (role === 'operator'
      ? store.hrEmployees.find((employee) => employee.role === 'operator')?.ext_hr_employee_id ||
        null
      : null);

  const state = {
    view: 'calendar',
    month: currentMonthKey(),
    kindFilter: DEFAULT_CALENDAR_FILTER,
    focusOrderId: null,
    dragStart: null,
    dragEnd: null,
    dayMenuDate: null,
    selectedEventId: null,
    popup: null,
    suppressDayClick: false,
    pointer: { x: 0, y: 0 },
  };

  const root = el(`
    <section class="view scheduling-view">
      <header class="view__header">
        <div>
          <h1>Planificación de Producción</h1>
          <p class="view__subtitle" data-role="view-subtitle"></p>
        </div>
        <div class="inline-actions">
          <span class="badge badge--muted" data-summary="planned">Planificadas: 0</span>
          <span class="badge badge--warn" data-summary="unplanned">Sin fechas: 0</span>
          <span class="badge badge--danger" data-summary="overdue">Atrasadas: 0</span>
        </div>
      </header>
      <nav class="tab-bar scheduling-tabs" data-role="view-tabs" aria-label="Vistas de planificación">
        <button type="button" class="tab-bar__btn" data-view="calendar">Calendario</button>
        ${
          role === 'operator'
            ? ''
            : '<button type="button" class="tab-bar__btn" data-view="list">Listado</button>'
        }
      </nav>
      <div class="scheduling-calendar" data-role="calendar-view">
        <div class="calendar-toolbar">
          <div class="calendar-month-nav">
            <button type="button" class="btn btn--tiny" data-month-nav="prev" aria-label="Mes anterior">‹</button>
            <strong data-month-label></strong>
            <button type="button" class="btn btn--tiny" data-month-nav="next" aria-label="Mes siguiente">›</button>
            <button type="button" class="btn btn--tiny" data-month-nav="today">Hoy</button>
          </div>
          <label class="inline-field">Tipo
            <select data-role="calendar-filter">
              <option value="Ambos">Ambos</option>
              <option value="Solo Órdenes de Trabajo">Solo Órdenes de Trabajo</option>
              <option value="Solo Mantenciones">Solo Mantenciones</option>
            </select>
          </label>
        </div>
        <div class="executive-summary" data-role="executive-summary" hidden></div>
        <div class="calendar-layout">
          <aside class="pending-tray" data-role="pending-tray" hidden></aside>
          <div class="calendar-main">
            <div class="calendar-weekdays">
              ${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}
            </div>
            <div class="calendar-grid" data-role="calendar-grid"></div>
            <p class="calendar-hint" data-role="drag-hint" hidden>
              Clic derecho para salir del modo selección de horario.
            </p>
            <div class="calendar-day-menu" data-role="day-menu" hidden></div>
            <div class="calendar-dialog-slot" data-role="event-dialog-slot"></div>
          </div>
        </div>
        <div class="scheduling-focus-backdrop" data-role="focus-backdrop" hidden></div>
        <div class="scheduling-floating-card" data-role="floating-card" hidden>
          <strong data-role="floating-title"></strong>
          <span>Arrastre sobre los días para elegir el rango.</span>
        </div>
        <div class="schedule-popup" data-role="schedule-popup" hidden>
          <h3>Nuevo rango horario</h3>
          <div class="schedule-popup__fields">
            <label>Inicio
              <input type="time" data-schedule-time="start" value="08:00" />
            </label>
            <label>Término
              <input type="time" data-schedule-time="end" value="16:00" />
            </label>
          </div>
          <p class="schedule-popup__range" data-role="schedule-range"></p>
          <div class="schedule-popup__actions">
            <button type="button" class="btn btn--tiny btn--primary" data-schedule-save>Guardar</button>
            <button type="button" class="btn btn--tiny" data-schedule-cancel>Cancelar</button>
            <span class="form-error" data-error="schedule" role="alert"></span>
          </div>
        </div>
      </div>
      <article class="panel" data-role="list-view" hidden>
        <div class="panel__body">
          <div class="filter-row">
            <label class="inline-field">Estado
              <select data-role="filter-status">
                <option value="">Abiertas</option>
                <option value="planned">Planificada</option>
                <option value="released">Liberada</option>
                <option value="in_progress">En Proceso</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </label>
            <label class="inline-field">Desde
              <input type="date" data-role="filter-from" />
            </label>
            <label class="inline-field">Hasta
              <input type="date" data-role="filter-to" />
            </label>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Orden</th><th>Producto</th><th>Estado</th><th>Prioridad</th><th>Inicio</th><th>Término</th><th></th></tr>
              </thead>
              <tbody data-role="rows"></tbody>
            </table>
          </div>
          <p class="empty-note" data-role="empty" hidden>Sin órdenes para los filtros seleccionados.</p>
        </div>
      </article>
    </section>`);

  const calendarView = root.querySelector('[data-role="calendar-view"]');
  const listView = root.querySelector('[data-role="list-view"]');
  const rowsEl = root.querySelector('[data-role="rows"]');
  const emptyEl = root.querySelector('[data-role="empty"]');
  const statusFilter = root.querySelector('[data-role="filter-status"]');
  const fromFilter = root.querySelector('[data-role="filter-from"]');
  const toFilter = root.querySelector('[data-role="filter-to"]');
  const monthLabelEl = root.querySelector('[data-month-label]');
  const kindFilter = root.querySelector('[data-role="calendar-filter"]');
  const executiveSummaryEl = root.querySelector('[data-role="executive-summary"]');
  const trayEl = root.querySelector('[data-role="pending-tray"]');
  const gridEl = root.querySelector('[data-role="calendar-grid"]');
  const hintEl = root.querySelector('[data-role="drag-hint"]');
  const dayMenuEl = root.querySelector('[data-role="day-menu"]');
  const dialogSlotEl = root.querySelector('[data-role="event-dialog-slot"]');
  const backdropEl = root.querySelector('[data-role="focus-backdrop"]');
  const floatingEl = root.querySelector('[data-role="floating-card"]');
  const popupEl = root.querySelector('[data-role="schedule-popup"]');
  const filters = { status: '', dateFrom: '', dateTo: '' };

  if (!canEditOrderSchedule(role)) popupEl.remove();

  function assignedOrderIds() {
    if (!operatorId) return [];
    const centers = new Set(
      store.shiftAssignments
        .filter((row) => row.active && row.ext_hr_employee_id === operatorId)
        .map((row) => row.work_center_id),
    );
    return store.productionOrders
      .filter((order) =>
        store
          .operationsForOrder(order.id)
          .some(
            (operation) =>
              operation.operator_id === operatorId || centers.has(operation.work_center_id),
          ),
      )
      .map((order) => order.id);
  }

  function visibleEvents() {
    const events = store.calendarEventsForMonth(state.month);
    const filtered = filterCalendarEvents(events, { kind: state.kindFilter });
    if (role !== 'operator') return filtered;
    const assigned = assignedOrderIds();
    return filtered.filter(
      (event) =>
        event.kind === 'maintenance' ||
        canViewOrderDetails(role, event, { operatorId, assignedOrderIds: assigned }),
    );
  }

  function renderSummary() {
    const summary = store.orderScheduleSummary();
    root.querySelector('[data-summary="planned"]').textContent = `Planificadas: ${summary.planned}`;
    root.querySelector('[data-summary="unplanned"]').textContent =
      `Sin fechas: ${summary.unplanned}`;
    root.querySelector('[data-summary="overdue"]').textContent = `Atrasadas: ${summary.overdue}`;
  }

  function renderViews() {
    calendarView.hidden = state.view !== 'calendar';
    listView.hidden = state.view !== 'list';
    root.querySelector('[data-role="view-subtitle"]').textContent =
      state.view === 'calendar'
        ? 'Calendario mensual de órdenes y mantenciones programadas.'
        : 'Fechas planificadas por orden. Las órdenes cerradas no admiten cambios.';
    for (const button of root.querySelectorAll('[data-view]')) {
      const active = button.dataset.view === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    }
  }

  function renderExecutiveSummary() {
    if (role !== 'plant_manager') {
      executiveSummaryEl.hidden = true;
      executiveSummaryEl.innerHTML = '';
      return;
    }
    const activeOrders = store.productionOrders.filter(
      (order) => order.status !== 'completed' && order.status !== 'cancelled',
    );
    const products = new Set(
      activeOrders.map((order) => store.productById(order.product_id)?.name || order.product_id),
    );
    const target = activeOrders.reduce(
      (sum, order) => sum + Number(order.quantity_planned || 0),
      0,
    );
    const activeMachines = store.workCenters.filter(
      (center) => center.status !== 'inactive',
    ).length;
    const inactiveMachines = store.workCenters.length - activeMachines;
    const operators = store.hrEmployees.filter((employee) => employee.role === 'operator').length;
    executiveSummaryEl.hidden = false;
    executiveSummaryEl.innerHTML = `
      <span><strong>Productos:</strong> ${products.size}</span>
      <span><strong>Meta:</strong> ${target} u.</span>
      <span><strong>Máquinas activas:</strong> ${activeMachines}</span>
      <span><strong>Máquinas inactivas:</strong> ${inactiveMachines}</span>
      <span><strong>Operadores:</strong> ${operators}</span>`;
  }

  function renderTray() {
    if (!TRAY_ROLES.has(role)) {
      trayEl.hidden = true;
      trayEl.innerHTML = '';
      return;
    }
    const pending = store.pendingSchedulingOrders();
    trayEl.hidden = false;
    trayEl.innerHTML = `
      <header class="pending-tray__header">
        <h2>Pendiente de horario</h2>
        <span class="badge badge--warn">${pending.length}</span>
      </header>
      ${
        pending.length
          ? pending
              .map((order) => {
                const focusButton =
                  role === 'planner'
                    ? `<button type="button" class="pending-tray__focus" data-focus-order="${escapeHtml(order.id)}">${icon('scheduling')} ${escapeHtml(order.order_number)}</button>`
                    : `<strong>${escapeHtml(order.order_number)}</strong>`;
                return `<div class="pending-tray__row" data-pending-order="${escapeHtml(order.id)}">
                  <div class="pending-tray__main">
                    ${focusButton}
                    <span>${escapeHtml(order['% de avance'])} de avance</span>
                    <span class="badge badge--${escapeHtml(order.is_critical_urgent ? 'danger' : 'muted')}">
                      ${order.is_critical_urgent ? 'Urgencia crítica' : `Prioridad: ${escapeHtml(PRIORITY_LABEL[order.priority] || order.priority)}`}
                    </span>
                  </div>
                  ${
                    role === 'plant_manager'
                      ? `<div class="pending-tray__controls">
                          <select data-priority-control="${escapeHtml(order.id)}" aria-label="Prioridad de ${escapeHtml(order.order_number)}">
                            ${Object.entries(PRIORITY_LABEL)
                              .map(
                                ([value, label]) =>
                                  `<option value="${escapeHtml(value)}" ${order.priority === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
                              )
                              .join('')}
                          </select>
                          <label class="pending-tray__critical">
                            <input type="checkbox" data-critical-toggle="${escapeHtml(order.id)}" ${order.is_critical_urgent ? 'checked' : ''} />
                            Urgencia crítica
                          </label>
                        </div>`
                      : ''
                  }
                </div>`;
              })
              .join('')
          : '<p class="empty-note">No hay órdenes pendientes de horario.</p>'
      }`;
  }

  function renderGrid(events) {
    const cells = buildMonthCells(state.month, events);
    const today = new Date().toISOString().slice(0, 10);
    gridEl.innerHTML = cells
      .map((cell) => {
        const chips = cell.events
          .map(
            (
              event,
            ) => `<button type="button" class="calendar-event-chip ${event.is_critical_urgent ? 'calendar-event-chip--critical' : ''}" data-event-kind="${escapeHtml(event.kind)}" data-event-id="${escapeHtml(event.id)}" title="${escapeHtml(event.title)}">
              ${icon(event.kind === 'order' ? 'scheduling' : 'maintenance')}
              <span>${escapeHtml(event.title)}</span>
            </button>`,
          )
          .join('');
        const indicators =
          role === 'plant_manager'
            ? `<span class="calendar-day__indicators">
                ${cell.events.some((event) => event.kind === 'order') ? '<i data-indicator="order"></i>' : ''}
                ${cell.events.some((event) => event.kind === 'maintenance') ? '<i data-indicator="maintenance"></i>' : ''}
              </span>`
            : '';
        return `<div class="calendar-day ${cell.outside ? 'calendar-day--outside' : ''} ${cell.key === today ? 'calendar-day--today' : ''}" data-date="${cell.key}" role="button" tabindex="0" draggable="${role === 'planner' || role === 'plant_manager' ? 'true' : 'false'}">
          <span class="calendar-day__number">${Number(cell.key.slice(-2))}</span>
          ${indicators}
          <span class="calendar-day__events">${chips}</span>
        </div>`;
      })
      .join('');
    renderDragHighlight();
  }

  function renderDragHighlight() {
    const range = sortedRange(state.dragStart, state.dragEnd);
    for (const cell of gridEl.querySelectorAll('.calendar-day')) {
      const active = Boolean(
        range && cell.dataset.date >= range.start && cell.dataset.date <= range.end,
      );
      cell.classList.toggle('calendar-day--drag-range', active);
    }
  }

  function renderDayMenu(events) {
    if (!state.dayMenuDate || state.selectedEventId || !MENU_ROLES.has(role)) {
      dayMenuEl.hidden = true;
      dayMenuEl.innerHTML = '';
      return;
    }
    const dayEvents = events.filter((event) => dateKeyInRange(state.dayMenuDate, event));
    dayMenuEl.hidden = false;
    dayMenuEl.innerHTML = `
      <header class="calendar-day-menu__header">
        <h3>Tareas del ${escapeHtml(formatLocalDate(state.dayMenuDate))}</h3>
        <button type="button" class="btn btn--tiny" data-day-menu-close aria-label="Cerrar lista">×</button>
      </header>
      ${
        dayEvents.length
          ? dayEvents
              .map(
                (
                  event,
                ) => `<button type="button" class="calendar-day-menu__item" data-event-id="${escapeHtml(event.id)}">
                  ${icon(event.kind === 'order' ? 'scheduling' : 'maintenance')}
                  <span>${escapeHtml(event.title)}</span>
                  <small>${escapeHtml(event.start_time || '08:00')} - ${escapeHtml(event.end_time || '16:00')}</small>
                </button>`,
              )
              .join('')
          : '<p class="empty-note">Sin tareas para este día.</p>'
      }`;
  }

  function renderDialog(events) {
    const event = events.find((candidate) => candidate.id === state.selectedEventId);
    if (!event) {
      dialogSlotEl.innerHTML = '';
      return;
    }
    dialogSlotEl.innerHTML = '';
    dialogSlotEl.appendChild(
      CalendarEventDialog({
        event,
        role,
        store,
        operatorId,
        onBack: () => {
          state.selectedEventId = null;
          state.dayMenuDate = event.start_date;
          renderCalendar();
        },
      }),
    );
  }

  function renderFocus() {
    const active = Boolean(state.focusOrderId);
    backdropEl.hidden = !active;
    floatingEl.hidden = !active;
    hintEl.hidden = !active;
    if (!active) return;
    const order = store.orderById(state.focusOrderId);
    root.querySelector('[data-role="floating-title"]').textContent =
      order?.order_number || state.focusOrderId;
    floatingEl.style.left = `${state.pointer.x + 14}px`;
    floatingEl.style.top = `${state.pointer.y + 14}px`;
  }

  function renderPopup() {
    if (!state.popup) {
      popupEl.hidden = true;
      return;
    }
    popupEl.hidden = false;
    popupEl.querySelector('[data-schedule-time="start"]').value = state.popup.startTime;
    popupEl.querySelector('[data-schedule-time="end"]').value = state.popup.endTime;
    popupEl.querySelector('[data-role="schedule-range"]').textContent =
      `${formatLocalDate(state.popup.startDate)} al ${formatLocalDate(state.popup.endDate)}`;
  }

  function renderCalendar() {
    monthLabelEl.textContent = monthLabel(state.month);
    kindFilter.value = state.kindFilter;
    const events = visibleEvents();
    renderExecutiveSummary();
    renderTray();
    renderGrid(events);
    renderDayMenu(events);
    renderDialog(events);
    renderFocus();
    renderPopup();
  }

  function renderRows() {
    const orders = store.ordersForScheduling({
      status: filters.status || null,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    });
    emptyEl.hidden = orders.length > 0;
    rowsEl.innerHTML = orders
      .map((order) => {
        const closed = order.status === 'completed' || order.status === 'cancelled';
        const product = store.productById(order.product_id);
        return `<tr data-order="${escapeHtml(order.id)}">
          <td>${escapeHtml(order.order_number)}</td>
          <td>${escapeHtml(product ? product.name : order.product_id)}</td>
          <td>${orderStatusBadge(order.status)}</td>
          <td>${escapeHtml(PRIORITY_LABEL[order.priority] || order.priority)}</td>
          <td><input type="date" data-date="start" data-order="${escapeHtml(order.id)}" value="${escapeHtml(order.planned_start_date || '')}" ${closed ? 'disabled' : ''} /></td>
          <td><input type="date" data-date="end" data-order="${escapeHtml(order.id)}" value="${escapeHtml(order.planned_end_date || '')}" ${closed ? 'disabled' : ''} /></td>
          <td class="row-actions">
            <button type="button" class="btn btn--tiny btn--primary" data-save="${escapeHtml(order.id)}" ${closed ? 'disabled' : ''}>Guardar</button>
            <button type="button" class="btn btn--tiny" data-clear="${escapeHtml(order.id)}" ${closed ? 'disabled' : ''}>Limpiar</button>
            <span class="form-error" data-error="${escapeHtml(order.id)}" role="alert"></span>
          </td>
        </tr>`;
      })
      .join('');
  }

  function saveListDates(orderId, clear = false) {
    const startInput = rowsEl.querySelector(`[data-date="start"][data-order="${orderId}"]`);
    const endInput = rowsEl.querySelector(`[data-date="end"][data-order="${orderId}"]`);
    const errorEl = rowsEl.querySelector(`[data-error="${orderId}"]`);
    try {
      store.updatePlannedDates(orderId, {
        planned_start_date: clear ? null : startInput.value || null,
        planned_end_date: clear ? null : endInput.value || null,
      });
      errorEl.textContent = '';
      showToast(clear ? 'Fechas eliminadas' : 'Fechas guardadas', { tone: 'success' });
      render();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  function openPopup() {
    if (!state.focusOrderId || !state.dragStart) return;
    const range = sortedRange(state.dragStart, state.dragEnd);
    state.popup = {
      startDate: range.start,
      endDate: range.end,
      startTime: '08:00',
      endTime: '16:00',
      orderId: state.focusOrderId,
    };
    state.focusOrderId = null;
    state.dragStart = null;
    state.dragEnd = null;
    state.suppressDayClick = true;
    renderCalendar();
  }

  function clearFocus() {
    state.focusOrderId = null;
    state.dragStart = null;
    state.dragEnd = null;
    state.popup = null;
    renderCalendar();
  }

  function savePopup() {
    if (!state.popup) return;
    const errorEl = popupEl.querySelector('[data-error="schedule"]');
    try {
      store.scheduleOrderRange(
        state.popup.orderId,
        {
          startDate: state.popup.startDate,
          endDate: state.popup.endDate,
          startTime: popupEl.querySelector('[data-schedule-time="start"]').value,
          endTime: popupEl.querySelector('[data-schedule-time="end"]').value,
        },
        role,
      );
      state.popup = null;
      errorEl.textContent = '';
      showToast('Horario guardado', { tone: 'success' });
      render();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  function render() {
    renderSummary();
    renderViews();
    renderCalendar();
    renderRows();
  }

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (state.suppressDayClick) {
      state.suppressDayClick = false;
      if (target.closest('.calendar-day')) return;
    }
    const viewButton = target.closest('[data-view]');
    if (viewButton) {
      state.view = viewButton.dataset.view;
      renderViews();
      return;
    }
    const navButton = target.closest('[data-month-nav]');
    if (navButton) {
      if (navButton.dataset.monthNav === 'today') state.month = currentMonthKey();
      else state.month = shiftMonth(state.month, navButton.dataset.monthNav === 'next' ? 1 : -1);
      state.dayMenuDate = null;
      state.selectedEventId = null;
      renderCalendar();
      return;
    }
    const focusButton = target.closest('[data-focus-order]');
    if (focusButton && role === 'planner') {
      state.focusOrderId = focusButton.dataset.focusOrder;
      state.dragStart = null;
      state.dragEnd = null;
      state.popup = null;
      state.dayMenuDate = null;
      state.selectedEventId = null;
      state.pointer = { x: event.clientX || 0, y: event.clientY || 0 };
      renderCalendar();
      return;
    }
    if (target.closest('[data-schedule-save]')) {
      savePopup();
      return;
    }
    if (target.closest('[data-schedule-cancel]')) {
      clearFocus();
      return;
    }
    if (target.closest('[data-day-menu-close]')) {
      state.dayMenuDate = null;
      renderCalendar();
      return;
    }
    const eventButton = target.closest('[data-event-id]');
    if (eventButton) {
      state.selectedEventId = eventButton.dataset.eventId;
      renderCalendar();
      return;
    }
    const saveButton = target.closest('[data-save]');
    if (saveButton) {
      saveListDates(saveButton.dataset.save);
      return;
    }
    const clearButton = target.closest('[data-clear]');
    if (clearButton) {
      saveListDates(clearButton.dataset.clear, true);
      return;
    }
    const dayCell = target.closest('.calendar-day');
    if (dayCell && MENU_ROLES.has(role) && !state.focusOrderId && !state.popup) {
      state.dayMenuDate = dayCell.dataset.date;
      state.selectedEventId = null;
      renderCalendar();
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (target === kindFilter) {
      state.kindFilter = target.value;
      state.selectedEventId = null;
      renderCalendar();
      return;
    }
    if (target === statusFilter) {
      filters.status = target.value;
      renderRows();
      return;
    }
    if (target === fromFilter) {
      filters.dateFrom = target.value;
      renderRows();
      return;
    }
    if (target === toFilter) {
      filters.dateTo = target.value;
      renderRows();
      return;
    }
    const priorityControl = target.closest('[data-priority-control]');
    if (priorityControl && role === 'plant_manager') {
      try {
        store.setOrderPriority(
          priorityControl.dataset.priorityControl,
          priorityControl.value,
          role,
        );
        showToast('Prioridad actualizada', { tone: 'success' });
      } catch (err) {
        showToast(err.message, { tone: 'danger' });
      }
      return;
    }
    const criticalToggle = target.closest('[data-critical-toggle]');
    if (criticalToggle && role === 'plant_manager') {
      try {
        store.setCriticalUrgent(criticalToggle.dataset.criticalToggle, target.checked, role);
        showToast('Urgencia crítica actualizada', { tone: 'success' });
      } catch (err) {
        showToast(err.message, { tone: 'danger' });
      }
    }
  });

  root.addEventListener('mousemove', (event) => {
    if (!state.focusOrderId) return;
    state.pointer = { x: event.clientX, y: event.clientY };
    floatingEl.style.left = `${event.clientX + 14}px`;
    floatingEl.style.top = `${event.clientY + 14}px`;
  });

  function startDrag(event) {
    if (!state.focusOrderId) return;
    const dayCell = event.target.closest('.calendar-day');
    if (!dayCell) return;
    state.dragStart = dayCell.dataset.date;
    state.dragEnd = dayCell.dataset.date;
    renderDragHighlight();
  }

  function extendDrag(event) {
    if (!state.focusOrderId || !state.dragStart) return;
    const dayCell = event.target.closest('.calendar-day');
    if (!dayCell) return;
    state.dragEnd = dayCell.dataset.date;
    renderDragHighlight();
  }

  root.addEventListener('mousedown', startDrag);
  root.addEventListener('mouseover', extendDrag);
  root.addEventListener('mouseenter', extendDrag, true);
  root.addEventListener('mouseup', () => openPopup());
  document.addEventListener('mouseup', () => openPopup());

  root.addEventListener('contextmenu', (event) => {
    if (!event.target.closest('.scheduling-calendar')) return;
    event.preventDefault();
    clearFocus();
  });

  store.addEventListener('change', render);
  render();
  return root;
}
