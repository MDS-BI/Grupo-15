import {
  el,
  escapeHtml,
  formatDurationLong,
  formatLocalDate,
  ORDER_STATUS_LABEL,
  PRIORITY_LABEL,
} from '../format.js';
import { icon } from '../icons.js';
import { showToast } from '../Toast.js';
import { workCenterLabel } from '../labels.js';
import { canEditOrderSchedule } from '../../domain/calendar-scheduling.js';
import { canResolveScheduledMaintenance, isResolvedMaintenance } from '../../domain/maintenance.js';

const SC08_NOTE = 'solo contexto operativo — no evaluación de desempeño';

function pad(value) {
  return String(value).padStart(2, '0');
}

function nowLocalInput() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function localToIso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function displayName(name, role, fallback) {
  if (!name) return fallback;
  if (role === 'supervisor' || role === 'plant_manager' || role === 'maintenance') return name;
  return String(name)
    .split(' ')
    .map((part) => `${part.charAt(0)}.`)
    .join(' ');
}

function detailRow(label, value) {
  return `<div class="calendar-dialog__detail"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

/**
 * @param {{event:Object, role?:string, store:Object, onBack?:Function, onClose?:Function}} options
 * @returns {HTMLElement}
 */
export function CalendarEventDialog({ event, role = 'planner', store, onBack, onClose } = {}) {
  const isOrder = event?.kind === 'order';
  const isMaintenance = event?.kind === 'maintenance';
  const maintenanceResolved = isMaintenance && isResolvedMaintenance(event);
  const canResolveMaintenance =
    isMaintenance && role === 'maintenance' && canResolveScheduledMaintenance(event);
  const editable = Boolean(
    isOrder && canEditOrderSchedule(role) && !['completed', 'cancelled'].includes(event.status),
  );
  const kindLabel = isOrder ? 'Orden de trabajo' : 'Mantención';
  const personLabel = isOrder ? 'Operador' : 'Técnico';
  const personName = isOrder ? event.operator_name : event.technician_name;
  const personFallback = isOrder ? 'sin operador asignado' : 'sin técnico asignado';
  const canEditStations = isOrder && ['supervisor', 'plant_manager'].includes(role);
  const stations =
    isOrder && typeof store?.orderStationsFor === 'function'
      ? store.orderStationsFor(event.sourceId)
      : [];
  const stationRows = stations
    .map((station) => {
      const name = workCenterLabel(store, station.work_center_id);
      const workers = station.operator_ext_hr_employee_ids?.length || 0;
      const title = `Estación derivada de la ruta/BOM · ${name} · Secuencia ${station.sequence}`;
      return `<li class="calendar-dialog__station" data-role="order-station" title="${escapeHtml(title)}">
        <span class="calendar-dialog__station-sequence">Secuencia ${escapeHtml(String(station.sequence))}</span>
        <span class="calendar-dialog__station-name">${escapeHtml(name)}</span>
        <span class="calendar-dialog__station-workers">${workers} trabajador${workers === 1 ? '' : 'es'}</span>
      </li>`;
    })
    .join('');

  const root = el(`
    <section class="calendar-dialog" data-role="event-dialog" aria-label="Detalle de tarea" draggable="false">
      <header class="calendar-dialog__header">
        <div>
          <p class="calendar-dialog__kind">${icon(isOrder ? 'scheduling' : 'maintenance')} ${escapeHtml(kindLabel)}</p>
          <h2>${escapeHtml(event?.title || 'Sin tarea')}</h2>
        </div>
        <button type="button" class="btn btn--tiny" data-role="event-back">Volver a la lista del día</button>
      </header>
      <div class="calendar-dialog__body">
        <dl class="calendar-dialog__details">
          ${detailRow('Fecha', `${escapeHtml(formatLocalDate(event?.start_date))} al ${escapeHtml(formatLocalDate(event?.end_date))}`)}
          ${detailRow('Horario', `${escapeHtml(event?.start_time || '08:00')} - ${escapeHtml(event?.end_time || '16:00')}`)}
          ${detailRow('Centro de trabajo', escapeHtml(event?.work_center_name || event?.work_center_id || '—'))}
          ${
            isOrder
              ? detailRow(
                  'Estado',
                  escapeHtml(ORDER_STATUS_LABEL[event?.status] || event?.status || '—'),
                )
              : detailRow(
                  'Tipo',
                  escapeHtml(event?.maintenanceType === 'preventive' ? 'Preventiva' : 'Correctiva'),
                )
          }
          ${detailRow('Prioridad', escapeHtml(PRIORITY_LABEL[event?.priority] || event?.priority || '—'))}
          ${
            isMaintenance && !maintenanceResolved
              ? detailRow('Tiempo parado', escapeHtml(formatDurationLong(event?.downtime_minutes)))
              : ''
          }
          ${detailRow(personLabel, escapeHtml(displayName(personName, role, personFallback)))}
        </dl>
        ${
          isOrder && stationRows
            ? `<div class="calendar-dialog__stations">
                <h3 class="calendar-dialog__stations-title">Estaciones de la orden</h3>
                <p class="calendar-dialog__stations-hint">Secuencia según receta/ruta; una estación equivale a una máquina.</p>
                <ul class="calendar-dialog__station-list">${stationRows}</ul>
              </div>`
            : ''
        }
        ${
          canEditStations
            ? `<div class="calendar-dialog__stations-actions">
                <button type="button" class="btn btn--tiny" data-role="edit-stations">${icon('supervision')} Editar estaciones y trabajadores</button>
              </div>`
            : ''
        }
        ${
          role === 'supervisor'
            ? `<p class="calendar-dialog__privacy" data-role="sc08-note">Nombres reales con fines de ${SC08_NOTE}.</p>`
            : ''
        }
        ${
          isOrder && !event?.operator_name
            ? `<p class="calendar-dialog__alert" data-role="operator-alert">Orden sin operador asignado.</p>`
            : ''
        }
        ${
          canResolveMaintenance
            ? `<div class="calendar-dialog__resolve" data-role="resolve-area">
                <button type="button" class="btn btn--tiny btn--primary" data-role="resolve-maintenance">${icon(
                  'maintenance',
                )} Resolver</button>
              </div>`
            : ''
        }
        ${
          editable
            ? `<div class="calendar-dialog__edit">
                <label>Inicio
                  <input type="time" data-dialog-time="start" value="${escapeHtml(event?.start_time || '08:00')}" />
                </label>
                <label>Término
                  <input type="time" data-dialog-time="end" value="${escapeHtml(event?.end_time || '16:00')}" />
                </label>
                <button type="button" class="btn btn--tiny btn--primary" data-dialog-save>Guardar horario</button>
                <span class="form-error" data-dialog-error role="alert"></span>
              </div>`
            : `<p class="calendar-dialog__readonly">Solo lectura</p>`
        }
      </div>
    </section>`);

  const backdrop = el(`
    <div class="modal-backdrop" data-role="event-dialog-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Detalle de tarea" data-role="event-dialog-modal">
        <button type="button" class="modal__close" data-role="event-dialog-close" aria-label="Cerrar">×</button>
      </div>
    </div>`);
  backdrop.querySelector('.modal').appendChild(root);
  let closed = false;

  function close(after) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
    if (typeof after === 'function') after();
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close(onClose);
  }

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close(onClose);
  });
  backdrop.closeModal = () => close();
  document.body.appendChild(backdrop);
  document.addEventListener('keydown', onKeyDown);

  root.querySelector('[data-role="event-back"]').addEventListener('click', () => {
    close(onBack);
  });

  if (canResolveMaintenance) {
    const area = root.querySelector('[data-role="resolve-area"]');

    function renderResolveButton() {
      area.innerHTML = `<button type="button" class="btn btn--tiny btn--primary" data-role="resolve-maintenance">${icon(
        'maintenance',
      )} Resolver</button>`;
      area
        .querySelector('[data-role="resolve-maintenance"]')
        .addEventListener('click', openResolvePopup);
    }

    function openResolvePopup() {
      area.innerHTML = `
        <div class="calendar-dialog__resolve-popup" data-role="resolve-popup" role="dialog" aria-modal="true">
          <p class="calendar-dialog__resolve-message" data-role="resolve-message">¿Está seguro que quiere resolver esta mantención?</p>
          <form data-role="resolve-form" class="calendar-dialog__resolve-form">
            <label>Fecha y hora de resolución
              <input type="datetime-local" name="resolvedAt" required />
            </label>
            <span class="form-error" data-role="resolve-error" role="alert"></span>
            <div class="calendar-dialog__resolve-actions">
              <button type="button" class="btn btn--tiny" data-role="resolve-cancel">Cancelar</button>
              <button type="submit" class="btn btn--tiny btn--primary">Confirmar</button>
            </div>
          </form>
        </div>`;
      const input = area.querySelector('[name="resolvedAt"]');
      input.value = nowLocalInput();
      input.focus();
      area
        .querySelector('[data-role="resolve-cancel"]')
        .addEventListener('click', renderResolveButton);
      area.querySelector('[data-role="resolve-form"]').addEventListener('submit', (submitEvent) => {
        submitEvent.preventDefault();
        const errorEl = area.querySelector('[data-role="resolve-error"]');
        try {
          const resolvedAt = localToIso(input.value);
          if (!resolvedAt) throw new Error('Debe indicar una fecha y hora de resolución válida.');
          store.resolveScheduledMaintenance(
            event.id || `maintenance:${event.sourceId}`,
            { resolvedAt },
            'maintenance',
          );
          event.status = 'resolved';
          event.resolved_at = resolvedAt;
          area.innerHTML = `<p class="calendar-dialog__resolved" data-role="resolved-note">Solo lectura</p>`;
          showToast('Mantención resuelta', { tone: 'success' });
        } catch (error) {
          errorEl.textContent = error.message;
        }
      });
    }

    renderResolveButton();
  }

  if (canEditStations) {
    root.querySelector('[data-role="edit-stations"]').addEventListener('click', () => {
      store.setSupervisionFocusOrder(event.sourceId);
      const location = root.ownerDocument?.defaultView?.location || globalThis.location;
      if (location) location.hash = '#/supervision';
    });
  }

  if (editable) {
    root.querySelector('[data-dialog-save]').addEventListener('click', () => {
      const start = root.querySelector('[data-dialog-time="start"]').value;
      const end = root.querySelector('[data-dialog-time="end"]').value;
      const errorEl = root.querySelector('[data-dialog-error]');
      try {
        store.scheduleOrderRange(
          event.sourceId,
          {
            startDate: event.start_date,
            endDate: event.end_date,
            startTime: start,
            endTime: end,
          },
          role,
        );
        errorEl.textContent = '';
        showToast('Horario guardado', { tone: 'success' });
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  return backdrop;
}
